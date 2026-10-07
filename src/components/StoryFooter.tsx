import React, { useCallback, useEffect, useInsertionEffect, useRef, useState } from 'react';
import { useStory } from '../context/StoryContext';
import { StoryShare } from './StoryShare';

export interface StoryFooterProps {
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

  const { pause, resume, config, stories, playbackKey } = useStory();
  const story = stories.find(item => item.id === storyId);
  const showReply = story?.interactions?.reply ?? config.showReply ?? true;
  const showLike = story?.interactions?.like ?? config.showLike ?? true;
  const showShare = (story?.interactions?.share ?? config.showShare ?? true)
    && (config.shareMode === 'custom' ? Boolean(config.onShare) : Boolean(story));
  const [shareOpen, setShareOpen] = useState(false);
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const [message, setMessage] = useState('');
  const [liked,   setLiked]   = useState(false);
  const [popping, setPopping] = useState(false);
  const [replyStatus, setReplyStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusPausedRef = useRef(false);
  const popTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replyVersionRef = useRef(0);
  const sendingRef = useRef(false);
  const persistedLiked = config.isStoryLiked?.(storyId);
  const pauseReason = `reply:${storyId}`;

  const releaseFocusPause = useCallback(() => {
    if (!focusPausedRef.current) return;
    focusPausedRef.current = false;
    resume(pauseReason);
  }, [pauseReason, resume]);

  // Reset per-story state when story changes
  useEffect(() => {
    inputRef.current?.blur();
    setLiked(false);
    setMessage('');
    setPopping(false);
    setReplyStatus('');
    setSubmitting(false);
    setShareOpen(false);
    sendingRef.current = false;
    replyVersionRef.current += 1;
    return () => {
      replyVersionRef.current += 1;
      if (popTimerRef.current) clearTimeout(popTimerRef.current);
      popTimerRef.current = null;
      releaseFocusPause();
    };
  }, [storyId, releaseFocusPause]);

  useEffect(() => {
    if (!showReply || config.showFooter === false) releaseFocusPause();
    if (!showShare || config.showFooter === false) setShareOpen(false);
  }, [showReply, showShare, config.showFooter, releaseFocusPause]);

  useEffect(() => {
    if (persistedLiked !== undefined) setLiked(persistedLiked);
  }, [persistedLiked, storyId]);

  useEffect(() => { setShareOpen(false); }, [playbackKey]);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || !config.onReply || sendingRef.current) return;
    const version = ++replyVersionRef.current;
    sendingRef.current = true;
    setSubmitting(true);
    setReplyStatus('Submitting reply…');
    try {
      await config.onReply(trimmed, storyId);
      if (version !== replyVersionRef.current) return;
      setMessage('');
      setReplyStatus('Reply submitted');
      inputRef.current?.blur();
      releaseFocusPause();
    } catch {
      if (version !== replyVersionRef.current) return;
      setReplyStatus('Reply could not be submitted. Try again.');
    } finally {
      if (version === replyVersionRef.current) {
        sendingRef.current = false;
        setSubmitting(false);
      }
    }
  };

  const handleLike = () => {
    const next = !liked;
    setLiked(next);
    config.onLikeChange?.(storyId, next);
    if (next) {
      setPopping(true);
      config.onLike?.(storyId);
      if (popTimerRef.current) clearTimeout(popTimerRef.current);
      popTimerRef.current = setTimeout(() => {
        setPopping(false);
        popTimerRef.current = null;
      }, 500);
    } else {
      if (popTimerRef.current) clearTimeout(popTimerRef.current);
      popTimerRef.current = null;
      setPopping(false);
    }
  };

  const handleShare = async () => {
    const version = replyVersionRef.current;
    if (config.shareMode !== 'custom') setShareOpen(true);
    try {
      await config.onShare?.(storyId);
    } catch {
      if (config.shareMode === 'custom' && version === replyVersionRef.current)
        setReplyStatus('Sharing could not be opened. Try again.');
    }
  };

  if (config.showFooter === false || (!showReply && !showLike && !showShare)) return null;

  const placeholder = userName ? `Reply to ${userName}…` : 'Send message…';

  return (<>
    <div
      data-interactive="true"
      aria-busy={submitting}
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
        justifyContent: showReply ? 'flex-start' : 'flex-end',
        gap: '10px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerCancel={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key !== 'Tab' && e.key !== 'Escape') e.stopPropagation();
      }}
    >
      {/* Reply input pill */}
      {showReply && <div
        onFocus={() => {
          if (focusPausedRef.current) return;
          focusPausedRef.current = true;
          pause(pauseReason);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) releaseFocusPause();
        }}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1.5px solid rgba(255,255,255,0.28)',
          borderRadius: '100px',
          padding: '9px 14px',
          minHeight: '44px',
          transition: 'border-color 0.2s ease',
        }}
      >
        <input
          ref={inputRef}
          data-storykit-reply="true"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setReplyStatus('');
          }}
          disabled={!config.onReply}
          readOnly={submitting}
          onKeyDown={(e) => {
            if (e.key !== 'Tab' && e.key !== 'Escape') e.stopPropagation();
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void handleSend();
            }
            if (e.key === 'Escape') {
              inputRef.current?.blur();
            }
          }}
          placeholder={config.onReply ? placeholder : 'Replies unavailable'}
          maxLength={300}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '16px',
            fontFamily: 'inherit',
          }}
          aria-label="Reply to story"
        />

        {/* Send button — appears when there's text */}
        {message.trim() && (
          <button
            type="button"
            onClick={handleSend}
            disabled={submitting}
            data-interactive="true"
            style={{
              background: 'rgba(255,255,255,0.9)',
              border: 'none',
              borderRadius: '50%',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: submitting ? 'wait' : 'pointer',
              flexShrink: 0,
            }}
            aria-label="Send reply"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>}

      {/* Like / Heart — bounces and fills on click */}
      {showLike && <button
        type="button"
        data-storykit-animated="true"
        onClick={handleLike}
        data-interactive="true"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          width: '44px',
          height: '44px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: popping ? 'heartPop 0.5s ease' : 'none',
          transition: 'color 0.2s ease',
        }}
        aria-label={liked ? 'Unlike story' : 'Like story'}
        aria-pressed={liked}
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
      </button>}

      {/* Share / Forward */}
      {showShare && <button
        ref={shareButtonRef}
        type="button"
        onClick={handleShare}
        data-interactive="true"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          width: '44px',
          height: '44px',
          flexShrink: 0,
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
      </button>}
      <span
        role="status"
        style={{ position: 'absolute', bottom: '100%', left: '12px', right: '12px', color: '#fff', background: 'rgba(0,0,0,0.8)', borderRadius: '12px', padding: replyStatus ? '8px 12px' : 0, fontSize: '13px', textAlign: 'center', pointerEvents: 'none' }}
      >
        {replyStatus}
      </span>
    </div>
    {shareOpen && showShare && story && <StoryShare
      key={storyId}
      story={story}
      userName={userName}
      onClose={() => setShareOpen(false)}
      returnFocusRef={shareButtonRef}
    />}
  </>);
};
