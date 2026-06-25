import type { RemoteReleaseConfig } from './releaseConfig';

const configuredBase = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL;
const API_BASE = (configuredBase ?? '').replace(/\/$/, '');

export interface OperationsSummary {
  users: {
    total: number;
    activeUsers7d: number;
  };
  practice: {
    sessions: number;
    averageScore: number | null;
    averageAccuracy: number | null;
  };
  learning: {
    items: number;
  };
  content: {
    draft: number;
    published: number;
    archived: number;
    [status: string]: number;
  };
  release: {
    remoteFlags: number;
    rolloutLimited: number;
  };
  serverTime: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: '运营服务请求失败' })) as { error?: string };
    throw new Error(body.error ?? '运营服务请求失败');
  }
  return response.json() as Promise<T>;
}

export async function fetchRemoteReleaseConfig(audienceKey = 'anonymous') {
  const params = new URLSearchParams({ audienceKey });
  return request<RemoteReleaseConfig>(`/api/release-config?${params.toString()}`);
}

export async function fetchOperationsSummary(accessToken: string) {
  return request<OperationsSummary>('/api/ops/summary', {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
}
