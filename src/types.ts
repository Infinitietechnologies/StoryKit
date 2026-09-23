import { ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// User
// ─────────────────────────────────────────────────────────────────────────────

export interface StoryUser {
  id: string;
  name: string;
  avatarUrl?: string;
  /** Display string, e.g. "2h ago" */
  timestamp?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sticker data payloads (one interface per sticker type)
// ─────────────────────────────────────────────────────────────────────────────

export interface TextStickerData {
  text: string;
  /** Visual style preset */
  style?: 'classic' | 'modern' | 'neon' | 'outline' | 'shadow';
  /** CSS colour for text (default: white) */
  color?: string;
  /** CSS colour for background pill (only used in classic style) */
  bgColor?: string;
  fontSize?: 'sm' | 'md' | 'lg' | 'xl';
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
}

export interface EmojiStickerData {
  emoji: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface MentionStickerData {
  username: string;
  /** Optional callback when tapped */
  onTap?: () => void;
}

export interface HashtagStickerData {
  /** Tag text WITHOUT the leading # */
  tag: string;
  onTap?: () => void;
}

export interface LocationStickerData {
  name: string;
  onTap?: () => void;
}

export interface LinkStickerData {
  url: string;
  /** Button label (default: "See More") */
  label?: string;
}

export interface PollStickerData {
  question: string;
  optionA: string;
  optionB: string;
  /** Called when the viewer votes */
  onVote?: (option: 'A' | 'B') => void;
}

export interface QuestionStickerData {
  prompt: string;
  placeholder?: string;
  onSubmit?: (answer: string) => void;
}

export interface MusicStickerData {
  title: string;
  artist: string;
  albumArtUrl?: string;
}

export interface CountdownStickerData {
  label: string;
  /** ISO 8601 date string for the target date/time */
  targetDate: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// StoryOverlay — strongly-typed discriminated union
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base positioning shared by every overlay variant.
 * x / y are percentage offsets from the top-left of the story card (0–100).
 */
interface OverlayBase {
  id: string;
  /** Left offset as a percentage of story width (0–100) */
  x: number;
  /** Top offset as a percentage of story height (0–100) */
  y: number;
}

export type StoryOverlay =
  | (OverlayBase & { type: 'text';      data: TextStickerData })
  | (OverlayBase & { type: 'emoji';     data: EmojiStickerData })
  | (OverlayBase & { type: 'mention';   data: MentionStickerData })
  | (OverlayBase & { type: 'hashtag';   data: HashtagStickerData })
  | (OverlayBase & { type: 'location';  data: LocationStickerData })
  | (OverlayBase & { type: 'link';      data: LinkStickerData })
  | (OverlayBase & { type: 'poll';      data: PollStickerData })
  | (OverlayBase & { type: 'question';  data: QuestionStickerData })
  | (OverlayBase & { type: 'music';     data: MusicStickerData })
  | (OverlayBase & { type: 'countdown'; data: CountdownStickerData })
  /** Backward-compatible escape hatch for custom JSX */
  | (OverlayBase & { type: 'custom';    content: ReactNode });

/** @deprecated Use StoryOverlay instead */
export type OverlayItem = StoryOverlay;

// ─────────────────────────────────────────────────────────────────────────────
// Story item
// ─────────────────────────────────────────────────────────────────────────────

export interface StoryItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  /** Duration in ms for images (default: 5000) */
  duration?: number;
  overlays?: StoryOverlay[];
  altText?: string;
  actionLink?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context types
// ─────────────────────────────────────────────────────────────────────────────

/** NOTE: progress is NOT in state — written directly to DOM refs for zero-jank animation */
export interface StoryState {
  activeIndex: number;
  isPaused: boolean;
  isLoaded: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  error: string | null;
}

export interface StoryActions {
  next: () => void;
  prev: () => void;
  pause: () => void;
  resume: () => void;
  setLoaded: (val: boolean) => void;
  setBuffering: (val: boolean) => void;
  toggleMute: () => void;
  reset: (targetIndex?: number) => void;
  setError: (err: string | null) => void;
  /** Register a fill-bar DOM element so the rAF loop can write scaleX directly */
  setSegmentRef: (index: number, el: HTMLDivElement | null) => void;
  /** Write video progress (0-100) directly to the DOM ref */
  seekVideoProgress: (index: number, valuePct: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Story ring props
// ─────────────────────────────────────────────────────────────────────────────

export interface StoryRingProps {
  /** The user whose stories to display */
  user: StoryUser;
  /** Whether all stories have been seen (backward-compatible single-ring toggle) */
  seen?: boolean;
  /** Total number of story segments (e.g. 3). If > 1, renders an authentic segmented arc ring. */
  count?: number;
  /** Number of seen story segments (from 0 to count). Defaults to count if seen=true, or 0. */
  seenCount?: number;
  /** Granular boolean array for each segment [true, false, false]. Takes priority over seenCount. */
  segments?: boolean[];
  /** Called when the ring is clicked — use this to open StoryViewer */
  onOpen: () => void;
  /** Override ring diameter in px (default: 68) */
  size?: number;
  /** Ring stroke thickness in px (default: 3) */
  strokeWidth?: number;
  /** Gap between segments in px (default: 3.5) */
  gap?: number;
  /** Custom seen stroke color (default: 'rgba(156, 163, 175, 0.65)') */
  seenColor?: string;
  /** Custom gradient color stops for unseen segments */
  gradientColors?: string[];
  /** Direction for read progression: 'ltr' (left-to-right, default) or 'rtl' (right-to-left) */
  dir?: 'ltr' | 'rtl';
}

// ─────────────────────────────────────────────────────────────────────────────
// Viewer config
// ─────────────────────────────────────────────────────────────────────────────

export interface ViewerConfig {
  keyboardNavigation?: boolean;
  defaultDuration?: number;
  /** Start videos muted so browser autoplay remains reliable. Defaults to true. */
  defaultMuted?: boolean;
  preloadCount?: number;
  /** Index of the story to start playback from (e.g. first unviewed story). Defaults to 0. */
  initialStoryIndex?: number;
  /** Called when a story media successfully loads and begins being viewed by the user */
  onStoryViewed?: (index: number, story: StoryItem) => void;
  /** Called when a story finishes its duration or user advances past it */
  onStoryEnd?: (index?: number, story?: StoryItem) => void;
  /** Called when the active story index changes */
  onStoryChange?: (index: number, story: StoryItem) => void;
  onAllStoriesEnd?: () => void;
  /** Called when user navigates backwards past the first story */
  onStartReached?: () => void;
  onClose?: () => void;
  onOpen?: () => void;
  /** Called when viewer submits a reply message */
  onReply?: (message: string, storyId: string) => void;
  /** Called when viewer taps the like/heart button */
  onLike?: (storyId: string) => void;
  /** Called when viewer taps the share button */
  onShare?: (storyId: string) => void;
  /** Called when viewer taps a @mention sticker */
  onMention?: (username: string) => void;
  /** Called when viewer taps a #hashtag sticker */
  onHashtag?: (tag: string) => void;
  /** Set false to hide the bottom footer bar */
  showFooter?: boolean;
  /** Direction for progress bar and story navigation: 'ltr' (left-to-right, default) or 'rtl' */
  dir?: 'ltr' | 'rtl';
}
