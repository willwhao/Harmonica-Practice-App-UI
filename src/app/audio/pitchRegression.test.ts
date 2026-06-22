import assert from 'node:assert/strict';
import test from 'node:test';
import { detectPitch, frequencyToNote } from './pitchDetection.ts';
import { inspectAudioCompatibility } from './audioCompatibility.ts';

const SAMPLE_RATE = 48_000;

function pcmFixture(frequency: number, options: { noise?: number; secondHarmonic?: number; amplitude?: number } = {}) {
  const length = 4096;
  const amplitude = options.amplitude ?? 0.65;
  let seed = 12_345;
  return Float32Array.from({ length }, (_, index) => {
    seed = (seed * 16_807) % 2_147_483_647;
    const noise = ((seed / 2_147_483_647) * 2 - 1) * (options.noise ?? 0);
    const fundamental = Math.sin((2 * Math.PI * frequency * index) / SAMPLE_RATE) * amplitude;
    const harmonic = Math.sin((4 * Math.PI * frequency * index) / SAMPLE_RATE) * (options.secondHarmonic ?? 0);
    return fundamental + harmonic + noise;
  });
}

const NOTE_FIXTURES = [
  ['G3', 196], ['C4', 261.63], ['D4', 293.66], ['E4', 329.63],
  ['G4', 392], ['A4', 440], ['C5', 523.25], ['D5', 587.33],
] as const;

test('regresses the supported practice-note frequency range', () => {
  NOTE_FIXTURES.forEach(([expectedNote, frequency]) => {
    const sample = detectPitch(pcmFixture(frequency), SAMPLE_RATE);
    assert.ok(sample, `${expectedNote} should be detected`);
    assert.equal(frequencyToNote(sample.frequency).note, expectedNote);
    assert.ok(Math.abs(sample.frequency - frequency) < 2);
  });
});

test('detects a fundamental under deterministic noise and harmonics', () => {
  const sample = detectPitch(pcmFixture(329.63, { noise: 0.025, secondHarmonic: 0.18 }), SAMPLE_RATE);
  assert.ok(sample);
  assert.equal(sample.note, 'E4');
  assert.ok(sample.confidence >= 0.7);
});

test('rejects a signal below the calibrated input gate', () => {
  assert.equal(detectPitch(pcmFixture(440, { amplitude: 0.01 }), SAMPLE_RATE, 0.02), null);
});

test('reports missing browser audio capabilities deterministically', () => {
  const result = inspectAudioCompatibility({
    isSecureContext: true,
    hasMediaDevices: false,
    hasAudioContext: true,
    hasAnimationFrame: false,
  });
  assert.equal(result.supported, false);
  assert.deepEqual(result.missing, ['media-devices', 'animation-frame']);
});
