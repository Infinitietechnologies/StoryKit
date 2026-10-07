import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface StoryPersistenceSnapshot {
  version: 1;
  viewedStoryIds: string[];
  likedStoryIds: string[];
  votes: Record<string, 'A' | 'B'>;
  updatedAt: number;
}

export interface StoryPersistenceAdapter {
  get(key: string): StoryPersistenceSnapshot | null | Promise<StoryPersistenceSnapshot | null>;
  set(key: string, value: StoryPersistenceSnapshot): void | Promise<void>;
  remove?(key: string): void | Promise<void>;
  /** Notify consumers when an external writer changes this key. */
  subscribe?(key: string, listener: () => void): () => void;
}

export interface UseStoryPersistenceOptions {
  adapter: StoryPersistenceAdapter;
  key: string;
  onError?: (error: Error) => void;
}

const emptySnapshot = (): StoryPersistenceSnapshot => ({
  version: 1,
  viewedStoryIds: [],
  likedStoryIds: [],
  votes: {},
  updatedAt: Date.now(),
});

const normalizeSnapshot = (value: StoryPersistenceSnapshot | null): StoryPersistenceSnapshot => {
  if (!value || value.version !== 1) return emptySnapshot();
  return {
    version: 1,
    viewedStoryIds: [...new Set(value.viewedStoryIds.filter((id) => typeof id === 'string'))],
    likedStoryIds: [...new Set(value.likedStoryIds.filter((id) => typeof id === 'string'))],
    votes: Object.fromEntries(
      Object.entries(value.votes).filter((entry): entry is [string, 'A' | 'B'] =>
        entry[1] === 'A' || entry[1] === 'B'),
    ),
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now(),
  };
};

const toError = (value: unknown) => value instanceof Error ? value : new Error(String(value));

export const createWebStorageAdapter = (options: {
  storage?: Storage;
  prefix?: string;
} = {}): StoryPersistenceAdapter => {
  const prefix = options.prefix ?? 'react-storykit:';
  const resolveStorage = () =>
    options.storage ?? (typeof window === 'undefined' ? null : window.localStorage);
  const storageKey = (key: string) => `${prefix}${key}`;

  return {
    get(key) {
      const storage = resolveStorage();
      const raw = storage?.getItem(storageKey(key));
      if (!raw) return null;
      return JSON.parse(raw) as StoryPersistenceSnapshot;
    },
    set(key, value) {
      resolveStorage()?.setItem(storageKey(key), JSON.stringify(value));
    },
    remove(key) {
      resolveStorage()?.removeItem(storageKey(key));
    },
    subscribe(key, listener) {
      if (typeof window === 'undefined') return () => undefined;
      const target = resolveStorage();
      const handleStorage = (event: StorageEvent) => {
        if (event.storageArea === target && event.key === storageKey(key)) listener();
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    },
  };
};

export const createMemoryStorageAdapter = (
  initial: Record<string, StoryPersistenceSnapshot> = {},
): StoryPersistenceAdapter => {
  const values = new Map(Object.entries(initial));
  const listeners = new Map<string, Set<() => void>>();
  const notify = (key: string) => listeners.get(key)?.forEach((listener) => listener());

  return {
    get: (key) => values.get(key) ?? null,
    set(key, value) {
      values.set(key, value);
      notify(key);
    },
    remove(key) {
      values.delete(key);
      notify(key);
    },
    subscribe(key, listener) {
      const keyListeners = listeners.get(key) ?? new Set();
      keyListeners.add(listener);
      listeners.set(key, keyListeners);
      return () => keyListeners.delete(listener);
    },
  };
};

export const useStoryPersistence = ({ adapter, key, onError }: UseStoryPersistenceOptions) => {
  const [snapshot, setSnapshot] = useState<StoryPersistenceSnapshot>(emptySnapshot);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const snapshotRef = useRef(snapshot);
  const mutationVersionRef = useRef(0);
  snapshotRef.current = snapshot;

  const reportError = useCallback((value: unknown) => {
    const nextError = toError(value);
    setError(nextError);
    onError?.(nextError);
  }, [onError]);

  const load = useCallback(async () => {
    const mutationVersion = mutationVersionRef.current;
    try {
      const loaded = normalizeSnapshot(await adapter.get(key));
      if (mutationVersion === mutationVersionRef.current) {
        snapshotRef.current = loaded;
        setSnapshot(loaded);
      }
      setError(null);
    } catch (loadError) {
      reportError(loadError);
    } finally {
      setReady(true);
    }
  }, [adapter, key, reportError]);

  useEffect(() => {
    setReady(false);
    void load();
    return adapter.subscribe?.(key, () => void load());
  }, [adapter, key, load]);

  const commit = useCallback((update: (current: StoryPersistenceSnapshot) => StoryPersistenceSnapshot) => {
    mutationVersionRef.current += 1;
    const next = { ...update(snapshotRef.current), version: 1 as const, updatedAt: Date.now() };
    snapshotRef.current = next;
    setSnapshot(next);
    Promise.resolve(adapter.set(key, next)).catch(reportError);
  }, [adapter, key, reportError]);

  const viewedIds = useMemo(() => new Set(snapshot.viewedStoryIds), [snapshot.viewedStoryIds]);
  const likedIds = useMemo(() => new Set(snapshot.likedStoryIds), [snapshot.likedStoryIds]);

  const markViewed = useCallback((storyId: string) => commit((current) =>
    current.viewedStoryIds.includes(storyId)
      ? current
      : { ...current, viewedStoryIds: [...current.viewedStoryIds, storyId] }), [commit]);

  const setLiked = useCallback((storyId: string, liked: boolean) => commit((current) => ({
    ...current,
    likedStoryIds: liked
      ? [...new Set([...current.likedStoryIds, storyId])]
      : current.likedStoryIds.filter((id) => id !== storyId),
  })), [commit]);

  const setVote = useCallback((key: string, vote: 'A' | 'B' | null) => commit((current) => {
    const votes = { ...current.votes };
    if (vote) votes[key] = vote;
    else delete votes[key];
    return { ...current, votes };
  }), [commit]);

  const clear = useCallback(async () => {
    mutationVersionRef.current += 1;
    const next = emptySnapshot();
    snapshotRef.current = next;
    setSnapshot(next);
    try {
      if (adapter.remove) await adapter.remove(key);
      else await adapter.set(key, next);
      setError(null);
    } catch (clearError) {
      reportError(clearError);
    }
  }, [adapter, key, reportError]);

  return {
    snapshot,
    ready,
    error,
    viewedIds,
    likedIds,
    hasViewed: (storyId: string) => viewedIds.has(storyId),
    isLiked: (storyId: string) => likedIds.has(storyId),
    getVote: (voteKey: string) => snapshot.votes[voteKey] ?? null,
    markViewed,
    setLiked,
    setVote,
    clear,
    reload: load,
  };
};
