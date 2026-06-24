import assert from 'node:assert/strict';
import test from 'node:test';
import { getAvailablePracticeCharts, getPracticeChart, migrateChart, validatePracticeChart } from './practiceCharts.ts';

test('provides at least eight independent arrangements', () => {
  const chartSongIds = ['1', '2', '3', '4', '5', '6', '7', '8'];
  const charts = chartSongIds.map((songId) => getPracticeChart(songId));
  charts.forEach(({ chart, isFallback }, index) => {
    assert.equal(isFallback, false);
    assert.equal(chart.songId, chartSongIds[index]);
    assert.ok(chart.measures.length >= 8);
    assert.equal(validatePracticeChart(chart).valid, true);
  });
  assert.equal(new Set(charts.map(({ chart }) => chart.id)).size, chartSongIds.length);
});

test('falls back only for songs that are still awaiting bespoke charts', () => {
  const fallback = getPracticeChart('9');
  assert.equal(fallback.isFallback, true);
  assert.equal(fallback.chart.songId, '1');
});

test('includes a validated chromatic chart with slide notes', () => {
  const { chart, isFallback } = getPracticeChart('7');
  assert.equal(isFallback, false);
  assert.equal(chart.harmonicaType, 'chromatic');
  assert.ok(chart.notes.some((note) => note.technique === 'slide'));
  assert.equal(validatePracticeChart(chart).valid, true);
});

test('rejects structurally invalid chart data', () => {
  const chart = structuredClone(getPracticeChart('1').chart);
  chart.totalBeats += 1;
  chart.notes[0].hole = 99;
  const result = validatePracticeChart(chart);
  assert.equal(result.valid, false);
  assert.ok(result.issues.length >= 2);
});

test('migrates version-one note defaults to schema version two', () => {
  const current = getPracticeChart('1').chart;
  const { schemaVersion: _schemaVersion, source: _source, notes, ...legacyBase } = structuredClone(current);
  const legacy = {
    ...legacyBase,
    schemaVersion: 1 as const,
    notes: notes.map(({ durationBeats: _duration, technique: _technique, ...note }) => note),
  };
  const migrated = migrateChart(legacy);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.source, 'practice-arrangement');
  assert.ok(migrated.notes.every((note) => note.durationBeats === 1 && note.technique === 'natural'));
});

test('registered chart collection has unique song ids and valid schemas', () => {
  const charts = getAvailablePracticeCharts();
  assert.ok(charts.length >= 8);
  assert.equal(new Set(charts.map((chart) => chart.songId)).size, charts.length);
  assert.ok(charts.every((chart) => validatePracticeChart(chart).valid));
});

test('charts include long notes and deterministic hole lanes', () => {
  const charts = getAvailablePracticeCharts();
  assert.ok(charts.some((chart) => chart.notes.some((note) => note.durationBeats > 1)));
  charts.forEach((chart) => {
    chart.notes.forEach((note) => {
      assert.equal(note.track, note.hole - 1);
      assert.ok(note.durationBeats >= 1);
    });
  });
});
