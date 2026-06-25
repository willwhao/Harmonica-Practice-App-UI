import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  auth?: { userId: string; email: string };
}

export interface UserRow extends Record<string, unknown> {
  id: string;
  email: string;
  nickname: string;
  password_hash: string;
  preferences_json: string;
  created_at: string;
  updated_at: string;
}

export interface RefreshRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  email: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface HistoryRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  song_id: string;
  score: number;
  accuracy: number;
  practiced_at: string;
  duration_seconds: number | null;
  weak_measures_json: string;
  revision: number;
  updated_at: string;
  deleted_at: string | null;
}

export interface LearningItemRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  item_type: string;
  payload_json: string;
  revision: number;
  updated_at: string;
  deleted_at: string | null;
}

export interface ContentItemRow extends Record<string, unknown> {
  id: string;
  content_type: string;
  payload_json: string;
  status: string;
  revision: number;
  updated_at: string;
  published_at: string | null;
}

export interface ReleaseFlagRow extends Record<string, unknown> {
  flag_key: string;
  enabled: number | null;
  rollout_percent: number;
  note: string | null;
  updated_at: string;
  updated_by: string | null;
}
