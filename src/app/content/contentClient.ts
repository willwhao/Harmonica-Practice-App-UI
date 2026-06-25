import { SONGS } from '../data.ts';
import { getAvailablePracticeCharts, type PracticeChart } from '../data/practiceCharts.ts';
import { LEARNING_TRACKS, type LearningTrack } from '../data/learningTracks.ts';
import type { Song } from '../types.ts';

export type ContentItemType = 'song' | 'practice-chart' | 'learning-track' | 'licensed-audio';
export type ContentItemStatus = 'draft' | 'published' | 'archived';

export interface ContentItem<T = unknown> {
  id: string;
  contentType: ContentItemType;
  payload: T;
  status: ContentItemStatus;
  revision: number;
  updatedAt: string;
  publishedAt: string | null;
}

export interface ContentCatalog {
  songs: Song[];
  charts: PracticeChart[];
  learningTracks: LearningTrack[];
  source: 'static' | 'cms';
}

function getApiBase() {
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
  return (meta.env?.VITE_API_URL ?? '').replace(/\/$/, '');
}

function isSong(value: unknown): value is Song {
  const candidate = value as Song;
  return Boolean(candidate?.id && candidate.title && candidate.artist && candidate.key && candidate.bpm);
}

function isPracticeChart(value: unknown): value is PracticeChart {
  const candidate = value as PracticeChart;
  return candidate?.schemaVersion === 2 && Boolean(candidate.id && candidate.songId && Array.isArray(candidate.notes) && Array.isArray(candidate.measures));
}

function isLearningTrack(value: unknown): value is LearningTrack {
  const candidate = value as LearningTrack;
  return Boolean(candidate?.id && candidate.title && Array.isArray(candidate.songIds) && candidate.targetSessions);
}

export function buildStaticContentCatalog(): ContentCatalog {
  return {
    songs: SONGS,
    charts: getAvailablePracticeCharts(),
    learningTracks: LEARNING_TRACKS,
    source: 'static',
  };
}

export function buildContentCatalog(items: ContentItem[]): ContentCatalog {
  const songs = items.filter((item): item is ContentItem<Song> => item.contentType === 'song' && isSong(item.payload)).map((item) => item.payload);
  const charts = items.filter((item): item is ContentItem<PracticeChart> => item.contentType === 'practice-chart' && isPracticeChart(item.payload)).map((item) => item.payload);
  const learningTracks = items.filter((item): item is ContentItem<LearningTrack> => item.contentType === 'learning-track' && isLearningTrack(item.payload)).map((item) => item.payload);
  const fallback = buildStaticContentCatalog();
  return {
    songs: songs.length ? songs : fallback.songs,
    charts: charts.length ? charts : fallback.charts,
    learningTracks: learningTracks.length ? learningTracks : fallback.learningTracks,
    source: songs.length || charts.length || learningTracks.length ? 'cms' : 'static',
  };
}

export async function fetchPublishedContentCatalog(fetcher: typeof fetch = fetch) {
  const apiBase = getApiBase();
  if (!apiBase) return buildStaticContentCatalog();
  try {
    const response = await fetcher(`${apiBase}/api/content`);
    if (!response.ok) return buildStaticContentCatalog();
    const body = await response.json() as { items?: ContentItem[] };
    return buildContentCatalog(Array.isArray(body.items) ? body.items : []);
  } catch {
    return buildStaticContentCatalog();
  }
}
