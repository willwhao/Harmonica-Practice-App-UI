import assert from 'node:assert/strict';
import test from 'node:test';
import { getPrivacyChecklist, summarizePrivacyReadiness } from './privacyChecklist.ts';

test('documents privacy handling for local audio and account data', () => {
  const checklist = getPrivacyChecklist();
  assert.ok(checklist.some((item) => item.id === 'local-audio-upload' && item.status === 'implemented'));
  assert.ok(checklist.some((item) => item.id === 'practice-recording' && item.status === 'implemented'));
  assert.ok(checklist.some((item) => item.id === 'formal-legal-docs' && item.status === 'implemented'));
});

test('summarizes privacy readiness counts', () => {
  const summary = summarizePrivacyReadiness();
  assert.equal(summary.total, 5);
  assert.equal(summary.implemented, 5);
  assert.equal(summary.planned, 0);
});
