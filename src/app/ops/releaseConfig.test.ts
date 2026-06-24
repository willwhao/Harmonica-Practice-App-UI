import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReleaseConfig, isFeatureEnabled, parseBooleanFlag, parseReleaseChannel, summarizeReleaseReadiness } from './releaseConfig.ts';

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
  assert.equal(isFeatureEnabled(config, 'audioUploadTranscription'), false);
  assert.equal(isFeatureEnabled(config, 'cloudSync'), true);
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

test('summarizes release readiness for UI display', () => {
  const summary = summarizeReleaseReadiness(buildReleaseConfig({ VITE_RELEASE_CHANNEL: 'preview', VITE_APP_VERSION: '0.2.0' }));
  assert.equal(summary.label, 'preview · v0.2.0');
  assert.equal(summary.total, 7);
  assert.equal(summary.enabled, 7);
});
