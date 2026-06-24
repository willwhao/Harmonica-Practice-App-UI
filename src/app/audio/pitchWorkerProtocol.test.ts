import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzePitchFrame } from './pitchWorkerProtocol.ts';

function sineWave(frequency: number, sampleRate: number, seconds: number, amplitude = 0.8) {
  const length = Math.floor(sampleRate * seconds);
  const data = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.sin(2 * Math.PI * frequency * index / sampleRate) * amplitude;
  }
  return data;
}

test('analyzes pitch frames through the worker protocol', () => {
  const response = analyzePitchFrame({
    id: 7,
    samples: sineWave(440, 44_100, 0.05),
    sampleRate: 44_100,
    minimumRms: 0.01,
  });

  assert.equal(response.id, 7);
  assert.ok(response.sample);
  assert.equal(response.sample.note, 'A4');
  assert.ok(Math.abs(response.sample.frequency - 440) < 3);
});
