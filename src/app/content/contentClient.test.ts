import assert from 'node:assert/strict';
import test from 'node:test';
import { SONGS } from '../data.ts';
import { buildContentCatalog, buildStaticContentCatalog, type ContentItem } from './contentClient.ts';
import { createPracticeChartFromPack } from './songPack.ts';

test('builds a static content catalog fallback', () => {
  const catalog = buildStaticContentCatalog();
  assert.equal(catalog.source, 'static');
  assert.equal(catalog.songs.length, SONGS.length);
  assert.ok(catalog.charts.length >= 8);
  assert.ok(catalog.learningTracks.length >= 3);
});

test('builds a CMS catalog while falling back missing content groups', () => {
  const cmsSong = { ...SONGS[0], title: 'CMS 天空之城' };
  const items: ContentItem[] = [{
    id: cmsSong.id,
    contentType: 'song',
    payload: cmsSong,
    status: 'published',
    revision: 1,
    updatedAt: '2026-06-25T00:00:00.000Z',
    publishedAt: '2026-06-25T00:00:00.000Z',
  }];
  const catalog = buildContentCatalog(items);
  assert.equal(catalog.source, 'cms');
  assert.equal(catalog.songs[0].title, 'CMS 天空之城');
  assert.ok(catalog.charts.length >= 8);
});

test('builds explicit notation charts without forcing four-beat measures', () => {
  const chart = createPracticeChartFromPack({
    songId: 'notation-fixture',
    title: 'Notation Fixture',
    key: 'C',
    harmonicaType: 'diatonic',
    measureBeats: 2,
    definitions: {
      '5': { frequency: 392, name: 'G4', track: 5, hole: 6, type: 'blow' },
      '6': { frequency: 440, name: 'A4', track: 5, hole: 6, type: 'draw' },
    },
    measures: [['5', '6']],
    notation: {
      beatsPerMeasure: 2,
      lines: [{
        measures: [
          { tokens: ['5|鸳|0.5|u1', '6|鸯|0.5|u1'] },
          { tokens: ['5|飞|2', '-||0|hold'] },
        ],
      }],
    },
  });

  assert.equal(chart.measureBeats, 2);
  assert.equal(chart.totalBeats, 4);
  assert.equal(chart.notes.length, 3);
  assert.equal(chart.notes[0].beat, 0);
  assert.equal(chart.notes[0].durationBeats, 0.5);
  assert.equal(chart.notes[1].beat, 0.5);
  assert.equal(chart.notes[2].beat, 2);
  assert.equal(chart.notation?.lines[0].measures.length, 2);
});
