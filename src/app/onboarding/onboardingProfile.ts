import type { UserPreferences } from '../types.ts';

const ONBOARDING_STORAGE_KEY = 'harmonica-onboarding-v1';

export type PracticeGoal = 'daily-habit' | 'intonation' | 'song-library';

export interface OnboardingProfile {
  schemaVersion: 1;
  goal: PracticeGoal;
  defaultHarmonica: UserPreferences['defaultHarmonica'];
  dailyGoalMinutes: number;
  skillLevel: UserPreferences['skillLevel'];
  microphoneExplained: boolean;
  deviceChecklist: {
    quietRoom: boolean;
    micPermission: boolean;
    headphones: boolean;
  };
  completedAt: string;
}

interface OnboardingStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function getDefaultStorage(): OnboardingStorage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function onboardingKey(userId?: string) {
  return userId ? `${ONBOARDING_STORAGE_KEY}:${userId}` : ONBOARDING_STORAGE_KEY;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPracticeGoal(value: unknown): value is PracticeGoal {
  return value === 'daily-habit' || value === 'intonation' || value === 'song-library';
}

function isOnboardingProfile(value: unknown): value is OnboardingProfile {
  if (!isRecord(value)) return false;
  if (!isRecord(value.deviceChecklist)) return false;
  return value.schemaVersion === 1
    && isPracticeGoal(value.goal)
    && (value.defaultHarmonica === 'diatonic' || value.defaultHarmonica === 'chromatic')
    && typeof value.dailyGoalMinutes === 'number'
    && ['beginner', 'intermediate', 'advanced'].includes(String(value.skillLevel))
    && typeof value.microphoneExplained === 'boolean'
    && typeof value.deviceChecklist.quietRoom === 'boolean'
    && typeof value.deviceChecklist.micPermission === 'boolean'
    && typeof value.deviceChecklist.headphones === 'boolean'
    && typeof value.completedAt === 'string';
}

export function createOnboardingProfile({
  goal,
  defaultHarmonica,
  dailyGoalMinutes,
  skillLevel,
  deviceChecklist,
  now = new Date().toISOString(),
}: {
  goal: PracticeGoal;
  defaultHarmonica: UserPreferences['defaultHarmonica'];
  dailyGoalMinutes: number;
  skillLevel: UserPreferences['skillLevel'];
  deviceChecklist: OnboardingProfile['deviceChecklist'];
  now?: string;
}): OnboardingProfile {
  return {
    schemaVersion: 1,
    goal,
    defaultHarmonica,
    dailyGoalMinutes: Math.max(5, Math.min(60, Math.round(dailyGoalMinutes / 5) * 5)),
    skillLevel,
    microphoneExplained: true,
    deviceChecklist,
    completedAt: now,
  };
}

export function loadOnboardingProfile(userId?: string, storage = getDefaultStorage()) {
  if (!storage) return null;
  try {
    const parsed: unknown = JSON.parse(storage.getItem(onboardingKey(userId)) ?? 'null');
    return isOnboardingProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveOnboardingProfile(profile: OnboardingProfile, userId?: string, storage = getDefaultStorage()) {
  storage?.setItem(onboardingKey(userId), JSON.stringify(profile));
}

export function clearOnboardingProfile(userId?: string, storage = getDefaultStorage()) {
  storage?.removeItem(onboardingKey(userId));
}

export function hasCompletedOnboarding(userId?: string, storage = getDefaultStorage()) {
  return Boolean(loadOnboardingProfile(userId, storage));
}
