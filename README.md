# react-stories-status-viewer

A micro-architectural, highly resilient, and accessible React & TypeScript Story Viewer Package.

## Features
- **Hyper-accurate Timers**: Uses `requestAnimationFrame` + `performance.now()`.
- **Preloading Engine**: Silently preloads next media items for zero-latency transitions.
- **Smart Gestures**: Differentiates taps and swipes with precise geometry and timing checks.
- **Dynamic Overlays**: Auto-adjusting overlay bounding boxes to keep interactive elements in the viewport.
- **Resilient Media**: Graceful fallbacks, syncs video natively with context state.
- **Tailwind Native**: Styled entirely with Tailwind CSS utility classes.

## Installation

```bash
npm install react-stories-status-viewer
```

### Tailwind CSS Setup

Since this package uses Tailwind CSS internally, you must add the package to your `tailwind.config.js` `content` array so Tailwind can compile the classes used inside the viewer:

```javascript
module.exports = {
  content: [
    // ... your other paths
    "./node_modules/react-stories-status-viewer/dist/**/*.{js,mjs}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

## Usage

```tsx
import { 
  StoryProvider, 
  StoryContainer, 
  StoryProgress, 
  StoryContent, 
  DynamicOverlay 
} from 'react-stories-status-viewer';

const stories = [
  {
    id: '1',
    url: 'https://example.com/image.jpg',
    type: 'image',
    duration: 5000,
  },
  {
    id: '2',
    url: 'https://example.com/video.mp4',
    type: 'video',
  }
];

export default function App() {
  return (
    <div className="w-full h-screen max-w-sm mx-auto">
      <StoryProvider 
        stories={stories} 
        config={{ keyboardNavigation: true }}
      >
        <StoryContainer>
          <StoryProgress />
          <StoryContent />
          <DynamicOverlay />
        </StoryContainer>
      </StoryProvider>
    </div>
  );
}
```

