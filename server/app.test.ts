import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createApiApp } from './app.ts';
import { createDatabase } from './database.ts';

const JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-characters';

async function testApi() {
  const database = await createDatabase();
  const app = createApiApp({ database, jwtSecret: JWT_SECRET, exposeResetToken: true });
  return { database, app };
}

async function register(app: ReturnType<typeof createApiApp>) {
  const response = await request(app).post('/api/auth/register').send({ email: 'player@example.com', password: 'correct-horse', nickname: 'Player' });
  assert.equal(response.status, 201);
  return response;
}

function refreshCookie(response: request.Response) {
  const cookies = response.headers['set-cookie'];
  assert.ok(cookies);
  return (Array.isArray(cookies) ? cookies[0] : cookies).split(';')[0];
}

test('registers, authenticates and protects account data', async () => {
  const { database, app } = await testApi();
  try {
    const registration = await register(app);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${registration.body.accessToken}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, 'player@example.com');
    const denied = await request(app).get('/api/auth/me');
    assert.equal(denied.status, 401);
  } finally {
    database.close();
  }
});

test('accepts validated monitoring events', async () => {
  const { database, app } = await testApi();
  try {
    const accepted = await request(app).post('/api/monitoring/events').send({
      type: 'error',
      message: 'render failed',
      createdAt: '2026-06-24T08:00:00.000Z',
      metadata: { route: '/practice', line: 12 },
      release: '0.2.0',
      environment: 'preview',
    });
    assert.equal(accepted.status, 202);
    assert.equal(accepted.body.accepted, true);

    const rejected = await request(app).post('/api/monitoring/events').send({ type: 'unknown', message: '' });
    assert.equal(rejected.status, 400);
  } finally {
    database.close();
  }
});

test('manages remote release flags and operations summary', async () => {
  const { database, app } = await testApi();
  try {
    const registration = await register(app);
    const authorization = `Bearer ${registration.body.accessToken}`;

    const denied = await request(app).put('/api/release-config/operationsPanel').send({ enabled: true, rolloutPercent: 25 });
    assert.equal(denied.status, 401);

    const savedFlag = await request(app)
      .put('/api/release-config/operationsPanel')
      .set('Authorization', authorization)
      .send({ enabled: true, rolloutPercent: 25, note: 'canary cohort' });
    assert.equal(savedFlag.status, 200);
    assert.equal(savedFlag.body.flag.enabled, true);
    assert.equal(savedFlag.body.flag.rolloutPercent, 25);

    const remoteConfig = await request(app).get('/api/release-config');
    assert.equal(remoteConfig.status, 200);
    assert.equal(remoteConfig.body.flags.operationsPanel.enabled, true);
    assert.equal(remoteConfig.body.flags.operationsPanel.rolloutPercent, 25);

    const base = {
      id: 'practice-for-ops',
      songId: '1',
      score: 880,
      accuracy: 86,
      practicedAt: new Date().toISOString(),
      durationSeconds: 60,
      weakMeasures: [],
      revision: 0,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };
    assert.equal((await request(app).post('/api/history/sync').set('Authorization', authorization).send({ changes: [base] })).status, 200);

    const songPayload = {
      id: 'ops-song-1',
      title: 'Ops Song',
      artist: 'Teacher',
      key: 'C',
      bpm: 96,
      difficulty: 1,
      harmonicaType: 'diatonic',
      genre: 'practice',
      color: '#047857',
      color2: '#00C9B1',
    };
    assert.equal((await request(app).put('/api/content/song/ops-song-1').set('Authorization', authorization).send({ payload: songPayload, status: 'published', revision: 0 })).status, 200);

    const summary = await request(app).get('/api/ops/summary').set('Authorization', authorization);
    assert.equal(summary.status, 200);
    assert.equal(summary.body.users.total, 1);
    assert.equal(summary.body.users.activeUsers7d, 1);
    assert.equal(summary.body.practice.sessions, 1);
    assert.equal(summary.body.practice.averageScore, 880);
    assert.equal(summary.body.content.published, 1);
    assert.equal(summary.body.release.remoteFlags, 1);
    assert.equal(summary.body.release.rolloutLimited, 1);
  } finally {
    database.close();
  }
});

test('manages CMS content with publish visibility and revision conflicts', async () => {
  const { database, app } = await testApi();
  try {
    const registration = await register(app);
    const authorization = `Bearer ${registration.body.accessToken}`;
    const songPayload = {
      id: 'cms-song-1',
      title: 'CMS 测试曲',
      artist: 'Teacher',
      key: 'C',
      bpm: 96,
      difficulty: 1,
      harmonicaType: 'diatonic',
      genre: '练习',
      color: '#047857',
      color2: '#00C9B1',
    };

    const denied = await request(app).put('/api/content/song/cms-song-1').send({ payload: songPayload, status: 'draft' });
    assert.equal(denied.status, 401);

    const draft = await request(app).put('/api/content/song/cms-song-1').set('Authorization', authorization).send({ payload: songPayload, status: 'draft', revision: 0 });
    assert.equal(draft.status, 200);
    assert.equal(draft.body.item.revision, 1);
    assert.equal((await request(app).get('/api/content')).body.items.length, 0);
    assert.equal((await request(app).get('/api/content').query({ includeDrafts: 'true' })).body.items.length, 1);

    const published = await request(app).put('/api/content/song/cms-song-1').set('Authorization', authorization).send({ payload: songPayload, status: 'published', revision: 1 });
    assert.equal(published.status, 200);
    assert.equal(published.body.item.revision, 2);
    assert.ok(published.body.item.publishedAt);

    const publicList = await request(app).get('/api/content').query({ contentType: 'song' });
    assert.equal(publicList.status, 200);
    assert.equal(publicList.body.items[0].payload.title, 'CMS 测试曲');

    const conflict = await request(app).put('/api/content/song/cms-song-1').set('Authorization', authorization).send({ payload: songPayload, status: 'published', revision: 1 });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.server.revision, 2);
  } finally {
    database.close();
  }
});

test('rotates refresh tokens and rejects replay of the old token', async () => {
  const { database, app } = await testApi();
  try {
    const registration = await register(app);
    const oldCookie = refreshCookie(registration);
    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);
    assert.equal(refreshed.status, 200);
    const newCookie = refreshCookie(refreshed);
    assert.notEqual(newCookie, oldCookie);
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);
    assert.equal(replay.status, 401);
    assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', newCookie)).status, 401);
  } finally {
    database.close();
  }
});

test('resets a password once and revokes existing sessions', async () => {
  const { database, app } = await testApi();
  try {
    const registration = await register(app);
    const oldCookie = refreshCookie(registration);
    const forgot = await request(app).post('/api/auth/forgot-password').send({ email: 'player@example.com' });
    assert.equal(forgot.status, 200);
    assert.ok(forgot.body.resetToken);
    const reset = await request(app).post('/api/auth/reset-password').send({ token: forgot.body.resetToken, password: 'new-secure-password' });
    assert.equal(reset.status, 204);
    assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', oldCookie)).status, 401);
    assert.equal((await request(app).post('/api/auth/login').send({ email: 'player@example.com', password: 'correct-horse' })).status, 401);
    assert.equal((await request(app).post('/api/auth/login').send({ email: 'player@example.com', password: 'new-secure-password' })).status, 200);
    assert.equal((await request(app).post('/api/auth/reset-password').send({ token: forgot.body.resetToken, password: 'another-password' })).status, 400);
  } finally {
    database.close();
  }
});

test('syncs history incrementally and reports revision conflicts', async () => {
  const { database, app } = await testApi();
  try {
    const registration = await register(app);
    const authorization = `Bearer ${registration.body.accessToken}`;
    const base = {
      id: 'practice-1', songId: '1', score: 900, accuracy: 88,
      practicedAt: '2026-06-22T08:00:00.000Z', durationSeconds: 60,
      weakMeasures: [], revision: 0, updatedAt: '2026-06-22T08:01:00.000Z', deletedAt: null,
    };
    const first = await request(app).post('/api/history/sync').set('Authorization', authorization).send({ changes: [base] });
    assert.equal(first.status, 200);
    assert.equal(first.body.accepted[0].revision, 1);
    const stale = await request(app).post('/api/history/sync').set('Authorization', authorization).send({ changes: [{ ...base, score: 950 }] });
    assert.equal(stale.body.accepted.length, 0);
    assert.equal(stale.body.conflicts[0].server.revision, 1);
    const resolved = await request(app).post('/api/history/sync').set('Authorization', authorization).send({ changes: [{ ...base, revision: 1, score: 950, updatedAt: '2026-06-22T08:02:00.000Z' }] });
    assert.equal(resolved.body.accepted[0].revision, 2);
    const delta = await request(app).get('/api/history').query({ since: '2026-06-22T08:01:30.000Z' }).set('Authorization', authorization);
    assert.equal(delta.status, 200);
    assert.equal(delta.body.entries[0].score, 950);
  } finally {
    database.close();
  }
});

test('syncs learning bookmarks and course progress', async () => {
  const { database, app } = await testApi();
  try {
    const registration = await register(app);
    const authorization = `Bearer ${registration.body.accessToken}`;
    const bookmark = {
      id: 'bookmark-1',
      itemType: 'bookmark',
      payload: {
        id: 'bookmark-1',
        songId: '1',
        startMeasure: 2,
        endMeasure: 4,
        label: '第 3 小节',
        createdAt: '2026-06-24T08:00:00.000Z',
      },
      revision: 0,
      updatedAt: '2026-06-24T08:01:00.000Z',
      deletedAt: null,
    };
    const progress = {
      id: 'beginner-foundation',
      itemType: 'course-progress',
      payload: {
        id: 'beginner-foundation',
        trackId: 'beginner-foundation',
        completedSessions: 2,
        targetSessions: 5,
        progressPercent: 40,
        nextSongId: '3',
      },
      revision: 0,
      updatedAt: '2026-06-24T08:01:00.000Z',
      deletedAt: null,
    };

    const first = await request(app).post('/api/learning/sync').set('Authorization', authorization).send({ changes: [bookmark, progress] });
    assert.equal(first.status, 200);
    assert.equal(first.body.accepted.length, 2);
    assert.equal(first.body.accepted[0].revision, 1);

    const stale = await request(app).post('/api/learning/sync').set('Authorization', authorization).send({ changes: [{ ...bookmark, payload: { ...bookmark.payload, label: '旧标签' } }] });
    assert.equal(stale.status, 200);
    assert.equal(stale.body.accepted.length, 0);
    assert.equal(stale.body.conflicts[0].server.revision, 1);

    const listed = await request(app).get('/api/learning').query({ since: '1970-01-01T00:00:00.000Z' }).set('Authorization', authorization);
    assert.equal(listed.status, 200);
    assert.equal(listed.body.entries.length, 2);
    assert.equal(listed.body.entries.find((entry: { itemType: string }) => entry.itemType === 'course-progress').payload.progressPercent, 40);
  } finally {
    database.close();
  }
});
