import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGrowthBadges,
  buildGrowthLevel,
  buildGrowthSummary,
  buildMonthlyGrowthReport,
  calculatePracticeXp,
  calculateTotalXp,
} from './growthSystem.ts';
import type { LearningTrackProgress, PracticeBookmark, PracticeHistoryEntry } from '../types.ts';

function entry(input: Partial<PracticeHistoryEntry> & Pick<PracticeHistoryEntry, 'id' | 'songId' | 'accuracy' | 'score' | 'practicedAt'>): PracticeHistoryEntry {
  return {
    durationSeconds: 120,
    weakMeasures: [],
    ...input,
  };
}

test('calculates practice XP from duration, accuracy and score', () => {
  const high = calculatePracticeXp(entry({ id: 'a', songId: '1', score: 3200, accuracy: 94, durationSeconds: 180, practicedAt: '2026-06-10T08:00:00.000Z' }));
  const low = calculatePracticeXp(entry({ id: 'b', songId: '1', score: 400, accuracy: 50, durationSeconds: 30, practicedAt: '2026-06-10T08:00:00.000Z', weakMeasures: [{ measure: 1, errors: 4, total: 8, averageCents: 20 }] }));
  assert.ok(high > low);
  assert.ok(low >= 10);
});

test('builds deterministic level progress from total XP', () => {
  assert.deepEqual(buildGrowthLevel(0), { level: 1, totalXp: 0, currentLevelXp: 0, nextLevelXp: 600, progressPercent: 0 });
  assert.equal(buildGrowthLevel(1250).level, 3);
  assert.equal(buildGrowthLevel(1250).currentLevelXp, 50);
});

test('awards badges from streaks, accuracy, score, course progress and bookmarks', () => {
  const now = new Date('2026-06-26T08:00:00.000Z');
  const history = [
    entry({ id: '1', songId: '1', score: 3100, accuracy: 91, practicedAt: '2026-06-22T08:00:00.000Z' }),
    entry({ id: '2', songId: '1', score: 2500, accuracy: 92, practicedAt: '2026-06-23T08:00:00.000Z' }),
    entry({ id: '3', songId: '2', score: 2600, accuracy: 93, practicedAt: '2026-06-24T08:00:00.000Z' }),
    entry({ id: '4', songId: '2', score: 2700, accuracy: 94, practicedAt: '2026-06-25T08:00:00.000Z' }),
    entry({ id: '5', songId: '3', score: 2800, accuracy: 95, practicedAt: '2026-06-26T08:00:00.000Z' }),
  ];
  const bookmarks: PracticeBookmark[] = [1, 2, 3].map((index) => ({
    id: `b${index}`,
    songId: '1',
    startMeasure: index,
    endMeasure: index,
    label: `第 ${index} 小节`,
    createdAt: `2026-06-2${index}T08:00:00.000Z`,
  }));
  const progress: LearningTrackProgress[] = [{
    id: 'track',
    trackId: 'track',
    completedSessions: 5,
    targetSessions: 5,
    progressPercent: 100,
    nextSongId: null,
    updatedAt: '2026-06-26T08:00:00.000Z',
  }];
  const badges = buildGrowthBadges(history, bookmarks, progress, now);
  assert.equal(badges.find((badge) => badge.id === 'first-session')?.earned, true);
  assert.equal(badges.find((badge) => badge.id === 'three-day-streak')?.earned, true);
  assert.equal(badges.find((badge) => badge.id === 'accurate-player')?.earned, true);
  assert.equal(badges.find((badge) => badge.id === 'score-breakthrough')?.earned, true);
  assert.equal(badges.find((badge) => badge.id === 'course-finisher')?.earned, true);
  assert.equal(badges.find((badge) => badge.id === 'weak-spot-hunter')?.earned, true);
});

test('builds a monthly report with improvement and weak-measure highlights', () => {
  const history = [
    entry({ id: 'old', songId: '1', score: 1000, accuracy: 70, durationSeconds: 60, practicedAt: '2026-06-01T08:00:00.000Z', weakMeasures: [{ measure: 2, errors: 3, total: 8, averageCents: 25 }] }),
    entry({ id: 'new', songId: '1', score: 2000, accuracy: 86, durationSeconds: 180, practicedAt: '2026-06-20T08:00:00.000Z', weakMeasures: [{ measure: 4, errors: 5, total: 8, averageCents: 15 }] }),
    entry({ id: 'past', songId: '2', score: 3000, accuracy: 99, durationSeconds: 600, practicedAt: '2026-05-20T08:00:00.000Z' }),
  ];
  const report = buildMonthlyGrowthReport(history, new Date('2026-06-26T08:00:00.000Z'));
  assert.equal(report.monthKey, '2026-06');
  assert.equal(report.sessions, 2);
  assert.equal(report.minutes, 4);
  assert.equal(report.averageAccuracy, 78);
  assert.deepEqual(report.improvedSongIds, ['1']);
  assert.equal(report.weakestMeasures[0].measure, 4);
});

test('combines XP, badges and monthly report in one summary', () => {
  const history = [
    entry({ id: '1', songId: '1', score: 1200, accuracy: 82, practicedAt: '2026-06-25T08:00:00.000Z' }),
    entry({ id: '2', songId: '1', score: 1400, accuracy: 88, practicedAt: '2026-06-26T08:00:00.000Z' }),
  ];
  const summary = buildGrowthSummary(history, [], [], new Date('2026-06-26T08:00:00.000Z'));
  assert.equal(summary.level.totalXp, calculateTotalXp(history));
  assert.equal(summary.monthlyReport.sessions, 2);
  assert.equal(summary.badges.some((badge) => badge.earned), true);
});
