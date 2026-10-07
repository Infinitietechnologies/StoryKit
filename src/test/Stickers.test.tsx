import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CountdownSticker } from '../stickers/CountdownSticker';
import { EmojiSticker } from '../stickers/EmojiSticker';
import { HashtagSticker } from '../stickers/HashtagSticker';
import { LocationSticker } from '../stickers/LocationSticker';
import { MentionSticker } from '../stickers/MentionSticker';
import { MusicSticker } from '../stickers/MusicSticker';
import { PollSticker } from '../stickers/PollSticker';
import { QuestionSticker } from '../stickers/QuestionSticker';
import { TextSticker } from '../stickers/TextSticker';

afterEach(cleanup);

describe('stickers', () => {
  it('renders the passive sticker variants', () => {
    const { rerender } = render(<TextSticker data={{ text: 'Announcement', style: 'neon' }} />);
    expect(screen.getByText('Announcement')).toBeInTheDocument();

    rerender(<EmojiSticker data={{ emoji: '🎉', size: 'lg' }} />);
    expect(screen.getByRole('img', { name: '🎉' })).toBeInTheDocument();

    rerender(<MusicSticker data={{ title: 'Track', artist: 'Artist' }} />);
    expect(screen.getByText(/Track/)).toBeInTheDocument();

    rerender(
      <CountdownSticker
        data={{ label: 'Launch', targetDate: new Date(Date.now() + 60_000).toISOString() }}
      />,
    );
    expect(screen.getByText('Launch')).toBeInTheDocument();
  });

  it('dispatches mention, hashtag, and location actions', () => {
    const onTap = vi.fn();
    const { rerender } = render(<MentionSticker data={{ username: 'alice', onTap }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mention: @alice' }));

    rerender(<HashtagSticker data={{ tag: 'launch', onTap }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hashtag: #launch' }));

    rerender(<LocationSticker data={{ name: 'Ahmedabad', onTap }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Location: Ahmedabad' }));
    expect(onTap).toHaveBeenCalledTimes(3);
  });

  it('submits a poll once and resumes playback', async () => {
    const onVote = vi.fn();
    const pause = vi.fn();
    const resume = vi.fn();
    render(
      <PollSticker
        data={{ question: 'Choose', optionA: 'A', optionB: 'B', onVote }}
        pause={pause}
        resume={resume}
      />,
    );

    const option = screen.getByRole('button', { name: 'Vote for: A' });
    fireEvent.pointerDown(option);
    fireEvent.click(option);
    fireEvent.click(option);
    expect(pause).toHaveBeenCalled();
    expect(onVote).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(resume).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Vote for: A' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('restores a persisted poll selection', () => {
    render(
      <PollSticker
        data={{ question: 'Choose', optionA: 'A', optionB: 'B', selectedOption: 'B' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Vote for: B' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Vote for: B' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('You chose: B');
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
  });

  it('does not pause when interacting with an already voted poll', () => {
    const pause = vi.fn();
    const resume = vi.fn();
    render(<PollSticker data={{ question: 'Choose', optionA: 'A', optionB: 'B', selectedOption: 'A' }} pause={pause} resume={resume} />);
    const option = screen.getByRole('button', { name: 'Vote for: A' });
    fireEvent.pointerDown(option);
    fireEvent.pointerUp(option);
    fireEvent.pointerCancel(option);
    expect(pause).not.toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
  });

  it('balances a canceled poll pointer and releases a held pointer on unmount', () => {
    const pause = vi.fn();
    const resume = vi.fn();
    const { unmount } = render(<PollSticker data={{ question: 'Choose', optionA: 'A', optionB: 'B' }} pause={pause} resume={resume} />);
    const option = screen.getByRole('button', { name: 'Vote for: A' });
    fireEvent.pointerDown(option);
    fireEvent.pointerCancel(option);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(option);
    expect(resume).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(option);
    unmount();
    expect(pause).toHaveBeenCalledTimes(2);
    expect(resume).toHaveBeenCalledTimes(2);
  });

  it('releases a poll pointer when it is lifted outside the sticker', () => {
    const pause = vi.fn();
    const resume = vi.fn();
    render(<PollSticker data={{ question: 'Choose', optionA: 'A', optionB: 'B' }} pause={pause} resume={resume} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Vote for: A' }));
    fireEvent.pointerUp(window);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('keeps a poll paused while keyboard focus moves between choices', () => {
    const pause = vi.fn();
    const resume = vi.fn();
    render(<PollSticker data={{ question: 'Choose', optionA: 'A', optionB: 'B' }} pause={pause} resume={resume} />);
    const first = screen.getByRole('button', { name: 'Vote for: A' });
    const second = screen.getByRole('button', { name: 'Vote for: B' });
    act(() => first.focus());
    act(() => second.focus());
    expect(pause).toHaveBeenCalledTimes(1);
    expect(resume).not.toHaveBeenCalled();
    act(() => second.blur());
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('pauses while answering and submits a trimmed response', async () => {
    const onSubmit = vi.fn();
    const pause = vi.fn();
    const resume = vi.fn();
    render(
      <QuestionSticker
        data={{ prompt: 'Your idea?', onSubmit }}
        pause={pause}
        resume={resume}
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Your answer' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '  Ship it  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(pause).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('Ship it');
    await waitFor(() => expect(resume).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Response submitted!')).toBeInTheDocument();
  });

  it('keeps question focus paused through the send button and cleans up on unmount', () => {
    const pause = vi.fn();
    const resume = vi.fn();
    const { rerender, unmount } = render(<QuestionSticker data={{ prompt: 'Your idea?', onSubmit: vi.fn() }} pause={pause} resume={resume} />);
    const input = screen.getByRole('textbox', { name: 'Your answer' });
    act(() => input.focus());
    fireEvent.change(input, { target: { value: 'Answer' } });
    act(() => screen.getByRole('button', { name: 'Send answer' }).focus());
    expect(pause).toHaveBeenCalledTimes(1);
    expect(resume).not.toHaveBeenCalled();
    const changedResume = vi.fn();
    rerender(<QuestionSticker data={{ prompt: 'Your idea?', onSubmit: vi.fn() }} pause={pause} resume={changedResume} />);
    expect(resume).not.toHaveBeenCalled();
    expect(changedResume).not.toHaveBeenCalled();
    unmount();
    expect(changedResume).toHaveBeenCalledTimes(1);
  });

  it('disables an answer without a submission handler and never shows success', () => {
    render(<QuestionSticker data={{ prompt: 'Your idea?' }} />);
    expect(screen.getByRole('textbox', { name: 'Your answer' })).toBeDisabled();
    expect(screen.getByPlaceholderText('Answers unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Response submitted!')).not.toBeInTheDocument();
  });

  it('preserves a failed answer for retry and prevents duplicate pending submissions', async () => {
    let rejectSubmission: (reason: Error) => void = () => {};
    const onSubmit = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectSubmission = reject; }));
    render(<QuestionSticker data={{ prompt: 'Your idea?', onSubmit }} />);
    const input = screen.getByRole('textbox', { name: 'Your answer' });
    fireEvent.change(input, { target: { value: '  Keep this draft  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Send answer' })).toBeDisabled();
    await act(async () => rejectSubmission(new Error('Offline')));
    expect(input).toHaveValue('  Keep this draft  ');
    expect(screen.getByRole('status')).toHaveTextContent('Response could not be submitted. Try again.');
    expect(screen.getByRole('button', { name: 'Send answer' })).not.toBeDisabled();
  });

  it('ignores a previous question submission after the prompt changes', async () => {
    let completeSubmission: () => void = () => {};
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => { completeSubmission = resolve; }));
    const { rerender } = render(<QuestionSticker data={{ prompt: 'First question', onSubmit }} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'First answer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send answer' }));
    rerender(<QuestionSticker data={{ prompt: 'Second question', onSubmit }} />);
    await act(async () => completeSubmission());
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.queryByText('Response submitted!')).not.toBeInTheDocument();
  });

  it('does not submit an answer while an IME composition is being confirmed', () => {
    const onSubmit = vi.fn();
    render(<QuestionSticker data={{ prompt: 'Your idea?', onSubmit }} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Answer' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('lets Tab reach a modal focus trap while protecting native sticker buttons from story shortcuts', () => {
    const onKeyDown = vi.fn();
    const { rerender } = render(<div onKeyDown={onKeyDown}><PollSticker data={{ question: 'Choose', optionA: 'A', optionB: 'B' }} /></div>);
    const option = screen.getByRole('button', { name: 'Vote for: A' });
    fireEvent.keyDown(option, { key: 'Tab' });
    fireEvent.keyDown(option, { key: 'Escape' });
    fireEvent.keyDown(option, { key: 'ArrowRight', code: 'ArrowRight' });
    fireEvent.keyDown(option, { key: ' ', code: 'Space' });
    expect(onKeyDown).toHaveBeenCalledTimes(2);
    onKeyDown.mockClear();
    rerender(<div onKeyDown={onKeyDown}><QuestionSticker data={{ prompt: 'Your idea?', onSubmit: vi.fn() }} /></div>);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Tab' });
    fireEvent.keyDown(input, { key: 'ArrowRight', code: 'ArrowRight' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onKeyDown).toHaveBeenCalledTimes(2);
  });
});
