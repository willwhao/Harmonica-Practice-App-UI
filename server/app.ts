import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Response } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { AppDatabase } from './database.ts';
import { createAccessToken, createOpaqueToken, hashPassword, hashToken, verifyAccessToken, verifyPassword } from './security.ts';
import type { AuthenticatedRequest, ContentItemRow, HistoryRow, LearningItemRow, RefreshRow, ReleaseFlagRow, UserRow } from './types.ts';

const DEFAULT_PREFERENCES = { defaultHarmonica: 'diatonic', dailyGoalMinutes: 15, skillLevel: 'beginner' };
const REFRESH_COOKIE = 'harmonica_refresh';
const DAY_MS = 86_400_000;
const FEATURE_FLAG_KEYS = [
  'audioUploadTranscription',
  'practiceRecording',
  'cloudSync',
  'learningCenter',
  'chromaticCharts',
  'licensedAudioDelivery',
  'contentManagement',
  'localMonitoring',
  'remoteMonitoring',
  'operationsPanel',
] as const;

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
const bookmarkPayloadSchema = z.object({
  id: z.string().min(1).max(100),
  songId: z.string().min(1).max(100),
  startMeasure: z.number().int().min(0),
  endMeasure: z.number().int().positive(),
  label: z.string().min(1).max(80),
  createdAt: z.string().datetime(),
});
const courseProgressPayloadSchema = z.object({
  id: z.string().min(1).max(100),
  trackId: z.string().min(1).max(100),
  completedSessions: z.number().int().min(0),
  targetSessions: z.number().int().positive(),
  progressPercent: z.number().int().min(0).max(100),
  nextSongId: z.string().min(1).max(100).nullable(),
});
const learningChangeSchema = z.object({
  id: z.string().min(1).max(100),
  itemType: z.enum(['bookmark', 'course-progress']),
  payload: z.union([bookmarkPayloadSchema, courseProgressPayloadSchema]),
  revision: z.number().int().min(0).default(0),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
}).refine((value) => (
  (value.itemType === 'bookmark' && bookmarkPayloadSchema.safeParse(value.payload).success)
  || (value.itemType === 'course-progress' && courseProgressPayloadSchema.safeParse(value.payload).success)
), { message: '学习数据类型与内容不匹配' });
const monitoringEventSchema = z.object({
  type: z.enum(['error', 'unhandled-rejection', 'performance', 'recovery']),
  message: z.string().min(1).max(500),
  createdAt: z.string().datetime(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  release: z.string().max(80).optional(),
  environment: z.string().max(40).optional(),
});
const songPayloadSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(120),
  artist: z.string().min(1).max(120),
  key: z.string().min(1).max(12),
  bpm: z.number().int().min(30).max(240),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  harmonicaType: z.enum(['diatonic', 'chromatic']),
  genre: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  color2: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
const contentItemSchema = z.object({
  id: z.string().min(1).max(120),
  contentType: z.enum(['song', 'practice-chart', 'learning-track', 'licensed-audio']),
  payload: z.unknown(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  revision: z.number().int().min(0).default(0),
  updatedAt: z.string().datetime().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
}).superRefine((value, context) => {
  if (value.contentType === 'song' && !songPayloadSchema.safeParse(value.payload).success) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: '曲目内容格式不正确', path: ['payload'] });
  }
  if (value.contentType === 'practice-chart' && (!value.payload || typeof value.payload !== 'object')) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: '谱面内容格式不正确', path: ['payload'] });
  }
  if (value.contentType === 'learning-track' && (!value.payload || typeof value.payload !== 'object')) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: '课程内容格式不正确', path: ['payload'] });
  }
  if (value.contentType === 'licensed-audio' && (!value.payload || typeof value.payload !== 'object')) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: '授权音频内容格式不正确', path: ['payload'] });
  }
});
const releaseFlagSchema = z.object({
  enabled: z.boolean().nullable().optional(),
  rolloutPercent: z.number().int().min(0).max(100).default(100),
  note: z.string().trim().max(240).nullable().optional(),
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

function publicLearningItem(row: LearningItemRow) {
  return {
    id: row.id,
    itemType: row.item_type,
    payload: JSON.parse(row.payload_json) as unknown,
    revision: row.revision,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function publicContentItem(row: ContentItemRow) {
  return {
    id: row.id,
    contentType: row.content_type,
    payload: JSON.parse(row.payload_json) as unknown,
    status: row.status,
    revision: row.revision,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

function publicReleaseFlag(row: ReleaseFlagRow) {
  return {
    key: row.flag_key,
    enabled: row.enabled === null ? null : row.enabled === 1,
    rolloutPercent: row.rollout_percent,
    note: row.note,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
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
  app.use('/api/monitoring', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));

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

  app.get('/api/release-config', (_request, response) => {
    const rows = database.all<ReleaseFlagRow>('SELECT * FROM release_flags ORDER BY flag_key ASC');
    const flags = Object.fromEntries(rows.map((row) => [row.flag_key, {
      enabled: row.enabled === null ? null : row.enabled === 1,
      rolloutPercent: row.rollout_percent,
      note: row.note,
      updatedAt: row.updated_at,
    }]));
    return response.json({ flags, serverTime: new Date().toISOString() });
  });

  app.put('/api/release-config/:flagKey', authenticate, (request: AuthenticatedRequest, response) => {
    const flagKey = String(request.params.flagKey);
    if (!FEATURE_FLAG_KEYS.includes(flagKey as typeof FEATURE_FLAG_KEYS[number])) {
      return response.status(404).json({ error: '功能开关不存在' });
    }
    const parsed = releaseFlagSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: '功能开关配置格式不正确' });
    const now = new Date().toISOString();
    const enabled = parsed.data.enabled === undefined || parsed.data.enabled === null ? null : (parsed.data.enabled ? 1 : 0);
    database.run(`INSERT INTO release_flags (flag_key,enabled,rollout_percent,note,updated_at,updated_by)
      VALUES (?,?,?,?,?,?) ON CONFLICT(flag_key) DO UPDATE SET enabled=excluded.enabled,rollout_percent=excluded.rollout_percent,note=excluded.note,updated_at=excluded.updated_at,updated_by=excluded.updated_by`,
    [flagKey, enabled, parsed.data.rolloutPercent, parsed.data.note ?? null, now, request.auth!.userId]);
    const saved = database.get<ReleaseFlagRow>('SELECT * FROM release_flags WHERE flag_key = ?', [flagKey]);
    return saved ? response.json({ flag: publicReleaseFlag(saved) }) : response.status(500).json({ error: '功能开关保存失败' });
  });

  app.get('/api/ops/summary', authenticate, (_request: AuthenticatedRequest, response) => {
    const users = database.get<{ total: number }>('SELECT COUNT(*) as total FROM users')?.total ?? 0;
    const activeUsers7d = database.get<{ total: number }>(
      'SELECT COUNT(DISTINCT user_id) as total FROM practice_history WHERE deleted_at IS NULL AND practiced_at >= ?',
      [new Date(Date.now() - 7 * DAY_MS).toISOString()],
    )?.total ?? 0;
    const practice = database.get<{ sessions: number; average_score: number | null; average_accuracy: number | null }>(
      'SELECT COUNT(*) as sessions, AVG(score) as average_score, AVG(accuracy) as average_accuracy FROM practice_history WHERE deleted_at IS NULL',
    ) ?? { sessions: 0, average_score: null, average_accuracy: null };
    const learningItems = database.get<{ total: number }>('SELECT COUNT(*) as total FROM learning_items WHERE deleted_at IS NULL')?.total ?? 0;
    const contentRows = database.all<{ status: string; total: number }>('SELECT status, COUNT(*) as total FROM content_items GROUP BY status');
    const content = contentRows.reduce<Record<string, number>>((accumulator, row) => {
      accumulator[row.status] = row.total;
      return accumulator;
    }, { draft: 0, published: 0, archived: 0 });
    const remoteFlags = database.all<ReleaseFlagRow>('SELECT * FROM release_flags ORDER BY flag_key ASC');
    return response.json({
      users: { total: users, activeUsers7d },
      practice: {
        sessions: practice.sessions,
        averageScore: practice.average_score === null ? null : Math.round(practice.average_score),
        averageAccuracy: practice.average_accuracy === null ? null : Math.round(practice.average_accuracy),
      },
      learning: { items: learningItems },
      content,
      release: {
        remoteFlags: remoteFlags.length,
        rolloutLimited: remoteFlags.filter((flag) => flag.rollout_percent < 100).length,
      },
      serverTime: new Date().toISOString(),
    });
  });

  app.post('/api/monitoring/events', (request, response) => {
    const parsed = monitoringEventSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: '监控事件格式不正确' });
    const event = parsed.data;
    const severity = event.type === 'performance' || event.type === 'recovery' ? 'info' : 'error';
    console[severity]('[monitoring]', JSON.stringify({
      ...event,
      userAgent: request.header('user-agent')?.slice(0, 160) ?? null,
    }));
    return response.status(202).json({ accepted: true });
  });

  app.get('/api/content', (request, response) => {
    const contentType = typeof request.query.contentType === 'string' ? request.query.contentType : undefined;
    const includeDrafts = request.query.includeDrafts === 'true';
    const statusFilter = includeDrafts ? ['draft', 'published'] : ['published'];
    const placeholders = statusFilter.map(() => '?').join(',');
    const rows = contentType
      ? database.all<ContentItemRow>(`SELECT * FROM content_items WHERE content_type = ? AND status IN (${placeholders}) ORDER BY content_type ASC, id ASC`, [contentType, ...statusFilter])
      : database.all<ContentItemRow>(`SELECT * FROM content_items WHERE status IN (${placeholders}) ORDER BY content_type ASC, id ASC`, statusFilter);
    return response.json({ items: rows.map(publicContentItem), serverTime: new Date().toISOString() });
  });

  app.put('/api/content/:contentType/:id', authenticate, (request: AuthenticatedRequest, response) => {
    const parsed = contentItemSchema.safeParse({
      ...request.body,
      id: request.params.id,
      contentType: request.params.contentType,
    });
    if (!parsed.success) return response.status(400).json({ error: '内容格式不正确' });
    const existing = database.get<ContentItemRow>('SELECT * FROM content_items WHERE id = ? AND content_type = ?', [parsed.data.id, parsed.data.contentType]);
    if (existing && parsed.data.revision !== existing.revision) {
      return response.status(409).json({ error: '内容版本冲突', server: publicContentItem(existing) });
    }
    const now = new Date().toISOString();
    const updatedAt = parsed.data.updatedAt ?? now;
    const publishedAt = parsed.data.status === 'published'
      ? (parsed.data.publishedAt ?? existing?.published_at ?? now)
      : (parsed.data.publishedAt ?? null);
    const revision = (existing?.revision ?? 0) + 1;
    database.run(`INSERT INTO content_items (id,content_type,payload_json,status,revision,updated_at,published_at)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(id,content_type) DO UPDATE SET payload_json=excluded.payload_json,status=excluded.status,revision=excluded.revision,updated_at=excluded.updated_at,published_at=excluded.published_at`,
    [parsed.data.id, parsed.data.contentType, JSON.stringify(parsed.data.payload), parsed.data.status, revision, updatedAt, publishedAt]);
    const saved = database.get<ContentItemRow>('SELECT * FROM content_items WHERE id = ? AND content_type = ?', [parsed.data.id, parsed.data.contentType]);
    return saved ? response.json({ item: publicContentItem(saved) }) : response.status(500).json({ error: '内容保存失败' });
  });

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

  app.get('/api/learning', authenticate, (request: AuthenticatedRequest, response) => {
    const since = typeof request.query.since === 'string' ? request.query.since : '1970-01-01T00:00:00.000Z';
    const itemType = typeof request.query.itemType === 'string' ? request.query.itemType : undefined;
    const rows = itemType
      ? database.all<LearningItemRow>('SELECT * FROM learning_items WHERE user_id = ? AND item_type = ? AND updated_at > ? ORDER BY updated_at ASC', [request.auth!.userId, itemType, since])
      : database.all<LearningItemRow>('SELECT * FROM learning_items WHERE user_id = ? AND updated_at > ? ORDER BY updated_at ASC', [request.auth!.userId, since]);
    return response.json({ entries: rows.map(publicLearningItem), serverTime: new Date().toISOString() });
  });

  app.post('/api/learning/sync', authenticate, (request: AuthenticatedRequest, response) => {
    const parsed = z.object({ changes: z.array(learningChangeSchema).max(200) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: '学习同步数据格式不正确' });
    const accepted: ReturnType<typeof publicLearningItem>[] = [];
    const conflicts: Array<{ client: z.infer<typeof learningChangeSchema>; server: ReturnType<typeof publicLearningItem> }> = [];
    database.transaction(() => parsed.data.changes.forEach((change) => {
      const existing = database.get<LearningItemRow>('SELECT * FROM learning_items WHERE id = ? AND user_id = ?', [change.id, request.auth!.userId]);
      if (existing && change.revision !== existing.revision) {
        conflicts.push({ client: change, server: publicLearningItem(existing) });
        return;
      }
      if (existing && change.updatedAt <= existing.updated_at) {
        accepted.push(publicLearningItem(existing));
        return;
      }
      const revision = (existing?.revision ?? 0) + 1;
      database.run(`INSERT INTO learning_items (id,user_id,item_type,payload_json,revision,updated_at,deleted_at)
        VALUES (?,?,?,?,?,?,?) ON CONFLICT(id,user_id) DO UPDATE SET item_type=excluded.item_type,payload_json=excluded.payload_json,revision=excluded.revision,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at`,
      [change.id, request.auth!.userId, change.itemType, JSON.stringify(change.payload), revision, change.updatedAt, change.deletedAt ?? null]);
      const saved = database.get<LearningItemRow>('SELECT * FROM learning_items WHERE id = ? AND user_id = ?', [change.id, request.auth!.userId]);
      if (saved) accepted.push(publicLearningItem(saved));
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
