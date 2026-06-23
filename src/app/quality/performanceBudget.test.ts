import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePerformanceBudget, estimateAudioFrameCost, PERFORMANCE_BUDGET } from './performanceBudget.ts';

test('passes assets within the default performance budget', () => {
  const result = evaluatePerformanceBudget([
    { name: 'index.js', sizeKb: 410, type: 'js' },
    { name: 'index.css', sizeKb: 88, type: 'css' },
  ]);
  assert.equal(result.passed, true);
  assert.equal(result.violations.length, 0);
});

test('reports budget violations with clear labels', () => {
  const result = evaluatePerformanceBudget([
    { name: 'index.js', sizeKb: PERFORMANCE_BUDGET.maxInitialJsKb + 1, type: 'js' },
    { name: 'index.css', sizeKb: PERFORMANCE_BUDGET.maxInitialCssKb + 1, type: 'css' },
  ]);
  assert.equal(result.passed, false);
  assert.equal(result.violations.length, 2);
  assert.match(result.violations[0], /JS/);
});

test('estimates audio frame duration for analysis planning', () => {
  const estimate = estimateAudioFrameCost({ frameSize: 4096, sampleRate: 48000, operationsPerSample: 2 });
  assert.ok(estimate.frameDurationMs > 80);
  assert.equal(estimate.estimatedOperations, 8192);
});
