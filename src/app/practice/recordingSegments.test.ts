import assert from 'node:assert/strict';
import test from 'node:test';
import type { NotePracticeResult } from '../types.ts';
import { buildRecordingErrorSegments } from './recordingSegments.ts';

const result = (beat: number, judgment: NotePracticeResult['judgment']): NotePracticeResult => ({
  loopIndex: 0,
  beat,
  measure: Math.floor(beat / 4) + 1,
  noteNumber: '3',
  hole: 5,
  breath: 'blow',
  judgment,
  centsDifference: judgment === 'Bad' ? 42 : null,
  detectedNote: null,
  timingDifferenceMs: null,
  stabilityCents: null,
});

test('builds bounded replay segments for bad and missed notes', () => {
  const segments = buildRecordingErrorSegments({
    results: [result(0, 'Perfect'), result(2, 'Bad'), result(4, 'Miss')],
    beatDurationSec: 0.5,
    startBeat: 0,
    segmentBeats: 8,
  });
  assert.equal(segments.length, 2);
  assert.equal(segments[0].startMs, 450);
  assert.equal(segments[0].endMs, 2250);
  assert.match(segments[0].reason, /42¢/);
  assert.match(segments[1].reason, /未识别/);
});

test('uses loop index and practice window offset in segment timing', () => {
  const item = result(10, 'Miss');
  item.loopIndex = 1;
  const [segment] = buildRecordingErrorSegments({
    results: [item],
    beatDurationSec: 1,
    startBeat: 8,
    segmentBeats: 4,
  });
  assert.equal(segment.startMs, 5450);
  assert.equal(segment.endMs, 7250);
});
