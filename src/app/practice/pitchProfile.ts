import { centsFromTarget } from '../audio/pitchDetection.ts';
import type { BreathDirection, HarmonicaKind, PracticeChart } from '../data/practiceCharts.ts';

const PROFILE_STORAGE_KEY = 'harmonica-pitch-profile-v1';
const MAX_ABSOLUTE_OFFSET_CENTS = 180;
const MIN_CONFIDENCE = 50;

export interface CalibrationTarget {
  id: string;
  noteNumber: string;
  targetNote: string;
  targetFrequency: number;
  hole: number;
  breath: BreathDirection;
  label: string;
  instruction: string;
}

export interface PitchProfileCalibrationSample {
  targetId: string;
  noteNumber: string;
  targetNote: string;
  targetFrequency: number;
  hole: number;
  breath: BreathDirection;
  measuredFrequency: number;
  centsDifference: number;
  confidence: number;
  capturedAt: string;
}

export interface PersonalPitchProfile {
  schemaVersion: 1;
  id: string;
  userId?: string;
  harmonicaType: HarmonicaKind;
  key: string;
  averageOffsetCents: number;
  noteOffsetsCents: Record<string, number>;
  sampleCount: number;
  samples: PitchProfileCalibrationSample[];
  createdAt: string;
  updatedAt: string;
}

interface PitchProfileStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function getDefaultStorage(): PitchProfileStorage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function getProfileStorageKey(userId?: string) {
  return userId ? `${PROFILE_STORAGE_KEY}:${userId}` : PROFILE_STORAGE_KEY;
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function breathLabel(breath: BreathDirection) {
  return breath === 'blow' ? '吹气' : '吸气';
}

function sanitizeProfileId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPitchProfileSample(value: unknown): value is PitchProfileCalibrationSample {
  if (!isRecord(value)) return false;
  return typeof value.targetId === 'string'
    && typeof value.noteNumber === 'string'
    && typeof value.targetNote === 'string'
    && typeof value.targetFrequency === 'number'
    && typeof value.hole === 'number'
    && (value.breath === 'blow' || value.breath === 'draw')
    && typeof value.measuredFrequency === 'number'
    && typeof value.centsDifference === 'number'
    && typeof value.confidence === 'number'
    && typeof value.capturedAt === 'string';
}

function isPersonalPitchProfile(value: unknown): value is PersonalPitchProfile {
  if (!isRecord(value)) return false;
  return value.schemaVersion === 1
    && typeof value.id === 'string'
    && (typeof value.userId === 'undefined' || typeof value.userId === 'string')
    && (value.harmonicaType === 'diatonic' || value.harmonicaType === 'chromatic')
    && typeof value.key === 'string'
    && typeof value.averageOffsetCents === 'number'
    && isRecord(value.noteOffsetsCents)
    && Object.values(value.noteOffsetsCents).every((offset) => typeof offset === 'number')
    && typeof value.sampleCount === 'number'
    && Array.isArray(value.samples)
    && value.samples.every(isPitchProfileSample)
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string';
}

function getUsableSamples(samples: PitchProfileCalibrationSample[]) {
  return samples.filter((sample) => (
    Number.isFinite(sample.measuredFrequency)
    && Number.isFinite(sample.targetFrequency)
    && Number.isFinite(sample.centsDifference)
    && sample.confidence >= MIN_CONFIDENCE
    && Math.abs(sample.centsDifference) <= MAX_ABSOLUTE_OFFSET_CENTS
  ));
}

export function buildCalibrationTargets(chart: PracticeChart, maxTargets = 4): CalibrationTarget[] {
  const selected = new Map<string, CalibrationTarget>();
  const collect = (includeTechniqueNotes: boolean) => {
    chart.notes.forEach((note) => {
      if (selected.size >= maxTargets) return;
      if (!includeTechniqueNotes && note.technique !== 'natural') return;
      const targetFrequency = chart.noteFrequencies[note.number];
      if (!targetFrequency) return;
      const targetNote = chart.noteNames[note.number] ?? note.number;
      const id = `${note.number}:${note.hole}:${note.type}`;
      if (selected.has(id)) return;
      selected.set(id, {
        id,
        noteNumber: note.number,
        targetNote,
        targetFrequency,
        hole: note.hole,
        breath: note.type,
        label: `${note.number} · 第 ${note.hole} 孔${breathLabel(note.type)}`,
        instruction: `吹/吸到 ${targetNote}，保持 1 秒，等稳定后记录。`,
      });
    });
  };

  collect(false);
  if (selected.size < Math.min(maxTargets, chart.notes.length)) collect(true);
  return [...selected.values()].slice(0, maxTargets);
}

export function buildCalibrationSample(
  target: CalibrationTarget,
  measuredFrequency: number,
  confidence: number,
  capturedAt = new Date().toISOString(),
): PitchProfileCalibrationSample {
  return {
    targetId: target.id,
    noteNumber: target.noteNumber,
    targetNote: target.targetNote,
    targetFrequency: target.targetFrequency,
    hole: target.hole,
    breath: target.breath,
    measuredFrequency,
    centsDifference: Math.round(centsFromTarget(measuredFrequency, target.targetFrequency)),
    confidence,
    capturedAt,
  };
}

export function createPitchProfile({
  userId,
  harmonicaType,
  key,
  samples,
  now = new Date().toISOString(),
}: {
  userId?: string;
  harmonicaType: HarmonicaKind;
  key: string;
  samples: PitchProfileCalibrationSample[];
  now?: string;
}): PersonalPitchProfile {
  const usableSamples = getUsableSamples(samples);
  if (usableSamples.length === 0) {
    throw new Error('没有可用的校准样本');
  }

  const averageOffsetCents = Math.round(average(usableSamples.map((sample) => sample.centsDifference)));
  const groupedOffsets = usableSamples.reduce<Record<string, number[]>>((groups, sample) => {
    groups[sample.noteNumber] = [...(groups[sample.noteNumber] ?? []), sample.centsDifference];
    return groups;
  }, {});
  const noteOffsetsCents = Object.fromEntries(
    Object.entries(groupedOffsets).map(([noteNumber, offsets]) => [noteNumber, Math.round(average(offsets))]),
  );

  return {
    schemaVersion: 1,
    id: `pitch-profile-${sanitizeProfileId(userId ?? 'guest')}-${sanitizeProfileId(now)}`,
    userId,
    harmonicaType,
    key,
    averageOffsetCents,
    noteOffsetsCents,
    sampleCount: usableSamples.length,
    samples: usableSamples,
    createdAt: now,
    updatedAt: now,
  };
}

export function correctFrequencyWithPitchProfile(frequency: number, profile?: PersonalPitchProfile | null) {
  if (!profile || !Number.isFinite(frequency)) return frequency;
  return frequency / Math.pow(2, profile.averageOffsetCents / 1200);
}

export function calibratedCentsFromTarget(
  frequency: number,
  targetFrequency: number,
  profile?: PersonalPitchProfile | null,
) {
  return centsFromTarget(correctFrequencyWithPitchProfile(frequency, profile), targetFrequency);
}

export function formatPitchOffset(offsetCents: number) {
  if (offsetCents === 0) return '0¢';
  return `${offsetCents > 0 ? '+' : ''}${offsetCents}¢`;
}

export function loadPitchProfile(userId?: string, storage = getDefaultStorage()) {
  if (!storage) return null;
  try {
    const parsed: unknown = JSON.parse(storage.getItem(getProfileStorageKey(userId)) ?? 'null');
    return isPersonalPitchProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function savePitchProfile(profile: PersonalPitchProfile, userId = profile.userId, storage = getDefaultStorage()) {
  if (!storage) return;
  storage.setItem(getProfileStorageKey(userId), JSON.stringify(profile));
}

export function clearPitchProfile(userId?: string, storage = getDefaultStorage()) {
  storage?.removeItem(getProfileStorageKey(userId));
}
