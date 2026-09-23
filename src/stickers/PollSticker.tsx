import React, { useState } from 'react';
import { PollStickerData } from '../types';

interface PollStickerProps {
  data: PollStickerData;
  /** Injected by DynamicOverlay from story context */
  pause?: () => void;
  resume?: () => void;
}

export const PollSticker: React.FC<PollStickerProps> = ({ data, pause, resume }) => {
  const { question, optionA, optionB, onVote } = data;
  const [voted, setVoted] = useState<'A' | 'B' | null>(null);

  // Simulated base vote distribution (real apps pass these via data.initialVotes)
  const base = { A: 48, B: 52 };
  const total  = (base.A + base.B) + (voted ? 1 : 0);
  const countA = base.A + (voted === 'A' ? 1 : 0);
  const pctA   = Math.round((countA / total) * 100);
  const pctB   = 100 - pctA;

  const handleVote = (option: 'A' | 'B') => {
    if (voted) return;
    setVoted(option);
    onVote?.(option);
    // Resume story after vote so it continues
    resume?.();
  };

  return (
    <div
      data-interactive="true"
      onPointerDown={(e) => {
        e.stopPropagation();
        pause?.();
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        if (!voted) resume?.();
      }}
      style={{
        width: '220px',
        background: 'rgba(255,255,255,0.15)',
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
      <p style={{ color: '#fff', fontWeight: 700, fontSize: '12px', textAlign: 'center', margin: '0 0 2px', opacity: 0.7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
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
          const pct     = opt === 'A' ? pctA : pctB;
          const isVoted = voted === opt;

          return (
            <button
              type="button"
              key={opt}
              onClick={() => handleVote(opt)}
              data-interactive="true"
              disabled={voted !== null}
              style={{
                position: 'relative',
                overflow: 'hidden',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '14px',
                padding: '10px 14px',
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
            >
              {/* Animated fill bar shown after voting */}
              {voted !== null && (
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: isVoted ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                    transformOrigin: 'left center',
                    transform: `scaleX(${pct / 100})`,
                    transition: 'transform 0.55s cubic-bezier(0.22,1,0.36,1)',
                  }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>
                {voted !== null ? `${label}  ${pct}%` : label}
                {isVoted && ' ✓'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Post-vote nudge */}
      {voted && (
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', textAlign: 'center', margin: '10px 0 0' }}>
          Thanks for voting!
        </p>
      )}
    </div>
  );
};
