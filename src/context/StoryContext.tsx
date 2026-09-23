import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { StoryActions, StoryItem, StoryState, ViewerConfig } from '../types';

interface StoryContextType extends StoryState, StoryActions {
  stories: StoryItem[];
  config: ViewerConfig;
}

const StoryContext = createContext<StoryContextType | undefined>(undefined);

export const StoryProvider: React.FC<{
  stories: StoryItem[];
  config?: ViewerConfig;
  children: React.ReactNode;
}> = ({ stories, config = {}, children }) => {
  const {
    defaultDuration = 5000,
    preloadCount = 2,
    initialStoryIndex = 0,
  } = config;

  // ── React state (only values that drive renders) ─────────────────────────
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.min(Math.max(0, initialStoryIndex), Math.max(0, stories.length - 1))
  );
  const [isPaused, setIsPaused] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep config in a ref to avoid re-triggering effects when parent passes inline callbacks
  const configRef = useRef(config);
  configRef.current = config;

  // Track story IDs that have already fired onStoryViewed during this session
  const viewedIdsRef = useRef<Set<string>>(new Set());
  const lastReportedStoryIdRef = useRef<string | null>(null);

  // Sync activeIndex if initialStoryIndex changes or if stories list switches to a new user
  const initialIndexRef = useRef(initialStoryIndex);
  const prevStoriesRef = useRef(stories);

  useEffect(() => {
    if (prevStoriesRef.current !== stories) {
      prevStoriesRef.current = stories;
      const clamped = Math.min(Math.max(0, initialStoryIndex), Math.max(0, stories.length - 1));
      initialIndexRef.current = clamped;
      setActiveIndex(clamped);
      setIsLoaded(false);
      setIsBuffering(false);
      setError(null);
      viewedIdsRef.current.clear();
      lastReportedStoryIdRef.current = null;
      segmentRefs.current.forEach((el, i) => {
        if (el) el.style.transform = i < clamped ? 'scaleX(1)' : 'scaleX(0)';
      });
    }
  }, [stories, initialStoryIndex]);

  // Notify parent on story change (strictly once per story transition)
  useEffect(() => {
    const currentStory = stories[activeIndex];
    if (currentStory && currentStory.id !== lastReportedStoryIdRef.current) {
      lastReportedStoryIdRef.current = currentStory.id;
      configRef.current.onStoryChange?.(activeIndex, currentStory);
    }
  }, [activeIndex, stories]);

  // Notify parent when media has actually loaded and is actively displayed to the user (strictly once per story)
  useEffect(() => {
    const currentStory = stories[activeIndex];
    if (isLoaded && currentStory && !viewedIdsRef.current.has(currentStory.id)) {
      viewedIdsRef.current.add(currentStory.id);
      configRef.current.onStoryViewed?.(activeIndex, currentStory);
    }
  }, [isLoaded, activeIndex, stories]);

  // ── Refs mirroring hot-path state (read inside rAF without stale closures) ─
  const isPausedRef = useRef(false);
  const isLoadedRef = useRef(false);
  const isBufferingRef = useRef(false);
  isPausedRef.current = isPaused;
  isLoadedRef.current = isLoaded;
  isBufferingRef.current = isBuffering;

  // ── DOM refs for progress fill bars: scaleX written directly, no React ────
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ── rAF handle ────────────────────────────────────────────────────────────
  const rafRef = useRef<number>(0);

  // ── Is current story a video? Set synchronously at render time ───────────
  const isVideo = stories[activeIndex]?.type === 'video';

  // Active index ref so callbacks remain completely stable without recreating
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  // ── Stable callbacks ──────────────────────────────────────────────────────
  const setSegmentRef = useCallback(
    (index: number, el: HTMLDivElement | null) => {
      segmentRefs.current[index] = el;
      if (el) {
        el.style.transform = index < activeIndexRef.current ? 'scaleX(1)' : 'scaleX(0)';
      }
    },
    [],
  );

  /** Write a 0-1 fraction as scaleX directly to the DOM element */
  const writeProgress = useCallback((index: number, fraction: number) => {
    const el = segmentRefs.current[index];
    if (el) el.style.transform = `scaleX(${Math.min(1, Math.max(0, fraction))})`;
  }, []);

  /** Called by video onTimeUpdate (valuePct = 0-100) */
  const seekVideoProgress = useCallback(
    (index: number, valuePct: number) => {
      writeProgress(index, valuePct / 100);
    },
    [writeProgress],
  );

  const next = useCallback(() => {
    setActiveIndex((prev) => {
      if (stories[prev]) {
        configRef.current.onStoryEnd?.(prev, stories[prev]);
      }
      const n = prev + 1;
      if (n < stories.length) return n;
      configRef.current.onAllStoriesEnd?.();
      return prev;
    });
  }, [stories]);

  const prev = useCallback(() => {
    setActiveIndex((prevIdx) => {
      if (prevIdx === 0) {
        configRef.current.onStartReached?.();
        return 0;
      }
      return prevIdx - 1;
    });
  }, []);

  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);
  const toggleMute = useCallback(() => setIsMuted((v) => !v), []);

  const reset = useCallback(
    (targetIndex = 0) => {
      const idx = Math.min(Math.max(0, targetIndex), Math.max(0, stories.length - 1));
      setActiveIndex(idx);
      setIsPaused(false);
      segmentRefs.current.forEach((el, i) => {
        if (el) el.style.transform = i < idx ? 'scaleX(1)' : 'scaleX(0)';
      });
    },
    [stories.length],
  );

  // ── Preloading engine ─────────────────────────────────────────────────────
  useEffect(() => {
    for (let i = 1; i <= preloadCount; i++) {
      const story = stories[activeIndex + i];
      if (!story) break;
      if (story.type === 'image') {
        const img = new Image();
        img.src = story.url;
      } else {
        const selector = `link[rel="preload"][as="video"][href="${story.url}"]`;
        if (!document.head.querySelector(selector)) {
          const link = document.createElement('link');
          link.rel = 'preload';
          link.as = 'video';
          link.href = story.url;
          document.head.appendChild(link);
        }
      }
    }
  }, [activeIndex, stories, preloadCount]);

  // ── Reset on story change ─────────────────────────────────────────────────
  useEffect(() => {
    setIsLoaded(false);
    setIsBuffering(false);
    setError(null);

    // Snap past stories to full, current + future to empty
    segmentRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.transform = i < activeIndex ? 'scaleX(1)' : 'scaleX(0)';
    });
  }, [activeIndex, stories]);

  // ── rAF animation loop — images only, reads refs (never stale) ───────────
  useEffect(() => {
    if (isVideo) return; // videos drive their own progress via onTimeUpdate

    cancelAnimationFrame(rafRef.current);

    let localStart: number | null = null;
    let localElapsed = 0;

    const tick = (time: number) => {
      const paused = isPausedRef.current;
      const loaded = isLoadedRef.current;
      const buffering = isBufferingRef.current;

      if (loaded && !paused && !buffering) {
        // Start or resume the timer
        if (localStart === null) localStart = time - localElapsed;
        localElapsed = time - localStart;

        const duration = stories[activeIndex]?.duration ?? defaultDuration;
        const fraction = localElapsed / duration;
        writeProgress(activeIndex, fraction);

        if (fraction >= 1) {
          writeProgress(activeIndex, 1);
          if (stories[activeIndex]) {
            configRef.current.onStoryEnd?.(activeIndex, stories[activeIndex]);
          }
          if (activeIndex >= stories.length - 1) {
            configRef.current.onAllStoriesEnd?.();
          } else {
            setActiveIndex(activeIndex + 1);
          }
          return; // stop loop — new activeIndex triggers a fresh effect
        }
      } else {
        // Paused/buffering/loading: keep localStart in sync to avoid time jump on resume
        if (localStart !== null) localStart = time - localElapsed;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // We intentionally exclude isPaused/isLoaded/isBuffering — they are read via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, isVideo, stories, defaultDuration, writeProgress]);

  const value: StoryContextType = {
    activeIndex,
    isPaused,
    isLoaded,
    isBuffering,
    isMuted,
    error,
    stories,
    config,
    next,
    prev,
    pause,
    resume,
    setLoaded: setIsLoaded,
    setBuffering: setIsBuffering,
    toggleMute,
    reset,
    setError,
    setSegmentRef,
    seekVideoProgress,
  };

  return <StoryContext.Provider value={value}>{children}</StoryContext.Provider>;
};

export const useStory = (): StoryContextType => {
  const ctx = useContext(StoryContext);
  if (!ctx) throw new Error('useStory must be used within a StoryProvider');
  return ctx;
};
