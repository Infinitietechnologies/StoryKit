import React, { useEffect, useRef, useState } from 'react';
import { MusicStickerData } from '../types';

// Inject keyframes once
let injected = false;
function ensureStyles() {
  if (injected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes musicMarquee {
      0%   { transform: translateX(0%); }
      100% { transform: translateX(-50%); }
    }
    @keyframes musicBeat {
      0%, 100% { transform: scaleY(0.35); }
      50%       { transform: scaleY(1); }
    }
  `;
  document.head.appendChild(s);
  injected = true;
}

export const MusicSticker: React.FC<{ data: MusicStickerData }> = ({ data }) => {
  ensureStyles();
  const { title, artist, albumArtUrl } = data;

  // Measure the TEXT SPAN — not the overflow-hidden container — to detect overflow correctly
  const spanRef      = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [needsMarquee, setNeedsMarquee] = useState(false);

  useEffect(() => {
    // rAF ensures the DOM has been painted before measuring
    const raf = requestAnimationFrame(() => {
      const span      = spanRef.current;
      const container = containerRef.current;
      if (span && container) {
        setNeedsMarquee(span.scrollWidth > container.clientWidth);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [title, artist]);

  // Duplicate text so the marquee loops seamlessly
  const label = `${title}  ·  ${artist}   `;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(0,0,0,0.64)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '100px',
        padding: albumArtUrl ? '6px 16px 6px 6px' : '9px 16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
        maxWidth: '240px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        border: '1px solid rgba(255,255,255,0.14)',
      }}
    >
      {/* Album art OR animated equalizer bars */}
      {albumArtUrl ? (
        <img
          src={albumArtUrl}
          alt={title}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            objectFit: 'cover',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        />
      ) : (
        <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '16px', flexShrink: 0, padding: '0 2px' }}>
          {[0.35, 0.65, 1, 0.7, 0.4].map((h, i) => (
            <div
              key={i}
              style={{
                width: '3px',
                height: '100%',
                background: '#fff',
                borderRadius: '2px',
                transformOrigin: 'bottom',
                animation: `musicBeat ${0.55 + i * 0.12}s ease-in-out infinite`,
                animationDelay: `${i * 0.08}s`,
                transform: `scaleY(${h})`,
              }}
            />
          ))}
        </div>
      )}

      {/* Scrolling text container */}
      <div
        ref={containerRef}
        style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}
      >
        {/* Title + artist — one line, marquee if overflow */}
        <div
          style={
            needsMarquee
              ? { display: 'inline-block', whiteSpace: 'nowrap', animation: 'musicMarquee 7s linear infinite' }
              : { display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
          }
        >
          <span ref={spanRef} style={{ color: '#fff', fontWeight: 700, fontSize: '13px' }}>
            {label}
            {/* Duplicate for seamless loop — only rendered when marquee active */}
            {needsMarquee && label}
          </span>
        </div>

        {/* Artist sub-line — shown only when NOT marquee-ing */}
        {!needsMarquee && (
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {artist}
          </div>
        )}
      </div>
    </div>
  );
};
