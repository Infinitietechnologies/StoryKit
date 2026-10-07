import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoryFooter } from '../components/StoryFooter';
import { StoryProvider, useStory } from '../context/StoryContext';
import { ViewerConfig } from '../types';

const stories = [{ id: 'one', type: 'image' as const, url: '/one.jpg' }];

function PlaybackProbe() {
  const { isPaused, pause, resume } = useStory();
  return <>
    <span aria-label="Playback state">{isPaused ? 'paused' : 'playing'}</span>
    <button onClick={() => pause()}>Pause manually</button>
    <button onClick={() => resume()}>Resume manually</button>
  </>;
}

function FooterHarness({ config = {}, storyId = 'one', show = true }: { config?: ViewerConfig; storyId?: string; show?: boolean }) {
  return <StoryProvider stories={stories} config={config}>
    <PlaybackProbe />
    {show && <StoryFooter storyId={storyId} userName="Alice" />}
  </StoryProvider>;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('StoryFooter', () => {
  it('disables unavailable replies, hides unavailable sharing, and exposes like state', () => {
    const onLikeChange = vi.fn();
    render(<FooterHarness config={{ onLikeChange }} />);
    expect(screen.getByRole('textbox', { name: 'Reply to story' })).toBeDisabled();
    expect(screen.getByPlaceholderText('Replies unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Share story' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Like story' }));
    expect(screen.getByRole('button', { name: 'Unlike story' })).toHaveAttribute('aria-pressed', 'true');
    expect(onLikeChange).toHaveBeenCalledWith('one', true);
    fireEvent.click(screen.getByRole('button', { name: 'Unlike story' }));
    expect(screen.getByRole('button', { name: 'Like story' })).toHaveAttribute('aria-pressed', 'false');
    expect(onLikeChange).toHaveBeenLastCalledWith('one', false);
  });

  it('pauses through reply controls and resumes after a trimmed reply is submitted', async () => {
    const onReply = vi.fn();
    render(<FooterHarness config={{ onReply }} />);
    const input = screen.getByRole('textbox', { name: 'Reply to story' });
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '  Hello Alice  ' } });
    const send = screen.getByRole('button', { name: 'Send reply' });
    act(() => send.focus());
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('paused');
    fireEvent.click(send);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Reply submitted'));
    expect(onReply).toHaveBeenCalledWith('Hello Alice', 'one');
    expect(input).toHaveValue('');
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('playing');
    act(() => input.focus());
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('paused');
    act(() => input.blur());
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('playing');
  });

  it('preserves a manual pause after replying and after the footer unmounts', async () => {
    const config = { onReply: vi.fn() };
    const { rerender } = render(<FooterHarness config={config} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause manually' }));
    const input = screen.getByRole('textbox');
    act(() => input.focus());
    fireEvent.change(input, { target: { value: 'Reply' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Reply submitted'));
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('paused');
    act(() => input.focus());
    rerender(<FooterHarness config={config} show={false} />);
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('paused');
    fireEvent.click(screen.getByRole('button', { name: 'Resume manually' }));
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('playing');
  });

  it('releases its reply pause when removed without a manual pause', () => {
    const config = { onReply: vi.fn() };
    const { rerender } = render(<FooterHarness config={config} />);
    act(() => screen.getByRole('textbox').focus());
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('paused');
    rerender(<FooterHarness config={config} show={false} />);
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('playing');
  });

  it('keeps a failed reply draft and allows retry without duplicate pending callbacks', async () => {
    let rejectSubmission: (reason: Error) => void = () => {};
    const onReply = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectSubmission = reject; }));
    render(<FooterHarness config={{ onReply }} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '  Keep my draft  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onReply).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Send reply' })).toBeDisabled();
    await act(async () => rejectSubmission(new Error('Offline')));
    expect(input).toHaveValue('  Keep my draft  ');
    expect(screen.getByRole('status')).toHaveTextContent('Reply could not be submitted. Try again.');
    expect(screen.getByRole('button', { name: 'Send reply' })).not.toBeDisabled();
  });

  it('ignores the previous story reply completion and resets the draft on story change', async () => {
    let completeSubmission: () => void = () => {};
    const config = { onReply: vi.fn(() => new Promise<void>((resolve) => { completeSubmission = resolve; })) };
    const { rerender } = render(<FooterHarness config={config} />);
    const input = screen.getByRole('textbox');
    act(() => input.focus());
    fireEvent.change(input, { target: { value: 'First reply' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    rerender(<FooterHarness config={config} storyId="two" />);
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('playing');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New draft' } });
    await act(async () => completeSubmission());
    expect(screen.getByRole('textbox')).toHaveValue('New draft');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('cancels an outgoing story heart timer before animating the next story', () => {
    vi.useFakeTimers();
    const { rerender } = render(<FooterHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Like story' }));
    act(() => vi.advanceTimersByTime(250));
    rerender(<FooterHarness storyId="two" />);
    fireEvent.click(screen.getByRole('button', { name: 'Like story' }));
    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByRole('button', { name: 'Unlike story' })).toHaveStyle({ animation: 'heartPop 0.5s ease' });
    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByRole('button', { name: 'Unlike story' })).toHaveStyle({ animation: 'none' });
  });

  it('does not submit a reply while confirming an IME composition', () => {
    const onReply = vi.fn();
    render(<FooterHarness config={{ onReply }} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Reply' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onReply).not.toHaveBeenCalled();
  });

  it('lets Tab reach the modal focus trap from its reply input and action buttons', () => {
    const onKeyDown = vi.fn();
    render(<div onKeyDown={onKeyDown}><FooterHarness config={{ onReply: vi.fn() }} /></div>);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Tab' });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Like story' }), { key: 'Tab' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Like story' }), { key: 'Escape' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Like story' }), { key: ' ', code: 'Space' });
    expect(onKeyDown).toHaveBeenCalledTimes(4);
  });
});
