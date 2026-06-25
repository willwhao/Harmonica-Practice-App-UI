import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReleaseConfig,
  getRolloutBucket,
  isFeatureEnabled,
  isInRollout,
  normalizeRolloutPercent,
  parseBooleanFlag,
  parseReleaseChannel,
  summarizeReleaseReadiness,
} from './releaseConfig.ts';

test('parses release channels with development fallback', () => {
  assert.equal(parseReleaseChannel('production'), 'production');
  assert.equal(parseReleaseChannel('preview'), 'preview');
  assert.equal(parseReleaseChannel('unknown'), 'development');
});

test('parses common boolean flag values', () => {
  assert.equal(parseBooleanFlag('true'), true);
  assert.equal(parseBooleanFlag('off'), false);
  assert.equal(parseBooleanFlag('unexpected'), undefined);
});

test('uses safer production defaults while keeping core features enabled', () => {
  const config = buildReleaseConfig({ VITE_RELEASE_CHANNEL: 'production', VITE_APP_VERSION: '1.2.3' });
  assert.equal(config.channel, 'production');
  assert.equal(config.appVersion, '1.2.3');
  assert.equal(config.audienceKey, 'anonymous');
  assert.equal(isFeatureEnabled(config, 'audioUploadTranscription'), false);
  assert.equal(isFeatureEnabled(config, 'cloudSync'), true);
  assert.equal(isFeatureEnabled(config, 'contentManagement'), true);
  assert.equal(isFeatureEnabled(config, 'licensedAudioDelivery'), false);
  assert.equal(isFeatureEnabled(config, 'remoteMonitoring'), true);
  assert.equal(isFeatureEnabled(config, 'operationsPanel'), false);
});

test('environment flags override channel defaults', () => {
  const config = buildReleaseConfig({
    VITE_RELEASE_CHANNEL: 'production',
    VITE_FEATURE_AUDIO_UPLOAD: 'enabled',
    VITE_FEATURE_OPERATIONS_PANEL: '1',
  });
  assert.equal(isFeatureEnabled(config, 'audioUploadTranscription'), true);
  assert.equal(config.flags.audioUploadTranscription.source, 'environment');
  assert.equal(isFeatureEnabled(config, 'operationsPanel'), true);
});

test('applies remote rollout rules before enabling a flag', () => {
  const audienceKey = 'player-42';
  const bucket = getRolloutBucket('operationsPanel', audienceKey);
  const blocked = buildReleaseConfig(
    { VITE_RELEASE_CHANNEL: 'production' },
    { flags: { operationsPanel: { enabled: true, rolloutPercent: bucket } } },
    audienceKey,
  );
  assert.equal(blocked.flags.operationsPanel.source, 'remote');
  assert.equal(blocked.flags.operationsPanel.rolloutMatched, false);
  assert.equal(isFeatureEnabled(blocked, 'operationsPanel'), false);

  const enabled = buildReleaseConfig(
    { VITE_RELEASE_CHANNEL: 'production' },
    { flags: { operationsPanel: { enabled: true, rolloutPercent: bucket + 1 } } },
    audienceKey,
  );
  assert.equal(enabled.flags.operationsPanel.rolloutMatched, true);
  assert.equal(isFeatureEnabled(enabled, 'operationsPanel'), true);
});

test('normalizes rollout percentages and keeps rollout buckets stable', () => {
  assert.equal(normalizeRolloutPercent(-1), 0);
  assert.equal(normalizeRolloutPercent(120), 100);
  assert.equal(normalizeRolloutPercent(49.6), 50);
  assert.equal(getRolloutBucket('cloudSync', 'same-user'), getRolloutBucket('cloudSync', 'same-user'));
  assert.equal(isInRollout('cloudSync', 'same-user', 0), false);
  assert.equal(isInRollout('cloudSync', 'same-user', 100), true);
});

test('summarizes release readiness for UI display', () => {
  const summary = summarizeReleaseReadiness(buildReleaseConfig({ VITE_RELEASE_CHANNEL: 'preview', VITE_APP_VERSION: '0.2.0' }));
  assert.equal(summary.label, 'preview 路 v0.2.0');
  assert.equal(summary.total, 10);
  assert.equal(summary.enabled, 9);
  assert.equal(summary.remoteOverrides, 0);
  assert.equal(summary.rolloutLimited, 0);
});
