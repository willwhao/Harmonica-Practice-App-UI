import assert from 'node:assert/strict';
import test from 'node:test';
import { getCompatibilityChecklist, summarizeCompatibilityReadiness } from './compatibilityChecklist.ts';

test('tracks accessibility and multi-browser readiness', () => {
  const checklist = getCompatibilityChecklist();
  assert.ok(checklist.some((item) => item.id === 'mobile-viewport' && item.status === 'implemented'));
  assert.ok(checklist.some((item) => item.id === 'reduced-motion' && item.status === 'implemented'));
  assert.ok(checklist.some((item) => item.id === 'browser-e2e' && item.status === 'partial'));
});

test('summarizes compatibility readiness', () => {
  const summary = summarizeCompatibilityReadiness();
  assert.equal(summary.total, 5);
  assert.equal(summary.implemented, 3);
  assert.equal(summary.partial, 2);
});
