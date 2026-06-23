import type { AudioTranscription } from './audioTranscription.ts';
import type { Song } from '../types.ts';
import type { BreathDirection, HarmonicaKind, PracticeChart, PracticeNote, ScoreBeat } from '../data/practiceCharts.ts';
import { validatePracticeChart } from '../data/practiceCharts.ts';

interface HoleMapping {
  hole: number;
  type: BreathDirection;
}

const DIATONIC_JIANPU_TO_HOLE: Record<string, HoleMapping> = {
  '1': { hole: 4, type: 'blow' },
  '♯1': { hole: 4, type: 'draw' },
  '2': { hole: 4, type: 'draw' },
  '♭3': { hole: 3, type: 'draw' },
  '3': { hole: 5, type: 'blow' },
  '4': { hole: 5, type: 'draw' },
  '♯4': { hole: 6, type: 'draw' },
  '5': { hole: 6, type: 'blow' },
  '♭6': { hole: 6, type: 'draw' },
  '6': { hole: 6, type: 'draw' },
  '♭7': { hole: 7, type: 'draw' },
  '7': { hole: 7, type: 'draw' },
};

const CHROMATIC_JIANPU_TO_HOLE: Record<string, HoleMapping> = {
  '1': { hole: 1, type: 'blow' },
  '♯1': { hole: 1, type: 'draw' },
  '2': { hole: 1, type: 'draw' },
  '♭3': { hole: 2, type: 'blow' },
  '3': { hole: 2, type: 'blow' },
  '4': { hole: 2, type: 'draw' },
  '♯4': { hole: 3, type: 'blow' },
  '5': { hole: 3, type: 'blow' },
  '♭6': { hole: 3, type: 'draw' },
  '6': { hole: 3, type: 'draw' },
  '♭7': { hole: 4, type: 'draw' },
  '7': { hole: 4, type: 'draw' },
};

function baseJianpu(jianpu: string) {
  return jianpu.replace(/[̣̇]/gu, '');
}

function mapJianpuToHole(jianpu: string, harmonicaType: HarmonicaKind): HoleMapping {
  const base = baseJianpu(jianpu);
  const table = harmonicaType === 'chromatic' ? CHROMATIC_JIANPU_TO_HOLE : DIATONIC_JIANPU_TO_HOLE;
  return table[base] ?? { hole: harmonicaType === 'chromatic' ? 1 : 4, type: 'blow' };
}

export function createPracticeChartFromTranscription({
  song,
  transcription,
  harmonicaType,
}: {
  song: Song;
  transcription: AudioTranscription;
  harmonicaType: HarmonicaKind;
}): PracticeChart | null {
  const beatDurationSec = 60 / song.bpm;
  const occupiedBeats = new Set<number>();
  const noteFrequencies: Record<string, number> = {};
  const noteNames: Record<string, string> = {};
  const notes: PracticeNote[] = [];

  transcription.notes.forEach((item) => {
    const beat = Math.max(0, Math.round(item.startSec / beatDurationSec));
    if (occupiedBeats.has(beat)) return;
    const durationBeats = Math.max(1, Math.round((item.endSec - item.startSec) / beatDurationSec));
    const mapping = mapJianpuToHole(item.jianpu, harmonicaType);
    const number = item.jianpu;
    noteFrequencies[number] = item.frequency;
    noteNames[number] = item.noteName;
    notes.push({
      beat,
      durationBeats,
      track: mapping.hole - 1,
      number,
      type: mapping.type,
      hole: mapping.hole,
      technique: baseJianpu(number).includes('♭') ? 'bend-half' : 'natural',
    });
    occupiedBeats.add(beat);
  });

  if (notes.length === 0) return null;
  notes.sort((a, b) => a.beat - b.beat);
  const lastNoteEnd = Math.max(...notes.map((note) => note.beat + note.durationBeats));
  const totalBeats = Math.max(4, Math.ceil(lastNoteEnd / 4) * 4);
  const measures: ScoreBeat[][] = Array.from({ length: totalBeats / 4 }, () => Array.from({ length: 4 }, () => ({ n: '-', t: 'rest' as const })));
  const clampedNotes = notes.map((note) => ({
    ...note,
    durationBeats: Math.min(note.durationBeats, totalBeats - note.beat),
  }));
  clampedNotes.forEach((note) => {
    const measureIndex = Math.floor(note.beat / 4);
    const beatIndex = note.beat % 4;
    measures[measureIndex][beatIndex] = { n: note.number, t: note.type, technique: note.technique };
  });

  const chart: PracticeChart = {
    schemaVersion: 2,
    id: `uploaded-${song.id}-${Date.now()}`,
    songId: song.id,
    title: `${song.title} · 上传音频识别草稿`,
    version: 1,
    harmonicaType,
    key: transcription.key,
    source: 'practice-arrangement',
    totalBeats,
    lookAheadBeats: 5,
    noteFrequencies,
    noteNames,
    notes: clampedNotes,
    measures,
  };
  return validatePracticeChart(chart).valid ? chart : null;
}
