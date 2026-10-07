import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoryProvider, useStory } from '../context/StoryContext';
import { StoryRing } from '../components/StoryRing';
import { StoryFooter } from '../components/StoryFooter';

const stories = [
  { id: 'one', type: 'image' as const, url: '/one.jpg' },
  { id: 'two', type: 'image' as const, url: '/two.jpg' },
];

let current: ReturnType<typeof useStory>;

const Harness = () => {
  const state = useStory();
  current = state;
  const { activeIndex, isMuted, next, prev, toggleMute, setSegmentRef } = state;
  const segmentRef = React.useCallback((element: HTMLDivElement | null) => {
    setSegmentRef(0, element);
  }, [setSegmentRef]);
  return (
    <>
      <output aria-label="active index">{activeIndex}</output>
      <output aria-label="muted">{String(isMuted)}</output>
      <div ref={segmentRef} data-testid="first segment" />
      <button type="button" onClick={next}>next</button>
      <button type="button" onClick={prev}>previous</button>
      <button type="button" onClick={toggleMute}>mute</button>
    </>
  );
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const controlFrames = () => {
  let frameId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  return (time: number) => act(() => {
    const pending = Array.from(frames.values());
    frames.clear();
    pending.forEach((callback) => callback(time));
  });
};

describe('StoryProvider', () => {
  it('navigates and emits terminal callbacks once', () => {
    const onStoryEnd = vi.fn();
    const onAllStoriesEnd = vi.fn();
    render(
      <StoryProvider stories={stories} config={{ onStoryEnd, onAllStoriesEnd }}>
        <Harness />
      </StoryProvider>,
    );

    expect(screen.getByLabelText('muted')).toHaveTextContent('true');
    fireEvent.click(screen.getByRole('button', { name: 'next' }));
    expect(screen.getByLabelText('active index')).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: 'next' }));
    fireEvent.click(screen.getByRole('button', { name: 'next' }));
    expect(onStoryEnd).toHaveBeenCalledTimes(2);
    expect(onAllStoriesEnd).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'previous' }));
    expect(screen.getByLabelText('active index')).toHaveTextContent('0');
    fireEvent.click(screen.getByRole('button', { name: 'mute' }));
    expect(screen.getByLabelText('muted')).toHaveTextContent('false');
  });

  it('throws a useful error outside the provider', () => {
    const Broken = () => {
      useStory();
      return null;
    };
    expect(() => render(<Broken />)).toThrow('useStory must be used within a StoryProvider');
  });

  it('emits each navigation callback once under StrictMode', () => {
    const onStoryEnd = vi.fn();
    const onAllStoriesEnd = vi.fn();
    const onStartReached = vi.fn();
    render(
      <React.StrictMode>
        <StoryProvider stories={stories} config={{ onStoryEnd, onAllStoriesEnd, onStartReached }}>
          <Harness />
        </StoryProvider>
      </React.StrictMode>,
    );

    act(() => current.prev());
    expect(onStartReached).toHaveBeenCalledTimes(1);
    act(() => current.next());
    expect(onStoryEnd).toHaveBeenCalledTimes(1);
    act(() => current.next());
    act(() => current.next());
    expect(onStoryEnd).toHaveBeenCalledTimes(2);
    expect(onAllStoriesEnd).toHaveBeenCalledTimes(1);
  });

  it('starts a replacement collection unloaded and allows it to finish once', () => {
    const onStoryViewed = vi.fn();
    const onAllStoriesEnd = vi.fn();
    const config = { onStoryViewed, onAllStoriesEnd };
    const { rerender } = render(
      <StoryProvider stories={[stories[0]]} config={config}><Harness /></StoryProvider>,
    );
    act(() => current.setLoaded(true));
    act(() => current.next());
    const staleLoaded = current.setLoaded;
    const staleBuffering = current.setBuffering;
    const staleError = current.setError;
    act(() => current.pause());
    rerender(
      <StoryProvider stories={[{ id: 'replacement', type: 'image', url: '/new.jpg' }]} config={config}>
        <Harness />
      </StoryProvider>,
    );

    expect(current.isLoaded).toBe(false);
    expect(current.isPaused).toBe(true);
    expect(onStoryViewed).toHaveBeenCalledTimes(1);
    act(() => {
      staleLoaded(true);
      staleBuffering(true);
      staleError('Old media failed');
    });
    expect(current.isLoaded).toBe(false);
    expect(current.isBuffering).toBe(false);
    expect(current.error).toBeNull();
    act(() => current.setLoaded(true));
    expect(onStoryViewed).toHaveBeenCalledTimes(2);
    expect(onStoryViewed.mock.calls[1][1].id).toBe('replacement');
    act(() => current.next());
    act(() => current.next());
    expect(onAllStoriesEnd).toHaveBeenCalledTimes(2);
  });

  it('honors updated initialStoryIndex without changing the collection', () => {
    const { rerender } = render(
      <StoryProvider stories={stories} config={{ initialStoryIndex: 0 }}><Harness /></StoryProvider>,
    );
    act(() => current.setLoaded(true));
    const key = current.playbackKey;
    rerender(
      <StoryProvider stories={stories} config={{ initialStoryIndex: 1 }}><Harness /></StoryProvider>,
    );
    expect(current.activeIndex).toBe(1);
    expect(current.playbackKey).toBeGreaterThan(key);
    expect(current.isLoaded).toBe(false);
  });

  it.each(['append', 'replace'])('preserves independent pause owners when collections %s', (change) => {
    const { rerender } = render(<StoryProvider stories={stories}><Harness /></StoryProvider>);
    act(() => {
      current.pause();
      current.pause('visibility');
      current.pause('reply:one');
    });
    const updated = change === 'append'
      ? [...stories, { id: 'three', type: 'image' as const, url: '/three.jpg' }]
      : [{ id: 'replacement', type: 'image' as const, url: '/replacement.jpg' }];
    rerender(<StoryProvider stories={updated}><Harness /></StoryProvider>);
    expect(current.isPaused).toBe(true);
    act(() => current.resume('reply:one'));
    expect(current.isPaused).toBe(true);
    act(() => current.resume('visibility'));
    expect(current.isPaused).toBe(true);
    act(() => current.resume());
    expect(current.isPaused).toBe(false);
  });

  it('keeps a focused reply paused when new stories are appended', () => {
    const config = { onReply: vi.fn() };
    const content = <><Harness /><StoryFooter storyId="one" /></>;
    const { rerender } = render(<StoryProvider stories={stories} config={config}>{content}</StoryProvider>);
    const input = screen.getByRole('textbox', { name: 'Reply to story' });
    act(() => input.focus());
    expect(current.isPaused).toBe(true);
    rerender(
      <StoryProvider stories={[...stories, { id: 'three', type: 'image', url: '/three.jpg' }]} config={config}>
        {content}
      </StoryProvider>,
    );
    expect(input).toHaveFocus();
    expect(current.isPaused).toBe(true);
    act(() => input.blur());
    expect(current.isPaused).toBe(false);
  });

  it('clears manual pause on reset while retaining environmental and focus owners', () => {
    render(<StoryProvider stories={stories}><Harness /></StoryProvider>);
    act(() => {
      current.pause();
      current.pause('visibility');
      current.pause('reply:one');
      current.pause('closed');
      current.pause('gesture');
      current.reset();
    });
    expect(current.isPaused).toBe(true);
    act(() => current.resume('reply:one'));
    expect(current.isPaused).toBe(true);
    act(() => current.resume('visibility'));
    expect(current.isPaused).toBe(true);
    act(() => current.resume('closed'));
    expect(current.isPaused).toBe(true);
    act(() => current.resume('gesture'));
    expect(current.isPaused).toBe(false);
  });

  it('restarts readiness when a story keeps its ID but changes media', () => {
    const { rerender } = render(<StoryProvider stories={stories}><Harness /></StoryProvider>);
    act(() => current.setLoaded(true));
    const key = current.playbackKey;
    rerender(
      <StoryProvider stories={[{ ...stories[0], url: '/replacement.jpg' }, stories[1]]}>
        <Harness />
      </StoryProvider>,
    );
    expect(current.playbackKey).toBeGreaterThan(key);
    expect(current.isLoaded).toBe(false);
  });

  it('preserves image timing and progress across new array and callback identities', () => {
    const frame = controlFrames();
    const onStoryEnd = vi.fn();
    const { rerender } = render(
      <StoryProvider stories={stories} config={{ defaultDuration: 1000, onStoryEnd }}>
        <Harness />
      </StoryProvider>,
    );
    act(() => current.setLoaded(true));
    frame(0);
    frame(500);
    const key = current.playbackKey;
    expect(screen.getByTestId('first segment')).toHaveStyle({ transform: 'scaleX(0.5)' });
    rerender(
      <StoryProvider
        stories={stories.map((story) => ({ ...story }))}
        config={{ defaultDuration: 1000, onStoryEnd: (...args) => onStoryEnd(...args) }}
      >
        <Harness />
      </StoryProvider>,
    );
    expect(current.playbackKey).toBe(key);
    expect(screen.getByTestId('first segment')).toHaveStyle({ transform: 'scaleX(0.5)' });
    frame(1000);
    expect(current.activeIndex).toBe(1);
    expect(onStoryEnd).toHaveBeenCalledTimes(1);
  });

  it('excludes paused time and retains pause ownership across navigation', () => {
    const frame = controlFrames();
    render(
      <StoryProvider stories={stories} config={{ defaultDuration: 1000 }}><Harness /></StoryProvider>,
    );
    act(() => current.setLoaded(true));
    frame(0);
    frame(400);
    act(() => {
      current.pause();
      current.pause('gesture');
      current.pause('visibility');
      current.resume('gesture');
    });
    frame(500);
    frame(5000);
    expect(current.isPaused).toBe(true);
    expect(current.activeIndex).toBe(0);
    expect(screen.getByTestId('first segment')).toHaveStyle({ transform: 'scaleX(0.4)' });
    act(() => current.resume('visibility'));
    expect(current.isPaused).toBe(true);
    act(() => current.resume());
    frame(5500);
    frame(6100);
    expect(current.activeIndex).toBe(1);
    act(() => current.pause());
    act(() => current.prev());
    expect(current.isPaused).toBe(true);
    act(() => current.reset());
    expect(current.isPaused).toBe(false);
  });

  it('replays a completed image at the same index from zero', () => {
    const frame = controlFrames();
    const onAllStoriesEnd = vi.fn();
    render(
      <StoryProvider stories={[stories[0]]} config={{ defaultDuration: 1000, onAllStoriesEnd }}>
        <Harness />
      </StoryProvider>,
    );
    act(() => current.setLoaded(true));
    frame(0);
    frame(1000);
    expect(onAllStoriesEnd).toHaveBeenCalledTimes(1);
    const key = current.playbackKey;
    const staleLoaded = current.setLoaded;
    act(() => current.reset());
    expect(current.activeIndex).toBe(0);
    expect(current.playbackKey).toBeGreaterThan(key);
    expect(current.isLoaded).toBe(false);
    expect(screen.getByTestId('first segment')).toHaveStyle({ transform: 'scaleX(0)' });
    act(() => staleLoaded(true));
    expect(current.isLoaded).toBe(false);
    act(() => current.setLoaded(true));
    frame(1100);
    frame(1600);
    expect(onAllStoriesEnd).toHaveBeenCalledTimes(1);
    frame(2100);
    expect(onAllStoriesEnd).toHaveBeenCalledTimes(2);
  });

  it('excludes a pause interval even when no animation frames arrive during it', () => {
    const frame = controlFrames();
    render(
      <StoryProvider stories={stories} config={{ defaultDuration: 1000 }}><Harness /></StoryProvider>,
    );
    act(() => current.setLoaded(true));
    frame(0);
    frame(400);
    act(() => current.pause('visibility'));
    act(() => current.resume('visibility'));
    frame(10000);
    expect(current.activeIndex).toBe(0);
    expect(screen.getByTestId('first segment')).toHaveStyle({ transform: 'scaleX(0.4)' });
    frame(10600);
    expect(current.activeIndex).toBe(1);
  });
});

describe('StoryRing', () => {
  it('renders segmented state and handles activation', () => {
    const onOpen = vi.fn();
    const { container } = render(
      <StoryRing
        user={{ id: 'alice', name: 'Alice Smith' }}
        segments={[true, false, false]}
        gradientColors={['#f00']}
        onOpen={onOpen}
      />,
    );

    const button = screen.getByRole('button', { name: '1 of 3 stories viewed from Alice Smith' });
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).not.toContain('NaN');
    expect(screen.getByText('AS')).toBeInTheDocument();
  });
});
