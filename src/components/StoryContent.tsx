import React, { useEffect, useRef, useState } from 'react';
import { useStory } from '../context/StoryContext';
import { StoryItem } from '../types';

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
  ensureKeyframe();

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
    config,
  } = useStory();

  const activeStory = stories[activeIndex];
  const [outgoingStory, setOutgoingStory] = useState<StoryItem | null>(null);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const prevStoryIdRef = useRef<string | null>(null);
  const prevIndexRef = useRef<number>(activeIndex);
  const videoRef = useRef<HTMLVideoElement>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Handle seamless dual-buffer transition when active story changes
  useEffect(() => {
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

      // Clean up outgoing buffer after animation finishes
      const timer = setTimeout(() => {
        setOutgoingStory(null);
      }, 270);
      return () => clearTimeout(timer);
    }

    prevStoryIdRef.current = activeStory.id;
    prevIndexRef.current = activeIndex;
  }, [activeStory?.id, activeIndex, stories]);

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

    // Safety fallback: ensure viewer never gets frozen if synthetic event is dropped
    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        setLoaded(true);
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      img.onload = null;
      img.onerror = null;
    };
  }, [activeStory?.id, activeStory?.url, activeStory?.type, setLoaded]);

  // Sync video play/pause with context isPaused
  useEffect(() => {
    const video = videoRef.current;
    if (!video || activeStory?.type !== 'video') return;
    if (isPaused) {
      video.pause();
    } else {
      video.play().catch(() => {/* autoplay policy may block */});
    }
  }, [isPaused, activeStory]);

  // Sync muted state reactively
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  // Clear error timer on story change
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [activeIndex]);

  const handleError = () => {
    setError('Media failed to load');
    setBuffering(false);
    errorTimerRef.current = setTimeout(() => next(), 3000);
  };

  if (!activeStory) return null;

  const inAnimation = outgoingStory
    ? direction === 'next'
      ? 'storySlideInRight 0.26s cubic-bezier(0.22, 1, 0.36, 1) forwards'
      : 'storySlideInLeft 0.26s cubic-bezier(0.22, 1, 0.36, 1) forwards'
    : 'storyFadeIn 0.2s ease-out';

  const outAnimation =
    direction === 'next'
      ? 'storySlideOutLeft 0.26s cubic-bezier(0.22, 1, 0.36, 1) forwards'
      : 'storySlideOutRight 0.26s cubic-bezier(0.22, 1, 0.36, 1) forwards';

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden select-none">
      {/* Outgoing Story Layer: smoothly animates out without dropping to black */}
      {outgoingStory && (
        <div
          key={`out_${outgoingStory.id}`}
          className="absolute inset-0 z-10 pointer-events-none"
          style={{ animation: outAnimation, willChange: 'transform, opacity' }}
        >
          {outgoingStory.type === 'image' && outgoingStory.url ? (
            <img
              src={outgoingStory.url}
              alt=""
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : outgoingStory.type === 'video' && outgoingStory.url ? (
            <video
              src={outgoingStory.url}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay={false}
            />
          ) : null}
        </div>
      )}

      {/* Incoming / Active Story Layer */}
      <div
        key={`in_${activeStory.id}`}
        className="absolute inset-0 z-20"
        style={{ animation: inAnimation, willChange: 'transform, opacity' }}
      >
        {activeStory.type === 'image' ? (
          <img
            ref={(el) => {
              if (el && el.complete && el.naturalWidth > 0) {
                setLoaded(true);
              }
            }}
            src={activeStory.url}
            alt={activeStory.altText ?? ''}
            className="w-full h-full object-cover"
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={handleError}
          />
        ) : (
          <video
            ref={videoRef}
            src={activeStory.url}
            className="w-full h-full object-cover"
            playsInline
            autoPlay
            muted={isMuted}
            onWaiting={() => setBuffering(true)}
            onCanPlay={() => { setBuffering(false); setLoaded(true); }}
            onPlaying={() => { setBuffering(false); setLoaded(true); }}
            onError={handleError}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration > 0) {
                seekVideoProgress(activeIndex, (v.currentTime / v.duration) * 100);
              }
            }}
            onEnded={() => {
              seekVideoProgress(activeIndex, 100);
              config.onStoryEnd?.(activeIndex, activeStory);
              if (activeIndex >= stories.length - 1) {
                config.onAllStoriesEnd?.();
              } else {
                next();
              }
            }}
          />
        )}
      </div>

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
