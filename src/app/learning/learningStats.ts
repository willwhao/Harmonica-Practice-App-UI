import { LEARNING_TRACKS } from '../data/learningTracks.ts';
import type { LearningTrackProgress, PracticeHistoryEntry } from '../types';

export function localDateKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function entryMinutes(entry: PracticeHistoryEntry) {
  return Math.max(1, Math.round((entry.durationSeconds ?? 120) / 60));
}

export function calculateStreak(history: PracticeHistoryEntry[], now = new Date()) {
  const activeDays = new Set(history.map((entry) => localDateKey(entry.practicedAt)));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!activeDays.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (activeDays.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getWeeklyActivity(history: PracticeHistoryEntry[], now = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    date.setDate(date.getDate() - (6 - index));
    const key = localDateKey(date);
    const entries = history.filter((entry) => localDateKey(entry.practicedAt) === key);
    return {
      key,
      label: new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(date).replace('周', ''),
      sessions: entries.length,
      minutes: entries.reduce((total, entry) => total + entryMinutes(entry), 0),
    };
  });
}

export function getLearningSummary(history: PracticeHistoryEntry[], now = new Date()) {
  const todayKey = localDateKey(now);
  const todayEntries = history.filter((entry) => localDateKey(entry.practicedAt) === todayKey);
  return {
    sessions: history.length,
    averageAccuracy: history.length ? Math.round(history.reduce((total, entry) => total + entry.accuracy, 0) / history.length) : 0,
    bestScore: history.reduce((best, entry) => Math.max(best, entry.score), 0),
    todayMinutes: todayEntries.reduce((total, entry) => total + entryMinutes(entry), 0),
    streak: calculateStreak(history, now),
  };
}

export function getLearningTrackProgress(history: PracticeHistoryEntry[], now = new Date()): LearningTrackProgress[] {
  const updatedAt = now.toISOString();
  return LEARNING_TRACKS.map((track) => {
    const entries = history.filter((entry) => !entry.deletedAt && track.songIds.includes(entry.songId));
    const completedSessions = entries.length;
    const progressPercent = Math.min(100, Math.round(completedSessions / track.targetSessions * 100));
    const nextSongId = track.songIds.find((songId) => !entries.some((entry) => entry.songId === songId))
      ?? track.songIds[completedSessions % track.songIds.length]
      ?? null;
    return {
      id: track.id,
      trackId: track.id,
      completedSessions,
      targetSessions: track.targetSessions,
      progressPercent,
      nextSongId,
      updatedAt,
      revision: 0,
      deletedAt: null,
    };
  });
}
