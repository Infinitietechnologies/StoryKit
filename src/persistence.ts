import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

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

const normalizeSnapshot = (value: unknown): StoryPersistenceSnapshot => {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) {
    return emptySnapshot();
  }
  const stored = value as Partial<StoryPersistenceSnapshot>;
  const ids = (value: unknown) => Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === 'string'))]
    : [];
  const votes = stored.votes && typeof stored.votes === 'object' && !Array.isArray(stored.votes)
    ? stored.votes
    : {};
  return {
    version: 1,
    viewedStoryIds: ids(stored.viewedStoryIds),
    likedStoryIds: ids(stored.likedStoryIds),
    votes: Object.fromEntries(
      Object.entries(votes).filter((entry): entry is [string, 'A' | 'B'] =>
        entry[1] === 'A' || entry[1] === 'B'),
    ),
    updatedAt: typeof stored.updatedAt === 'number' && Number.isFinite(stored.updatedAt)
      ? stored.updatedAt
      : Date.now(),
  };
};

const toError = (value: unknown) => value instanceof Error ? value : new Error(String(value));

// Native storage events reach other documents; this bus also reaches adapters in this one.
const storageListeners = new WeakMap<Storage, Map<string, Set<() => void>>>();
const notifyStorage = (storage: Storage, key: string) =>
  storageListeners.get(storage)?.get(key)?.forEach((listener) => listener());

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
      const storage = resolveStorage();
      storage?.setItem(storageKey(key), JSON.stringify(value));
      if (storage) notifyStorage(storage, storageKey(key));
    },
    remove(key) {
      const storage = resolveStorage();
      storage?.removeItem(storageKey(key));
      if (storage) notifyStorage(storage, storageKey(key));
    },
    subscribe(key, listener) {
      if (typeof window === 'undefined') return () => undefined;
      const target = resolveStorage();
      if (!target) return () => undefined;
      const keys = storageListeners.get(target) ?? new Map<string, Set<() => void>>();
      const listeners = keys.get(storageKey(key)) ?? new Set<() => void>();
      listeners.add(listener);
      keys.set(storageKey(key), listeners);
      storageListeners.set(target, keys);
      const handleStorage = (event: StorageEvent) => {
        if (event.storageArea === target && (event.key === null || event.key === storageKey(key))) {
          listener();
        }
      };
      window.addEventListener('storage', handleStorage);
      return () => {
        window.removeEventListener('storage', handleStorage);
        listeners.delete(listener);
        if (!listeners.size) keys.delete(storageKey(key));
      };
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

type SnapshotUpdate = (current: StoryPersistenceSnapshot) => StoryPersistenceSnapshot;
interface PersistenceState {
  snapshot: StoryPersistenceSnapshot;
  ready: boolean;
  error: Error | null;
}

const createPersistenceStore = (adapter: StoryPersistenceAdapter, key: string) => {
  const initialState: PersistenceState = { snapshot: emptySnapshot(), ready: false, error: null };
  let state = initialState;
  const listeners = new Set<() => void>();
  let unsubscribe: (() => void) | undefined;
  let hydrated = false;
  let loading = false;
  let loadVersion = 0;
  let mutationVersion = 0;
  let pendingUpdates: SnapshotUpdate[] = [];
  let writeTail = Promise.resolve();
  let writing = false;

  const publish = (next: PersistenceState) => {
    state = { ...next, ready: listeners.size > 0 && next.ready };
    listeners.forEach((listener) => listener());
  };
  const reportError = (error: unknown) => publish({ ...state, error: toError(error) });
  const applyUpdate = (snapshot: StoryPersistenceSnapshot, update: SnapshotUpdate) => ({
    ...update(snapshot), version: 1 as const, updatedAt: Date.now(),
  });
  // Shared by every hook using this adapter/key, including writes surviving unmounts.
  const enqueue = (operation: () => void | Promise<void>) => {
    writeTail = writeTail.then(async () => {
      writing = true;
      try {
        const pending = operation();
        // Suppress only notifications on this call stack. External writers may
        // update the key while an asynchronous write acknowledgement is pending.
        writing = false;
        await pending;
        publish({ ...state, error: null });
      } catch (error) {
        reportError(error);
      } finally {
        writing = false;
      }
    });
    return writeTail;
  };

  const load = async () => {
    const version = ++loadVersion;
    loading = true;
    try {
      // A reload must not read a snapshot preceding our outstanding writes/removal.
      await writeTail;
      if (version !== loadVersion) return;
      const mutation = mutationVersion;
      const loaded = normalizeSnapshot(await adapter.get(key));
      if (version !== loadVersion) return;
      if (hydrated && mutation !== mutationVersion) {
        publish({ ...state, ready: true });
        return;
      }
      const buffered = pendingUpdates;
      pendingUpdates = [];
      const snapshot = buffered.reduce(applyUpdate, loaded);
      hydrated = true;
      publish({ snapshot, ready: true, error: null });
      if (buffered.length) void enqueue(() => adapter.set(key, snapshot));
    } catch (error) {
      if (version === loadVersion) {
        publish({ ...state, ready: true, error: toError(error) });
      }
    } finally {
      if (version === loadVersion) loading = false;
    }
  };

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => initialState,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        // Reconnects rehydrate so an idle store does not hide external changes.
        hydrated = false;
        publish({ ...state, ready: false });
        try {
          unsubscribe = adapter.subscribe?.(key, () => {
            // Memory/Web Storage adapters notify synchronously during our own write.
            if (!writing) void load();
          });
        } catch (error) {
          reportError(error);
        }
        void load();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          unsubscribe?.();
          unsubscribe = undefined;
          state = { ...state, ready: false };
        }
      };
    },
    update(update: SnapshotUpdate) {
      mutationVersion += 1;
      const snapshot = applyUpdate(state.snapshot, update);
      publish({ ...state, snapshot });
      if (hydrated) void enqueue(() => adapter.set(key, snapshot));
      else {
        pendingUpdates.push(update);
        if (!loading) void load();
      }
    },
    clear() {
      loadVersion += 1;
      loading = false;
      mutationVersion += 1;
      hydrated = true;
      pendingUpdates = [];
      const snapshot = emptySnapshot();
      publish({ ...state, snapshot, ready: true });
      return enqueue(() => adapter.remove ? adapter.remove(key) : adapter.set(key, snapshot));
    },
    reload: load,
  };
};

const persistenceStores = new WeakMap<StoryPersistenceAdapter,
  Map<string, ReturnType<typeof createPersistenceStore>>>();
const getPersistenceStore = (adapter: StoryPersistenceAdapter, key: string) => {
  const stores = persistenceStores.get(adapter)
    ?? new Map<string, ReturnType<typeof createPersistenceStore>>();
  let store = stores.get(key);
  if (!store) {
    store = createPersistenceStore(adapter, key);
    stores.set(key, store);
    persistenceStores.set(adapter, stores);
  }
  return store;
};

export const useStoryPersistence = ({ adapter, key, onError }: UseStoryPersistenceOptions) => {
  const store = useMemo(() => getPersistenceStore(adapter, key), [adapter, key]);
  const { snapshot, ready, error } = useSyncExternalStore(
    store.subscribe, store.getSnapshot, store.getServerSnapshot,
  );
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => {
    if (error) onErrorRef.current?.(error);
  }, [error, store]);
  const commit = store.update;

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
    if (vote) return { ...current, votes: { ...votes, [key]: vote } };
    else delete votes[key];
    return { ...current, votes };
  }), [commit]);

  return {
    snapshot,
    ready,
    error,
    viewedIds,
    likedIds,
    hasViewed: (storyId: string) => viewedIds.has(storyId),
    isLiked: (storyId: string) => likedIds.has(storyId),
    getVote: (voteKey: string) => Object.prototype.hasOwnProperty.call(snapshot.votes, voteKey)
      ? snapshot.votes[voteKey]
      : null,
    markViewed,
    setLiked,
    setVote,
    clear: store.clear,
    reload: store.reload,
  };
};
