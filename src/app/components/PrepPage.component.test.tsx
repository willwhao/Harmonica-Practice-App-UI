import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SONGS } from '../data';
import { PrepPage } from './PrepPage';

describe('PrepPage', () => {
  it('submits default practice settings', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<PrepPage song={SONGS[0]} onBack={vi.fn()} onStart={onStart} />);
    await user.click(screen.getByRole('button', { name: '开始练习' }));
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({
      speed: 100,
      practiceRange: 'full',
      repeatCount: 1,
      harmonicaType: 'diatonic',
      metronomeEnabled: true,
    }));
  });

  it('uses the chromatic harmonica default for a chromatic song', () => {
    render(<PrepPage song={SONGS[6]} onBack={vi.fn()} onStart={vi.fn()} />);
    expect(screen.getByRole('button', { name: /半音阶/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
