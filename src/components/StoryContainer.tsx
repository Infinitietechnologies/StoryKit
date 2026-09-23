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
  const { next, prev, pause, resume, isPaused, toggleMute, config } = useStory();

  const containerRef   = useRef<HTMLDivElement>(null);
  const touchStartRef  = useRef<{ x: number; y: number; time: number } | null>(null);
  const isDraggingDown = useRef(false);
  /** Tracks whether WE called pause() so we only resume() what we paused. */
  const didPauseRef    = useRef(false);

  // ── Pointer down ─────────────────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Let interactive children handle their own events
      if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;

      touchStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      isDraggingDown.current = false;
      pause();
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
          snapBack(true);
          config.onClose();
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config],
  );

  // ── Snap container back or animate away ──────────────────────────────────
  const snapBack = useCallback((away = false) => {
    const el = containerRef.current;
    if (!el) return;
    el.style.transition = 'transform 0.35s cubic-bezier(0.32,0,0.67,0), border-radius 0.35s ease';
    el.style.transform   = away ? 'translateY(120%) scale(0.9)' : '';
    el.style.borderRadius = '';
    setTimeout(() => { if (el) el.style.transition = ''; }, 380);
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
        if (didPauseRef.current) resume();
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
        if (relativeX < totalWidth * 0.3) prev();
        else next();
      }

      if (didPauseRef.current) resume();
      didPauseRef.current = false;
    },
    [next, prev, resume, snapBack],
  );

  // Ensure window pointer release always clears pause state
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (didPauseRef.current) {
        resume();
        didPauseRef.current = false;
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [resume]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    if (config.keyboardNavigation === false) return;

    const onKey = (e: KeyboardEvent) => {
      // Don't steal keys while user is typing
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          isPaused ? resume() : pause();
          break;

        case 'ArrowRight':
          e.preventDefault();
          next();
          break;

        case 'ArrowLeft':
          e.preventDefault();
          prev();
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
  }, [config, next, prev, pause, resume, isPaused, toggleMute]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
};
