import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoryViewer } from '../components/StoryViewer';

const imageStories = [
  { id: 'one', type: 'image' as const, url: '/one.jpg', altText: 'First story' },
  { id: 'two', type: 'image' as const, url: '/two.jpg', altText: 'Second story' },
];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('StoryViewer', () => {
  it('waits for the first media before starting the opening animation', () => {
    vi.useFakeTimers();
    render(<StoryViewer isOpen onClose={vi.fn()} stories={imageStories} />);

    const dialog = screen.getByRole('dialog');
    const animatedCard = dialog.firstElementChild?.firstElementChild as HTMLElement;
    expect(animatedCard).toHaveStyle({ opacity: '0' });

    const firstMedia = screen.getByAltText('First story');
    fireEvent.load(firstMedia);
    expect(animatedCard).toHaveStyle({ opacity: '0' });
    act(() => vi.advanceTimersByTime(40));
    expect(animatedCard).toHaveStyle({ opacity: '1' });
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
});
