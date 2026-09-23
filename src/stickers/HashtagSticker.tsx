import React from 'react';
import { HashtagStickerData } from '../types';

export const HashtagSticker: React.FC<{ data: HashtagStickerData }> = ({ data }) => {
  const { tag, onTap } = data;

  return (
    <button
      onClick={onTap}
      data-interactive="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.18)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        color: '#fff',
        fontWeight: 700,
        fontSize: '15px',
        padding: '7px 14px',
        borderRadius: '100px',
        border: '1.5px solid rgba(255,255,255,0.4)',
        cursor: onTap ? 'pointer' : 'default',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        whiteSpace: 'nowrap',
        letterSpacing: '-0.01em',
      }}
      aria-label={`Hashtag: #${tag}`}
    >
      <span style={{ opacity: 0.7, marginRight: '1px' }}>#</span>
      {tag}
    </button>
  );
};

