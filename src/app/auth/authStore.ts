import type { AuthUser, UserPreferences } from '../types';

const ACCOUNTS_KEY = 'harmonica-local-accounts-v1';
const SESSION_KEY = 'harmonica-local-session-v1';

interface StoredAccount extends AuthUser {
  passwordSalt: string;
  passwordVerifier: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultHarmonica: 'diatonic',
  dailyGoalMinutes: 15,
  skillLevel: 'beginner',
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function createPasswordVerifier(password: string, salt?: string) {
  const passwordBytes = new TextEncoder().encode(password);
  const saltBytes = salt ? base64ToBytes(salt) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: saltBytes,
    iterations: 120_000,
  }, key, 256);
  return {
    salt: bytesToBase64(saltBytes),
    verifier: bytesToBase64(new Uint8Array(bits)),
  };
}

function loadAccounts(): StoredAccount[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: StoredAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function publicUser(account: StoredAccount): AuthUser {
  const { passwordSalt: _salt, passwordVerifier: _verifier, ...user } = account;
  return user;
}

function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase('en-US');
}

export function loadSessionUser(): AuthUser | null {
  const userId = localStorage.getItem(SESSION_KEY);
  if (!userId) return null;
  const account = loadAccounts().find((item) => item.id === userId);
  if (!account) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  return publicUser(account);
}

export async function registerLocalAccount(input: { email: string; password: string; nickname: string }) {
  const email = normalizeEmail(input.email);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('请输入有效的邮箱地址');
  if (input.password.length < 8) throw new Error('密码至少需要 8 个字符');
  if (input.nickname.trim().length < 2) throw new Error('昵称至少需要 2 个字符');

  const accounts = loadAccounts();
  if (accounts.some((account) => account.email === email)) throw new Error('该邮箱已注册');
  const password = await createPasswordVerifier(input.password);
  const account: StoredAccount = {
    id: crypto.randomUUID(),
    email,
    nickname: input.nickname.trim(),
    createdAt: new Date().toISOString(),
    preferences: { ...DEFAULT_PREFERENCES },
    passwordSalt: password.salt,
    passwordVerifier: password.verifier,
  };
  saveAccounts([...accounts, account]);
  localStorage.setItem(SESSION_KEY, account.id);
  return publicUser(account);
}

export async function loginLocalAccount(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const account = loadAccounts().find((item) => item.email === email);
  if (!account) throw new Error('邮箱或密码不正确');
  const candidate = await createPasswordVerifier(password, account.passwordSalt);
  if (candidate.verifier !== account.passwordVerifier) throw new Error('邮箱或密码不正确');
  localStorage.setItem(SESSION_KEY, account.id);
  return publicUser(account);
}

export function updateLocalUser(user: AuthUser) {
  const accounts = loadAccounts();
  const index = accounts.findIndex((account) => account.id === user.id);
  if (index < 0) throw new Error('本地账户不存在');
  accounts[index] = { ...accounts[index], ...user };
  saveAccounts(accounts);
  return publicUser(accounts[index]);
}

export function logoutLocalAccount() {
  localStorage.removeItem(SESSION_KEY);
}

export function deleteLocalAccount(userId: string) {
  saveAccounts(loadAccounts().filter((account) => account.id !== userId));
  localStorage.removeItem(SESSION_KEY);
}

export function getLocalUserExport(user: AuthUser, history: unknown[], bookmarks: unknown[] = []) {
  return JSON.stringify({ exportedAt: new Date().toISOString(), user, history, bookmarks }, null, 2);
}
