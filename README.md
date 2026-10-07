# react-storykit

Production-focused React components for image and video stories, segmented story
rings, progress indicators, gestures, and interactive stickers.

[Live demo](https://infinitietechnologies.github.io/StoryKit/)

## Requirements

- React 18 or 19
- React DOM 18 or 19
- Node.js 20.19 or newer for development and package builds
- A modern browser with Pointer Events support

## Installation

```bash
npm install react-storykit
```

Import the packaged stylesheet once in your application entry point:

```tsx
import 'react-storykit/styles.css';
```

The CSS is precompiled; consumers do not need Tailwind CSS.

## Complete viewer

```tsx
import { StoryViewer, type StoryItem } from 'react-storykit';
import 'react-storykit/styles.css';

const stories: StoryItem[] = [
  {
    id: 'launch',
    type: 'image',
    url: 'https://cdn.example.com/launch.jpg',
    altText: 'Product launch',
    duration: 5000,
  },
  {
    id: 'demo',
    type: 'video',
    url: 'https://cdn.example.com/demo.mp4',
  },
];

export function Stories({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <StoryViewer
      isOpen={open}
      onClose={onClose}
      stories={stories}
      user={{ id: 'acme', name: 'Acme', avatarUrl: '/avatar.png' }}
      config={{
        defaultDuration: 5000,
        defaultMuted: true,
        onStoryViewed: (index, story) => console.log('viewed', index, story.id),
        onAllStoriesEnd: onClose,
      }}
    />
  );
}
```

`StoryViewer` provides modal semantics, focus containment and restoration, body
scroll locking, keyboard controls, reduced-motion support, safe-area spacing,
and responsive mobile/desktop layouts.

The viewer opens immediately with a visible loading state and usable controls.
Failed stories offer **Try again** and **Skip story**, and slow connections show
the same recovery options after eight seconds. Videos blocked by browser autoplay
policy offer a **Play video** button. Errors never silently skip a story.

Pause, mute, and close controls work with touch and keyboard. Story navigation
uses left/right tap areas and keyboard arrows, with reversed progression in RTL.
Playback pauses while the tab is hidden. Holding a story or focusing a reply or
question pauses only that interaction; releasing it preserves a manual pause.

## Composable viewer

The lower-level components can be composed inside `StoryProvider`:

```tsx
import {
  DynamicOverlay,
  StoryContainer,
  StoryContent,
  StoryProgress,
  StoryProvider,
} from 'react-storykit';

<StoryProvider stories={stories} config={{ keyboardNavigation: true }}>
  <StoryContainer>
    <StoryProgress />
    <StoryContent />
    <DynamicOverlay />
  </StoryContainer>
</StoryProvider>;
```

## Keyboard controls

| Key | Action |
| --- | --- |
| Left/Right arrow | Previous/next story; reversed in RTL mode |
| Space | Pause or resume |
| M | Mute or unmute |
| Escape | Close the viewer |

Set `keyboardNavigation: false` to disable these global controls.

## Persistence and external stores

StoryKit does not depend on a particular state manager. Persistence uses the
`StoryPersistenceAdapter` contract, so applications can store the same state in
Web Storage, Redux, Zustand, IndexedDB, React Native AsyncStorage, a server API,
or another platform-specific store.

For browser persistence:

```tsx
import { useState } from 'react';
import {
  createWebStorageAdapter,
  StoryViewer,
  type StoryItem,
  useStoryPersistence,
} from 'react-storykit';

const adapter = createWebStorageAdapter({ prefix: 'my-app:' });

function Stories({ accountId, stories }: { accountId: string; stories: StoryItem[] }) {
  const [open, setOpen] = useState(false);
  const [resumeIndex, setResumeIndex] = useState(0);
  const storiesState = useStoryPersistence({
    adapter,
    key: `stories:${accountId}`,
  });

  // Wait for stored progress before choosing the first unviewed story.
  if (!storiesState.ready) return null;

  function openStories() {
    // Capture once per opening; marking a story viewed must not change playback.
    const firstUnviewed = stories.findIndex((story) => !storiesState.hasViewed(story.id));
    setResumeIndex(Math.max(0, firstUnviewed));
    setOpen(true);
  }

  return (
    <>
      <button type="button" onClick={openStories}>View stories</button>
      <StoryViewer
        isOpen={open}
        onClose={() => setOpen(false)}
        stories={stories}
        initialStoryIndex={resumeIndex}
        config={{
          onStoryViewed: (_index, story) => storiesState.markViewed(story.id),
          isStoryLiked: storiesState.isLiked,
          onLikeChange: storiesState.setLiked,
        }}
      />
    </>
  );
}
```

Custom adapters implement four small operations:

```ts
const reduxAdapter: StoryPersistenceAdapter = {
  get: (key) => selectStoryState(store.getState(), key),
  set: (key, value) => { store.dispatch(saveStoryState({ key, value })); },
  remove: (key) => { store.dispatch(clearStoryState(key)); },
  subscribe: (_key, listener) => store.subscribe(listener),
};
```

Create adapters once outside React components. Scope keys by account, tenant, or
feed so different users never share progress. The snapshot is versioned and
currently stores viewed IDs, liked IDs, and poll votes.

Mutations made during hydration are buffered and applied to the loaded state.
Writes and clears are ordered per adapter/key, including between hook instances.
Changing the key isolates account state from pending reads. Use the returned
`error` or `onError` to handle storage failures in your application's UI.

Pinia is Vue-specific, so a React component cannot call a Pinia hook directly.
A shared store module or framework bridge can still expose Pinia-backed data
through the same adapter contract.

## Security notes

Story media URLs are rendered by the browser and should come from trusted or
validated sources. Link stickers only open HTTP and HTTPS URLs and isolate the
new tab with `noopener,noreferrer`. Applications remain responsible for their
Content Security Policy and media-host allowlists.

## Development

```bash
npm ci
npm run validate
cd demo
npm ci
npm run build
```

For real-browser checks, use Node.js 22 or newer, install the test browsers once,
and run the browser suite from the package root:

```bash
npx playwright install chromium webkit
npm run test:e2e
```

The suite uses local image/video fixtures and checks desktop Chromium, mobile
Chromium, and mobile WebKit. `/qa.html` is an isolated development test harness;
it is not included in the production demo build.

`npm run validate` runs TypeScript checks, ESLint, tests, and the production
package build.

## License

MIT
