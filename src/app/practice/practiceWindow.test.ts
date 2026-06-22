import assert from 'node:assert/strict';
import test from 'node:test';
import { getPlaybackPosition, getPracticeWindow } from './practiceWindow.ts';

test('creates full and half-song practice windows', () => {
  assert.deepEqual(getPracticeWindow(12, 'firstHalf', 2), {
    startMeasure: 0, endMeasure: 6, startBeat: 0, endBeat: 24,
    segmentBeats: 24, repeatCount: 2, totalPlaybackBeats: 48,
  });
  assert.equal(getPracticeWindow(12, 'secondHalf', 1).startBeat, 24);
  assert.equal(getPracticeWindow(12, 'full', 3).totalPlaybackBeats, 144);
});

test('maps playback time into repeated chart positions', () => {
  assert.deepEqual(getPlaybackPosition(25, 24, 24, 3), { loopIndex: 1, beatWithinLoop: 1, chartBeat: 25 });
  assert.deepEqual(getPlaybackPosition(72, 24, 24, 3), { loopIndex: 2, beatWithinLoop: 24, chartBeat: 48 });
});

test('clamps custom A-B markers to a valid measure range', () => {
  const custom = getPracticeWindow(12, 'custom', 2, 3, 7);
  assert.equal(custom.startMeasure, 3);
  assert.equal(custom.endMeasure, 7);
  assert.equal(custom.startBeat, 12);
  assert.equal(custom.totalPlaybackBeats, 32);

  const clamped = getPracticeWindow(12, 'custom', 1, 20, 2);
  assert.equal(clamped.startMeasure, 11);
  assert.equal(clamped.endMeasure, 12);
});
