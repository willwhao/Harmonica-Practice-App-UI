import type { Song } from '../types';
import type {
  BreathDirection,
  HarmonicaKind,
  HarmonicaTechnique,
  PracticeChart,
  PracticeNote,
  ScoreBeat,
  ScoreNotation,
  ScoreNotationMeasure,
  ScoreNotationToken,
} from '../data/practiceCharts';
import { validatePracticeChart } from '../data/practiceCharts.ts';

const REST = '-';
const PACK_URL = '/content/practice-song-pack.json';

interface ExternalNoteDefinition {
  frequency: number;
  name: string;
  track: number;
  hole: number;
  type: BreathDirection;
  technique?: HarmonicaTechnique;
}

interface ExternalChartBlueprint {
  songId: string;
  title: string;
  key: string;
  harmonicaType: HarmonicaKind;
  measureBeats?: number;
  definitions: Record<string, ExternalNoteDefinition>;
  measures: string[][];
  lyrics?: string[][];
  notation?: ExternalNotation;
}

type ExternalNotationToken = ExternalNotationTokenObject | string;

interface ExternalNotationTokenObject {
  kind?: ScoreNotationToken['kind'];
  text: string;
  note?: string;
  lyric?: string;
  durationBeats?: number;
  underline?: 0 | 1 | 2;
  octave?: ScoreNotationToken['octave'];
  suffix?: string;
  slur?: boolean;
}

interface ExternalNotationMeasure {
  section?: string;
  tokens: ExternalNotationToken[];
}

interface ExternalNotationLine {
  measures: ExternalNotationMeasure[];
}

interface ExternalNotation {
  beatsPerMeasure?: number;
  lines: ExternalNotationLine[];
}

export interface PracticeSongPack {
  songs: Song[];
  charts: PracticeChart[];
}

interface RawPracticeSongPack {
  songs?: Song[];
  charts?: ExternalChartBlueprint[];
}

function parseScoreToken(token: string) {
  if (token === REST) return { number: REST, durationBeats: 1 };
  const [number, durationRaw] = token.split(':');
  const durationBeats = durationRaw ? Number(durationRaw) : 1;
  if (!number || !Number.isFinite(durationBeats) || durationBeats <= 0) {
    throw new Error(`外部谱面 token ${token} 的格式无效`);
  }
  return { number, durationBeats };
}

function normalizeNotationToken(input: ExternalNotationToken): ExternalNotationTokenObject {
  if (typeof input !== 'string') return input;
  const [text = '', lyric = '', durationRaw = '', flagsRaw = '', note = ''] = input.split('|');
  const flags = flagsRaw.split(',').map((flag) => flag.trim()).filter(Boolean);
  const durationBeats = durationRaw === '' ? undefined : Number(durationRaw);
  const underline = flags.includes('u2') ? 2 : flags.includes('u1') ? 1 : undefined;
  const kind = flags.includes('rest') ? 'rest' : flags.includes('hold') ? 'hold' : undefined;
  const octave = flags.includes('high') ? 'high' : flags.includes('low') ? 'low' : undefined;
  const suffix = flags.includes('v') ? '∨' : undefined;
  return {
    text,
    note: note || undefined,
    lyric: lyric || undefined,
    durationBeats: Number.isFinite(durationBeats) ? durationBeats : undefined,
    underline,
    kind,
    octave,
    suffix,
    slur: flags.includes('slur') || undefined,
  };
}

function inferTokenKind(token: ExternalNotationTokenObject): ScoreNotationToken['kind'] {
  if (token.kind) return token.kind;
  if (token.text === '-' || token.note === '-') return 'hold';
  if (token.text === '0' || token.note === '0') return 'rest';
  return 'note';
}

function createNotationToken(
  token: ExternalNotationTokenObject,
  id: string,
  startBeat: number | undefined,
  kind: ScoreNotationToken['kind'],
): ScoreNotationToken {
  return {
    id,
    kind,
    text: token.text,
    note: token.note,
    lyric: token.lyric,
    startBeat,
    durationBeats: token.durationBeats,
    underline: token.underline,
    octave: token.octave,
    suffix: token.suffix,
    slur: token.slur,
  };
}

function buildNotationAndNotes(
  blueprint: ExternalChartBlueprint,
  measureBeats: number,
): { notation?: ScoreNotation; notes?: PracticeNote[]; totalBeats?: number } {
  if (!blueprint.notation) return {};

  const notes: PracticeNote[] = [];
  const lines: ScoreNotation['lines'] = [];
  let currentBeat = 0;
  let measureIndex = 0;

  blueprint.notation.lines.forEach((line, lineIndex) => {
    const lineStart = currentBeat;
    const measures: ScoreNotationMeasure[] = [];

    line.measures.forEach((measure) => {
      const measureStart = currentBeat;
      const tokens: ScoreNotationToken[] = [];
      let consumedBeats = 0;

      if (measure.section) {
        tokens.push({
          id: `m${measureIndex}-section`,
          kind: 'section',
          text: measure.section,
        });
      }

      measure.tokens.forEach((tokenInput, tokenIndex) => {
        const token = normalizeNotationToken(tokenInput);
        const kind = inferTokenKind(token);
        const advancesTime = kind === 'note' || kind === 'rest';
        const durationBeats = token.durationBeats ?? (kind === 'hold' || kind === 'section' ? 0 : 1);
        const tokenStartBeat = advancesTime ? currentBeat : undefined;
        const notationToken = createNotationToken(token, `m${measureIndex}-t${tokenIndex}`, tokenStartBeat, kind);
        tokens.push(notationToken);

        if (kind === 'note') {
          const number = token.note ?? token.text;
          const definition = blueprint.definitions[number];
          if (!definition) throw new Error(`外部谱面 ${blueprint.songId} 使用了未定义音符 ${number}`);
          notes.push({
            beat: currentBeat,
            durationBeats,
            track: definition.track,
            number,
            type: definition.type,
            hole: definition.hole,
            technique: definition.technique ?? 'natural',
            lyric: token.lyric,
          });
        }

        if (advancesTime) {
          currentBeat += durationBeats;
          consumedBeats += durationBeats;
        }
      });

      if (consumedBeats < measureBeats) currentBeat += measureBeats - consumedBeats;

      measures.push({
        id: `measure-${measureIndex}`,
        section: measure.section,
        startBeat: measureStart,
        endBeat: currentBeat,
        tokens,
      });
      measureIndex += 1;
    });

    lines.push({
      id: `line-${lineIndex}`,
      startBeat: lineStart,
      endBeat: currentBeat,
      measures,
    });
  });

  return {
    notation: {
      beatsPerMeasure: measureBeats,
      lines,
    },
    notes,
    totalBeats: currentBeat,
  };
}

export function createPracticeChartFromPack(blueprint: ExternalChartBlueprint): PracticeChart {
  const measureBeats = blueprint.measureBeats ?? blueprint.notation?.beatsPerMeasure ?? 4;
  const notationResult = buildNotationAndNotes(blueprint, measureBeats);
  const measures = blueprint.measures.map((measure, measureIndex) => measure.map((token, beatIndex): ScoreBeat => {
    const parsed = parseScoreToken(token);
    const lyric = blueprint.lyrics?.[measureIndex]?.[beatIndex];
    if (parsed.number === REST) return { n: REST, t: 'rest', durationBeats: parsed.durationBeats, lyric };
    const definition = blueprint.definitions[parsed.number];
    if (!definition) throw new Error(`外部谱面 ${blueprint.songId} 使用了未定义音符 ${parsed.number}`);
    return {
      n: parsed.number,
      t: definition.type,
      durationBeats: parsed.durationBeats,
      technique: definition.technique ?? 'natural',
      lyric,
    };
  }));

  const notes = notationResult.notes ?? blueprint.measures.flatMap((measure, measureIndex) => measure.flatMap((token, beatIndex) => {
    const parsed = parseScoreToken(token);
    if (parsed.number === REST) return [];
    const definition = blueprint.definitions[parsed.number];
    return [{
      beat: measureIndex * measureBeats + beatIndex,
      durationBeats: parsed.durationBeats,
      track: definition.track,
      number: parsed.number,
      type: definition.type,
      hole: definition.hole,
      technique: definition.technique ?? 'natural',
      lyric: blueprint.lyrics?.[measureIndex]?.[beatIndex],
    }];
  }));
  const totalBeats = notationResult.totalBeats ?? blueprint.measures.length * measureBeats;

  const chart: PracticeChart = {
    schemaVersion: 2,
    id: `external-${blueprint.songId}-practice-v1`,
    songId: blueprint.songId,
    title: blueprint.title,
    version: 1,
    harmonicaType: blueprint.harmonicaType,
    key: blueprint.key,
    source: 'practice-arrangement',
    totalBeats,
    lookAheadBeats: 5,
    measureBeats,
    noteFrequencies: Object.fromEntries(Object.entries(blueprint.definitions).map(([token, value]) => [token, value.frequency])),
    noteNames: Object.fromEntries(Object.entries(blueprint.definitions).map(([token, value]) => [token, value.name])),
    notes,
    measures,
    notation: notationResult.notation,
  };

  const validation = validatePracticeChart(chart);
  if (!validation.valid) {
    throw new Error(`外部谱面 ${blueprint.songId} 校验失败：${validation.issues.join('；')}`);
  }
  return chart;
}

function isSong(value: unknown): value is Song {
  const candidate = value as Partial<Song>;
  return typeof candidate.id === 'string'
    && typeof candidate.title === 'string'
    && typeof candidate.artist === 'string'
    && typeof candidate.key === 'string'
    && typeof candidate.bpm === 'number'
    && (candidate.difficulty === 1 || candidate.difficulty === 2 || candidate.difficulty === 3)
    && (candidate.harmonicaType === 'diatonic' || candidate.harmonicaType === 'chromatic')
    && typeof candidate.genre === 'string'
    && typeof candidate.color === 'string'
    && typeof candidate.color2 === 'string';
}

export function mergeSongs(baseSongs: Song[], externalSongs: Song[]) {
  const byId = new Map(baseSongs.map((song) => [song.id, song]));
  externalSongs.forEach((song) => byId.set(song.id, song));
  return [...byId.values()];
}

export function findChartForSong(charts: PracticeChart[], songId: string) {
  return charts.find((chart) => chart.songId === songId) ?? null;
}

export async function loadPracticeSongPack(fetcher: typeof fetch = fetch): Promise<PracticeSongPack> {
  const response = await fetcher(PACK_URL, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`外部谱面加载失败：${response.status}`);
  const raw = await response.json() as RawPracticeSongPack;
  const songs = (raw.songs ?? []).filter(isSong);
  const charts = (raw.charts ?? []).map(createPracticeChartFromPack);
  return { songs, charts };
}
