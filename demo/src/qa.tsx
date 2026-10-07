import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  StoryViewer, createWebStorageAdapter, useStoryPersistence, type StoryItem,
} from 'react-storykit';
import 'react-storykit/styles.css';

const adapter = createWebStorageAdapter({ prefix: 'qa-storykit:' });
const parameters = new URLSearchParams(window.location.search);
const scenario = parameters.get('scenario') ?? 'images';

function QA() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const persistence = useStoryPersistence({ adapter, key: 'browser-tests' });
  const record = (event: string) => setEvents((previous) => [...previous, event]);
  const first: StoryItem = {
    id: 'first', type: 'image',
    url: scenario === 'failure' ? '/qa-first.svg?failure=1' : '/qa-first.svg',
    altText: 'Aurora story', duration: 60000,
  };
  if (scenario === 'poll') {
    first.overlays = [{
      id: 'qa-poll', type: 'poll', x: 20, y: 30,
      data: {
        question: 'Which view should we explore?', optionA: 'Mountains', optionB: 'Ocean',
        selectedOption: persistence.getVote('qa-poll'),
        onVote: async (vote) => { await persistence.setVote('qa-poll', vote); record('vote:' + vote); },
      },
    }];
  }
  if (scenario === 'question') {
    first.overlays = [{
      id: 'qa-question', type: 'question', x: 18, y: 30,
      data: {
        prompt: 'Where would you travel next?', placeholder: 'Name a place',
        onSubmit: async (answer) => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (answer === 'fail') throw new Error('QA response failure');
          record('answer:' + answer);
        },
      },
    }];
  }
  const stories: StoryItem[] = [
    scenario === 'video'
      ? { id: 'video', type: 'video', url: '/qa-video.webm', altText: 'Animated color study' }
      : first,
    { id: 'second', type: 'image', url: '/qa-second.svg', altText: 'Ocean story', duration: 60000 },
  ];

  return <main>
    <h1>StoryKit Browser QA</h1>
    <p>Local media and isolated scenarios for playback, recovery, accessibility, and interactions.</p>
    <p data-testid="scenario">Scenario: {scenario}</p>
    <button type="button" disabled={!persistence.ready} onClick={() => setOpen(true)}>Open stories</button>
    <pre data-testid="event-log">{events.join('\n')}</pre>
    <StoryViewer
      isOpen={open}
      onClose={() => { setOpen(false); record('closed'); }}
      stories={stories}
      user={{ id: 'qa', name: 'Aurora Studio', timestamp: 'Just now' }}
      ariaLabel="QA stories"
      config={{
        dir: parameters.get('dir') === 'rtl' ? 'rtl' : 'ltr',
        onStoryChange: (_index, story) => record('story:' + story.id),
        onStoryViewed: (_index, story) => record('viewed:' + story.id),
        onStoryEnd: (_index, story) => record('ended:' + story?.id),
        onAllStoriesEnd: () => { setOpen(false); record('all-ended'); },
        onReply: async (message, storyId) => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (message === 'fail') throw new Error('QA reply failure');
          record('reply:' + storyId + ':' + message);
        },
        isStoryLiked: persistence.isLiked,
        onLikeChange: persistence.setLiked,
      }}
    />
  </main>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QA /></React.StrictMode>);
