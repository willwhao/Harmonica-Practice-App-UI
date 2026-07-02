import assert from 'node:assert/strict';
import test from 'node:test';
import { getPracticeChart } from '../data/practiceCharts.ts';
import { getFallingNoteGeometry, getHarmonicaTrackCount, getNoteTrackIndex, getVisibleTraditionalScore } from './scoreLayout.ts';

test('maps harmonica holes to deterministic lane indexes', () => {
  assert.equal(getHarmonicaTrackCount('diatonic'), 10);
  assert.equal(getHarmonicaTrackCount('chromatic'), 12);
  assert.equal(getNoteTrackIndex({ hole: 1 }), 0);
  assert.equal(getNoteTrackIndex({ hole: 12 }), 11);
});

test('builds a two-line traditional score window from the current measure', () => {
  const { chart } = getPracticeChart('1');
  const [lineA, lineB] = getVisibleTraditionalScore(chart.measures, 18.2);
  assert.equal(lineA.length, 8);
  assert.equal(lineB.length, 8);
  assert.equal(lineA[0].measure, 4);
  assert.equal(lineB[0].measure, 6);
  assert.ok([...lineA, ...lineB].some((item) => item.absoluteBeat === 18));
});

test('turns note duration into a longer falling bar', () => {
  const short = getFallingNoteGeometry({
    note: { beat: 2, durationBeats: 1, hole: 4 },
    currentBeat: 0,
    judgmentY: 300,
    beatHeight: 50,
    trackWidth: 30,
  });
  const long = getFallingNoteGeometry({
    note: { beat: 2, durationBeats: 3, hole: 4 },
    currentBeat: 0,
    judgmentY: 300,
    beatHeight: 50,
    trackWidth: 30,
  });
  assert.equal(short.centerX, long.centerX);
  assert.ok(long.durationHeight > short.durationHeight);
});
