import React, { memo, useCallback } from 'react';
import { useStory } from '../context/StoryContext';

interface SegmentProps {
  index: number;
  setSegmentRef: (index: number, el: HTMLDivElement | null) => void;
  isRTL?: boolean;
}

/**
 * A single progress segment.
 * The fill bar is registered with the context so the rAF loop can write
 * scaleX directly to the DOM — zero React re-renders during animation.
 * Fills Left-to-Right in LTR, and Right-to-Left in RTL.
 */
const ProgressSegment = memo(({ index, setSegmentRef, isRTL }: SegmentProps) => {
  const refCallback = useCallback(
    (el: HTMLDivElement | null) => setSegmentRef(index, el),
    [index, setSegmentRef],
  );

  return (
    <div className="flex-1 h-[3px] bg-white/35 rounded-full overflow-hidden">
      <div
        ref={refCallback}
        className="h-full w-full bg-white rounded-full"
        style={{
          transformOrigin: isRTL ? 'right center' : 'left center',
          transform: 'scaleX(0)',
          willChange: 'transform',
        }}
      />
    </div>
  );
});

ProgressSegment.displayName = 'ProgressSegment';

export const StoryProgress: React.FC = () => {
  const { stories, activeIndex, setSegmentRef, config } = useStory();
  const isRTL =
    config.dir ? config.dir === 'rtl' :
    (typeof document !== 'undefined' &&
      (document.dir === 'rtl' || document.documentElement.dir === 'rtl'));

  return (
    <div
      role="progressbar"
      aria-label="Story progression"
      aria-valuemin={0}
      aria-valuemax={stories.length}
      aria-valuenow={stories.length ? activeIndex + 1 : 0}
      aria-valuetext={stories.length ? `Story ${activeIndex + 1} of ${stories.length}` : 'No stories'}
      dir={isRTL ? 'rtl' : 'ltr'}
      className="absolute top-0 left-0 w-full z-50 flex gap-[3px] px-2 pb-3 bg-gradient-to-b from-black/60 to-transparent pointer-events-none"
      style={{
        paddingTop: 'max(8px, env(safe-area-inset-top, 8px))',
      }}
    >
      {stories.map((story, i) => (
        <ProgressSegment
          key={story.id}
          index={i}
          setSegmentRef={setSegmentRef}
          isRTL={isRTL}
        />
      ))}
    </div>
  );
};
