import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStory } from '../context/StoryContext';
import { StoryItem } from '../types';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
interface MediaLayer { story: StoryItem; key: string; index: number }

export const StoryContent: React.FC = () => {
  const {
    stories, activeIndex, playbackKey, isPaused, isMuted, isLoaded, isBuffering,
    error, setLoaded, setBuffering, setError, seekVideoProgress, next, reset,
    pause, resume, toggleMute,
  } = useStory();
  const activeStory = stories[activeIndex];
  const hasStory = Boolean(activeStory);
  const mediaKey = `${playbackKey}:${activeStory?.id}:${activeStory?.type}:${activeStory?.url}`;
  const previousLayerRef = useRef<MediaLayer | null>(null);
  const [outgoingLayer, setOutgoingLayer] = useState<MediaLayer | null>(null);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [slowLoading, setSlowLoading] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previousLayer = previousLayerRef.current;
  const pendingOutgoing = previousLayer && previousLayer.key !== mediaKey &&
    previousLayer.story.id !== activeStory?.id ? previousLayer : null;
  const visibleOutgoing = pendingOutgoing ?? outgoingLayer;

  useIsomorphicLayoutEffect(() => {
    if (!activeStory) {
      previousLayerRef.current = null;
      setOutgoingLayer(null);
      return;
    }
    const previous = previousLayerRef.current;
    if (previous && previous.key !== mediaKey) {
      setDirection(activeIndex >= previous.index ? 'next' : 'prev');
      setOutgoingLayer(previous.story.id === activeStory.id ? null : previous);
    }
    previousLayerRef.current = { story: activeStory, key: mediaKey, index: activeIndex };
  }, [activeStory, activeIndex, mediaKey]);

  useEffect(() => {
    if (!outgoingLayer || (!isLoaded && !error)) return;
    const timer = setTimeout(() => setOutgoingLayer(null), 270);
    return () => clearTimeout(timer);
  }, [isLoaded, error, outgoingLayer]);

  useEffect(() => {
    setSlowLoading(false);
    setPlaybackBlocked(false);
    resume('autoplay');
    return () => resume('autoplay');
  }, [mediaKey, resume]);

  useEffect(() => {
    if (!hasStory || (isLoaded && !isBuffering) || error) return;
    const timer = setTimeout(() => setSlowLoading(true), 8000);
    return () => clearTimeout(timer);
  }, [mediaKey, hasStory, isLoaded, isBuffering, error]);

  // Inspect the displayed image's decoded cache state without a second request.
  useEffect(() => {
    const image = imageRef.current;
    if (activeStory?.type === 'image' && image?.complete && image.naturalWidth > 0) setLoaded(true);
  }, [mediaKey, activeStory?.type, setLoaded]);

  const handleError = useCallback(() => {
    setLoaded(false);
    setBuffering(false);
    setError('This story could not be loaded.');
    setPlaybackBlocked(false);
  }, [setLoaded, setBuffering, setError]);

  const attemptPlayback = useCallback(async (video: HTMLVideoElement, cancelled: () => boolean) => {
    try {
      await video.play();
      if (!cancelled()) setPlaybackBlocked(false);
      return !cancelled();
    } catch (playError) {
      if (cancelled() || (playError instanceof Error && playError.name === 'AbortError')) return false;
      if (!video.muted) { video.muted = true; toggleMute(); return false; }
      setPlaybackBlocked(true);
      pause('autoplay');
      return false;
    }
  }, [pause, toggleMute]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || activeStory?.type !== 'video') return;
    let cancelled = false;
    video.muted = isMuted;
    if (isPaused || error) video.pause();
    else void attemptPlayback(video, () => cancelled);
    return () => { cancelled = true; video.pause(); };
  }, [mediaKey, activeStory?.type, isPaused, isMuted, error, attemptPlayback]);

  const playFromGesture = () => {
    const video = videoRef.current;
    if (!video) return;
    // Invoke play synchronously inside the click gesture, before React effects.
    void attemptPlayback(video, () => video !== videoRef.current).then((played) => {
      if (played && video === videoRef.current) { resume('autoplay'); resume(); }
    });
  };

  if (!activeStory) return null;
  const layers: (MediaLayer & { active: boolean })[] = [
    ...(visibleOutgoing ? [{ ...visibleOutgoing, active: false }] : []),
    { story: activeStory, key: mediaKey, index: activeIndex, active: true },
  ];
  const loading = (!isLoaded || isBuffering) && !error && !playbackBlocked;
  const controlClass = 'min-h-[44px] min-w-[44px] rounded-full border-0 appearance-none px-5 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white';

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden select-none">
      {layers.map(({ story, key, active }) => (
        <div key={key} aria-hidden={!active || undefined} data-storykit-animated="true"
          className={`absolute inset-0 ${active ? 'z-20' : 'z-10 pointer-events-none'}`}
          style={{
            animation: isLoaded && visibleOutgoing
              ? `${active ? (direction === 'next' ? 'storykit-in-next' : 'storykit-in-prev') : (direction === 'next' ? 'storykit-out-next' : 'storykit-out-prev')} 260ms ease-out both`
              : undefined,
            opacity: isLoaded ? undefined : active ? 0 : 1,
          }}
        >
          {story.type === 'image' ? (
            <img ref={active ? imageRef : undefined} src={story.url} alt={active ? story.altText ?? '' : ''}
              className="w-full h-full object-cover" draggable={false}
              onLoad={active ? () => { setError(null); setLoaded(true); } : undefined}
              onError={active ? handleError : undefined} />
          ) : (
            <video ref={active ? videoRef : undefined} src={story.url}
              aria-label={active ? story.altText ?? 'Story video' : undefined}
              className="w-full h-full object-cover" playsInline preload="auto" muted={active ? isMuted : true}
              onWaiting={active ? () => setBuffering(true) : undefined}
              onCanPlay={active ? () => { setBuffering(false); setLoaded(true); } : undefined}
              onPlaying={active ? () => { setBuffering(false); setLoaded(true); setPlaybackBlocked(false); } : undefined}
              onError={active ? handleError : undefined}
              onTimeUpdate={active ? (event) => {
                const video = event.currentTarget;
                if (Number.isFinite(video.duration) && video.duration > 0)
                  seekVideoProgress(activeIndex, (video.currentTime / video.duration) * 100);
              } : undefined}
              onEnded={active ? () => { seekVideoProgress(activeIndex, 100); next(); } : undefined} />
          )}
        </div>
      ))}

      {loading && (
        <div className="absolute z-30 flex flex-col items-center gap-3 rounded-2xl bg-black/75 px-6 py-5 text-center" role="status">
          <div aria-hidden="true" data-storykit-animated="true" className="w-8 h-8 rounded-full border-[3px] border-white/30 border-t-white animate-spin" />
          <p className="text-sm text-white/90">{slowLoading ? 'Taking longer than usual…' : isBuffering ? 'Buffering video…' : 'Loading story…'}</p>
          {slowLoading && <div className="flex gap-3">
            <button type="button" className={`${controlClass} bg-white text-black`} onClick={() => reset(activeIndex)}>Try again</button>
            <button type="button" className={`${controlClass} bg-white/15 text-white`} onClick={next}>Skip story</button>
          </div>}
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/85 px-6 text-center">
          <div role="alert"><p className="text-white text-base font-semibold">Story unavailable</p>
            <p className="mt-2 text-white/80 text-sm">{error}</p></div>
          <div className="flex gap-3">
            <button type="button" className={`${controlClass} bg-white text-black`} onClick={() => reset(activeIndex)}>Try again</button>
            <button type="button" className={`${controlClass} bg-white/15 text-white`} onClick={next}>Skip story</button>
          </div>
        </div>
      )}

      {playbackBlocked && !error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/50 px-6 text-center">
          <p role="status" className="text-white text-sm">Tap to play this video</p>
          <button type="button" className={`${controlClass} bg-white text-black`} onClick={playFromGesture}>Play video</button>
        </div>
      )}
    </div>
  );
};
