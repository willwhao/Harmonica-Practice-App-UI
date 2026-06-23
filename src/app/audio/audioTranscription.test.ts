import assert from 'node:assert/strict';
import test from 'node:test';
import { midiToJianpu, transcribeMonoAudio } from './audioTranscription.ts';

function sine(frequency: number, seconds: number, sampleRate = 44100) {
  const samples = new Float32Array(Math.floor(seconds * sampleRate));
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.sin(2 * Math.PI * frequency * index / sampleRate) * 0.55;
  }
  return { samples, sampleRate };
}

test('maps midi notes to key-relative jianpu', () => {
  assert.equal(midiToJianpu(60, 'C'), '1');
  assert.equal(midiToJianpu(64, 'C'), '3');
  assert.equal(midiToJianpu(67, 'C'), '5');
  assert.equal(midiToJianpu(67, 'G'), '1');
});

test('transcribes a clean monophonic tone into a jianpu draft', () => {
  const audio = sine(392, 0.7);
  const transcription = transcribeMonoAudio({ ...audio, key: 'C' });
  assert.ok(transcription.notes.length >= 1);
  assert.equal(transcription.notes[0].jianpu, '5');
  assert.match(transcription.jianpuLine, /5/);
});
