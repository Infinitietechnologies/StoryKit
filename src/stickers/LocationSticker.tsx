import React from 'react';
import { LocationStickerData } from '../types';

export const LocationSticker: React.FC<{ data: LocationStickerData }> = ({ data }) => {
  const { name, onTap } = data;

  return (
    <button
      type="button"
      onClick={onTap}
      data-interactive="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(10px)',
        color: '#000',
        fontWeight: 600,
        fontSize: '14px',
        padding: '7px 12px 7px 9px',
        borderRadius: '100px',
        border: 'none',
        cursor: onTap ? 'pointer' : 'default',
        boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        whiteSpace: 'nowrap',
        maxWidth: '200px',
      }}
      aria-label={`Location: ${name}`}
    >
      {/* Pin SVG */}
      <svg width="14" height="16" viewBox="0 0 14 16" fill="none" style={{ flexShrink: 0 }}>
        <path
          d="M7 0C4.24 0 2 2.24 2 5c0 3.75 5 11 5 11s5-7.25 5-11c0-2.76-2.24-5-5-5zm0 6.5A1.5 1.5 0 1 1 7 3.5a1.5 1.5 0 0 1 0 3z"
          fill="#E03131"
        />
      </svg>
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
    </button>
  );
};
