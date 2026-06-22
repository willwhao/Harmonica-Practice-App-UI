import 'dotenv/config';
import { createDatabase } from './database.ts';
import { createApiApp } from './app.ts';
import { createPasswordResetSender } from './email.ts';

const port = Number(process.env.PORT ?? 8787);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET 必须至少包含 32 个字符');

const database = await createDatabase(process.env.DATABASE_PATH ?? 'harmonica.sqlite');
const sendPasswordReset = process.env.SMTP_HOST ? createPasswordResetSender({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER ?? '',
  password: process.env.SMTP_PASSWORD ?? '',
  from: process.env.SMTP_FROM ?? 'Harmonica Practice <no-reply@example.com>',
  appOrigin: process.env.APP_ORIGIN ?? 'http://localhost:5173',
}) : undefined;
if (process.env.NODE_ENV === 'production' && !sendPasswordReset) throw new Error('生产环境必须配置 SMTP 密码重置邮件');
const app = createApiApp({
  database,
  jwtSecret,
  allowedOrigin: process.env.APP_ORIGIN,
  secureCookies: process.env.NODE_ENV === 'production',
  exposeResetToken: process.env.NODE_ENV !== 'production',
  sendPasswordReset,
});

app.listen(port, () => console.log(`Harmonica API listening on http://127.0.0.1:${port}`));
