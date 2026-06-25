import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearOnboardingProfile,
  createOnboardingProfile,
  hasCompletedOnboarding,
  loadOnboardingProfile,
  saveOnboardingProfile,
} from './onboardingProfile.ts';

function createMemoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
  };
}

test('creates a bounded onboarding profile from user choices', () => {
  const profile = createOnboardingProfile({
    goal: 'intonation',
    defaultHarmonica: 'chromatic',
    dailyGoalMinutes: 64,
    skillLevel: 'intermediate',
    deviceChecklist: { quietRoom: true, micPermission: true, headphones: false },
    now: '2026-06-24T00:00:00.000Z',
  });

  assert.equal(profile.dailyGoalMinutes, 60);
  assert.equal(profile.microphoneExplained, true);
  assert.equal(profile.completedAt, '2026-06-24T00:00:00.000Z');
});

test('stores onboarding completion by user key', () => {
  const storage = createMemoryStorage();
  const profile = createOnboardingProfile({
    goal: 'daily-habit',
    defaultHarmonica: 'diatonic',
    dailyGoalMinutes: 15,
    skillLevel: 'beginner',
    deviceChecklist: { quietRoom: true, micPermission: false, headphones: true },
    now: '2026-06-24T00:00:00.000Z',
  });

  saveOnboardingProfile(profile, 'u1', storage);
  assert.deepEqual(loadOnboardingProfile('u1', storage), profile);
  assert.equal(hasCompletedOnboarding('u1', storage), true);
  assert.equal(hasCompletedOnboarding('u2', storage), false);
  clearOnboardingProfile('u1', storage);
  assert.equal(loadOnboardingProfile('u1', storage), null);
});
