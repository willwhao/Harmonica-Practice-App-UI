import assert from 'node:assert/strict';
import test from 'node:test';
import { SONGS } from '../data.ts';
import { buildPlaybackSyncPlan, getPracticeAudioAssets, getSelectedSyntheticAsset, validatePracticeAudioAssets } from './practiceAudioAssets.ts';

test('registers audio assets with explicit licensing metadata', () => {
  const assets = getPracticeAudioAssets(SONGS[0]);
  assert.equal(validatePracticeAudioAssets(assets), true);
  assert.ok(assets.some((asset) => asset.status === 'available'));
  assert.ok(assets.some((asset) => asset.status === 'requires-license'));
});

test('maps current accompaniment modes to safe synthetic assets', () => {
  assert.equal(getSelectedSyntheticAsset('original')?.id, 'synth-chords');
  assert.equal(getSelectedSyntheticAsset('simplified')?.id, 'synth-root');
  assert.equal(getSelectedSyntheticAsset('none'), null);
});

test('builds a deterministic playback sync plan', () => {
  const plan = buildPlaybackSyncPlan({
    song: { bpm: 100 },
    speed: 80,
    segmentStartBeat: 4,
    segmentEndBeat: 20,
    repeatCount: 2,
  });
  assert.equal(plan.effectiveBpm, 80);
  assert.equal(plan.playbackRate, 0.8);
  assert.equal(plan.beatDurationSec, 0.75);
  assert.equal(plan.segmentEndBeat - plan.segmentStartBeat, 16);
});
