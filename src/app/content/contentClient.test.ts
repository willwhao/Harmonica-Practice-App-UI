import assert from 'node:assert/strict';
import test from 'node:test';
import { SONGS } from '../data.ts';
import { buildContentCatalog, buildStaticContentCatalog, type ContentItem } from './contentClient.ts';

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
