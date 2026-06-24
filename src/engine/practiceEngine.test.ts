import assert from 'node:assert/strict';
import test from 'node:test';
import { getPracticeChart } from '../app/data/practiceCharts.ts';
import {
  addJudgmentCount,
  adjustJudgment,
  buildRecordingErrorSegments,
  calculateAccuracy,
  getHarmonicaTrackCount,
  getPlaybackPosition,
  getPracticeWindow,
  getWeakestMeasure,
  migrateChart,
  nextCombo,
  validatePracticeChart,
} from './index.ts';

test('engine validates and migrates practice charts without React', () => {
  const current = getPracticeChart('1').chart;
  assert.equal(validatePracticeChart(current).valid, true);

  const legacy = {
    ...current,
    schemaVersion: 1 as const,
    notes: current.notes.map(({ durationBeats: _durationBeats, technique: _technique, ...note }) => note),
  };
  const migrated = migrateChart(legacy);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.notes[0].durationBeats, 1);
  assert.equal(migrated.notes[0].technique, 'natural');
});

test('engine calculates segmented playback, scoring and weak measures', () => {
  const window = getPracticeWindow(12, 'custom', 2, 2, 5);
  assert.deepEqual(window, {
    startMeasure: 2,
    endMeasure: 5,
    startBeat: 8,
    endBeat: 20,
    segmentBeats: 12,
    repeatCount: 2,
    totalPlaybackBeats: 24,
  });
  assert.deepEqual(getPlaybackPosition(14, window.startBeat, window.segmentBeats, window.repeatCount), {
    loopIndex: 1,
    beatWithinLoop: 2,
    chartBeat: 10,
  });

  const counts = addJudgmentCount({ perfect: 1, great: 0, good: 0, bad: 0, miss: 0 }, 'Great');
  assert.equal(calculateAccuracy(counts), 95);
  assert.equal(nextCombo(3, 'Good'), 4);
  assert.equal(nextCombo(3, 'Bad'), 0);
  assert.equal(adjustJudgment('Perfect', 220, 10), 'Great');
});

test('engine provides layout and replay segment helpers', () => {
  assert.equal(getHarmonicaTrackCount('diatonic'), 10);
  assert.equal(getHarmonicaTrackCount('chromatic'), 12);

  const results = [{
    loopIndex: 1,
    beat: 10,
    measure: 3,
    noteNumber: '5',
    hole: 6,
    breath: 'blow' as const,
    judgment: 'Miss' as const,
    centsDifference: null,
    detectedNote: null,
    timingDifferenceMs: null,
    stabilityCents: null,
  }];
  assert.equal(getWeakestMeasure(results)?.measure, 3);
  assert.deepEqual(buildRecordingErrorSegments({
    results,
    beatDurationSec: 0.5,
    startBeat: 8,
    segmentBeats: 12,
  })[0], {
    id: '1-10-6-0',
    label: '第 3 小节 · 5 · 6孔吹',
    startMs: 6450,
    endMs: 8250,
    reason: '未识别到目标音',
  });
});
