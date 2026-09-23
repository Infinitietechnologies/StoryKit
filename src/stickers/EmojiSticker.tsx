import React from 'react';
import { EmojiStickerData } from '../types';

const SIZE_MAP = { sm: '32px', md: '48px', lg: '64px', xl: '80px' };

export const EmojiSticker: React.FC<{ data: EmojiStickerData }> = ({ data }) => {
  const { emoji, size = 'lg' } = data;
  return (
    <span
      role="img"
      aria-label={emoji}
      style={{
        fontSize: SIZE_MAP[size],
        lineHeight: 1,
        display: 'block',
        userSelect: 'none',
        filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))',
      }}
    >
      {emoji}
    </span>
  );
};

