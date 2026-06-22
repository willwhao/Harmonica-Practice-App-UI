import assert from 'node:assert/strict';
import test from 'node:test';
import { detectPitch, frequencyToNote } from './pitchDetection.ts';

function sineWave(frequency: number, sampleRate = 48_000, length = 4096) {
  return Float32Array.from({ length }, (_, index) => Math.sin(2 * Math.PI * frequency * index / sampleRate) * 0.5);
}

test('converts concert A to A4', () => {
  assert.deepEqual(frequencyToNote(440), { midi: 69, note: 'A4', cents: 0 });
});

test('detects A4 from a clean waveform', () => {
  const sample = detectPitch(sineWave(440), 48_000);
  assert.ok(sample);
  assert.ok(Math.abs(sample.frequency - 440) < 2, `detected ${sample.frequency} Hz`);
  assert.equal(sample.note, 'A4');
});

test('detects middle C from a clean waveform', () => {
  const sample = detectPitch(sineWave(261.63), 48_000);
  assert.ok(sample);
  assert.ok(Math.abs(sample.frequency - 261.63) < 2, `detected ${sample.frequency} Hz`);
  assert.equal(sample.note, 'C4');
});

test('ignores silence', () => {
  assert.equal(detectPitch(new Float32Array(4096), 48_000), null);
});

test('respects a calibrated noise threshold', () => {
  assert.equal(detectPitch(sineWave(440), 48_000, 0.6), null);
});
