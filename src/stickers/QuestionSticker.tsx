import React, { useRef, useState } from 'react';
import { QuestionStickerData } from '../types';

interface QuestionStickerProps {
  data: QuestionStickerData;
  /** Injected by DynamicOverlay from story context */
  pause?: () => void;
  resume?: () => void;
}

export const QuestionSticker: React.FC<QuestionStickerProps> = ({ data, pause, resume }) => {
  const { prompt, placeholder = 'Type something…', onSubmit } = data;
  const [value, setValue]       = useState('');
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFocus = () => pause?.();          // Stop story timer while user types
  const handleBlur  = () => { if (!submitted) resume?.(); };  // Resume only if not submitted

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit?.(trimmed);
    setSubmitted(true);
    resume?.();                                  // Resume story after submitting
    inputRef.current?.blur();
  };

  return (
    <div
      data-interactive="true"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      style={{
        width: '228px',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header — Instagram purple → red → amber gradient */}
      <div
        style={{
          background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span style={{ fontSize: '16px' }}>🤔</span>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '13px' }}>
          Ask me anything
        </span>
      </div>

      {/* Question prompt */}
      <div style={{ background: 'rgba(255,255,255,0.96)', padding: '10px 14px 6px' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: '#000', lineHeight: 1.35, textAlign: 'center' }}>
          {prompt}
        </p>
      </div>

      {/* Input area */}
      {submitted ? (
        <div style={{ background: '#fff', padding: '12px 14px', textAlign: 'center' }}>
          <span style={{ fontSize: '22px' }}>🙏</span>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#555', fontWeight: 600 }}>
            Response sent!
          </p>
        </div>
      ) : (
        <div
          style={{
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 10px',
            borderTop: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={handleFocus}   // ← pauses story
            onBlur={handleBlur}     // ← resumes story
            onKeyDown={(e) => {
              e.stopPropagation();  // prevent Space/Arrow keys from triggering story nav
              if (e.key === 'Enter') handleSubmit();
            }}
            placeholder={placeholder}
            maxLength={150}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '13px',
              color: '#000',
              background: 'transparent',
              fontFamily: 'inherit',
            }}
            aria-label="Your answer"
          />
          {value.trim() && (
            <button
              onClick={handleSubmit}
              data-interactive="true"
              style={{
                background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 100%)',
                border: 'none',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'transform 0.15s ease',
              }}
              aria-label="Send answer"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
