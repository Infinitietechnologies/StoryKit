import React from 'react';
import { TextStickerData } from '../types';

const FONT_SIZE_MAP = {
  sm: '14px',
  md: '18px',
  lg: '24px',
  xl: '32px',
};

const neonGlow = (color: string) =>
  `0 0 6px ${color}, 0 0 18px ${color}, 0 0 40px ${color}`;

const outlineStyle = (color = '#000') =>
  `-1px -1px 0 ${color}, 1px -1px 0 ${color}, -1px 1px 0 ${color}, 1px 1px 0 ${color}`;

export const TextSticker: React.FC<{ data: TextStickerData }> = ({ data }) => {
  const {
    text,
    style = 'classic',
    color = '#ffffff',
    bgColor = 'rgba(0,0,0,0.55)',
    fontSize = 'md',
    align = 'center',
    bold = true,
  } = data;

  const fs = FONT_SIZE_MAP[fontSize];
  const fw = bold ? '700' : '400';

  const baseStyle: React.CSSProperties = {
    fontSize: fs,
    fontWeight: fw,
    textAlign: align,
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
    maxWidth: '240px',
    wordBreak: 'break-word',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  if (style === 'classic') {
    return (
      <div
        style={{
          ...baseStyle,
          color,
          background: bgColor,
          backdropFilter: 'blur(8px)',
          padding: '8px 14px',
          borderRadius: '12px',
        }}
      >
        {text}
      </div>
    );
  }

  if (style === 'modern') {
    return (
      <div
        style={{
          ...baseStyle,
          color,
          padding: '4px 8px',
          textShadow: '0 2px 8px rgba(0,0,0,0.8)',
        }}
      >
        {text}
      </div>
    );
  }

  if (style === 'neon') {
    return (
      <div
        style={{
          ...baseStyle,
          color,
          padding: '6px 12px',
          textShadow: neonGlow(color),
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '10px',
          border: `1.5px solid ${color}`,
        }}
      >
        {text}
      </div>
    );
  }

  if (style === 'outline') {
    return (
      <div
        style={{
          ...baseStyle,
          color,
          padding: '4px 8px',
          textShadow: outlineStyle('#000'),
        }}
      >
        {text}
      </div>
    );
  }

  // shadow
  return (
    <div
      style={{
        ...baseStyle,
        color,
        padding: '4px 8px',
        textShadow: '0 3px 12px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.8)',
      }}
    >
      {text}
    </div>
  );
};

