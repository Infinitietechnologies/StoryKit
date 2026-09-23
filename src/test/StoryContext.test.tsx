import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StoryProvider, useStory } from '../context/StoryContext';
import { StoryRing } from '../components/StoryRing';

const stories = [
  { id: 'one', type: 'image' as const, url: '/one.jpg' },
  { id: 'two', type: 'image' as const, url: '/two.jpg' },
];

const Harness = () => {
  const { activeIndex, isMuted, next, prev, toggleMute } = useStory();
  return (
    <>
      <output aria-label="active index">{activeIndex}</output>
      <output aria-label="muted">{String(isMuted)}</output>
      <button type="button" onClick={next}>next</button>
      <button type="button" onClick={prev}>previous</button>
      <button type="button" onClick={toggleMute}>mute</button>
    </>
  );
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
