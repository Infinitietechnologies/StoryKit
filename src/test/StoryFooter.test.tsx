import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoryFooter } from '../components/StoryFooter';
import { StoryProvider, useStory } from '../context/StoryContext';
import { StoryItem, ViewerConfig } from '../types';

const stories = [{ id: 'one', type: 'image' as const, url: '/one.jpg' }];

function PlaybackProbe() {
  const { isPaused, pause, resume } = useStory();
  return <>
    <span aria-label="Playback state">{isPaused ? 'paused' : 'playing'}</span>
    <button onClick={() => pause()}>Pause manually</button>
    <button onClick={() => resume()}>Resume manually</button>
  </>;
}

function FooterHarness({ config = {}, storyId = 'one', show = true, items = stories }: { config?: ViewerConfig; storyId?: string; show?: boolean; items?: StoryItem[] }) {
  return <StoryProvider stories={items} config={config}>
    <PlaybackProbe />
    {show && <StoryFooter storyId={storyId} userName="Alice" />}
  </StoryProvider>;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('StoryFooter', () => {
  it('disables unavailable replies, offers built-in sharing, and exposes like state', () => {
    const onLikeChange = vi.fn();
    render(<FooterHarness config={{ onLikeChange }} />);
    expect(screen.getByRole('textbox', { name: 'Reply to story' })).toBeDisabled();
    expect(screen.getByPlaceholderText('Replies unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share story' })).toBeInTheDocument();
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

  it.each(Array.from({ length: 8 }, (_, mask) => mask))('honors independent per-story flags (combination %i)', mask => {
    const interactions = { reply: Boolean(mask & 1), like: Boolean(mask & 2), share: Boolean(mask & 4) };
    render(<FooterHarness items={[{ ...stories[0], interactions }]} />);
    expect(Boolean(screen.queryByRole('textbox', { name: 'Reply to story' }))).toBe(interactions.reply);
    expect(Boolean(screen.queryByRole('button', { name: 'Like story' }))).toBe(interactions.like);
    expect(Boolean(screen.queryByRole('button', { name: 'Share story' }))).toBe(interactions.share);
  });

  it('uses viewer defaults and lets a story explicitly override them', () => {
    const config = { showReply: false, showLike: false, showShare: false };
    const { rerender } = render(<FooterHarness config={config} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Like story' })).not.toBeInTheDocument();
    rerender(<FooterHarness config={config} items={[{ ...stories[0], interactions: { like: true } }]} />);
    expect(screen.getByRole('button', { name: 'Like story' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('does not pause playback when the like button receives focus', () => {
    render(<FooterHarness />);
    act(() => screen.getByRole('button', { name: 'Like story' }).focus());
    fireEvent.click(screen.getByRole('button', { name: 'Like story' }));
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('playing');
  });

  it('releases reply focus when reply is hidden while the footer remains', () => {
    const config = { onReply: vi.fn() };
    const { rerender } = render(<FooterHarness config={config} />);
    act(() => screen.getByRole('textbox').focus());
    rerender(<FooterHarness config={config} items={[{ ...stories[0], interactions: { reply: false } }]} />);
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('playing');
    expect(screen.getByRole('button', { name: 'Like story' })).toBeInTheDocument();
  });

  it('opens an actionable dialog, copies the actual story link, and resumes on close', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const item = { ...stories[0], share: { url: 'https://example.com/stories/one' } };
    render(<FooterHarness items={[item]} />);
    const trigger = screen.getByRole('button', { name: 'Share story' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Share story' });
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('paused');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent('Link copied'));
    expect(writeText).toHaveBeenCalledWith(item.share.url);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close sharing' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('playing');
  });

  it('keeps manual pause and closes only sharing on Escape', () => {
    render(<FooterHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause manually' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share story' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close sharing' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('paused');
  });

  it('shows a selectable link when copying fails', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
    render(<FooterHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Share story' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent('Could not copy automatically'));
    expect(within(dialog).getByRole('textbox', { name: 'Story link' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Copy link' })).not.toBeDisabled();
  });

  it('invokes device sharing with metadata and closes when it resolves', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });
    const item = { ...stories[0], share: { url: 'https://example.com/story/one', title: 'Launch', text: 'See our launch' } };
    render(<FooterHarness items={[item]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Share story' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share via device' }));
    expect(share).toHaveBeenCalledWith(item.share);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByLabelText('Playback state')).toHaveTextContent('playing'));
  });

  it('treats device-share cancellation normally and leaves copy available', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')) });
    render(<FooterHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Share story' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Share via device' }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Copy link' })).not.toBeDisabled());
    expect(within(dialog).getByRole('status')).toBeEmptyDOMElement();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close sharing' }));
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('playing');
  });

  it('rejects non-HTTP share links and still lets the viewer close the dialog', () => {
    render(<FooterHarness items={[{ ...stories[0], share: { url: 'javascript:alert(1)' } }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Share story' }));
    expect(screen.getByText('This story does not have a shareable link.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close sharing' }));
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('playing');
  });

  it('preserves the opt-in custom sharing flow without leaving playback paused', async () => {
    const onShare = vi.fn();
    render(<FooterHarness config={{ shareMode: 'custom', onShare }} />);
    const trigger = screen.getByRole('button', { name: 'Share story' });
    act(() => trigger.focus());
    fireEvent.click(trigger);
    await waitFor(() => expect(onShare).toHaveBeenCalledWith('one'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('playing');
  });

  it('releases sharing pause when controls are disabled while its dialog is open', () => {
    const { rerender } = render(<FooterHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Share story' }));
    rerender(<FooterHarness config={{ showFooter: false }} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('playing');
    expect(screen.queryByRole('button', { name: 'Share story' })).not.toBeInTheDocument();
  });

  it('offers copy fallback if the browser has no Clipboard API or device sharing fails', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new Error('Not allowed')) });
    render(<FooterHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Share story' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Share via device' }));
    await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent('Device sharing is unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent('Could not copy automatically'));
    expect(within(dialog).getByRole('textbox', { name: 'Story link' })).toHaveFocus();
  });

  it('ignores a pending share rejection after the dialog is dismissed', async () => {
    let rejectShare!: (error: Error) => void;
    vi.stubGlobal('navigator', { share: vi.fn(() => new Promise((_resolve, reject) => { rejectShare = reject; })) });
    render(<FooterHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Share story' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share via device' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close sharing' }));
    await act(async () => rejectShare(new Error('Late rejection')));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('playing');
  });

  it('contains Tab focus even when focus is lost while an action is pending', () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(() => new Promise(() => {})) } });
    render(<FooterHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Share story' }));
    const close = screen.getByRole('button', { name: 'Close sharing' });
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Copy link' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    act(() => close.blur());
    fireEvent.keyDown(document.body, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('playing');
  });

  it('keeps built-in sharing available if its opening notification fails', async () => {
    const onShare = vi.fn().mockRejectedValue(new Error('Notification failed'));
    render(<FooterHarness config={{ onShare }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Share story' }));
    await waitFor(() => expect(onShare).toHaveBeenCalledWith('one'));
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.queryByText('Sharing could not be opened. Try again.')).not.toBeInTheDocument();
  });

  it('reports a failed custom sharing flow without getting stuck paused', async () => {
    render(<FooterHarness config={{ shareMode: 'custom', onShare: vi.fn().mockRejectedValue(new Error('Share failed')) }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Share story' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sharing could not be opened. Try again.'));
    expect(screen.getByLabelText('Playback state')).toHaveTextContent('playing');
  });
});
