import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryStorageAdapter,
  createWebStorageAdapter,
  useStoryPersistence,
  type StoryPersistenceAdapter,
  type StoryPersistenceSnapshot,
} from '../persistence';

const makeSnapshot = (overrides: Partial<StoryPersistenceSnapshot> = {}): StoryPersistenceSnapshot => ({
  version: 1,
  viewedStoryIds: [],
  likedStoryIds: [],
  votes: {},
  updatedAt: 1,
  ...overrides,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const PersistenceHarness = ({ adapter }: { adapter: ReturnType<typeof createMemoryStorageAdapter> }) => {
  const persistence = useStoryPersistence({ adapter, key: 'account-1' });
  return (
    <>
      <output aria-label="ready">{String(persistence.ready)}</output>
      <output aria-label="viewed">{String(persistence.hasViewed('story-1'))}</output>
      <output aria-label="liked">{String(persistence.isLiked('story-1'))}</output>
      <button type="button" onClick={() => persistence.markViewed('story-1')}>view</button>
      <button type="button" onClick={() => persistence.setLiked('story-1', true)}>like</button>
    </>
  );
};

describe('story persistence', () => {
  it('survives hook unmounts through an adapter', async () => {
    const adapter = createMemoryStorageAdapter();
    const first = render(<PersistenceHarness adapter={adapter} />);
    await waitFor(() => expect(screen.getByLabelText('ready')).toHaveTextContent('true'));
    fireEvent.click(screen.getByRole('button', { name: 'view' }));
    fireEvent.click(screen.getByRole('button', { name: 'like' }));
    first.unmount();

    render(<PersistenceHarness adapter={adapter} />);
    await waitFor(() => expect(screen.getByLabelText('viewed')).toHaveTextContent('true'));
    expect(screen.getByLabelText('liked')).toHaveTextContent('true');
  });

  it('serializes snapshots through Web Storage', async () => {
    const adapter = createWebStorageAdapter({ storage: localStorage, prefix: 'test:' });
    const snapshot = {
      version: 1 as const,
      viewedStoryIds: ['story-1'],
      likedStoryIds: [],
      votes: { poll: 'A' as const },
      updatedAt: Date.now(),
    };
    await adapter.set('viewer', snapshot);
    expect(await adapter.get('viewer')).toEqual(snapshot);
    await adapter.remove?.('viewer');
    expect(await adapter.get('viewer')).toBeNull();
  });

  it('does not reload when an inline error callback changes', async () => {
    const adapter = { get: vi.fn(() => makeSnapshot()), set: vi.fn() };
    const onError = vi.fn();
    const hook = renderHook(() => useStoryPersistence({
      adapter, key: 'viewer', onError: (error) => onError(error),
    }));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    hook.rerender();
    hook.rerender();
    await act(async () => {});
    expect(adapter.get).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('isolates a new account from the previous account pending read', async () => {
    const previous = deferred<StoryPersistenceSnapshot>();
    const adapter: StoryPersistenceAdapter = {
      get: (key) => key === 'previous' ? previous.promise : makeSnapshot({ viewedStoryIds: ['new'] }),
      set: vi.fn(),
    };
    const hook = renderHook(({ account }) => useStoryPersistence({ adapter, key: account }), {
      initialProps: { account: 'previous' },
    });
    await act(async () => {});
    hook.rerender({ account: 'new' });
    expect(hook.result.current.ready).toBe(false);
    expect(hook.result.current.snapshot.viewedStoryIds).toEqual([]);
    await waitFor(() => expect(hook.result.current.hasViewed('new')).toBe(true));
    await act(async () => { previous.resolve(makeSnapshot({ viewedStoryIds: ['previous'] })); });
    expect(hook.result.current.snapshot.viewedStoryIds).toEqual(['new']);
    act(() => hook.result.current.markViewed('another'));
    await waitFor(() => expect(adapter.set).toHaveBeenCalledWith('new', expect.objectContaining({
      viewedStoryIds: ['new', 'another'],
    })));
  });

  it('ignores errors from an adapter that is no longer selected', async () => {
    const previous = deferred<StoryPersistenceSnapshot>();
    const original: StoryPersistenceAdapter = { get: () => previous.promise, set: vi.fn() };
    const replacement = createMemoryStorageAdapter({ viewer: makeSnapshot() });
    const onError = vi.fn();
    const hook = renderHook(({ adapter }) => useStoryPersistence({ adapter, key: 'viewer', onError }), {
      initialProps: { adapter: original },
    });
    await act(async () => {});
    hook.rerender({ adapter: replacement });
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    await act(async () => { previous.reject(new Error('obsolete adapter')); });
    expect(hook.result.current.error).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('uses the newest reload when reads complete out of order', async () => {
    const older = deferred<StoryPersistenceSnapshot>();
    const newer = deferred<StoryPersistenceSnapshot>();
    const adapter = {
      get: vi.fn().mockReturnValueOnce(makeSnapshot())
        .mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise),
      set: vi.fn(),
    };
    const hook = renderHook(() => useStoryPersistence({ adapter, key: 'viewer' }));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    act(() => { void hook.result.current.reload(); });
    await waitFor(() => expect(adapter.get).toHaveBeenCalledTimes(2));
    act(() => { void hook.result.current.reload(); });
    await waitFor(() => expect(adapter.get).toHaveBeenCalledTimes(3));
    await act(async () => { newer.resolve(makeSnapshot({ viewedStoryIds: ['newer'] })); });
    await act(async () => { older.resolve(makeSnapshot({ viewedStoryIds: ['older'] })); });
    expect(hook.result.current.snapshot.viewedStoryIds).toEqual(['newer']);
  });

  it('rebases mutations made before hydration onto the saved snapshot', async () => {
    const initial = deferred<StoryPersistenceSnapshot>();
    const adapter = { get: () => initial.promise, set: vi.fn() };
    const hook = renderHook(() => useStoryPersistence({ adapter, key: 'viewer' }));
    act(() => {
      hook.result.current.markViewed('new');
      hook.result.current.setLiked('new', true);
      hook.result.current.setVote('new-poll', 'B');
    });
    expect(hook.result.current.hasViewed('new')).toBe(true);
    expect(adapter.set).not.toHaveBeenCalled();
    await act(async () => { initial.resolve(makeSnapshot({
      viewedStoryIds: ['saved'], likedStoryIds: ['saved'], votes: { 'saved-poll': 'A' },
    })); });
    await waitFor(() => expect(adapter.set).toHaveBeenCalledTimes(1));
    expect(adapter.set).toHaveBeenCalledWith('viewer', expect.objectContaining({
      viewedStoryIds: ['saved', 'new'], likedStoryIds: ['saved', 'new'],
      votes: { 'saved-poll': 'A', 'new-poll': 'B' },
    }));
  });

  it('keeps local mutations when an already running reload returns stale data', async () => {
    const stale = deferred<StoryPersistenceSnapshot>();
    const adapter = {
      get: vi.fn().mockReturnValueOnce(makeSnapshot()).mockReturnValueOnce(stale.promise),
      set: vi.fn(),
    };
    const hook = renderHook(() => useStoryPersistence({ adapter, key: 'viewer' }));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    act(() => { void hook.result.current.reload(); });
    await waitFor(() => expect(adapter.get).toHaveBeenCalledTimes(2));
    act(() => hook.result.current.markViewed('new'));
    await act(async () => { stale.resolve(makeSnapshot()); });
    expect(hook.result.current.hasViewed('new')).toBe(true);
  });

  it('orders async writes and clear so older writes cannot restore cleared state', async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    let stored: StoryPersistenceSnapshot | null = null;
    const adapter = {
      get: () => stored,
      set: vi.fn(async (_key: string, value: StoryPersistenceSnapshot) => {
        await (adapter.set.mock.calls.length === 1 ? first.promise : second.promise);
        stored = value;
      }),
      remove: vi.fn(() => { stored = null; }),
    };
    const hook = renderHook(() => useStoryPersistence({ adapter, key: 'viewer' }));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    let cleared!: Promise<void>;
    act(() => {
      hook.result.current.markViewed('first');
      hook.result.current.markViewed('second');
      cleared = hook.result.current.clear();
    });
    await waitFor(() => expect(adapter.set).toHaveBeenCalledTimes(1));
    expect(adapter.remove).not.toHaveBeenCalled();
    await act(async () => { first.resolve(); });
    await waitFor(() => expect(adapter.set).toHaveBeenCalledTimes(2));
    expect(adapter.remove).not.toHaveBeenCalled();
    await act(async () => { second.resolve(); await cleared; });
    expect(adapter.set.mock.calls[1][1].viewedStoryIds).toEqual(['first', 'second']);
    expect(adapter.remove).toHaveBeenCalledTimes(1);
    expect(stored).toBeNull();
    expect(hook.result.current.snapshot.viewedStoryIds).toEqual([]);
  });

  it('clears buffered mutations and ignores an initial read completing after clear', async () => {
    const initial = deferred<StoryPersistenceSnapshot>();
    const adapter = { get: () => initial.promise, set: vi.fn(), remove: vi.fn() };
    const hook = renderHook(() => useStoryPersistence({ adapter, key: 'viewer' }));
    await act(async () => {});
    act(() => hook.result.current.markViewed('new'));
    await act(async () => { await hook.result.current.clear(); });
    await act(async () => { initial.resolve(makeSnapshot({ viewedStoryIds: ['saved'] })); });
    expect(adapter.set).not.toHaveBeenCalled();
    expect(adapter.remove).toHaveBeenCalledTimes(1);
    expect(hook.result.current.snapshot.viewedStoryIds).toEqual([]);
  });

  it('shares optimistic state and write ordering between hook instances', async () => {
    const firstWrite = deferred<void>();
    let stored: StoryPersistenceSnapshot | null = null;
    const adapter = {
      get: () => stored,
      set: vi.fn(async (_key: string, value: StoryPersistenceSnapshot) => {
        if (adapter.set.mock.calls.length === 1) await firstWrite.promise;
        stored = value;
      }),
    };
    const first = renderHook(() => useStoryPersistence({ adapter, key: 'viewer' }));
    const second = renderHook(() => useStoryPersistence({ adapter, key: 'viewer' }));
    await waitFor(() => expect(first.result.current.ready && second.result.current.ready).toBe(true));
    act(() => {
      first.result.current.markViewed('viewed');
      second.result.current.setLiked('liked', true);
    });
    expect(first.result.current.isLiked('liked')).toBe(true);
    expect(second.result.current.hasViewed('viewed')).toBe(true);
    await waitFor(() => expect(adapter.set).toHaveBeenCalledTimes(1));
    await act(async () => { firstWrite.resolve(); });
    await waitFor(() => expect(adapter.set).toHaveBeenCalledTimes(2));
    expect(stored).toMatchObject({ viewedStoryIds: ['viewed'], likedStoryIds: ['liked'] });
  });

  it('preserves queued writes across StrictMode unmount and rehydrates on remount', async () => {
    const writing = deferred<void>();
    let stored: StoryPersistenceSnapshot | null = null;
    const adapter = {
      get: () => stored,
      set: vi.fn(async (_key: string, value: StoryPersistenceSnapshot) => {
        await writing.promise;
        stored = value;
      }),
    };
    const wrapper = ({ children }: { children: React.ReactNode }) => <React.StrictMode>{children}</React.StrictMode>;
    const first = renderHook(() => useStoryPersistence({ adapter, key: 'viewer' }), { wrapper });
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    act(() => first.result.current.markViewed('queued'));
    await waitFor(() => expect(adapter.set).toHaveBeenCalledTimes(1));
    first.unmount();
    const second = renderHook(() => useStoryPersistence({ adapter, key: 'viewer' }), { wrapper });
    expect(second.result.current.ready).toBe(false);
    await act(async () => { writing.resolve(); });
    await waitFor(() => expect(second.result.current.ready).toBe(true));
    expect(second.result.current.hasViewed('queued')).toBe(true);
    second.unmount();
    stored = makeSnapshot({ viewedStoryIds: ['external'] });
    const third = renderHook(() => useStoryPersistence({ adapter, key: 'viewer' }));
    await waitFor(() => expect(third.result.current.ready).toBe(true));
    expect(third.result.current.snapshot.viewedStoryIds).toEqual(['external']);
  });

  it.each(['synchronous', 'asynchronous'])('reports %s write failures and keeps the queue usable', async (kind) => {
    const failure = new Error('quota');
    const adapter = {
      get: () => makeSnapshot(),
      set: vi.fn().mockImplementationOnce(() => {
        if (kind === 'synchronous') throw failure;
        return Promise.reject(failure);
      }),
    };
    const onError = vi.fn();
    const hook = renderHook(() => useStoryPersistence({ adapter, key: 'viewer', onError }));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(() => act(() => hook.result.current.markViewed('failed'))).not.toThrow();
    await waitFor(() => expect(hook.result.current.error).toBe(failure));
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    act(() => hook.result.current.markViewed('retry'));
    await waitFor(() => expect(adapter.set).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hook.result.current.error).toBeNull());
    expect(adapter.set.mock.calls[1][1].viewedStoryIds).toEqual(['failed', 'retry']);
  });

  it('reports invalid JSON and leaves unreadable saved state untouched', async () => {
    localStorage.setItem('test:viewer', '{');
    const adapter = createWebStorageAdapter({ storage: localStorage, prefix: 'test:' });
    const onError = vi.fn();
    const hook = renderHook(() => useStoryPersistence({ adapter, key: 'viewer', onError }));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.error).toBeInstanceOf(SyntaxError);
    act(() => hook.result.current.markViewed('new'));
    await act(async () => {});
    expect(localStorage.getItem('test:viewer')).toBe('{');
    expect(onError).toHaveBeenCalled();
  });

  it.each([
    { version: 1, viewedStoryIds: 'bad', likedStoryIds: ['like', 'like', 1], votes: null },
    { version: 1, viewedStoryIds: ['story', 'story', 1], likedStoryIds: null, votes: ['A'] },
    { version: 2, viewedStoryIds: ['old'], likedStoryIds: ['old'], votes: { old: 'A' } },
  ])('normalizes malformed snapshot fields without throwing: %j', async (stored) => {
    localStorage.setItem('test:viewer', JSON.stringify(stored));
    const adapter = createWebStorageAdapter({ storage: localStorage, prefix: 'test:' });
    const hook = renderHook(() => useStoryPersistence({ adapter, key: 'viewer' }));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.snapshot.viewedStoryIds).toEqual(stored.version === 1 && Array.isArray(stored.viewedStoryIds) ? ['story'] : []);
    expect(hook.result.current.snapshot.likedStoryIds).toEqual(Array.isArray(stored.likedStoryIds) && stored.version === 1 ? ['like'] : []);
    expect(hook.result.current.snapshot.votes).toEqual({});
    expect(Number.isFinite(hook.result.current.snapshot.updatedAt)).toBe(true);
  });

  it('handles vote keys matching Object prototype properties', async () => {
    const adapter = createMemoryStorageAdapter();
    const hook = renderHook(() => useStoryPersistence({ adapter, key: 'viewer' }));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.getVote('__proto__')).toBeNull();
    expect(hook.result.current.getVote('constructor')).toBeNull();
    act(() => hook.result.current.setVote('__proto__', 'A'));
    expect(hook.result.current.getVote('__proto__')).toBe('A');
    await waitFor(async () => expect((await adapter.get('viewer'))?.votes).toHaveProperty('__proto__', 'A'));
    act(() => hook.result.current.setVote('__proto__', null));
    expect(hook.result.current.getVote('__proto__')).toBeNull();
  });

  it('updates hooks after another Web Storage adapter writes or removes in the same document', async () => {
    const adapter = createWebStorageAdapter({ storage: localStorage, prefix: 'test:' });
    const external = createWebStorageAdapter({ storage: localStorage, prefix: 'test:' });
    const hook = renderHook(() => useStoryPersistence({ adapter, key: 'viewer' }));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    act(() => external.set('viewer', makeSnapshot({ viewedStoryIds: ['external'] })));
    await waitFor(() => expect(hook.result.current.hasViewed('external')).toBe(true));
    act(() => external.remove?.('viewer'));
    await waitFor(() => expect(hook.result.current.snapshot.viewedStoryIds).toEqual([]));
  });

  it('observes external writes arriving while an async acknowledgement is pending', async () => {
    const acknowledgement = deferred<void>();
    let stored = makeSnapshot();
    let notify!: () => void;
    const adapter: StoryPersistenceAdapter = {
      get: () => stored,
      set: vi.fn((_key, value) => {
        stored = value;
        notify();
        return acknowledgement.promise;
      }),
      subscribe: (_key, listener) => {
        notify = listener;
        return () => {};
      },
    };
    const hook = renderHook(() => useStoryPersistence({ adapter, key: 'viewer' }));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    act(() => hook.result.current.markViewed('local'));
    await waitFor(() => expect(adapter.set).toHaveBeenCalledTimes(1));
    act(() => {
      stored = makeSnapshot({ viewedStoryIds: ['external'] });
      notify();
    });
    await act(async () => { acknowledgement.resolve(); });
    await waitFor(() => expect(hook.result.current.snapshot.viewedStoryIds).toEqual(['external']));
  });

  it('reloads after a cross-document storage clear event', async () => {
    const adapter = createWebStorageAdapter({ storage: localStorage, prefix: 'test:' });
    adapter.set('viewer', makeSnapshot({ viewedStoryIds: ['saved'] }));
    const hook = renderHook(() => useStoryPersistence({ adapter, key: 'viewer' }));
    await waitFor(() => expect(hook.result.current.hasViewed('saved')).toBe(true));
    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage }));
    });
    await waitFor(() => expect(hook.result.current.snapshot.viewedStoryIds).toEqual([]));
  });
});
