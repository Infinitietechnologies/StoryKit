import React, { useCallback, useEffect, useRef } from 'react';
import { useStory } from '../context/StoryContext';

interface StoryContainerProps {
  children: React.ReactNode;
}

/**
 * Any element matching this selector will NOT trigger pause/tap/swipe logic.
 * Pointer events on buttons, links, inputs, overlays, etc. pass through untouched.
 */
const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, [role="button"], [data-overlay], [data-interactive]';

export const StoryContainer: React.FC<StoryContainerProps> = ({ children }) => {
  const { next, prev, pause, resume, isPaused, toggleMute, config, playbackKey } = useStory();

  const containerRef   = useRef<HTMLDivElement>(null);
  const touchStartRef  = useRef<{ x: number; y: number; time: number } | null>(null);
  const isDraggingDown = useRef(false);
  /** Tracks whether WE called pause() so we only resume() what we paused. */
  const didPauseRef    = useRef(false);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isRTL =
    config.dir ? config.dir === 'rtl' :
    (typeof document !== 'undefined' &&
      (document.dir === 'rtl' || document.documentElement.dir === 'rtl'));

  // ── Pointer down ─────────────────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button > 0 || e.isPrimary === false || touchStartRef.current) return;
      // Let interactive children handle their own events
      if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;

      touchStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      isDraggingDown.current = false;
      try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* Synthetic or released pointer. */ }
      pause('gesture');
      didPauseRef.current = true;
    },
    [pause],
  );

  // ── Pointer move: rubber-band drag-to-close ───────────────────────────────
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!touchStartRef.current || !containerRef.current) return;

      const deltaY = e.clientY - touchStartRef.current.y;
      const deltaX = Math.abs(e.clientX - touchStartRef.current.x);

      if (deltaY > 0 && deltaY > deltaX) {
        isDraggingDown.current = true;
        // Rubber-band resistance
        const rubberY = deltaY * (1 - Math.min(0.6, deltaY / 500));
        containerRef.current.style.transform = `translateY(${rubberY}px) scale(${1 - rubberY * 0.0005})`;
        containerRef.current.style.borderRadius = `${Math.min(24, rubberY * 0.12)}px`;

        if (deltaY > 140 && config.onClose) {
          touchStartRef.current = null;
          isDraggingDown.current = false;
          if (didPauseRef.current) resume('gesture');
          didPauseRef.current = false;
          snapBack(true);
          config.onClose();
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, resume],
  );

  // ── Snap container back or animate away ──────────────────────────────────
  const snapBack = useCallback((away = false) => {
    const el = containerRef.current;
    if (!el) return;
    el.style.transition = 'transform 0.35s cubic-bezier(0.32,0,0.67,0), border-radius 0.35s ease';
    el.style.transform   = away ? 'translateY(120%) scale(0.9)' : '';
    el.style.borderRadius = '';
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => { el.style.transition = ''; }, 380);
  }, []);

  // ── Pointer up ────────────────────────────────────────────────────────────
  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;

      // No tracked start means we never intercepted this gesture (button click etc.)
      if (!start) return;

      if (isDraggingDown.current) {
        snapBack(false);
        isDraggingDown.current = false;
        if (didPauseRef.current) resume('gesture');
        didPauseRef.current = false;
        return;
      }

      const deltaX    = Math.abs(e.clientX - start.x);
      const deltaY    = Math.abs(e.clientY - start.y);
      const deltaTime = Date.now() - start.time;

      // Quick tap — navigate
      if (deltaX < 12 && deltaY < 12 && deltaTime < 280) {
        const rect       = containerRef.current?.getBoundingClientRect();
        const relativeX  = e.clientX - (rect?.left ?? 0);
        const totalWidth = rect?.width ?? window.innerWidth;
        const tappedPreviousSide = isRTL
          ? relativeX > totalWidth * 0.7
          : relativeX < totalWidth * 0.3;
        if (tappedPreviousSide) prev();
        else next();
      }

      if (didPauseRef.current) resume('gesture');
      didPauseRef.current = false;
    },
    [isRTL, next, prev, resume, snapBack],
  );

  const handlePointerCancel = useCallback(() => {
    touchStartRef.current = null;
    isDraggingDown.current = false;
    snapBack(false);
    if (didPauseRef.current) resume('gesture');
    didPauseRef.current = false;
  }, [resume, snapBack]);

  // Ensure window pointer release always clears pause state
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (touchStartRef.current || didPauseRef.current) handlePointerCancel();
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
      resume('gesture');
    };
  }, [resume, handlePointerCancel]);

  useEffect(() => {
    const updateVisibility = () => {
      if (document.hidden) pause('visibility');
      else resume('visibility');
    };
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      document.removeEventListener('visibilitychange', updateVisibility);
      resume('visibility');
    };
  }, [pause, resume, playbackKey]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    if (config.keyboardNavigation === false) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.code === 'Escape' || e.key === 'Escape') {
        e.preventDefault();
        config.onClose?.();
        return;
      }
      // Don't steal keys while user is typing
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest(INTERACTIVE_SELECTOR + ', [contenteditable]:not([contenteditable="false"])')) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (isPaused) resume();
          else pause();
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (isRTL) prev();
          else next();
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (isRTL) next();
          else prev();
          break;

        case 'Escape':
          e.preventDefault();
          config.onClose?.();
          break;

        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [config, isRTL, next, prev, pause, resume, isPaused, toggleMute]);

  return (
    <div
      ref={containerRef}
      data-storykit-root="true"
      className="relative w-full h-full bg-black overflow-hidden touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
};
