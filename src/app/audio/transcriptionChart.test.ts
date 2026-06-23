import assert from 'node:assert/strict';
import test from 'node:test';
import { SONGS } from '../data.ts';
import type { AudioTranscription } from './audioTranscription.ts';
import { createPracticeChartFromTranscription } from './transcriptionChart.ts';

const transcription: AudioTranscription = {
  durationSec: 4,
  key: 'C',
  jianpuLine: '1 2 3 5',
  notes: [
    { startSec: 0, endSec: 0.4, frequency: 261.63, noteName: 'C4', jianpu: '1', confidence: 90 },
    { startSec: 0.65, endSec: 1.05, frequency: 293.66, noteName: 'D4', jianpu: '2', confidence: 88 },
    { startSec: 1.3, endSec: 1.7, frequency: 329.63, noteName: 'E4', jianpu: '3', confidence: 88 },
    { startSec: 2.6, endSec: 3.4, frequency: 392, noteName: 'G4', jianpu: '5', confidence: 92 },
  ],
};

test('turns a transcription draft into a validated practice chart', () => {
  const chart = createPracticeChartFromTranscription({
    song: SONGS[0],
    transcription,
    harmonicaType: 'diatonic',
  });
  assert.ok(chart);
  assert.equal(chart.songId, SONGS[0].id);
  assert.equal(chart.harmonicaType, 'diatonic');
  assert.equal(chart.notes.length, 4);
  assert.equal(chart.notes[0].hole, 4);
  assert.equal(chart.measures[0][0].n, '1');
});

test('returns null when no stable notes were transcribed', () => {
  const chart = createPracticeChartFromTranscription({
    song: SONGS[0],
    transcription: { ...transcription, notes: [], jianpuLine: '' },
    harmonicaType: 'chromatic',
  });
  assert.equal(chart, null);
});
