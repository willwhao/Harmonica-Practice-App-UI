import assert from 'node:assert/strict';
import test from 'node:test';
import { getLegalDocument, LEGAL_DOCUMENTS, summarizeLegalReadiness } from './legalDocuments.ts';

test('provides versioned privacy policy and terms documents', () => {
  assert.equal(LEGAL_DOCUMENTS.length, 2);
  assert.equal(getLegalDocument('privacy').title, '隐私政策');
  assert.equal(getLegalDocument('terms').title, '用户协议');
  assert.ok(getLegalDocument('privacy').sections.some((section) => section.title.includes('麦克风')));
  assert.ok(getLegalDocument('terms').sections.some((section) => section.title.includes('版权')));
});

test('summarizes legal readiness for release checks', () => {
  const summary = summarizeLegalReadiness();
  assert.equal(summary.complete, true);
  assert.equal(summary.version, '1.0.0');
  assert.equal(summary.effectiveDate, '2026-06-24');
  assert.deepEqual(summary.documents, ['privacy', 'terms']);
});
