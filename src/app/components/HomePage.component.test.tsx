import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SONGS } from '../data';
import { HomePage } from './HomePage';

function renderHome(onSelect = vi.fn()) {
  render(<HomePage songs={SONGS} history={[]} user={null} onAccount={vi.fn()} onLearning={vi.fn()} onSelect={onSelect} />);
  return onSelect;
}

describe('HomePage', () => {
  it('filters songs by search and resets the result', async () => {
    const user = userEvent.setup();
    renderHome();
    const search = screen.getByPlaceholderText('搜索歌曲、歌手...');
    await user.type(search, '月亮');
    expect(screen.getByRole('button', { name: /月亮代表我的心/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /天空之城/ })).not.toBeInTheDocument();
    await user.clear(search);
    expect(screen.getByRole('button', { name: /天空之城/ })).toBeInTheDocument();
  });

  it('selects a song from the filtered library', async () => {
    const user = userEvent.setup();
    const onSelect = renderHome();
    await user.click(screen.getByRole('button', { name: /天空之城/ }));
    expect(onSelect).toHaveBeenCalledWith(SONGS[0]);
  });
});
