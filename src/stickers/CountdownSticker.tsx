import React, { useEffect, useState } from 'react';
import { CountdownStickerData } from '../types';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function getTimeLeft(targetDate: string): TimeLeft {
  const diff = new Date(targetDate).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const s = Math.floor(diff / 1000);
  return {
    days:    Math.floor(s / 86400),
    hours:   Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    expired: false,
  };
}

const Unit: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '42px' }}>
    <span
      style={{
        fontSize: '28px',
        fontWeight: 800,
        color: '#fff',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.02em',
      }}
    >
      {String(value).padStart(2, '0')}
    </span>
    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.75)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>
      {label}
    </span>
  </div>
);

const Colon = () => (
  <span style={{ fontSize: '22px', fontWeight: 800, color: 'rgba(255,255,255,0.6)', marginBottom: '10px', lineHeight: 1 }}>
    :
  </span>
);

export const CountdownSticker: React.FC<{ data: CountdownStickerData }> = ({ data }) => {
  const { label, targetDate } = data;
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate));

  useEffect(() => {
    if (timeLeft.expired) return;
    const id = setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 1000);
    return () => clearInterval(id);
  }, [targetDate, timeLeft.expired]);

  return (
    <div
      style={{
        width: '200px',
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 40%, #fda085 100%)',
        borderRadius: '20px',
        padding: '14px 12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        textAlign: 'center',
      }}
    >
      {/* Hourglass */}
      <div style={{ fontSize: '22px', marginBottom: '4px' }}>⏳</div>

      {/* Label */}
      <p style={{ margin: '0 0 10px', color: '#fff', fontWeight: 700, fontSize: '13px', lineHeight: 1.3 }}>
        {label}
      </p>

      {timeLeft.expired ? (
        <p style={{ color: '#fff', fontWeight: 800, fontSize: '16px', margin: 0 }}>🎉 Time's up!</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '2px' }}>
          {timeLeft.days > 0 && (
            <>
              <Unit value={timeLeft.days} label="days" />
              <Colon />
            </>
          )}
          <Unit value={timeLeft.hours}   label="hrs"  />
          <Colon />
          <Unit value={timeLeft.minutes} label="min"  />
          <Colon />
          <Unit value={timeLeft.seconds} label="sec"  />
        </div>
      )}
    </div>
  );
};

