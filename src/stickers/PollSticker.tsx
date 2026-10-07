import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PollStickerData } from '../types';

interface PollStickerProps {
  data: PollStickerData;
  /** Injected by DynamicOverlay from story context */
  pause?: () => void;
  resume?: () => void;
}

export const PollSticker: React.FC<PollStickerProps> = ({ data, pause, resume }) => {
  const { question, optionA, optionB, selectedOption, onVote } = data;
  const [voted, setVoted] = useState<'A' | 'B' | null>(selectedOption ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [voteError, setVoteError] = useState('');
  const callbacksRef = useRef({ pause, resume });
  callbacksRef.current = { pause, resume };
  const pausedRef = useRef(false);
  const focusedRef = useRef(false);
  const pointerRef = useRef<number | null>(null);
  const voteVersionRef = useRef(0);
  const submittingRef = useRef(false);

  const pauseInteraction = useCallback(() => {
    if (pausedRef.current || !callbacksRef.current.pause) return;
    pausedRef.current = true;
    callbacksRef.current.pause();
  }, []);

  const releaseInteraction = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    callbacksRef.current.resume?.();
  }, []);

  const releasePointer = useCallback(() => {
    pointerRef.current = null;
    if (!focusedRef.current) releaseInteraction();
  }, [releaseInteraction]);

  useEffect(() => {
    voteVersionRef.current += 1;
    setVoted(selectedOption ?? null);
    setSubmitting(false);
    setVoteError('');
    submittingRef.current = false;
    focusedRef.current = false;
    pointerRef.current = null;
    releaseInteraction();
  }, [question, optionA, optionB, selectedOption, releaseInteraction]);

  useEffect(() => {
    const finishPointer = (event: PointerEvent) => {
      if (pointerRef.current !== null && pointerRef.current === event.pointerId) releasePointer();
    };
    window.addEventListener('pointerup', finishPointer);
    window.addEventListener('pointercancel', finishPointer);
    return () => {
      window.removeEventListener('pointerup', finishPointer);
      window.removeEventListener('pointercancel', finishPointer);
      voteVersionRef.current += 1;
      releaseInteraction();
    };
  }, [releaseInteraction, releasePointer]);

  const handleVote = async (option: 'A' | 'B') => {
    if (voted || submittingRef.current) return;
    const version = ++voteVersionRef.current;
    submittingRef.current = true;
    setSubmitting(true);
    setVoteError('');
    try {
      await onVote?.(option);
      if (version !== voteVersionRef.current) return;
      setVoted(option);
      focusedRef.current = false;
      pointerRef.current = null;
      releaseInteraction();
    } catch {
      if (version !== voteVersionRef.current) return;
      setVoteError('Vote could not be submitted. Try again.');
    } finally {
      if (version === voteVersionRef.current) {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  };

  return (
    <div
      data-interactive="true"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (voted || submittingRef.current) return;
        pointerRef.current = e.pointerId;
        pauseInteraction();
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        releasePointer();
      }}
      onPointerCancel={(e) => {
        e.stopPropagation();
        releasePointer();
      }}
      onLostPointerCapture={releasePointer}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key !== 'Tab' && e.key !== 'Escape') e.stopPropagation();
      }}
      onFocus={() => {
        if (voted || submittingRef.current) return;
        focusedRef.current = true;
        pauseInteraction();
      }}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        focusedRef.current = false;
        if (pointerRef.current === null) releaseInteraction();
      }}
      role="group"
      aria-label={question}
      aria-busy={submitting}
      style={{
        width: '220px',
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(255,255,255,0.3)',
        borderRadius: '20px',
        padding: '14px 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Emoji header */}
      <p style={{ color: '#fff', fontWeight: 700, fontSize: '12px', textAlign: 'center', margin: '0 0 2px', opacity: 0.85, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        POLL
      </p>
      {/* Question */}
      <p style={{ color: '#fff', fontWeight: 700, fontSize: '14px', textAlign: 'center', margin: '0 0 12px', lineHeight: 1.35 }}>
        {question}
      </p>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {(['A', 'B'] as const).map((opt) => {
          const label   = opt === 'A' ? optionA : optionB;
          const isVoted = voted === opt;

          return (
            <button
              type="button"
              key={opt}
              onClick={() => void handleVote(opt)}
              data-interactive="true"
              disabled={voted !== null || submitting}
              style={{
                position: 'relative',
                overflow: 'hidden',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '14px',
                padding: '10px 14px',
                minHeight: '44px',
                borderRadius: '12px',
                border: isVoted
                  ? '2px solid rgba(255,255,255,0.95)'
                  : '1.5px solid rgba(255,255,255,0.5)',
                background: 'transparent',
                color: '#fff',
                cursor: voted ? 'default' : 'pointer',
                transition: 'border-color 0.2s ease',
              }}
              aria-label={`Vote for: ${label}`}
              aria-pressed={isVoted}
            >
              {/* Selection highlight shown after voting */}
              {voted !== null && (
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: isVoted ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)',
                    transformOrigin: 'left center',
                  }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>
                {label}
                {isVoted && ' ✓'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Post-vote nudge */}
      <p role="status" style={{ color: '#fff', fontSize: '12px', textAlign: 'center', margin: voted || submitting || voteError ? '10px 0 0' : 0 }}>
        {voteError || (submitting ? 'Submitting vote…' : voted ? `You chose: ${voted === 'A' ? optionA : optionB}` : '')}
      </p>
    </div>
  );
};
