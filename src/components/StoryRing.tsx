import React, { useId } from 'react';
import { StoryRingProps } from '../types';

/**
 * Modern Instagram & WhatsApp-style Story Ring.
 *
 * Supports:
 * - Single continuous circle when count <= 1.
 * - Multi-segment arc ring when count > 1 (e.g. 3 stories = 3 separate circular segments).
 * - Partial seen state: viewed segments are clean gray, unviewed segments glow in Instagram gradient.
 * - Granular `segments` boolean array [true, false, false] or `count` + `seenCount`.
 * - Full backward compatibility with `seen?: boolean`.
 */
export const StoryRing: React.FC<StoryRingProps> = ({
  user,
  seen,
  count,
  seenCount,
  segments,
  onOpen,
  size = 68,
  strokeWidth = 2.8,
  gap = 3.5,
  seenColor = 'rgba(156, 163, 175, 0.55)',
  gradientColors,
  dir,
}) => {
  const gradientId = 'story_ring_grad_' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const isRTL =
    dir === 'rtl' ||
    (typeof document !== 'undefined' &&
      (document.dir === 'rtl' || document.documentElement.dir === 'rtl'));

  // ── Resolve segment array ──────────────────────────────────────────────────
  let resolvedSegments: boolean[];
  if (segments && segments.length > 0) {
    resolvedSegments = segments;
  } else if (count !== undefined && count > 0) {
    const actualSeen = seenCount ?? (seen ? count : 0);
    resolvedSegments = Array.from({ length: count }, (_, i) => i < actualSeen);
  } else {
    resolvedSegments = [seen ?? false];
  }

  const totalSegments = resolvedSegments.length;
  const viewedCount = resolvedSegments.filter(Boolean).length;
  const allSeen = viewedCount === totalSegments;
  const anyUnseen = !allSeen;

  // ── Geometry calculations ──────────────────────────────────────────────────
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Gap between SVG ring and inner avatar
  const avatarGap = 3;
  const avatarSize = Math.max(20, size - strokeWidth * 2 - avatarGap * 2);

  // Initials fallback
  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Multi-segment math
  const slice = circumference / totalSegments;
  const effectiveGap = Math.min(gap, slice * 0.45);
  const useRoundCaps = totalSegments > 1 && (slice - effectiveGap) > strokeWidth * 1.5;
  const dashLength = totalSegments === 1
    ? circumference
    : useRoundCaps
      ? Math.max(0.5, (slice - effectiveGap) - strokeWidth)
      : Math.max(0.5, slice - effectiveGap);
  const dashGap = totalSegments === 1 ? 0 : circumference - dashLength;

  const defaultStops = [
    { offset: '0%', color: '#f09433' },
    { offset: '25%', color: '#e6683c' },
    { offset: '50%', color: '#dc2743' },
    { offset: '75%', color: '#cc2366' },
    { offset: '100%', color: '#bc1888' },
  ];

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${viewedCount} of ${totalSegments} stories viewed from ${user.name}`}
      className="flex flex-col items-center gap-1.5 group focus:outline-none"
    >
      {/* Ring container with interactive hover scale and pulse */}
      <div
        data-storykit-animated="true"
        className={`relative flex items-center justify-center rounded-full transition-transform duration-200 ${
          allSeen ? '' : 'group-hover:scale-105 group-active:scale-95'
        }`}
        style={{
          width: size,
          height: size,
          animation: anyUnseen ? 'storyRingPulse 2.6s ease-in-out infinite' : undefined,
        }}
      >
        {/* SVG Ring */}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0 pointer-events-none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              {gradientColors
                ? gradientColors.map((col, idx) => (
                    <stop
                      key={idx}
                      offset={`${gradientColors.length === 1 ? 0 : (idx / (gradientColors.length - 1)) * 100}%`}
                      stopColor={col}
                    />
                  ))
                : defaultStops.map((s, idx) => (
                    <stop key={idx} offset={s.offset} stopColor={s.color} />
                  ))}
            </linearGradient>
          </defs>

          {/* In LTR (default), mirror horizontally so segment 0 is on the LEFT, progressing Left-to-Right */}
          <g
            transform={
              isRTL
                ? `rotate(-90 ${cx} ${cy})`
                : `translate(${size}, 0) scale(-1, 1) rotate(-90 ${cx} ${cy})`
            }
          >
            {totalSegments === 1 ? (
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={allSeen ? seenColor : `url(#${gradientId})`}
                strokeWidth={strokeWidth}
                style={{ transition: 'stroke 0.3s ease' }}
              />
            ) : (
              resolvedSegments.map((isSegmentSeen, idx) => {
                const startDistance =
                  idx * slice + (effectiveGap / 2) + (useRoundCaps ? strokeWidth / 2 : 0);

                return (
                  <circle
                    key={idx}
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="none"
                    stroke={isSegmentSeen ? seenColor : `url(#${gradientId})`}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${dashLength} ${dashGap}`}
                    strokeDashoffset={-startDistance}
                    strokeLinecap={useRoundCaps ? 'round' : 'butt'}
                    style={{ transition: 'stroke 0.3s ease' }}
                  />
                );
              })
            )}
          </g>
        </svg>

        {/* Avatar with clean dark gap separation */}
        <div
          className="rounded-full overflow-hidden bg-gray-800 flex items-center justify-center ring-[2px] ring-black"
          style={{ width: avatarSize, height: avatarSize }}
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-full h-full object-cover select-none"
              draggable={false}
            />
          ) : (
            <span
              className="text-white font-semibold select-none"
              style={{ fontSize: avatarSize * 0.36 }}
            >
              {initials}
            </span>
          )}
        </div>
      </div>

      {/* Username label */}
      <span
        className={`text-xs font-medium max-w-[76px] truncate text-center transition-colors ${
          allSeen ? 'text-white/40' : 'text-white'
        }`}
      >
        {user.name}
      </span>

      {/* Keyframe animation for active pulse */}
      <style>{`
        @keyframes storyRingPulse {
          0%, 100% { filter: drop-shadow(0 0 0 rgba(220,39,67,0)); }
          50%       { filter: drop-shadow(0 0 5px rgba(220,39,67,0.35)); }
        }
      `}</style>
    </button>
  );
};
