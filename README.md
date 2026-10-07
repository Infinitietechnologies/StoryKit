# react-storykit

Production-focused React components for image and video stories, segmented story
rings, progress indicators, gestures, and interactive stickers.

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
import {
  createWebStorageAdapter,
  useStoryPersistence,
} from 'react-storykit';

const adapter = createWebStorageAdapter({ prefix: 'my-app:' });

function Stories() {
  const storiesState = useStoryPersistence({
    adapter,
    key: `stories:${accountId}`,
  });

  return (
    <StoryViewer
      isOpen={open}
      onClose={close}
      stories={stories}
      initialStoryIndex={stories.findIndex(
        (story) => !storiesState.hasViewed(story.id),
      )}
      config={{
        onStoryViewed: (_index, story) => storiesState.markViewed(story.id),
        isStoryLiked: storiesState.isLiked,
        onLikeChange: storiesState.setLiked,
      }}
    />
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

`npm run validate` runs TypeScript checks, ESLint, tests, and the production
package build.

## License

MIT
