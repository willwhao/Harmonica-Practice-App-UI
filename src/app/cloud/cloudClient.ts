import type { AuthUser, PracticeHistoryEntry } from '../types';

const configuredBase = import.meta.env.VITE_API_URL as string | undefined;
const API_BASE = (configuredBase ?? '').replace(/\/$/, '');
let accessToken = '';

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

interface SyncConflict {
  client: CloudHistoryEntry;
  server: CloudHistoryEntry;
}

interface CloudHistoryEntry extends PracticeHistoryEntry {
  revision: number;
  updatedAt: string;
  deletedAt?: string | null;
}

export function isCloudMode() {
  return Boolean(configuredBase);
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  if (response.status === 401 && retry && path !== '/api/auth/refresh') {
    const restored = await refreshCloudSession();
    if (restored) return request<T>(path, init, false);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: '云服务请求失败' })) as { error?: string };
    throw new Error(body.error ?? '云服务请求失败');
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

function acceptSession(result: AuthResponse) {
  accessToken = result.accessToken;
  return result.user;
}

export async function registerCloudAccount(input: { email: string; password: string; nickname: string }) {
  return acceptSession(await request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(input) }, false));
}

export async function loginCloudAccount(email: string, password: string) {
  return acceptSession(await request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false));
}

export async function refreshCloudSession() {
  try {
    return acceptSession(await request<AuthResponse>('/api/auth/refresh', { method: 'POST' }, false));
  } catch {
    accessToken = '';
    return null;
  }
}

export async function logoutCloudAccount() {
  try {
    await request<void>('/api/auth/logout', { method: 'POST' }, false);
  } finally {
    accessToken = '';
  }
}

export async function updateCloudUser(user: AuthUser) {
  const result = await request<{ user: AuthUser }>('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ nickname: user.nickname, preferences: user.preferences }) });
  return result.user;
}

export async function deleteCloudAccount() {
  await request<void>('/api/auth/me', { method: 'DELETE' });
  accessToken = '';
}

export function requestCloudPasswordReset(email: string) {
  return request<{ message: string; resetToken?: string }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }, false);
}

export function resetCloudPassword(token: string, password: string) {
  return request<void>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }, false);
}

function asCloudEntry(entry: PracticeHistoryEntry): CloudHistoryEntry {
  return {
    ...entry,
    revision: entry.revision ?? 0,
    updatedAt: entry.updatedAt ?? entry.practicedAt,
    deletedAt: entry.deletedAt ?? null,
  };
}

function mergeEntries(entries: CloudHistoryEntry[]) {
  const byId = new Map<string, CloudHistoryEntry>();
  entries.forEach((entry) => {
    const current = byId.get(entry.id);
    if (!current || entry.revision > current.revision || entry.updatedAt > current.updatedAt) byId.set(entry.id, entry);
  });
  return [...byId.values()].filter((entry) => !entry.deletedAt).sort((a, b) => b.practicedAt.localeCompare(a.practicedAt)).slice(0, 100);
}

export async function syncCloudHistory(history: PracticeHistoryEntry[]) {
  const local = history.map(asCloudEntry);
  const first = await request<{ accepted: CloudHistoryEntry[]; conflicts: SyncConflict[] }>('/api/history/sync', { method: 'POST', body: JSON.stringify({ changes: local }) });
  const clientWins = first.conflicts
    .filter(({ client, server }) => client.updatedAt > server.updatedAt)
    .map(({ client, server }) => ({ ...client, revision: server.revision }));
  const resolved = clientWins.length
    ? await request<{ accepted: CloudHistoryEntry[] }>('/api/history/sync', { method: 'POST', body: JSON.stringify({ changes: clientWins }) })
    : { accepted: [] };
  const cloud = await request<{ entries: CloudHistoryEntry[] }>('/api/history?since=1970-01-01T00%3A00%3A00.000Z');
  return mergeEntries([...local, ...first.accepted, ...resolved.accepted, ...cloud.entries]);
}
