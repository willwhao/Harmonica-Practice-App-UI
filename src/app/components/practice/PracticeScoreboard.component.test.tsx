import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PracticeScoreboard } from './PracticeScoreboard';

describe('PracticeScoreboard', () => {
  it('renders song status and triggers back navigation', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(
      <PracticeScoreboard
        title="天空之城"
        subtitle="C调 · 92 BPM · 全曲 ×1"
        score={1200}
        accuracy={88}
        progressPct={42.4}
        onBack={onBack}
      />,
    );

    expect(screen.getByText('天空之城')).toBeInTheDocument();
    expect(screen.getByText('C调 · 92 BPM · 全曲 ×1')).toBeInTheDocument();
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('准确率 88%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '练习进度' })).toHaveAttribute('aria-valuenow', '42');

    await user.click(screen.getByRole('button', { name: '返回练习设置' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
