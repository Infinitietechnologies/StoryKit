import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
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
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const promptId = useId();
  const callbacksRef = useRef({ pause, resume });
  callbacksRef.current = { pause, resume };
  const pausedRef = useRef(false);
  const submittingRef = useRef(false);
  const submitVersionRef = useRef(0);

  const releaseFocusPause = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    callbacksRef.current.resume?.();
  }, []);

  useEffect(() => {
    inputRef.current?.blur();
    submitVersionRef.current += 1;
    setValue('');
    setSubmitted(false);
    setSubmitting(false);
    setSubmitError('');
    submittingRef.current = false;
    return () => {
      submitVersionRef.current += 1;
      releaseFocusPause();
    };
  }, [prompt, placeholder, releaseFocusPause]);

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (!trimmed || !onSubmit || submittingRef.current) return;
    const version = ++submitVersionRef.current;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(trimmed);
      if (version !== submitVersionRef.current) return;
      inputRef.current?.blur();
      setSubmitted(true);
      releaseFocusPause();
    } catch {
      if (version !== submitVersionRef.current) return;
      setSubmitError('Response could not be submitted. Try again.');
    } finally {
      if (version === submitVersionRef.current) {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  };

  return (
    <div
      data-interactive="true"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerCancel={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key !== 'Tab' && e.key !== 'Escape') e.stopPropagation();
      }}
      onFocus={() => {
        if (pausedRef.current || !callbacksRef.current.pause) return;
        pausedRef.current = true;
        callbacksRef.current.pause();
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) releaseFocusPause();
      }}
      aria-busy={submitting}
      style={{
        width: '228px',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Deep gradient keeps the header readable over any story. */}
      <div
        style={{
          background: 'linear-gradient(135deg, #6b21a8 0%, #be123c 50%, #92400e 100%)',
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
        <p id={promptId} style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: '#000', lineHeight: 1.35, textAlign: 'center' }}>
          {prompt}
        </p>
      </div>

      {/* Input area */}
      {submitted ? (
        <div style={{ background: '#fff', padding: '12px 14px', textAlign: 'center' }}>
          <span style={{ fontSize: '22px' }}>🙏</span>
          <p role="status" style={{ margin: '4px 0 0', fontSize: '12px', color: '#555', fontWeight: 600 }}>
            Response submitted!
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
            onChange={(e) => {
              setValue(e.target.value);
              setSubmitError('');
            }}
            disabled={!onSubmit}
            readOnly={submitting}
            onKeyDown={(e) => {
              if (e.key !== 'Tab' && e.key !== 'Escape') e.stopPropagation();
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void handleSubmit();
              }
              if (e.key === 'Escape') {
                inputRef.current?.blur();
              }
            }}
            placeholder={onSubmit ? placeholder : 'Answers unavailable'}
            maxLength={150}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: '44px',
              border: 'none',
              fontSize: '16px',
              color: '#000',
              background: 'transparent',
              fontFamily: 'inherit',
            }}
            aria-label="Your answer"
            aria-describedby={promptId}
          />
          {value.trim() && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              data-interactive="true"
              style={{
                background: 'linear-gradient(135deg, #6b21a8 0%, #be123c 100%)',
                border: 'none',
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: submitting ? 'wait' : 'pointer',
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
      {!submitted && (submitting || submitError) && (
        <p role="status" style={{ margin: 0, padding: '8px 10px', background: '#fff', color: '#444', textAlign: 'center', fontSize: '12px' }}>
          {submitError || 'Submitting response…'}
        </p>
      )}
    </div>
  );
};
