import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LinkSticker } from '../stickers/LinkSticker';

describe('LinkSticker', () => {
  it('opens HTTPS links with opener isolation', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<LinkSticker data={{ url: 'https://example.com/path', label: 'Visit' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open link: Visit' }));
    expect(open).toHaveBeenCalledWith('https://example.com/path', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });

  it('rejects executable URL schemes', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<LinkSticker data={{ url: 'javascript:alert(1)', label: 'Unsafe' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open link: Unsafe' }));
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });
});
