import React from 'react';
import { MentionStickerData } from '../types';

export const MentionSticker: React.FC<{ data: MentionStickerData }> = ({ data }) => {
  const { username, onTap } = data;

  return (
    <button
      onClick={onTap}
      data-interactive="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(10px)',
        color: '#000',
        fontWeight: 700,
        fontSize: '15px',
        padding: '7px 14px',
        borderRadius: '100px',
        border: 'none',
        cursor: onTap ? 'pointer' : 'default',
        boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        whiteSpace: 'nowrap',
        letterSpacing: '-0.01em',
      }}
      aria-label={`Mention: @${username}`}
    >
      <span style={{ opacity: 0.5, fontWeight: 400 }}>@</span>
      {username}
    </button>
  );
};

