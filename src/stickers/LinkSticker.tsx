import React from 'react';
import { LinkStickerData } from '../types';

export const LinkSticker: React.FC<{ data: LinkStickerData }> = ({ data }) => {
  const { url, label = 'See More' } = data;

  const handleClick = () => {
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
      window.open(parsed.href, '_blank', 'noopener,noreferrer');
    } catch {
      // Invalid or unsupported URLs are intentionally ignored.
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      data-interactive="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)',
        color: '#000',
        fontWeight: 700,
        fontSize: '14px',
        padding: '9px 16px 9px 12px',
        borderRadius: '100px',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        whiteSpace: 'nowrap',
        letterSpacing: '-0.01em',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.04)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
      aria-label={`Open link: ${label}`}
    >
      {/* Chain link icon */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      {label}
      {/* Arrow */}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </button>
  );
};
