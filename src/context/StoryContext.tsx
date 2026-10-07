import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StoryActions, StoryItem, StoryState, ViewerConfig } from '../types';

interface StoryContextType extends StoryState, StoryActions {
  stories: StoryItem[];
  config: ViewerConfig;
}

interface PlaybackState {
  activeIndex: number;
  playbackKey: number;
  storiesIdentity: string;
  initialStoryIndex: number;
  mediaIdentity: string;
}

interface MediaState {
  playbackKey: number;
  isLoaded: boolean;
  isBuffering: boolean;
  error: string | null;
}

const StoryContext = createContext<StoryContextType | undefined>(undefined);
const clampIndex = (index: number, length: number) =>
  Math.min(Math.max(0, index), Math.max(0, length - 1));
const identifyMedia = (story?: StoryItem) => JSON.stringify([story?.id, story?.type, story?.url]);
const emptyMedia = (playbackKey: number): MediaState => ({
  playbackKey,
  isLoaded: false,
  isBuffering: false,
  error: null,
});

export const StoryProvider: React.FC<{
  stories: StoryItem[];
  config?: ViewerConfig;
  children: React.ReactNode;
}> = ({ stories, config = {}, children }) => {
  const {
    defaultDuration = 5000,
    defaultMuted = true,
    preloadCount = 2,
    initialStoryIndex = 0,
  } = config;
  const storiesIdentity = JSON.stringify(stories.map((story) => story.id));
  const [playback, setPlayback] = useState<PlaybackState>(() => {
    const activeIndex = clampIndex(initialStoryIndex, stories.length);
    return {
      activeIndex,
      playbackKey: 0,
      storiesIdentity,
      initialStoryIndex,
      mediaIdentity: identifyMedia(stories[activeIndex]),
    };
  });
  const [media, setMedia] = useState<MediaState>(() => emptyMedia(0));
  const [pauseReasons, setPauseReasons] = useState<Set<string>>(() => new Set());
  const [isMuted, setIsMuted] = useState(defaultMuted);

  // Adjust selection before committing children, so new media never inherits
  // readiness or errors from the previous collection or source URL.
  const collectionChanged = playback.storiesIdentity !== storiesIdentity;
  const selectionChanged = collectionChanged || playback.initialStoryIndex !== initialStoryIndex;
  const selectedIndex = selectionChanged
    ? clampIndex(initialStoryIndex, stories.length)
    : playback.activeIndex;
  const mediaIdentity = identifyMedia(stories[selectedIndex]);
  if (selectionChanged || playback.mediaIdentity !== mediaIdentity) {
    setPlayback({
      activeIndex: selectedIndex,
      playbackKey: playback.playbackKey + 1,
      storiesIdentity,
      initialStoryIndex,
      mediaIdentity,
    });
  }

  const { activeIndex, playbackKey } = playback;
  const currentStory = stories[activeIndex];
  const isPaused = pauseReasons.size > 0;
  const isLoaded = media.playbackKey === playbackKey && media.isLoaded;
  const isBuffering = media.playbackKey === playbackKey && media.isBuffering;
  const error = media.playbackKey === playbackKey ? media.error : null;

  const configRef = useRef(config);
  const storiesRef = useRef(stories);
  const playbackRef = useRef(playback);
  const pauseReasonsRef = useRef(pauseReasons);
  configRef.current = config;
  storiesRef.current = stories;
  playbackRef.current = playback;
  pauseReasonsRef.current = pauseReasons;

  const viewedRef = useRef({ storiesIdentity, ids: new Set<string>() });
  const lastReportedStoryRef = useRef<string | null>(null);
  const endedPlaybackRef = useRef<number | null>(null);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const imageClockRef = useRef<{ previousTime: number | null; elapsed: number }>({
    previousTime: null,
    elapsed: 0,
  });

  useEffect(() => {
    const story = storiesRef.current[activeIndex];
    const identity = JSON.stringify([storiesIdentity, activeIndex, story?.id]);
    if (story && identity !== lastReportedStoryRef.current) {
      lastReportedStoryRef.current = identity;
      configRef.current.onStoryChange?.(activeIndex, story);
    }
  }, [activeIndex, currentStory?.id, storiesIdentity]);

  useEffect(() => {
    if (viewedRef.current.storiesIdentity !== storiesIdentity) {
      viewedRef.current = { storiesIdentity, ids: new Set() };
    }
    const story = storiesRef.current[activeIndex];
    if (isLoaded && story && !viewedRef.current.ids.has(story.id)) {
      viewedRef.current.ids.add(story.id);
      configRef.current.onStoryViewed?.(activeIndex, story);
    }
  }, [isLoaded, activeIndex, currentStory?.id, storiesIdentity]);

  // Each media callback captures its playback key. Late events from outgoing
  // media cannot mark the incoming story loaded, buffering, or failed.
  const setLoaded = useCallback((value: boolean) => {
    if (playbackRef.current.playbackKey !== playbackKey) return;
    if (!value) imageClockRef.current.previousTime = null;
    setMedia((previous) => ({
      ...(previous.playbackKey === playbackKey ? previous : emptyMedia(playbackKey)),
      isLoaded: value,
    }));
  }, [playbackKey]);
  const setBuffering = useCallback((value: boolean) => {
    if (playbackRef.current.playbackKey !== playbackKey) return;
    if (value) imageClockRef.current.previousTime = null;
    setMedia((previous) => ({
      ...(previous.playbackKey === playbackKey ? previous : emptyMedia(playbackKey)),
      isBuffering: value,
    }));
  }, [playbackKey]);
  const setError = useCallback((value: string | null) => {
    if (playbackRef.current.playbackKey !== playbackKey) return;
    setMedia((previous) => ({
      ...(previous.playbackKey === playbackKey ? previous : emptyMedia(playbackKey)),
      error: value,
    }));
  }, [playbackKey]);

  const selectStory = useCallback((index: number) => {
    const previous = playbackRef.current;
    const nextPlayback = {
      ...previous,
      activeIndex: index,
      playbackKey: previous.playbackKey + 1,
      mediaIdentity: identifyMedia(storiesRef.current[index]),
    };
    playbackRef.current = nextPlayback;
    imageClockRef.current = { previousTime: null, elapsed: 0 };
    setPlayback(nextPlayback);
  }, []);

  const next = useCallback(() => {
    const { activeIndex: index, playbackKey: key } = playbackRef.current;
    const currentStories = storiesRef.current;
    const story = currentStories[index];
    if (!story || endedPlaybackRef.current === key) return;
    const isLast = index >= currentStories.length - 1;
    if (isLast) endedPlaybackRef.current = key;
    else selectStory(index + 1);
    // External callbacks run in the action, never in a React state updater.
    configRef.current.onStoryEnd?.(index, story);
    if (isLast) configRef.current.onAllStoriesEnd?.();
  }, [selectStory]);

  const prev = useCallback(() => {
    const index = playbackRef.current.activeIndex;
    if (index === 0) {
      configRef.current.onStartReached?.();
      return;
    }
    selectStory(index - 1);
  }, [selectStory]);

  const pause = useCallback((reason = 'manual') => {
    if (pauseReasonsRef.current.has(reason)) return;
    // Browsers can stop delivering frames in hidden tabs. Clear the previous
    // timestamp immediately instead of waiting for a paused frame to arrive.
    imageClockRef.current.previousTime = null;
    const reasons = new Set(pauseReasonsRef.current);
    reasons.add(reason);
    pauseReasonsRef.current = reasons;
    setPauseReasons(reasons);
  }, []);
  const resume = useCallback((reason = 'manual') => {
    if (!pauseReasonsRef.current.has(reason)) return;
    const reasons = new Set(pauseReasonsRef.current);
    reasons.delete(reason);
    pauseReasonsRef.current = reasons;
    setPauseReasons(reasons);
  }, []);
  const toggleMute = useCallback(() => setIsMuted((value) => !value), []);
  const reset = useCallback((targetIndex = 0) => {
    selectStory(clampIndex(targetIndex, storiesRef.current.length));
    const reasons = new Set(pauseReasonsRef.current);
    reasons.delete('manual');
    pauseReasonsRef.current = reasons;
    setPauseReasons(pauseReasonsRef.current);
  }, [selectStory]);

  const setSegmentRef = useCallback((index: number, element: HTMLDivElement | null) => {
    segmentRefs.current[index] = element;
    if (element) {
      element.style.transform = index < playbackRef.current.activeIndex ? 'scaleX(1)' : 'scaleX(0)';
    }
  }, []);
  const writeProgress = useCallback((index: number, fraction: number) => {
    const element = segmentRefs.current[index];
    if (element) element.style.transform = 'scaleX(' + Math.min(1, Math.max(0, fraction)) + ')';
  }, []);
  const seekVideoProgress = useCallback((index: number, valuePct: number) => {
    writeProgress(index, valuePct / 100);
  }, [writeProgress]);

  const preloadIdentity = JSON.stringify(stories.slice(activeIndex + 1, activeIndex + 1 + preloadCount)
    .map((story) => [story.type, story.url]));
  useEffect(() => {
    const appendedLinks: HTMLLinkElement[] = [];
    for (let i = 1; i <= preloadCount; i++) {
      const story = storiesRef.current[activeIndex + i];
      if (!story) break;
      if (story.type === 'image') {
        const image = new Image();
        image.src = story.url;
      } else {
        const alreadyPreloaded = Array.from(
          document.head.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="video"]'),
        ).some((link) => link.getAttribute('href') === story.url);
        if (!alreadyPreloaded) {
          const link = document.createElement('link');
          link.rel = 'preload';
          link.as = 'video';
          link.href = story.url;
          document.head.appendChild(link);
          appendedLinks.push(link);
        }
      }
    }
    return () => appendedLinks.forEach((link) => link.remove());
  }, [activeIndex, preloadCount, preloadIdentity]);

  useEffect(() => {
    segmentRefs.current.forEach((element, index) => {
      if (element) element.style.transform = index < activeIndex ? 'scaleX(1)' : 'scaleX(0)';
    });
  }, [activeIndex, playbackKey]);

  const timingRef = useRef({ isPaused, isLoaded, isBuffering, duration: defaultDuration });
  timingRef.current = {
    isPaused,
    isLoaded,
    isBuffering,
    duration: currentStory?.duration ?? defaultDuration,
  };
  const isVideo = currentStory?.type === 'video';
  useEffect(() => {
    if (isVideo || !storiesRef.current[activeIndex]) return;
    let frame = 0;
    const clock = { previousTime: null as number | null, elapsed: 0 };
    imageClockRef.current = clock;
    const tick = (time: number) => {
      if (playbackRef.current.playbackKey !== playbackKey) return;
      const timing = timingRef.current;
      const running = timing.isLoaded && !timing.isPaused && !timing.isBuffering;
      if (running) {
        if (clock.previousTime !== null) clock.elapsed += time - clock.previousTime;
        clock.previousTime = time;
        const fraction = clock.elapsed / timing.duration;
        writeProgress(activeIndex, fraction);
        if (fraction >= 1) {
          next();
          return;
        }
      } else {
        clock.previousTime = null;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [activeIndex, playbackKey, isVideo, writeProgress, next]);

  const value: StoryContextType = {
    activeIndex,
    playbackKey,
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
    setLoaded,
    setBuffering,
    toggleMute,
    reset,
    setError,
    setSegmentRef,
    seekVideoProgress,
  };
  return <StoryContext.Provider value={value}>{children}</StoryContext.Provider>;
};

export const useStory = (): StoryContextType => {
  const context = useContext(StoryContext);
  if (!context) throw new Error('useStory must be used within a StoryProvider');
  return context;
};
