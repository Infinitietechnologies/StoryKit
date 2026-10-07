import React, { useEffect, useInsertionEffect, useRef, useState } from 'react';
import { useStory } from '../context/StoryContext';

interface StoryFooterProps {
  storyId: string;
  /** Optional — shown in the input placeholder */
  userName?: string;
}

// Inject heart-pop keyframe once
let heartInjected = false;
function ensureHeartAnim() {
  if (heartInjected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes heartPop {
      0%   { transform: scale(1); }
      30%  { transform: scale(1.5); }
      60%  { transform: scale(0.88); }
      100% { transform: scale(1); }
    }
  `;
  document.head.appendChild(s);
  heartInjected = true;
}

export const StoryFooter: React.FC<StoryFooterProps> = ({ storyId, userName }) => {
  useInsertionEffect(ensureHeartAnim, []);

  const { pause, resume, config } = useStory();
  const [message, setMessage] = useState('');
  const [liked,   setLiked]   = useState(false);
  const [popping, setPopping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const persistedLiked = config.isStoryLiked?.(storyId);

  // Reset per-story state when story changes
  useEffect(() => {
    setLiked(false);
    setMessage('');
    setPopping(false);
  }, [storyId]);

  useEffect(() => {
    if (persistedLiked !== undefined) setLiked(persistedLiked);
  }, [persistedLiked, storyId]);

  const handleFocus = () => pause();
  const handleBlur  = () => resume();

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    config.onReply?.(trimmed, storyId);
    setMessage('');
    inputRef.current?.blur();  // blur triggers handleBlur → resume()
  };

  const handleLike = () => {
    const next = !liked;
    setLiked(next);
    config.onLikeChange?.(storyId, next);
    if (next) {
      setPopping(true);
      config.onLike?.(storyId);
      setTimeout(() => setPopping(false), 500);
    }
  };

  const handleShare = () => config.onShare?.(storyId);

  const placeholder = userName ? `Reply to ${userName}…` : 'Send message…';

  return (
    <div
      data-interactive="true"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.25) 70%, transparent 100%)',
        paddingTop: '28px',
        paddingLeft: '12px',
        paddingRight: '12px',
        paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      {/* Reply input pill */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255,255,255,0.13)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1.5px solid rgba(255,255,255,0.28)',
          borderRadius: '100px',
          padding: '9px 14px',
          transition: 'border-color 0.2s ease',
        }}
      >
        <input
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onFocus={handleFocus}      // ← pauses story timer
          onBlur={handleBlur}        // ← resumes story timer
          onKeyDown={(e) => {
            e.stopPropagation();     // prevents Space/Arrow from triggering story nav while typing
            if (e.key === 'Enter') handleSend();
            if (e.key === 'Escape') inputRef.current?.blur();
          }}
          placeholder={placeholder}
          maxLength={300}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: '14px',
            fontFamily: 'inherit',
          }}
          aria-label="Reply to story"
        />

        {/* Send button — appears when there's text */}
        {message.trim() && (
          <button
            type="button"
            onClick={handleSend}
            data-interactive="true"
            style={{
              background: 'rgba(255,255,255,0.9)',
              border: 'none',
              borderRadius: '50%',
              width: '26px',
              height: '26px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="Send reply"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Like / Heart — bounces and fills on click */}
      <button
        type="button"
        data-storykit-animated="true"
        onClick={handleLike}
        data-interactive="true"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: popping ? 'heartPop 0.5s ease' : 'none',
          transition: 'color 0.2s ease',
        }}
        aria-label={liked ? 'Unlike story' : 'Like story'}
        title={liked ? 'Unlike' : 'Like'}
      >
        <svg
          width="27"
          height="27"
          viewBox="0 0 24 24"
          fill={liked ? '#ff3040' : 'none'}
          stroke={liked ? '#ff3040' : 'rgba(255,255,255,0.88)'}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: 'fill 0.2s ease, stroke 0.2s ease' }}
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>

      {/* Share / Forward */}
      <button
        type="button"
        onClick={handleShare}
        data-interactive="true"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Share story"
        title="Share"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
};
