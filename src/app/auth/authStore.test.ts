import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import {
  createPasswordVerifier,
  loadSessionUser,
  loginLocalAccount,
  logoutLocalAccount,
  registerLocalAccount,
  updateLocalUser,
} from './authStore.ts';

class MemoryStorage {
  #items = new Map<string, string>();
  get length() { return this.#items.size; }
  clear() { this.#items.clear(); }
  getItem(key: string) { return this.#items.get(key) ?? null; }
  key(index: number) { return [...this.#items.keys()][index] ?? null; }
  removeItem(key: string) { this.#items.delete(key); }
  setItem(key: string, value: string) { this.#items.set(key, value); }
}

Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
beforeEach(() => localStorage.clear());

test('creates a repeatable verifier when the same salt is used', async () => {
  const first = await createPasswordVerifier('correct-horse-battery-staple');
  const second = await createPasswordVerifier('correct-horse-battery-staple', first.salt);
  assert.equal(second.salt, first.salt);
  assert.equal(second.verifier, first.verifier);
});

test('rejects a different password through a different verifier', async () => {
  const first = await createPasswordVerifier('correct-horse-battery-staple');
  const second = await createPasswordVerifier('incorrect-password', first.salt);
  assert.notEqual(second.verifier, first.verifier);
});

test('registers, restores and logs in a local account', async () => {
  const registered = await registerLocalAccount({ email: 'Player@Example.com', password: 'practice-123', nickname: '小乐' });
  assert.equal(registered.email, 'player@example.com');
  assert.equal(loadSessionUser()?.id, registered.id);

  logoutLocalAccount();
  assert.equal(loadSessionUser(), null);
  await assert.rejects(() => loginLocalAccount('player@example.com', 'wrong-password'));
  const loggedIn = await loginLocalAccount('player@example.com', 'practice-123');
  assert.equal(loggedIn.id, registered.id);
});

test('persists updated practice preferences', async () => {
  const user = await registerLocalAccount({ email: 'settings@example.com', password: 'practice-123', nickname: '练习者' });
  const updated = updateLocalUser({ ...user, preferences: { ...user.preferences, dailyGoalMinutes: 30 } });
  assert.equal(updated.preferences.dailyGoalMinutes, 30);
  assert.equal(loadSessionUser()?.preferences.dailyGoalMinutes, 30);
});
