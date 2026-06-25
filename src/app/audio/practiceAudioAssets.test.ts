import assert from 'node:assert/strict';
import test from 'node:test';
import { SONGS } from '../data.ts';
import { buildCdnAssetUrl, buildPlaybackSyncPlan, getPracticeAudioAssets, getSelectedSyntheticAsset, summarizeLicensedAudioReadiness, validatePracticeAudioAssets, type LicensedAudioGrant } from './practiceAudioAssets.ts';

test('registers audio assets with explicit licensing metadata', () => {
  const assets = getPracticeAudioAssets(SONGS[0]);
  assert.equal(validatePracticeAudioAssets(assets), true);
  assert.ok(assets.some((asset) => asset.status === 'available'));
  assert.ok(assets.some((asset) => asset.status === 'requires-license'));
});

test('gates licensed audio behind both approval and CDN configuration', () => {
  const grants: LicensedAudioGrant[] = [{
    songId: '1',
    kind: 'licensed-backing',
    assetPath: 'backing/castle in the sky.m4a',
    label: '授权原曲伴奏',
    rightsHolder: 'Example Rights Holder',
    licenseId: 'license-001',
    status: 'approved',
    validFrom: '2026-01-01',
    expiresAt: '2027-01-01',
  }];
  const withoutCdn = getPracticeAudioAssets(SONGS[0], { grants, now: '2026-06-24T00:00:00.000Z' });
  assert.equal(withoutCdn.find((asset) => asset.kind === 'licensed-backing')?.status, 'cdn-missing');

  const withCdn = getPracticeAudioAssets(SONGS[0], { grants, cdnBaseUrl: 'https://cdn.example.com/audio/', now: '2026-06-24T00:00:00.000Z' });
  const backing = withCdn.find((asset) => asset.kind === 'licensed-backing');
  assert.equal(backing?.status, 'available');
  assert.equal(backing?.url, 'https://cdn.example.com/audio/backing/castle%20in%20the%20sky.m4a');
  assert.equal(validatePracticeAudioAssets(withCdn), true);
});

test('reports licensed audio readiness across pending and expired grants', () => {
  const grants: LicensedAudioGrant[] = [{
    songId: '1',
    kind: 'licensed-demo',
    assetPath: 'demo/expired.m4a',
    label: '过期示范',
    rightsHolder: 'Teacher',
    licenseId: 'license-expired',
    status: 'approved',
    validFrom: '2025-01-01',
    expiresAt: '2025-12-31',
  }];
  const assets = getPracticeAudioAssets(SONGS[0], { grants, cdnBaseUrl: 'https://cdn.example.com', now: '2026-06-24T00:00:00.000Z' });
  const summary = summarizeLicensedAudioReadiness(assets);
  assert.equal(summary.expired, 1);
  assert.equal(summary.pending, 1);
});

test('builds encoded CDN asset urls', () => {
  assert.equal(buildCdnAssetUrl('https://cdn.example.com/audio/', '/demo/教师 示范.m4a'), 'https://cdn.example.com/audio/demo/%E6%95%99%E5%B8%88%20%E7%A4%BA%E8%8C%83.m4a');
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
