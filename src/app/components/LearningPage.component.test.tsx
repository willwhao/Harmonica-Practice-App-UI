import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SONGS } from '../data';
import type { PracticeHistoryEntry } from '../types';
import { LearningPage } from './LearningPage';

describe('LearningPage', () => {
  it('shows growth level, monthly XP and badge progress', () => {
    const history: PracticeHistoryEntry[] = [{
      id: 'practice-1',
      songId: SONGS[0].id,
      score: 1800,
      accuracy: 88,
      practicedAt: new Date().toISOString(),
      durationSeconds: 120,
      weakMeasures: [],
    }];

    render(
      <LearningPage
        user={null}
        songs={SONGS}
        history={history}
        bookmarks={[]}
        learningProgress={[]}
        onBack={vi.fn()}
        onSelectSong={vi.fn()}
        onPracticeBookmark={vi.fn()}
      />,
    );

    expect(screen.getByText(/成长等级 Lv\./)).toBeInTheDocument();
    expect(screen.getByText('本月 XP')).toBeInTheDocument();
    expect(screen.getByText('成长徽章')).toBeInTheDocument();
    expect(screen.getByText('初次登台')).toBeInTheDocument();
  });
});
