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
