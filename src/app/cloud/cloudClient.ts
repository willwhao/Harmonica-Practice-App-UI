import type { AuthUser, LearningTrackProgress, PracticeBookmark, PracticeHistoryEntry } from '../types';

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

type CloudLearningItemType = 'bookmark' | 'course-progress';

interface CloudLearningItem {
  id: string;
  itemType: CloudLearningItemType;
  payload: PracticeBookmark | LearningTrackProgress;
  revision: number;
  updatedAt: string;
  deletedAt?: string | null;
}

interface LearningSyncConflict {
  client: CloudLearningItem;
  server: CloudLearningItem;
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

function bookmarkAsCloudItem(bookmark: PracticeBookmark): CloudLearningItem {
  const updatedAt = bookmark.updatedAt ?? bookmark.createdAt;
  return {
    id: bookmark.id,
    itemType: 'bookmark',
    payload: {
      id: bookmark.id,
      songId: bookmark.songId,
      startMeasure: bookmark.startMeasure,
      endMeasure: bookmark.endMeasure,
      label: bookmark.label,
      createdAt: bookmark.createdAt,
      revision: bookmark.revision ?? 0,
      updatedAt,
      deletedAt: bookmark.deletedAt ?? null,
    },
    revision: bookmark.revision ?? 0,
    updatedAt,
    deletedAt: bookmark.deletedAt ?? null,
  };
}

function progressAsCloudItem(progress: LearningTrackProgress): CloudLearningItem {
  return {
    id: progress.id,
    itemType: 'course-progress',
    payload: {
      id: progress.id,
      trackId: progress.trackId,
      completedSessions: progress.completedSessions,
      targetSessions: progress.targetSessions,
      progressPercent: progress.progressPercent,
      nextSongId: progress.nextSongId,
      updatedAt: progress.updatedAt,
      revision: progress.revision ?? 0,
      deletedAt: progress.deletedAt ?? null,
    },
    revision: progress.revision ?? 0,
    updatedAt: progress.updatedAt,
    deletedAt: progress.deletedAt ?? null,
  };
}

function cloudItemToBookmark(item: CloudLearningItem): PracticeBookmark | null {
  if (item.itemType !== 'bookmark' || item.deletedAt) return null;
  const payload = item.payload as PracticeBookmark;
  return {
    id: payload.id,
    songId: payload.songId,
    startMeasure: payload.startMeasure,
    endMeasure: payload.endMeasure,
    label: payload.label,
    createdAt: payload.createdAt,
    revision: item.revision,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt ?? null,
  };
}

function cloudItemToProgress(item: CloudLearningItem): LearningTrackProgress | null {
  if (item.itemType !== 'course-progress' || item.deletedAt) return null;
  const payload = item.payload as LearningTrackProgress;
  return {
    id: payload.id,
    trackId: payload.trackId,
    completedSessions: payload.completedSessions,
    targetSessions: payload.targetSessions,
    progressPercent: payload.progressPercent,
    nextSongId: payload.nextSongId,
    updatedAt: item.updatedAt,
    revision: item.revision,
    deletedAt: item.deletedAt ?? null,
  };
}

function mergeCloudLearningItems(items: CloudLearningItem[]) {
  const byId = new Map<string, CloudLearningItem>();
  items.forEach((item) => {
    const current = byId.get(item.id);
    if (!current || item.revision > current.revision || item.updatedAt > current.updatedAt) byId.set(item.id, item);
  });
  return [...byId.values()];
}

export async function syncCloudLearning(bookmarks: PracticeBookmark[], progress: LearningTrackProgress[]) {
  const local = [...bookmarks.map(bookmarkAsCloudItem), ...progress.map(progressAsCloudItem)];
  const first = await request<{ accepted: CloudLearningItem[]; conflicts: LearningSyncConflict[] }>('/api/learning/sync', { method: 'POST', body: JSON.stringify({ changes: local }) });
  const clientWins = first.conflicts
    .filter(({ client, server }) => client.updatedAt > server.updatedAt)
    .map(({ client, server }) => ({ ...client, revision: server.revision }));
  const resolved = clientWins.length
    ? await request<{ accepted: CloudLearningItem[] }>('/api/learning/sync', { method: 'POST', body: JSON.stringify({ changes: clientWins }) })
    : { accepted: [] };
  const cloud = await request<{ entries: CloudLearningItem[] }>('/api/learning?since=1970-01-01T00%3A00%3A00.000Z');
  const merged = mergeCloudLearningItems([...local, ...first.accepted, ...resolved.accepted, ...cloud.entries]);
  return {
    bookmarks: merged.map(cloudItemToBookmark).filter((item): item is PracticeBookmark => Boolean(item)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100),
    progress: merged.map(cloudItemToProgress).filter((item): item is LearningTrackProgress => Boolean(item)).sort((a, b) => a.trackId.localeCompare(b.trackId)),
  };
}
