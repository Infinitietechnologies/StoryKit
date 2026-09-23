import React, { useCallback, useEffect, useInsertionEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStory } from '../context/StoryContext';
import { StoryItem } from '../types';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// Inject smooth transition keyframes once
const TRANSITION_STYLES = `
@keyframes storySlideInRight {
  0% {
    transform: translateX(36px) scale(0.985);
    opacity: 0;
  }
  100% {
    transform: translateX(0) scale(1);
    opacity: 1;
  }
}
@keyframes storySlideOutLeft {
  0% {
    transform: translateX(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateX(-36px) scale(0.985);
    opacity: 0;
  }
}
@keyframes storySlideInLeft {
  0% {
    transform: translateX(-36px) scale(0.985);
    opacity: 0;
  }
  100% {
    transform: translateX(0) scale(1);
    opacity: 1;
  }
}
@keyframes storySlideOutRight {
  0% {
    transform: translateX(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateX(36px) scale(0.985);
    opacity: 0;
  }
}
@keyframes storyFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
`;

let keyframeInjected = false;
function ensureKeyframe() {
  if (keyframeInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = TRANSITION_STYLES;
  document.head.appendChild(style);
  keyframeInjected = true;
}

export const StoryContent: React.FC = () => {
  useInsertionEffect(ensureKeyframe, []);

  const {
    stories,
    activeIndex,
    isPaused,
    isMuted,
    isLoaded,
    isBuffering,
    error,
    setLoaded,
    setBuffering,
    setError,
    seekVideoProgress,
    next,
    pause,
    toggleMute,
  } = useStory();

  const activeStory = stories[activeIndex];
  const [outgoingStory, setOutgoingStory] = useState<StoryItem | null>(null);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const prevStoryIdRef = useRef<string | null>(null);
  const prevIndexRef = useRef<number>(activeIndex);
  const videoRef = useRef<HTMLVideoElement>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const errorHandledRef = useRef(false);
  const pendingOutgoingStory =
    prevStoryIdRef.current && prevStoryIdRef.current !== activeStory?.id
      ? stories.find((story) => story.id === prevStoryIdRef.current) ?? null
      : null;
  // This render-time derivation includes the old keyed layer in the very first
  // commit of a navigation, before the layout effect records transition state.
  const visibleOutgoingStory = pendingOutgoingStory ?? outgoingStory;

  // Handle seamless dual-buffer transition when active story changes
  useIsomorphicLayoutEffect(() => {
    if (!activeStory) return;

    if (prevStoryIdRef.current && prevStoryIdRef.current !== activeStory.id) {
      const oldIndex = prevIndexRef.current;
      const isForward = activeIndex >= oldIndex;
      setDirection(isForward ? 'next' : 'prev');

      // Preserve outgoing story for transition
      const prevStory = stories.find((s) => s.id === prevStoryIdRef.current) || {
        id: prevStoryIdRef.current,
        url: '',
        type: 'image' as const,
      };

      setOutgoingStory(prevStory);
      prevStoryIdRef.current = activeStory.id;
      prevIndexRef.current = activeIndex;

      return;
    }

    prevStoryIdRef.current = activeStory.id;
    prevIndexRef.current = activeIndex;
  }, [activeStory, activeIndex, stories]);

  // Keep the previous media visible until the incoming media is ready, then
  // remove it only after both transition animations have completed.
  useEffect(() => {
    if (!outgoingStory || !isLoaded) return;
    const timer = setTimeout(() => setOutgoingStory(null), 270);
    return () => clearTimeout(timer);
  }, [isLoaded, outgoingStory]);

  const handleError = useCallback(() => {
    if (errorHandledRef.current) return;
    errorHandledRef.current = true;
    setError('Media failed to load');
    setBuffering(false);
    errorTimerRef.current = setTimeout(next, 3000);
  }, [next, setBuffering, setError]);

  // Robust image loading detection: handles cached images, fast renders, and slow networks
  useEffect(() => {
    if (activeStory?.type !== 'image') return;

    let cancelled = false;
    const img = new Image();
    img.src = activeStory.url;

    // If image is already cached by the browser, mark loaded immediately
    if (img.complete && img.naturalWidth > 0) {
      setLoaded(true);
      return;
    }

    img.onload = () => {
      if (!cancelled) setLoaded(true);
    };
    img.onerror = () => {
      if (!cancelled) handleError();
    };

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [activeStory?.id, activeStory?.url, activeStory?.type, handleError, setLoaded]);

  // Sync video play/pause with context isPaused
  useEffect(() => {
    const video = videoRef.current;
    if (!video || activeStory?.type !== 'video') return;
    if (isPaused) {
      video.pause();
    } else {
      video.play().catch(() => {
        if (!video.muted) {
          toggleMute();
          return;
        }
        pause();
        setError('Playback was blocked by the browser');
      });
    }
  }, [isPaused, isMuted, activeStory, pause, setError, toggleMute]);

  // Sync muted state reactively
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  // Clear error timer on story change
  useEffect(() => {
    errorHandledRef.current = false;
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [activeIndex]);

  if (!activeStory) return null;

  const inAnimation = visibleOutgoingStory
    ? direction === 'next'
      ? 'storySlideInRight 0.26s cubic-bezier(0.22, 1, 0.36, 1) forwards'
      : 'storySlideInLeft 0.26s cubic-bezier(0.22, 1, 0.36, 1) forwards'
    : 'none';

  const outAnimation =
    direction === 'next'
      ? 'storySlideOutLeft 0.26s cubic-bezier(0.22, 1, 0.36, 1) forwards'
      : 'storySlideOutRight 0.26s cubic-bezier(0.22, 1, 0.36, 1) forwards';

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden select-none">
      {/* A keyed layer list lets React preserve the decoded media node when an
          active story becomes outgoing, eliminating the one-frame black flash. */}
      {[
        ...(visibleOutgoingStory ? [{ story: visibleOutgoingStory, active: false }] : []),
        { story: activeStory, active: true },
      ].map(({ story, active }) => (
        <div
          data-storykit-animated="true"
          key={story.id}
          className={`absolute inset-0 ${active ? 'z-20' : 'z-10 pointer-events-none'}`}
          style={{
            animation: isLoaded ? (active ? inAnimation : outAnimation) : 'none',
            opacity: isLoaded ? undefined : active ? 0 : 1,
            willChange: 'transform, opacity',
          }}
        >
          {story.type === 'image' ? (
            <img
              ref={active ? (el) => {
                if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
              } : undefined}
              src={story.url}
              alt={active ? story.altText ?? '' : ''}
              className="w-full h-full object-cover"
              draggable={false}
              onLoad={active ? () => setLoaded(true) : undefined}
              onError={active ? handleError : undefined}
            />
          ) : (
            <video
              ref={active ? videoRef : undefined}
              src={story.url}
              className="w-full h-full object-cover"
              playsInline
              autoPlay={active}
              muted={active ? isMuted : true}
              onWaiting={active ? () => setBuffering(true) : undefined}
              onCanPlay={active ? () => { setBuffering(false); setLoaded(true); } : undefined}
              onPlaying={active ? () => { setBuffering(false); setLoaded(true); } : undefined}
              onError={active ? handleError : undefined}
              onTimeUpdate={active ? (e) => {
                const video = e.currentTarget;
                if (video.duration > 0) {
                  seekVideoProgress(activeIndex, (video.currentTime / video.duration) * 100);
                }
              } : undefined}
              onEnded={active ? () => {
                seekVideoProgress(activeIndex, 100);
                next();
              } : undefined}
            />
          )}
        </div>
      ))}

      {/* Spinner — loading / buffering */}
      {(!isLoaded || isBuffering) && !error && (
        <div className="absolute z-30 pointer-events-none">
          <div className="w-9 h-9 rounded-full border-[3px] border-white/20 border-t-white animate-spin" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute z-30 flex flex-col items-center gap-2 px-6 text-center pointer-events-none">
          <div className="text-white/80 text-sm font-medium">{error}</div>
          <div className="text-white/40 text-xs">Skipping in 3s…</div>
        </div>
      )}
    </div>
  );
};
