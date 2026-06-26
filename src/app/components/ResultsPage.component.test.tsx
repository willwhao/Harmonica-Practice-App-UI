import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SONGS } from '../data';
import { ResultsPage } from './ResultsPage';

describe('ResultsPage', () => {
  it('renders a zero-note result without invalid progress values', () => {
    render(
      <ResultsPage
        song={SONGS[0]}
        results={{
          score: 0,
          accuracy: 0,
          maxCombo: 0,
          perfect: 0,
          great: 0,
          good: 0,
          bad: 0,
          miss: 0,
          total: 0,
        }}
        onBookmarkWeakMeasure={vi.fn()}
        onRetry={vi.fn()}
        onHome={vi.fn()}
      />,
    );

    expect(screen.getByText('最终得分')).toBeInTheDocument();
    expect(screen.getByText(/XP/)).toBeInTheDocument();
    expect(screen.getAllByText('0%').length).toBeGreaterThan(0);
  });
});
