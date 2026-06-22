import assert from 'node:assert/strict';
import test from 'node:test';
import { adjustJudgment, getWeakestMeasure, summarizeTimingAndStability, summarizeWeakMeasures } from './practiceInsights.ts';
import type { NotePracticeResult } from '../types.ts';

const result = (measure: number, judgment: NotePracticeResult['judgment'], centsDifference: number | null): NotePracticeResult => ({
  loopIndex: 0, beat: measure * 4, measure, noteNumber: '3', hole: 5,
  breath: 'blow', judgment, centsDifference, detectedNote: centsDifference === null ? null : 'E4',
  timingDifferenceMs: null, stabilityCents: null,
});

test('downgrades judgments for late or unstable notes', () => {
  assert.equal(adjustJudgment('Perfect', 220, 10), 'Great');
  assert.equal(adjustJudgment('Great', 250, 50), 'Bad');
  assert.equal(adjustJudgment('Good', null, 12), 'Good');
});

test('summarizes rhythm direction and pitch stability', () => {
  const items = [
    { ...result(1, 'Great', 10), timingDifferenceMs: -120, stabilityCents: 14 },
    { ...result(1, 'Good', 20), timingDifferenceMs: 200, stabilityCents: 26 },
  ];
  assert.deepEqual(summarizeTimingAndStability(items), {
    averageTimingDeviationMs: 160, earlyNotes: 1, lateNotes: 1, averageStabilityCents: 20,
  });
});

test('ranks measures by error ratio and intonation deviation', () => {
  const results = [
    result(1, 'Perfect', 5), result(1, 'Miss', null),
    result(2, 'Bad', 74), result(2, 'Miss', null),
  ];
  const summary = summarizeWeakMeasures(results);
  assert.equal(summary[0].measure, 2);
  assert.equal(summary[0].errors, 2);
  assert.equal(summary[0].averageCents, 74);
  assert.equal(getWeakestMeasure(results)?.measure, 2);
});

test('returns no weakest measure when there are no bad or missed notes', () => {
  assert.equal(getWeakestMeasure([result(1, 'Great', 18)]), null);
});
