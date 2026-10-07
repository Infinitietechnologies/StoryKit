import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createMemoryStorageAdapter,
  createWebStorageAdapter,
  useStoryPersistence,
} from '../persistence';

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
});
