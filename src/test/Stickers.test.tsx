import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CountdownSticker } from '../stickers/CountdownSticker';
import { EmojiSticker } from '../stickers/EmojiSticker';
import { HashtagSticker } from '../stickers/HashtagSticker';
import { LocationSticker } from '../stickers/LocationSticker';
import { MentionSticker } from '../stickers/MentionSticker';
import { MusicSticker } from '../stickers/MusicSticker';
import { PollSticker } from '../stickers/PollSticker';
import { QuestionSticker } from '../stickers/QuestionSticker';
import { TextSticker } from '../stickers/TextSticker';

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

  it('submits a poll once and resumes playback', () => {
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
    expect(resume).toHaveBeenCalled();
    expect(onVote).toHaveBeenCalledTimes(1);
  });

  it('pauses while answering and submits a trimmed response', () => {
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
    expect(resume).toHaveBeenCalled();
    expect(screen.getByText('Response sent!')).toBeInTheDocument();
  });
});
