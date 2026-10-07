import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoryViewer } from '../components/StoryViewer';
import { StoryContent } from '../components/StoryContent';
import { StoryProvider, useStory } from '../context/StoryContext';

const imageStories = [
  { id: 'one', type: 'image' as const, url: '/one.jpg', altText: 'First story' },
  { id: 'two', type: 'image' as const, url: '/two.jpg', altText: 'Second story' },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('StoryViewer', () => {
  it('opens the loading shell before the first media has loaded', () => {
    vi.useFakeTimers();
    render(<StoryViewer isOpen onClose={vi.fn()} stories={imageStories} />);

    const dialog = screen.getByRole('dialog');
    const animatedCard = dialog.firstElementChild?.firstElementChild as HTMLElement;
    expect(animatedCard).toHaveStyle({ opacity: '0' });

    act(() => vi.advanceTimersByTime(40));
    expect(animatedCard).toHaveStyle({ opacity: '1' });
    expect(screen.getByText(/Loading story/).closest('[role="status"]')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Close (Esc)' })).toBeVisible();
    expect(screen.getByAltText('First story').parentElement).toHaveStyle({ opacity: '0' });
  });

  it('renders as a modal, locks scrolling, and restores focus', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <StoryViewer isOpen onClose={vi.fn()} stories={imageStories} ariaLabel="Test stories" />,
    );

    expect(screen.getByRole('dialog', { name: 'Test stories' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('honors config.initialStoryIndex', () => {
    render(
      <StoryViewer
        isOpen
        onClose={vi.fn()}
        stories={imageStories}
        config={{ initialStoryIndex: 1 }}
      />,
    );

    expect(screen.getByAltText('Second story')).toHaveAttribute('src', '/two.jpg');
  });

  it('honors disabled keyboard navigation', () => {
    const onStoryEnd = vi.fn();
    render(
      <StoryViewer
        isOpen
        onClose={vi.fn()}
        stories={imageStories}
        config={{ keyboardNavigation: false, onStoryEnd }}
      />,
    );

    fireEvent.keyDown(window, { code: 'ArrowRight' });
    expect(onStoryEnd).not.toHaveBeenCalled();
    expect(screen.getByAltText('First story')).toBeInTheDocument();
  });

  it('emits video completion callbacks exactly once', () => {
    const onStoryEnd = vi.fn();
    const onAllStoriesEnd = vi.fn();
    const { container } = render(
      <StoryViewer
        isOpen
        onClose={vi.fn()}
        stories={[{ id: 'video', type: 'video', url: '/video.mp4' }]}
        config={{ onStoryEnd, onAllStoriesEnd }}
      />,
    );

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    fireEvent.ended(video!);
    expect(onStoryEnd).toHaveBeenCalledTimes(1);
    expect(onAllStoriesEnd).toHaveBeenCalledTimes(1);
    fireEvent.ended(video!);
    expect(onStoryEnd).toHaveBeenCalledTimes(1);
    expect(onAllStoriesEnd).toHaveBeenCalledTimes(1);
  });

  it('keeps outgoing media visible until the next story has loaded', () => {
    vi.useFakeTimers();
    const { container } = render(
      <StoryViewer isOpen onClose={vi.fn()} stories={imageStories} />,
    );

    const firstMedia = screen.getByAltText('First story');
    fireEvent.load(firstMedia);
    fireEvent.keyDown(window, { code: 'ArrowRight' });

    const incoming = screen.getByAltText('Second story');
    const outgoing = container.querySelector<HTMLImageElement>('img[src="/one.jpg"]');
    expect(outgoing).not.toBeNull();
    expect(outgoing).toBe(firstMedia);
    expect(incoming.parentElement).toHaveStyle({ opacity: '0' });

    fireEvent.load(incoming);
    expect(incoming.parentElement).not.toHaveStyle({ opacity: '0' });
    act(() => vi.advanceTimersByTime(280));
    expect(container.querySelector('img[src="/one.jpg"]')).not.toBeInTheDocument();
  });

  it('closes after the exit transition', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <StoryViewer isOpen onClose={vi.fn()} stories={imageStories} />,
    );
    rerender(<StoryViewer isOpen={false} onClose={vi.fn()} stories={imageStories} />);
    act(() => vi.advanceTimersByTime(400));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('pauses the image timer and disables keyboard navigation during the exit transition', () => {
    vi.useFakeTimers();
    const onStoryEnd = vi.fn();
    const onAllStoriesEnd = vi.fn();
    const config = { defaultDuration: 100, onStoryEnd, onAllStoriesEnd };
    const onClose = vi.fn();
    const { rerender } = render(
      <StoryViewer isOpen onClose={onClose} stories={imageStories} config={config} />,
    );
    fireEvent.load(screen.getByAltText('First story'));
    act(() => vi.advanceTimersByTime(50));
    rerender(<StoryViewer isOpen={false} onClose={onClose} stories={imageStories} config={config} />);
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'Escape' });
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByAltText('Second story')).not.toBeInTheDocument();
    expect(onStoryEnd).not.toHaveBeenCalled();
    expect(onAllStoriesEnd).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('suppresses completion callbacks from a retained video after closing', () => {
    const onStoryEnd = vi.fn();
    const onAllStoriesEnd = vi.fn();
    const config = { onStoryEnd, onAllStoriesEnd };
    const stories = [{ id: 'video', type: 'video' as const, url: '/video.mp4' }];
    const onClose = vi.fn();
    const { container, rerender } = render(
      <StoryViewer isOpen onClose={onClose} stories={stories} config={config} />,
    );
    const video = container.querySelector('video')!;
    rerender(<StoryViewer isOpen={false} onClose={onClose} stories={stories} config={config} />);
    fireEvent.ended(video);
    expect(onStoryEnd).not.toHaveBeenCalled();
    expect(onAllStoriesEnd).not.toHaveBeenCalled();
  });

  it('starts a fresh playback session when reopened before the exit transition completes', () => {
    vi.useFakeTimers();
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const config = { onOpen };
    const { rerender } = render(
      <StoryViewer isOpen onClose={onClose} stories={imageStories} initialStoryIndex={0} config={config} />,
    );
    const first = screen.getByAltText('First story');
    fireEvent.load(first);
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.load(screen.getByAltText('Second story'));
    act(() => vi.advanceTimersByTime(280));
    expect(screen.queryByAltText('First story')).not.toBeInTheDocument();
    rerender(
      <StoryViewer isOpen={false} onClose={onClose} stories={imageStories} initialStoryIndex={0} config={config} />,
    );
    act(() => vi.advanceTimersByTime(100));
    rerender(
      <StoryViewer isOpen onClose={onClose} stories={imageStories} initialStoryIndex={0} config={config} />,
    );
    expect(screen.getByAltText('First story')).not.toBe(first);
    expect(screen.getByAltText('First story').parentElement).toHaveStyle({ opacity: '0' });
    expect(screen.queryByAltText('Second story')).not.toBeInTheDocument();
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('keeps the first-media error visible until the user explicitly skips it', () => {
    vi.useFakeTimers();
    const onStoryEnd = vi.fn();
    render(
      <StoryViewer isOpen onClose={vi.fn()} stories={imageStories} config={{ onStoryEnd }} />,
    );
    fireEvent.error(screen.getByAltText('First story'));
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Story unavailable');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(onStoryEnd).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Skip story' }));
    expect(onStoryEnd).toHaveBeenCalledTimes(1);
    expect(screen.getByAltText('Second story')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('retries a failed image by replacing and loading media at the same index', () => {
    const onStoryViewed = vi.fn();
    render(
      <StoryViewer isOpen onClose={vi.fn()} stories={imageStories} config={{ onStoryViewed }} />,
    );
    const failed = screen.getByAltText('First story');
    fireEvent.error(failed);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    const retried = screen.getByAltText('First story');
    expect(retried).not.toBe(failed);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(retried.parentElement).toHaveStyle({ opacity: '0' });
    expect(onStoryViewed).not.toHaveBeenCalled();
    fireEvent.load(retried);
    expect(retried.parentElement).not.toHaveStyle({ opacity: '0' });
    expect(onStoryViewed).toHaveBeenCalledTimes(1);
  });

  it('offers retry and skip after eight seconds of loading across parent rerenders', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { rerender } = render(<StoryViewer isOpen onClose={onClose} stories={imageStories} />);
    act(() => vi.advanceTimersByTime(4000));
    rerender(
      <StoryViewer isOpen onClose={onClose} stories={imageStories.map((story) => ({ ...story }))} />,
    );
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText(/Taking longer than usual/).closest('[role="status"]')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Skip story' })).toBeVisible();
  });

  it('recovers blocked autoplay from an explicit play gesture', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(function (this: HTMLMediaElement) {
        Object.defineProperty(this, 'paused', { configurable: true, value: false });
        return Promise.resolve();
      })
      .mockRejectedValueOnce(new DOMException('Autoplay blocked', 'NotAllowedError'));
    const { container } = render(
      <StoryViewer isOpen onClose={vi.fn()} stories={[{ id: 'video', type: 'video', url: '/video.mp4' }]} />,
    );
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
    const callsBeforeGesture = play.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Play video' }));
    expect(play.mock.calls.length).toBeGreaterThan(callsBeforeGesture);
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Play video' })).not.toBeInTheDocument();
    expect(container.querySelector('video')?.paused).toBe(false);
    expect(screen.getByRole('button', { name: 'Pause story' })).toBeInTheDocument();
  });

  it('ignores a previous video play rejection after navigating to the next story', async () => {
    let rejectPlayback!: (reason: Error) => void;
    const pendingPlayback = new Promise<void>((_, reject) => { rejectPlayback = reject; });
    vi.spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementationOnce(() => pendingPlayback)
      .mockResolvedValue(undefined);
    render(
      <StoryViewer isOpen onClose={vi.fn()} stories={[
        { id: 'video', type: 'video', url: '/video.mp4' }, imageStories[1],
      ]} />,
    );
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.load(screen.getByAltText('Second story'));
    await act(async () => { rejectPlayback(new Error('Old playback rejected')); });
    expect(screen.queryByText('Tap to play this video')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause story' })).toBeInTheDocument();
  });

  it('releases the blocked-video pause when navigating to an image', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play')
      .mockRejectedValue(new DOMException('Autoplay blocked', 'NotAllowedError'));
    render(
      <StoryViewer isOpen onClose={vi.fn()} stories={[
        { id: 'video', type: 'video', url: '/video.mp4' }, imageStories[1],
      ]} />,
    );
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.load(screen.getByAltText('Second story'));
    expect(screen.queryByRole('button', { name: 'Play video' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause story' })).toBeInTheDocument();
  });

  it('remounts and reloads a video when reset targets its current index', async () => {
    const ResetControls = () => {
      const { reset, isLoaded } = useStory();
      return <>
        <output aria-label="media loaded">{String(isLoaded)}</output>
        <button type="button" onClick={() => reset()}>Reset video</button>
      </>;
    };
    const { container } = render(
      <StoryProvider stories={[{ id: 'video', type: 'video', url: '/video.mp4' }]}>
        <StoryContent /><ResetControls />
      </StoryProvider>,
    );
    await act(async () => {});
    const first = container.querySelector('video')!;
    fireEvent.canPlay(first);
    expect(screen.getByLabelText('media loaded')).toHaveTextContent('true');
    fireEvent.click(screen.getByRole('button', { name: 'Reset video' }));
    const replay = container.querySelector('video')!;
    expect(replay).not.toBe(first);
    expect(screen.getByLabelText('media loaded')).toHaveTextContent('false');
    fireEvent.canPlay(replay);
    expect(screen.getByLabelText('media loaded')).toHaveTextContent('true');
    await act(async () => {});
  });
});
