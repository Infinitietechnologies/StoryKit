import React, { useEffect, useMemo, useState } from 'react';
import { StoryItem, StoryUser, ViewerConfig } from '../types';
import { StoryProvider } from '../context/StoryContext';
import { StoryContainer } from './StoryContainer';
import { StoryProgress } from './StoryProgress';
import { StoryContent } from './StoryContent';
import { DynamicOverlay } from './DynamicOverlay';
import { StoryFooter } from './StoryFooter';
import { useStory } from '../context/StoryContext';

interface StoryViewerProps {
  isOpen: boolean;
  onClose: () => void;
  stories: StoryItem[];
  user?: StoryUser;
  /** Index of the story to start playback from (e.g. first unviewed story). Defaults to 0. */
  initialStoryIndex?: number;
  config?: Omit<ViewerConfig, 'onClose'>;
}

// ── SVG icon helpers ──────────────────────────────────────────────────────────
const IconClose = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
    className="w-5 h-5">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const IconVolume = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    className="w-5 h-5">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
  </svg>
);

const IconMute = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    className="w-5 h-5">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

// ── Inner header — must be inside StoryProvider to access useStory ───────────
const StoryHeader: React.FC<{ user?: StoryUser; onClose: () => void }> = ({ user, onClose }) => {
  const { toggleMute, isMuted } = useStory();

  /** Stop pointer events from bubbling to StoryContainer so buttons don't trigger nav */
  const stopPointer = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div
      className="absolute top-5 sm:top-7 left-0 right-0 z-40 px-3 pb-2 flex items-center gap-2 pointer-events-none"
      style={{
        paddingTop: 'max(4px, env(safe-area-inset-top, 0px))',
      }}
    >
      {/* User info */}
      {user && (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700 ring-[1.5px] ring-white/50 flex-shrink-0 shadow-md">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                {user.name[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-white font-semibold text-sm leading-tight truncate" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
              {user.name}
            </span>
            {user.timestamp && (
              <span className="text-white/55 text-[11px] leading-tight">{user.timestamp}</span>
            )}
          </div>
        </div>
      )}
      {!user && <div className="flex-1" />}

      {/* Controls — pointer-events-auto + stopPropagation blocks StoryContainer from intercepting */}
      <div
        className="flex items-center gap-0.5 pointer-events-auto"
        onPointerDown={stopPointer}
        onPointerUp={stopPointer}
      >
        <button
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute (M)' : 'Mute (M)'}
          title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
          className="p-2 text-white/75 hover:text-white hover:bg-white/10 active:scale-90 transition-all duration-150 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          {isMuted ? <IconMute /> : <IconVolume />}
        </button>
        <button
          onClick={onClose}
          aria-label="Close (Esc)"
          title="Close (Esc)"
          className="p-2 text-white/75 hover:text-white hover:bg-white/10 active:scale-90 transition-all duration-150 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <IconClose />
        </button>
      </div>
    </div>
  );
};

// ── Inner viewer — inside StoryProvider ──────────────────────────────────────
const StoryViewerInner: React.FC<{ user?: StoryUser; onClose: () => void; isVisible: boolean }> = ({
  user,
  onClose,
  isVisible,
}) => {
  const { stories, activeIndex, config } = useStory();
  const showFooter = config.showFooter !== false;
  const currentStoryId = stories[activeIndex]?.id ?? '';

  return (
    <div
      className="w-full h-full"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(100%) scale(0.96)',
        transition: 'opacity 350ms cubic-bezier(0.32,0,0.67,0), transform 350ms cubic-bezier(0.32,0,0.67,0)',
      }}
    >
      <StoryContainer>
        <StoryProgress />
        <StoryHeader user={user} onClose={onClose} />
        <StoryContent />
        <DynamicOverlay />
        {showFooter && <StoryFooter storyId={currentStoryId} userName={user?.name} />}
      </StoryContainer>
    </div>
  );
};

// ── Public StoryViewer ────────────────────────────────────────────────────────
export const StoryViewer: React.FC<StoryViewerProps> = ({
  isOpen,
  onClose,
  stories,
  user,
  initialStoryIndex = 0,
  config = {},
}) => {
  // mounted: controls DOM presence; visible: drives CSS animation
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // Double rAF ensures the initial opacity:0 is painted before we transition
      requestAnimationFrame(() => requestAnimationFrame(() => setIsVisible(true)));
    } else {
      setIsVisible(false);
      const t = setTimeout(() => setMounted(false), 380);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const mergedConfig = useMemo(
    () => ({
      ...config,
      onClose,
      keyboardNavigation: true,
      initialStoryIndex: initialStoryIndex ?? config.initialStoryIndex ?? 0,
    }),
    [config, onClose, initialStoryIndex]
  );

  if (!mounted) return null;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-350 sm:p-4"
      style={{
        backgroundColor: isVisible ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0)',
        backdropFilter: isVisible ? 'blur(8px)' : 'blur(0px)',
        transitionDuration: '350ms',
      }}
      onClick={(e) => {
        // Close if user clicks the bare backdrop (outside the card)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Story card — 100% fullscreen on mobile (100dvh, edge-to-edge, zero margin), floating card on tablet/desktop */}
      <div className="relative w-full h-[100dvh] max-h-[100dvh] sm:h-full sm:max-w-sm sm:max-h-[92dvh] mx-auto overflow-hidden sm:rounded-2xl sm:shadow-2xl">
        <StoryProvider stories={stories} config={mergedConfig}>
          <StoryViewerInner user={user} onClose={onClose} isVisible={isVisible} />
        </StoryProvider>
      </div>
    </div>
  );
};

