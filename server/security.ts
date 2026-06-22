import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT, jwtVerify } from 'jose';

const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, saltValue, hashValue] = stored.split('$');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, 'base64url');
  const candidate = await scrypt(password, Buffer.from(saltValue, 'base64url'), expected.length) as Buffer;
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

export function createOpaqueToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('base64url');
}

export async function createAccessToken(user: { id: string; email: string }, secret: string) {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer('harmonica-practice-api')
    .setAudience('harmonica-practice-web')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(secret));
}

export async function verifyAccessToken(token: string, secret: string) {
  const result = await jwtVerify(token, new TextEncoder().encode(secret), {
    issuer: 'harmonica-practice-api',
    audience: 'harmonica-practice-web',
  });
  if (!result.payload.sub) throw new Error('访问令牌缺少用户标识');
  return { userId: result.payload.sub, email: String(result.payload.email ?? '') };
}
