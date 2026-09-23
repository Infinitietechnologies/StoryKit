import { useState } from 'react';
import {
  StoryRing,
  StoryViewer,
  StoryItem,
  StoryUser,
} from 'react-storykit';

// ── Helper: date N seconds from now ──────────────────────────────────────────
const fromNow = (seconds: number) =>
  new Date(Date.now() + seconds * 1000).toISOString();

// ── Story data ────────────────────────────────────────────────────────────────
const USERS: { user: StoryUser; stories: StoryItem[] }[] = [
  {
    user: {
      id: 'u1',
      name: 'Aria Chen',
      avatarUrl: 'https://i.pravatar.cc/150?img=47',
      timestamp: '2h ago',
    },
    stories: [
      {
        id: 's1-1',
        url: 'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?q=80&w=900&auto=format&fit=crop',
        type: 'image',
        duration: 7000,
        overlays: [
          {
            id: 'txt1',
            type: 'text',
            x: 8, y: 58,
            data: { text: 'Golden hour vibes ✨', style: 'classic', fontSize: 'lg', bold: true },
          },
          {
            id: 'loc1',
            type: 'location',
            x: 8, y: 72,
            data: { name: 'Sahara Desert, Morocco' },
          },
          {
            id: 'music1',
            type: 'music',
            x: 8, y: 8,
            data: { title: 'Golden Hour', artist: 'JVKE' },
          },
        ],
      },
      {
        id: 's1-2',
        url: 'https://images.unsplash.com/photo-1707343843437-caacff5cfa74?q=80&w=900&auto=format&fit=crop',
        type: 'image',
        duration: 8000,
        overlays: [
          {
            id: 'poll1',
            type: 'poll',
            x: 10, y: 35,
            data: {
              question: 'Which do you prefer?',
              optionA: '🌄 Sunrise',
              optionB: '🌅 Sunset',
              onVote: (opt) => console.log('Voted:', opt),
            },
          },
          {
            id: 'emoji1',
            type: 'emoji',
            x: 72, y: 70,
            data: { emoji: '🔥', size: 'xl' },
          },
        ],
      },
      {
        id: 's1-3',
        url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=900&auto=format&fit=crop',
        type: 'image',
        duration: 8000,
        overlays: [
          {
            id: 'q1',
            type: 'question',
            x: 8, y: 28,
            data: {
              prompt: 'What should I explore next? 🗺️',
              placeholder: 'Drop your suggestion…',
              onSubmit: (ans) => console.log('Answer:', ans),
            },
          },
          {
            id: 'hash1',
            type: 'hashtag',
            x: 8, y: 76,
            data: { tag: 'travel' },
          },
          {
            id: 'hash2',
            type: 'hashtag',
            x: 40, y: 76,
            data: { tag: 'adventure' },
          },
        ],
      },
    ],
  },
  {
    user: {
      id: 'u2',
      name: 'Sam Park',
      avatarUrl: 'https://i.pravatar.cc/150?img=12',
      timestamp: '5h ago',
    },
    stories: [
      {
        id: 's2-1',
        url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=900&auto=format&fit=crop',
        type: 'image',
        duration: 7000,
        overlays: [
          {
            id: 'txt2',
            type: 'text',
            x: 8, y: 10,
            data: { text: 'Peak season is HERE', style: 'neon', color: '#00e5ff', fontSize: 'lg' },
          },
          {
            id: 'cd1',
            type: 'countdown',
            x: 8, y: 36,
            data: { label: 'Summit attempt in…', targetDate: fromNow(3600 * 18) },
          },
          {
            id: 'mention1',
            type: 'mention',
            x: 8, y: 74,
            data: { username: 'alpineguide', onTap: () => console.log('@alpineguide tapped') },
          },
        ],
      },
      {
        id: 's2-2',
        url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=900&auto=format&fit=crop',
        type: 'image',
        duration: 6000,
        overlays: [
          {
            id: 'txt3',
            type: 'text',
            x: 8, y: 12,
            data: { text: 'Untouched wilderness 🌿', style: 'shadow', fontSize: 'md' },
          },
          {
            id: 'link1',
            type: 'link',
            x: 20, y: 74,
            data: { url: 'https://unsplash.com', label: 'View Full Gallery' },
          },
        ],
      },
    ],
  },
  {
    user: {
      id: 'u3',
      name: 'Jamie Lee',
      timestamp: '1d ago',
    },
    stories: [
      {
        id: 's3-1',
        url: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?q=80&w=900&auto=format&fit=crop',
        type: 'image',
        duration: 6000,
        overlays: [
          {
            id: 'txt4',
            type: 'text',
            x: 8, y: 16,
            data: { text: 'Morning calm', style: 'outline', fontSize: 'lg' },
          },
          {
            id: 'emoji2',
            type: 'emoji',
            x: 76, y: 14,
            data: { emoji: '🌊', size: 'md' },
          },
          {
            id: 'music2',
            type: 'music',
            x: 8, y: 68,
            data: {
              title: 'Ocean Eyes',
              artist: 'Billie Eilish',
              albumArtUrl: 'https://i.scdn.co/image/ab67616d0000b273a91c10fe9472d9bd89802e5a',
            },
          },
        ],
      },
    ],
  },
];

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [activeStartIndex, setActiveStartIndex] = useState<number>(0);

  // Granular set of individual story IDs that have been viewed
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set());

  /** Calculate first unviewed story index for a given user (starts at 0 if all viewed) */
  const getFirstUnviewedIndex = (userEntry: typeof USERS[number]) => {
    const idx = userEntry.stories.findIndex((s) => !viewedStoryIds.has(s.id));
    return idx === -1 ? 0 : idx;
  };

  /** Open viewer for a user */
  const handleOpen = (i: number) => {
    const start = getFirstUnviewedIndex(USERS[i]);
    setActiveStartIndex(start);
    setOpenIndex(i);
  };

  /** Close viewer */
  const handleClose = () => {
    setOpenIndex(null);
  };

  /**
   * Called when all stories of the current user finish naturally.
   * Auto-advances to the next user in line; closes if at the end.
   */
  const handleAllEnd = () => {
    if (openIndex === null) return;

    const nextUserIdx = openIndex + 1;
    if (nextUserIdx < USERS.length) {
      const nextStart = getFirstUnviewedIndex(USERS[nextUserIdx]);
      setActiveStartIndex(nextStart);
      setOpenIndex(nextUserIdx);
    } else {
      setOpenIndex(null);
    }
  };

  /**
   * Called when user navigates backwards past the first story of the current user.
   * Seamlessly navigates to the previous user in line.
   */
  const handleStartReached = () => {
    if (openIndex !== null && openIndex > 0) {
      const prevUserIdx = openIndex - 1;
      const prevStart = getFirstUnviewedIndex(USERS[prevUserIdx]);
      setActiveStartIndex(prevStart);
      setOpenIndex(prevUserIdx);
    }
  };

  /** Reset all viewed statuses for testing */
  const handleResetAll = () => {
    setViewedStoryIds(new Set());
  };

  const active = openIndex !== null ? USERS[openIndex] : null;

  return (
    <div className="min-h-full flex flex-col items-center justify-start pt-10 px-6 gap-9">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white tracking-tight">Stories &amp; Status</h1>
        <p className="text-white/45 text-xs mt-1">
          Multi-Segment Status Rings · Partial Progress Tracking · Auto-Resume
        </p>
      </div>

      {/* Story rings row */}
      <div className="flex items-start gap-7">
        {USERS.map((entry, i) => {
          const segments = entry.stories.map((s) => viewedStoryIds.has(s.id));
          const seenCount = segments.filter(Boolean).length;
          const totalCount = entry.stories.length;

          return (
            <div key={entry.user.id} className="flex flex-col items-center gap-1.5">
              <StoryRing
                user={entry.user}
                segments={segments}
                count={totalCount}
                seenCount={seenCount}
                onOpen={() => handleOpen(i)}
                size={72}
              />
              {/* Segmented status badge */}
              <span className="text-[11px] tracking-wide font-medium">
                {seenCount === totalCount && totalCount > 0 ? (
                  <span className="text-white/35">All viewed</span>
                ) : seenCount > 0 ? (
                  <span className="text-amber-400 font-semibold">{seenCount}/{totalCount} viewed</span>
                ) : (
                  <span className="text-rose-400 font-semibold">{totalCount} new</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Helper notes & reset button */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-white/30 text-[11px] text-center leading-relaxed max-w-sm">
          Watch 1 story and close (Esc/swipe ↓). The ring displays partial progress (gray seen segment + gradient unseen segments), and reopening resumes from the first unviewed story.
        </p>
        {viewedStoryIds.size > 0 && (
          <button
            onClick={handleResetAll}
            className="text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all duration-150 border border-white/10"
          >
            ↺ Reset viewed stories ({viewedStoryIds.size})
          </button>
        )}
      </div>

      {/* Full-screen Story Viewer */}
      {active && (
        <StoryViewer
          isOpen={openIndex !== null}
          onClose={handleClose}
          stories={active.stories}
          user={active.user}
          initialStoryIndex={activeStartIndex}
          config={{
            initialStoryIndex: activeStartIndex,
            onStoryViewed: (_idx, story) => {
              // Only marks as viewed AFTER media has successfully loaded and is actively displayed!
              setViewedStoryIds((prev) => {
                if (prev.has(story.id)) return prev;
                const next = new Set(prev);
                next.add(story.id);
                return next;
              });
            },
            onStoryEnd: (_idx, story) => {
              if (story) {
                setViewedStoryIds((prev) => {
                  if (prev.has(story.id)) return prev;
                  const next = new Set(prev);
                  next.add(story.id);
                  return next;
                });
              }
            },
            onAllStoriesEnd: handleAllEnd,
            onStartReached: handleStartReached,
            onReply: (msg, id) => console.log('Reply:', msg, 'story:', id),
            onLike: (id) => console.log('Liked story:', id),
            onShare: (id) => console.log('Share story:', id),
            onMention: (u) => console.log('Mention tapped:', u),
            onHashtag: (t) => console.log('Hashtag tapped:', t),
          }}
        />
      )}
    </div>
  );
}
