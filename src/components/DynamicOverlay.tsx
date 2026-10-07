import React, { useCallback } from 'react';
import { useStory } from '../context/StoryContext';
import { StoryOverlay } from '../types';

// ── Sticker components ────────────────────────────────────────────────────────
import { TextSticker }      from '../stickers/TextSticker';
import { EmojiSticker }     from '../stickers/EmojiSticker';
import { MentionSticker }   from '../stickers/MentionSticker';
import { HashtagSticker }   from '../stickers/HashtagSticker';
import { LocationSticker }  from '../stickers/LocationSticker';
import { LinkSticker }      from '../stickers/LinkSticker';
import { PollSticker }      from '../stickers/PollSticker';
import { QuestionSticker }  from '../stickers/QuestionSticker';
import { MusicSticker }     from '../stickers/MusicSticker';
import { CountdownSticker } from '../stickers/CountdownSticker';

// ── Sticker dispatcher — injects context (pause/resume + config callbacks) ───
const StickerContent: React.FC<{ overlay: StoryOverlay }> = ({ overlay }) => {
  const { pause, resume, config, playbackKey } = useStory();
  const pauseReason = `overlay:${playbackKey}:${overlay.id}`;
  const pauseOverlay = useCallback(() => pause(pauseReason), [pause, pauseReason]);
  const resumeOverlay = useCallback(() => resume(pauseReason), [resume, pauseReason]);

  switch (overlay.type) {
    case 'text':      return <TextSticker      data={overlay.data} />;
    case 'emoji':     return <EmojiSticker     data={overlay.data} />;
    case 'location':  return <LocationSticker  data={overlay.data} />;
    case 'link':      return <LinkSticker      data={overlay.data} />;
    case 'music':     return <MusicSticker     data={overlay.data} />;
    case 'countdown': return <CountdownSticker data={overlay.data} />;

    case 'mention': {
      const onTap = overlay.data.onTap
        ?? (config.onMention ? () => config.onMention!(overlay.data.username) : undefined);
      return <MentionSticker data={{ ...overlay.data, onTap }} />;
    }
    case 'hashtag': {
      const onTap = overlay.data.onTap
        ?? (config.onHashtag ? () => config.onHashtag!(overlay.data.tag) : undefined);
      return <HashtagSticker data={{ ...overlay.data, onTap }} />;
    }

    case 'poll':     return <PollSticker     data={overlay.data} pause={pauseOverlay} resume={resumeOverlay} />;
    case 'question': return <QuestionSticker data={overlay.data} pause={pauseOverlay} resume={resumeOverlay} />;
    case 'custom':   return <>{overlay.content}</>;
    default:         return null;
  }
};

// ── Single positioned overlay ─────────────────────────────────────────────────
/**
 * No window-based clamping here — the story card itself has overflow:hidden
 * so anything outside is naturally clipped. The old useKeepInViewport was
 * comparing against window bounds, which pushed stickers outside the card.
 */
const OverlayNode: React.FC<{
  overlay: StoryOverlay;
}> = ({ overlay }) => {
  const x = Math.min(100, Math.max(0, overlay.x));
  const y = Math.min(100, Math.max(0, overlay.y));

  return (
    <div
      className="absolute pointer-events-auto"
      data-overlay="true"
      style={{
        top:  `${y}%`,
        left: `${x}%`,
        // Nudge inward if sticker would overflow card edge
        // We clamp via CSS so no JS layout thrashing is needed
        maxWidth: `calc(100% - ${x}% - 8px)`,
      }}
    >
      <StickerContent overlay={overlay} />
    </div>
  );
};

// ── Public component ──────────────────────────────────────────────────────────
export const DynamicOverlay: React.FC = () => {
  const { stories, activeIndex, isLoaded, playbackKey } = useStory();
  const story = stories[activeIndex];
  if (!isLoaded || !story?.overlays?.length) return null;

  return (
    // overflow:hidden clips any sticker that goes outside the card bounds
    <div className="z-40 absolute inset-0 pointer-events-none overflow-hidden">
      {story.overlays.map((overlay) => (
        <OverlayNode key={`${playbackKey}:${overlay.id}`} overlay={overlay} />
      ))}
    </div>
  );
};
