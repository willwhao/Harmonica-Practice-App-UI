import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchOperationsSummary, fetchRemoteReleaseConfig } from './opsClient.ts';

test('fetches remote release config with an audience key', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = (async (url: string | URL | Request) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({
      flags: { operationsPanel: { enabled: true, rolloutPercent: 25 } },
      serverTime: '2026-06-25T00:00:00.000Z',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    const config = await fetchRemoteReleaseConfig('player-42');
    assert.equal(requestedUrl, '/api/release-config?audienceKey=player-42');
    assert.equal(config.flags?.operationsPanel?.enabled, true);
    assert.equal(config.flags?.operationsPanel?.rolloutPercent, 25);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetches operations summary with bearer token', async () => {
  const originalFetch = globalThis.fetch;
  let authorization = '';
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    authorization = String(new Headers(init?.headers).get('Authorization'));
    return new Response(JSON.stringify({
      users: { total: 3, activeUsers7d: 2 },
      practice: { sessions: 8, averageScore: 870, averageAccuracy: 86 },
      learning: { items: 5 },
      content: { draft: 1, published: 4, archived: 0 },
      release: { remoteFlags: 2, rolloutLimited: 1 },
      serverTime: '2026-06-25T00:00:00.000Z',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    const summary = await fetchOperationsSummary('token-1');
    assert.equal(authorization, 'Bearer token-1');
    assert.equal(summary.users.activeUsers7d, 2);
    assert.equal(summary.release.rolloutLimited, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('raises API errors with server messages', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: '需要登录' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch;
  try {
    await assert.rejects(() => fetchOperationsSummary(''), /需要登录/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
