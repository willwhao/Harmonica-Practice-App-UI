import { LEARNING_TRACKS } from '../data/learningTracks.ts';
import { calculateStreak, entryMinutes, localDateKey } from '../learning/learningStats.ts';
import type { LearningTrackProgress, PracticeBookmark, PracticeHistoryEntry } from '../types';

export type BadgeTier = 'bronze' | 'silver' | 'gold';

export interface GrowthBadge {
  id: string;
  label: string;
  description: string;
  tier: BadgeTier;
  earned: boolean;
  progress: number;
  target: number;
  earnedAt: string | null;
}

export interface GrowthLevel {
  level: number;
  totalXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
}

export interface GrowthMonthlyReport {
  monthKey: string;
  sessions: number;
  minutes: number;
  averageAccuracy: number;
  bestScore: number;
  xp: number;
  activeDays: number;
  improvedSongIds: string[];
  weakestMeasures: Array<{ songId: string; measure: number; errors: number }>;
}

export interface GrowthSummary {
  level: GrowthLevel;
  badges: GrowthBadge[];
  monthlyReport: GrowthMonthlyReport;
}

const XP_PER_LEVEL = 600;

export function calculatePracticeXp(entry: PracticeHistoryEntry) {
  const minutesXp = entryMinutes(entry) * 10;
  const accuracyBonus = Math.max(0, entry.accuracy - 60) * 2;
  const scoreBonus = Math.floor(entry.score / 250);
  const weakMeasurePenalty = Math.min(30, (entry.weakMeasures?.length ?? 0) * 5);
  return Math.max(10, Math.round(minutesXp + accuracyBonus + scoreBonus - weakMeasurePenalty));
}

export function calculateTotalXp(history: PracticeHistoryEntry[]) {
  return history.filter((entry) => !entry.deletedAt).reduce((total, entry) => total + calculatePracticeXp(entry), 0);
}

export function buildGrowthLevel(totalXp: number): GrowthLevel {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const currentLevelXp = totalXp % XP_PER_LEVEL;
  const nextLevelXp = XP_PER_LEVEL;
  return {
    level,
    totalXp,
    currentLevelXp,
    nextLevelXp,
    progressPercent: Math.round(currentLevelXp / nextLevelXp * 100),
  };
}

function firstEarnedAt(history: PracticeHistoryEntry[], predicate: (entries: PracticeHistoryEntry[]) => boolean) {
  const sorted = [...history].filter((entry) => !entry.deletedAt).sort((a, b) => a.practicedAt.localeCompare(b.practicedAt));
  const seen: PracticeHistoryEntry[] = [];
  for (const entry of sorted) {
    seen.push(entry);
    if (predicate(seen)) return entry.practicedAt;
  }
  return null;
}

export function buildGrowthBadges(
  history: PracticeHistoryEntry[],
  bookmarks: PracticeBookmark[] = [],
  learningProgress: LearningTrackProgress[] = [],
  now = new Date(),
): GrowthBadge[] {
  const activeHistory = history.filter((entry) => !entry.deletedAt);
  const sessions = activeHistory.length;
  const streak = calculateStreak(activeHistory, now);
  const highAccuracySessions = activeHistory.filter((entry) => entry.accuracy >= 90).length;
  const bestScore = activeHistory.reduce((best, entry) => Math.max(best, entry.score), 0);
  const completedTracks = learningProgress.filter((item) => !item.deletedAt && item.progressPercent >= 100).length;
  const practicedBookmarkCount = bookmarks.filter((item) => !item.deletedAt).length;

  const definitions = [
    {
      id: 'first-session',
      label: '初次登台',
      description: '完成第一次口琴练习。',
      tier: 'bronze' as const,
      progress: sessions,
      target: 1,
      earnedAt: firstEarnedAt(activeHistory, (entries) => entries.length >= 1),
    },
    {
      id: 'three-day-streak',
      label: '三日不断',
      description: '保持 3 天连续练习。',
      tier: 'silver' as const,
      progress: streak,
      target: 3,
      earnedAt: streak >= 3 ? now.toISOString() : null,
    },
    {
      id: 'accurate-player',
      label: '音准稳定',
      description: '累计 5 次准确率达到 90% 以上。',
      tier: 'silver' as const,
      progress: highAccuracySessions,
      target: 5,
      earnedAt: firstEarnedAt(activeHistory, (entries) => entries.filter((entry) => entry.accuracy >= 90).length >= 5),
    },
    {
      id: 'score-breakthrough',
      label: '高分突破',
      description: '单次练习得分达到 3000 分。',
      tier: 'gold' as const,
      progress: bestScore,
      target: 3000,
      earnedAt: firstEarnedAt(activeHistory, (entries) => entries.some((entry) => entry.score >= 3000)),
    },
    {
      id: 'course-finisher',
      label: '课程完课',
      description: '完成任意一条分级课程。',
      tier: 'gold' as const,
      progress: completedTracks,
      target: 1,
      earnedAt: completedTracks ? learningProgress.find((item) => item.progressPercent >= 100)?.updatedAt ?? now.toISOString() : null,
    },
    {
      id: 'weak-spot-hunter',
      label: '难点猎手',
      description: '收藏 3 个难点小节并进行专项复练。',
      tier: 'bronze' as const,
      progress: practicedBookmarkCount,
      target: 3,
      earnedAt: practicedBookmarkCount >= 3 ? bookmarks.filter((item) => !item.deletedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt))[2]?.createdAt ?? null : null,
    },
  ];

  return definitions.map((badge) => ({
    ...badge,
    progress: Math.min(badge.progress, badge.target),
    earned: badge.progress >= badge.target,
  }));
}

export function buildMonthlyGrowthReport(history: PracticeHistoryEntry[], now = new Date()): GrowthMonthlyReport {
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const entries = history
    .filter((entry) => !entry.deletedAt && entry.practicedAt.startsWith(monthKey))
    .sort((a, b) => a.practicedAt.localeCompare(b.practicedAt));
  const sessions = entries.length;
  const minutes = entries.reduce((total, entry) => total + entryMinutes(entry), 0);
  const activeDays = new Set(entries.map((entry) => localDateKey(entry.practicedAt))).size;
  const bySong = new Map<string, PracticeHistoryEntry[]>();
  entries.forEach((entry) => bySong.set(entry.songId, [...(bySong.get(entry.songId) ?? []), entry]));
  const improvedSongIds = [...bySong.entries()]
    .filter(([, songEntries]) => songEntries.length >= 2 && songEntries.at(-1)!.accuracy > songEntries[0].accuracy)
    .map(([songId]) => songId)
    .slice(0, 3);
  const weakestMeasures = entries
    .flatMap((entry) => (entry.weakMeasures ?? []).map((measure) => ({ songId: entry.songId, measure: measure.measure, errors: measure.errors })))
    .sort((a, b) => b.errors - a.errors)
    .slice(0, 5);

  return {
    monthKey,
    sessions,
    minutes,
    averageAccuracy: sessions ? Math.round(entries.reduce((total, entry) => total + entry.accuracy, 0) / sessions) : 0,
    bestScore: entries.reduce((best, entry) => Math.max(best, entry.score), 0),
    xp: entries.reduce((total, entry) => total + calculatePracticeXp(entry), 0),
    activeDays,
    improvedSongIds,
    weakestMeasures,
  };
}

export function buildGrowthSummary(
  history: PracticeHistoryEntry[],
  bookmarks: PracticeBookmark[] = [],
  learningProgress: LearningTrackProgress[] = [],
  now = new Date(),
): GrowthSummary {
  const derivedProgress = learningProgress.length ? learningProgress : LEARNING_TRACKS.map((track) => {
    const completedSessions = history.filter((entry) => track.songIds.includes(entry.songId)).length;
    return {
      id: track.id,
      trackId: track.id,
      completedSessions,
      targetSessions: track.targetSessions,
      progressPercent: Math.min(100, Math.round(completedSessions / track.targetSessions * 100)),
      nextSongId: null,
      updatedAt: now.toISOString(),
      revision: 0,
      deletedAt: null,
    };
  });
  return {
    level: buildGrowthLevel(calculateTotalXp(history)),
    badges: buildGrowthBadges(history, bookmarks, derivedProgress, now),
    monthlyReport: buildMonthlyGrowthReport(history, now),
  };
}
