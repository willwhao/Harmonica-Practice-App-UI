import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateStreak, getLearningSummary, getWeeklyActivity } from './learningStats.ts';
import type { PracticeHistoryEntry } from '../types.ts';

const entry = (day: number, accuracy = 80, durationSeconds = 180): PracticeHistoryEntry => ({
  id: String(day), songId: '1', score: day * 100, accuracy,
  practicedAt: new Date(2026, 5, day, 12).toISOString(), durationSeconds,
});

test('calculates a streak including today and preceding days', () => {
  assert.equal(calculateStreak([entry(20), entry(21), entry(22)], new Date(2026, 5, 22, 18)), 3);
});

test('keeps a streak alive when the last practice was yesterday', () => {
  assert.equal(calculateStreak([entry(20), entry(21)], new Date(2026, 5, 22, 8)), 2);
});

test('builds weekly activity and summary metrics', () => {
  const history = [entry(21, 90, 120), entry(22, 70, 240)];
  const now = new Date(2026, 5, 22, 18);
  const week = getWeeklyActivity(history, now);
  const summary = getLearningSummary(history, now);
  assert.equal(week.at(-1)?.minutes, 4);
  assert.equal(summary.averageAccuracy, 80);
  assert.equal(summary.todayMinutes, 4);
  assert.equal(summary.bestScore, 2200);
});
