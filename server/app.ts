import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Response } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { AppDatabase } from './database.ts';
import { createAccessToken, createOpaqueToken, hashPassword, hashToken, verifyAccessToken, verifyPassword } from './security.ts';
import type { AuthenticatedRequest, HistoryRow, RefreshRow, UserRow } from './types.ts';

const DEFAULT_PREFERENCES = { defaultHarmonica: 'diatonic', dailyGoalMinutes: 15, skillLevel: 'beginner' };
const REFRESH_COOKIE = 'harmonica_refresh';
const DAY_MS = 86_400_000;

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8).max(128),
});
const registerSchema = credentialsSchema.extend({ nickname: z.string().trim().min(2).max(40) });
const historyChangeSchema = z.object({
  id: z.string().min(1).max(100),
  songId: z.string().min(1).max(100),
  score: z.number().int().min(0),
  accuracy: z.number().int().min(0).max(100),
  practicedAt: z.string().datetime(),
  durationSeconds: z.number().int().min(0).optional(),
  weakMeasures: z.array(z.object({ measure: z.number().int().positive(), errors: z.number().int().min(0), total: z.number().int().positive(), averageCents: z.number().nullable() })).default([]),
  revision: z.number().int().min(0).default(0),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export interface ApiOptions {
  database: AppDatabase;
  jwtSecret: string;
  allowedOrigin?: string;
  secureCookies?: boolean;
  exposeResetToken?: boolean;
  sendPasswordReset?: (email: string, token: string) => Promise<void>;
}

function publicUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    createdAt: row.created_at,
    preferences: JSON.parse(row.preferences_json) as typeof DEFAULT_PREFERENCES,
  };
}

function publicHistory(row: HistoryRow) {
  return {
    id: row.id,
    songId: row.song_id,
    score: row.score,
    accuracy: row.accuracy,
    practicedAt: row.practiced_at,
    durationSeconds: row.duration_seconds ?? undefined,
    weakMeasures: JSON.parse(row.weak_measures_json) as unknown[],
    revision: row.revision,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function createApiApp(options: ApiOptions) {
  const { database, jwtSecret } = options;
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: options.allowedOrigin ?? 'http://localhost:5173', credentials: true }));
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }));

  const setRefreshCookie = (response: Response, token: string) => {
    response.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: options.secureCookies ?? false,
      sameSite: options.secureCookies ? 'none' : 'lax',
      path: '/api/auth',
      maxAge: 30 * DAY_MS,
    });
  };

  const issueSession = async (user: UserRow, response: Response, replacedSessionId?: string) => {
    const refreshToken = createOpaqueToken();
    const sessionId = randomUUID();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * DAY_MS).toISOString();
    database.transaction(() => {
      database.run('INSERT INTO refresh_sessions (id,user_id,token_hash,expires_at,created_at,revoked_at,replaced_by) VALUES (?,?,?,?,?,?,?)', [sessionId, user.id, hashToken(refreshToken), expiresAt, now, null, null]);
      if (replacedSessionId) database.run('UPDATE refresh_sessions SET revoked_at = ?, replaced_by = ? WHERE id = ?', [now, sessionId, replacedSessionId]);
    });
    setRefreshCookie(response, refreshToken);
    return { accessToken: await createAccessToken(user, jwtSecret), user: publicUser(user) };
  };

  const authenticate = async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    const authorization = request.header('authorization');
    if (!authorization?.startsWith('Bearer ')) return response.status(401).json({ error: '需要登录' });
    try {
      request.auth = await verifyAccessToken(authorization.slice(7), jwtSecret);
      next();
    } catch {
      response.status(401).json({ error: '访问令牌无效或已过期' });
    }
  };

  app.get('/api/health', (_request, response) => response.json({ status: 'ok', database: 'sqlite', time: new Date().toISOString() }));

  app.post('/api/auth/register', async (request, response) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: '注册信息格式不正确' });
    const existing = database.get<UserRow>('SELECT * FROM users WHERE email = ?', [parsed.data.email]);
    if (existing) return response.status(409).json({ error: '该邮箱已注册' });
    const now = new Date().toISOString();
    const id = randomUUID();
    database.run('INSERT INTO users (id,email,nickname,password_hash,preferences_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)', [id, parsed.data.email, parsed.data.nickname, await hashPassword(parsed.data.password), JSON.stringify(DEFAULT_PREFERENCES), now, now]);
    const user = database.get<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) return response.status(500).json({ error: '账户创建失败' });
    return response.status(201).json(await issueSession(user, response));
  });

  app.post('/api/auth/login', async (request, response) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: '邮箱或密码格式不正确' });
    const user = database.get<UserRow>('SELECT * FROM users WHERE email = ?', [parsed.data.email]);
    if (!user || !await verifyPassword(parsed.data.password, user.password_hash)) return response.status(401).json({ error: '邮箱或密码不正确' });
    return response.json(await issueSession(user, response));
  });

  app.post('/api/auth/refresh', async (request, response) => {
    const token = request.cookies[REFRESH_COOKIE] as string | undefined;
    if (!token) return response.status(401).json({ error: '刷新会话不存在' });
    const session = database.get<RefreshRow>(`SELECT s.id,s.user_id,s.expires_at,s.revoked_at,u.email FROM refresh_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?`, [hashToken(token)]);
    if (session?.revoked_at) {
      database.run('UPDATE refresh_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [new Date().toISOString(), session.user_id]);
      response.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      return response.status(401).json({ error: '检测到刷新令牌重放，会话已全部撤销' });
    }
    if (!session || session.expires_at <= new Date().toISOString()) {
      response.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      return response.status(401).json({ error: '刷新会话无效或已过期' });
    }
    const user = database.get<UserRow>('SELECT * FROM users WHERE id = ?', [session.user_id]);
    if (!user) return response.status(401).json({ error: '账户不存在' });
    return response.json(await issueSession(user, response, session.id));
  });

  app.post('/api/auth/logout', (request, response) => {
    const token = request.cookies[REFRESH_COOKIE] as string | undefined;
    if (token) database.run('UPDATE refresh_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL', [new Date().toISOString(), hashToken(token)]);
    response.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return response.status(204).end();
  });

  app.post('/api/auth/forgot-password', async (request, response) => {
    const parsed = z.object({ email: z.string().email().transform((value) => value.trim().toLowerCase()) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: '请输入有效邮箱' });
    const user = database.get<UserRow>('SELECT * FROM users WHERE email = ?', [parsed.data.email]);
    let resetToken: string | undefined;
    if (user) {
      resetToken = createOpaqueToken();
      database.run('INSERT INTO password_reset_tokens (id,user_id,token_hash,expires_at,created_at,used_at) VALUES (?,?,?,?,?,?)', [randomUUID(), user.id, hashToken(resetToken), new Date(Date.now() + 15 * 60_000).toISOString(), new Date().toISOString(), null]);
      if (options.sendPasswordReset) await options.sendPasswordReset(user.email, resetToken);
    }
    return response.json({ message: '如果邮箱已注册，密码重置邮件将很快发送', ...(options.exposeResetToken && resetToken ? { resetToken } : {}) });
  });

  app.post('/api/auth/reset-password', async (request, response) => {
    const parsed = z.object({ token: z.string().min(20), password: z.string().min(8).max(128) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: '重置参数无效' });
    const reset = database.get<{ id: string; user_id: string; expires_at: string; used_at: string | null } & Record<string, unknown>>('SELECT * FROM password_reset_tokens WHERE token_hash = ?', [hashToken(parsed.data.token)]);
    if (!reset || reset.used_at || reset.expires_at <= new Date().toISOString()) return response.status(400).json({ error: '重置链接无效或已过期' });
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(parsed.data.password);
    database.transaction(() => {
      database.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [passwordHash, now, reset.user_id]);
      database.run('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?', [now, reset.id]);
      database.run('UPDATE refresh_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [now, reset.user_id]);
    });
    response.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return response.status(204).end();
  });

  app.get('/api/auth/me', authenticate, (request: AuthenticatedRequest, response) => {
    const user = database.get<UserRow>('SELECT * FROM users WHERE id = ?', [request.auth!.userId]);
    return user ? response.json({ user: publicUser(user) }) : response.status(404).json({ error: '账户不存在' });
  });

  app.patch('/api/auth/me', authenticate, (request: AuthenticatedRequest, response) => {
    const parsed = z.object({
      nickname: z.string().trim().min(2).max(40),
      preferences: z.object({
        defaultHarmonica: z.enum(['diatonic', 'chromatic']),
        dailyGoalMinutes: z.number().int().min(5).max(240),
        skillLevel: z.enum(['beginner', 'intermediate', 'advanced']),
      }),
    }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: '账户资料格式不正确' });
    database.run('UPDATE users SET nickname = ?, preferences_json = ?, updated_at = ? WHERE id = ?', [parsed.data.nickname, JSON.stringify(parsed.data.preferences), new Date().toISOString(), request.auth!.userId]);
    const user = database.get<UserRow>('SELECT * FROM users WHERE id = ?', [request.auth!.userId]);
    return user ? response.json({ user: publicUser(user) }) : response.status(404).json({ error: '账户不存在' });
  });

  app.delete('/api/auth/me', authenticate, (request: AuthenticatedRequest, response) => {
    database.run('DELETE FROM users WHERE id = ?', [request.auth!.userId]);
    response.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return response.status(204).end();
  });

  app.get('/api/history', authenticate, (request: AuthenticatedRequest, response) => {
    const since = typeof request.query.since === 'string' ? request.query.since : '1970-01-01T00:00:00.000Z';
    const rows = database.all<HistoryRow>('SELECT * FROM practice_history WHERE user_id = ? AND updated_at > ? ORDER BY updated_at ASC', [request.auth!.userId, since]);
    return response.json({ entries: rows.map(publicHistory), serverTime: new Date().toISOString() });
  });

  app.post('/api/history/sync', authenticate, (request: AuthenticatedRequest, response) => {
    const parsed = z.object({ changes: z.array(historyChangeSchema).max(100) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: '同步数据格式不正确' });
    const accepted: ReturnType<typeof publicHistory>[] = [];
    const conflicts: Array<{ client: z.infer<typeof historyChangeSchema>; server: ReturnType<typeof publicHistory> }> = [];
    database.transaction(() => parsed.data.changes.forEach((change) => {
      const existing = database.get<HistoryRow>('SELECT * FROM practice_history WHERE id = ? AND user_id = ?', [change.id, request.auth!.userId]);
      if (existing && change.revision !== existing.revision) {
        conflicts.push({ client: change, server: publicHistory(existing) });
        return;
      }
      if (existing && change.updatedAt <= existing.updated_at) {
        accepted.push(publicHistory(existing));
        return;
      }
      const revision = (existing?.revision ?? 0) + 1;
      database.run(`INSERT INTO practice_history (id,user_id,song_id,score,accuracy,practiced_at,duration_seconds,weak_measures_json,revision,updated_at,deleted_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id,user_id) DO UPDATE SET song_id=excluded.song_id,score=excluded.score,accuracy=excluded.accuracy,practiced_at=excluded.practiced_at,duration_seconds=excluded.duration_seconds,weak_measures_json=excluded.weak_measures_json,revision=excluded.revision,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at`,
      [change.id, request.auth!.userId, change.songId, change.score, change.accuracy, change.practicedAt, change.durationSeconds ?? null, JSON.stringify(change.weakMeasures), revision, change.updatedAt, change.deletedAt ?? null]);
      const saved = database.get<HistoryRow>('SELECT * FROM practice_history WHERE id = ? AND user_id = ?', [change.id, request.auth!.userId]);
      if (saved) accepted.push(publicHistory(saved));
    }));
    return response.json({ accepted, conflicts, serverTime: new Date().toISOString() });
  });

  app.use((error: unknown, _request: express.Request, response: Response, _next: NextFunction) => {
    void _next;
    console.error(error);
    response.status(500).json({ error: '服务器内部错误' });
  });
  return app;
}
