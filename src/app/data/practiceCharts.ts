import { migrateChart as migrateEngineChart, validatePracticeChart as validateEnginePracticeChart } from '../../engine/chartValidation.ts';

export type BreathDirection = 'blow' | 'draw';
export type HarmonicaKind = 'diatonic' | 'chromatic';
export type HarmonicaTechnique = 'natural' | 'bend-half' | 'bend-whole' | 'overblow' | 'slide';

export interface PracticeNote {
  beat: number;
  durationBeats: number;
  track: number;
  number: string;
  type: BreathDirection;
  hole: number;
  technique: HarmonicaTechnique;
  lyric?: string;
}

export type ScoreNotationTokenKind = 'note' | 'rest' | 'hold' | 'section';
export type ScoreNotationOctave = 'high' | 'low';

export interface ScoreNotationToken {
  id: string;
  kind: ScoreNotationTokenKind;
  text: string;
  note?: string;
  lyric?: string;
  startBeat?: number;
  durationBeats?: number;
  underline?: 0 | 1 | 2;
  octave?: ScoreNotationOctave;
  suffix?: string;
  slur?: boolean;
}

export interface ScoreNotationMeasure {
  id: string;
  section?: string;
  startBeat: number;
  endBeat: number;
  tokens: ScoreNotationToken[];
}

export interface ScoreNotationLine {
  id: string;
  startBeat: number;
  endBeat: number;
  measures: ScoreNotationMeasure[];
}

export interface ScoreNotation {
  beatsPerMeasure: number;
  lines: ScoreNotationLine[];
}

export interface ScoreBeat {
  n: string;
  t: BreathDirection | 'rest';
  durationBeats?: number;
  technique?: HarmonicaTechnique;
  lyric?: string;
}

export interface PracticeChart {
  schemaVersion: 2;
  id: string;
  songId: string;
  title: string;
  version: number;
  harmonicaType: HarmonicaKind;
  key: string;
  source: 'practice-arrangement';
  totalBeats: number;
  lookAheadBeats: number;
  measureBeats?: number;
  noteFrequencies: Record<string, number>;
  noteNames: Record<string, string>;
  notes: PracticeNote[];
  measures: ScoreBeat[][];
  notation?: ScoreNotation;
}

export interface ChartValidationResult {
  valid: boolean;
  issues: string[];
}

interface NoteDefinition {
  frequency: number;
  name: string;
  track: number;
  hole: number;
  type: BreathDirection;
  technique?: HarmonicaTechnique;
}

interface ChartBlueprint {
  songId: string;
  title: string;
  key: string;
  harmonicaType: HarmonicaKind;
  definitions: Record<string, NoteDefinition>;
  measures: string[][];
  lyrics?: string[][];
}

type LegacyPracticeNote = Omit<PracticeNote, 'durationBeats' | 'technique'> & {
  durationBeats?: number;
  technique?: HarmonicaTechnique;
};

type LegacyPracticeChart = Omit<PracticeChart, 'schemaVersion' | 'source' | 'notes'> & {
  schemaVersion?: 1;
  notes: LegacyPracticeNote[];
};

const REST = '-';

function parseScoreToken(token: string) {
  if (token === REST) return { number: REST, durationBeats: 1 };
  const [number, durationRaw] = token.split(':');
  const durationBeats = durationRaw ? Number(durationRaw) : 1;
  if (!number || !Number.isFinite(durationBeats) || durationBeats <= 0) {
    throw new Error(`谱面 token ${token} 的格式无效`);
  }
  return { number, durationBeats };
}

function createChart(blueprint: ChartBlueprint): PracticeChart {
  const scoreMeasures = blueprint.measures.map((measure, measureIndex) => measure.map((token, beatIndex): ScoreBeat => {
    const parsed = parseScoreToken(token);
    const lyric = blueprint.lyrics?.[measureIndex]?.[beatIndex];
    if (parsed.number === REST) return { n: REST, t: 'rest', durationBeats: parsed.durationBeats, lyric };
    const definition = blueprint.definitions[parsed.number];
    if (!definition) throw new Error(`谱面 ${blueprint.songId} 使用了未定义音符 ${parsed.number}`);
    return { n: parsed.number, t: definition.type, durationBeats: parsed.durationBeats, technique: definition.technique ?? 'natural', lyric };
  }));
  const notes = blueprint.measures.flatMap((measure, measureIndex) => measure.flatMap((token, beatIndex) => {
    const parsed = parseScoreToken(token);
    if (parsed.number === REST) return [];
    const definition = blueprint.definitions[parsed.number];
    return [{
      beat: measureIndex * 4 + beatIndex,
      durationBeats: parsed.durationBeats,
      track: definition.track,
      number: parsed.number,
      type: definition.type,
      hole: definition.hole,
      technique: definition.technique ?? 'natural',
      lyric: blueprint.lyrics?.[measureIndex]?.[beatIndex],
    }];
  }));
  return {
    schemaVersion: 2,
    id: `song-${blueprint.songId}-practice-v2`,
    songId: blueprint.songId,
    title: blueprint.title,
    version: 2,
    harmonicaType: blueprint.harmonicaType,
    key: blueprint.key,
    source: 'practice-arrangement',
    totalBeats: blueprint.measures.length * 4,
    lookAheadBeats: 5,
    noteFrequencies: Object.fromEntries(Object.entries(blueprint.definitions).map(([token, value]) => [token, value.frequency])),
    noteNames: Object.fromEntries(Object.entries(blueprint.definitions).map(([token, value]) => [token, value.name])),
    notes,
    measures: scoreMeasures,
  };
}

export function validatePracticeChart(chart: PracticeChart): ChartValidationResult {
  return validateEnginePracticeChart(chart);
}

export function migrateChart(input: PracticeChart | LegacyPracticeChart): PracticeChart {
  return migrateEngineChart(input);
}

const C_DIATONIC: Record<string, NoteDefinition> = {
  '1': { frequency: 261.63, name: 'C4', track: 3, hole: 4, type: 'blow' },
  '2': { frequency: 293.66, name: 'D4', track: 3, hole: 4, type: 'draw' },
  '3': { frequency: 329.63, name: 'E4', track: 4, hole: 5, type: 'blow' },
  '4': { frequency: 349.23, name: 'F4', track: 4, hole: 5, type: 'draw' },
  '5': { frequency: 392, name: 'G4', track: 5, hole: 6, type: 'blow' },
  '6': { frequency: 440, name: 'A4', track: 5, hole: 6, type: 'draw' },
  '7': { frequency: 493.88, name: 'B4', track: 6, hole: 7, type: 'draw' },
  '1̇': { frequency: 523.25, name: 'C5', track: 6, hole: 7, type: 'blow' },
  '♭3': { frequency: 311.13, name: 'D#4', track: 2, hole: 3, type: 'draw', technique: 'bend-half' },
};

const G_DIATONIC: Record<string, NoteDefinition> = {
  '1': { frequency: 196, name: 'G3', track: 2, hole: 3, type: 'blow' },
  '2': { frequency: 220, name: 'A3', track: 2, hole: 3, type: 'draw' },
  '3': { frequency: 246.94, name: 'B3', track: 3, hole: 4, type: 'blow' },
  '4': { frequency: 261.63, name: 'C4', track: 3, hole: 4, type: 'draw' },
  '5': { frequency: 293.66, name: 'D4', track: 4, hole: 5, type: 'blow' },
  '6': { frequency: 329.63, name: 'E4', track: 4, hole: 5, type: 'draw' },
  '7': { frequency: 369.99, name: 'F#4', track: 5, hole: 6, type: 'draw' },
  '1̇': { frequency: 392, name: 'G4', track: 5, hole: 6, type: 'blow' },
};

const F_DIATONIC: Record<string, NoteDefinition> = {
  '1': { frequency: 174.61, name: 'F3', track: 2, hole: 3, type: 'blow' },
  '2': { frequency: 196, name: 'G3', track: 2, hole: 3, type: 'draw' },
  '3': { frequency: 220, name: 'A3', track: 3, hole: 4, type: 'blow' },
  '4': { frequency: 233.08, name: 'A#3', track: 3, hole: 4, type: 'draw' },
  '5': { frequency: 261.63, name: 'C4', track: 4, hole: 5, type: 'blow' },
  '6': { frequency: 293.66, name: 'D4', track: 4, hole: 5, type: 'draw' },
  '7': { frequency: 329.63, name: 'E4', track: 5, hole: 6, type: 'draw' },
  '1̇': { frequency: 349.23, name: 'F4', track: 5, hole: 6, type: 'blow' },
};

const D_CHROMATIC: Record<string, NoteDefinition> = {
  '1': { frequency: 293.66, name: 'D4', track: 0, hole: 1, type: 'blow' },
  '2': { frequency: 329.63, name: 'E4', track: 0, hole: 1, type: 'draw' },
  '3': { frequency: 369.99, name: 'F#4', track: 1, hole: 2, type: 'blow', technique: 'slide' },
  '4': { frequency: 392, name: 'G4', track: 1, hole: 2, type: 'draw' },
  '5': { frequency: 440, name: 'A4', track: 2, hole: 3, type: 'blow' },
  '6': { frequency: 493.88, name: 'B4', track: 2, hole: 3, type: 'draw' },
  '7': { frequency: 554.37, name: 'C#5', track: 3, hole: 4, type: 'draw', technique: 'slide' },
  '1̇': { frequency: 587.33, name: 'D5', track: 3, hole: 4, type: 'blow' },
};

const BLUEPRINTS: ChartBlueprint[] = [
  { songId: '1', title: '天空之城·主题练习编配', key: 'C', harmonicaType: 'diatonic', definitions: C_DIATONIC, measures: [
    ['3','3','4','5:2'], ['-','4','3','2'], ['1','2','3','5'], ['4','3','2:2','-'],
    ['3','4','5','6:2'], ['-','3','2','1'], ['2','3','4','2'], ['1:3','-','-','-'],
    ['5','6','1̇:2','6'], ['5','4','3','2'], ['3','5','4','2'], ['1:3','-','-','-'],
  ] },
  { songId: '2', title: '月亮代表我的心·旋律练习编配', key: 'G', harmonicaType: 'diatonic', definitions: G_DIATONIC, measures: [
    ['1','3','5','5:2'], ['6','5','3','2'], ['1','2','3','5'], ['3:2','-','2','-'],
    ['3','5','6','1̇:2'], ['7','6','5','3'], ['2','3','2','1'], ['1:3','-','-','-'],
    ['5','5','6','5'], ['3','2','1','2'], ['3','5','3','2'], ['1:3','-','-','-'],
  ] },
  { songId: '3', title: '童年·节奏练习编配', key: 'C', harmonicaType: 'diatonic', definitions: C_DIATONIC, measures: [
    ['1','1','3','3'], ['5','5','3:2','-'], ['2','2','4','4'], ['6','6','5:2','-'],
    ['3','3','4','5'], ['5','4','3','2'], ['1','3','2','4'], ['3','-','-','-'],
    ['5','6','5','3'], ['4','5','4','2'], ['3','4','5','2'], ['1:3','-','-','-'],
  ] },
  { songId: '4', title: '让我们荡起双桨·换气练习编配', key: 'F', harmonicaType: 'diatonic', definitions: F_DIATONIC, measures: [
    ['5','5','6','5'], ['3','2','1:2','-'], ['2','3','4','5'], ['6:2','5','-','-'],
    ['5','6','1̇','6'], ['5','4','3','2'], ['3','4','5','3'], ['2:3','-','-','-'],
    ['1','2','3','5'], ['4','3','2','1'], ['2','3','5','6'], ['5:3','-','-','-'],
  ] },
  { songId: '5', title: 'Amazing Grace·长音控制编配', key: 'G', harmonicaType: 'diatonic', definitions: G_DIATONIC, measures: [
    ['1:2','3','5:2','-'], ['3','5','6:3','-'], ['5','6','1̇:2','6'], ['5:3','-','-','-'],
    ['3:2','5','6','-'], ['5','3','2:2','-'], ['1','3','5','3'], ['1:3','-','-','-'],
    ['5:2','6','1̇','-'], ['6','5','3','2'], ['1','2','3','5'], ['3:3','-','-','-'],
  ] },
  { songId: '6', title: '外婆的澎湖湾·切分节奏编配', key: 'C', harmonicaType: 'diatonic', definitions: C_DIATONIC, measures: [
    ['3','3','5','6'], ['5','3','2:2','-'], ['1','2','3','5'], ['6','5','3','2'],
    ['3','5','6','1̇'], ['6','5','3','2'], ['1','2','3','2'], ['1:3','-','-','-'],
    ['5','5','6','5'], ['3','2','1','2'], ['3','4','5','3'], ['2:3','-','-','-'],
  ] },
  { songId: '7', title: '故乡的原风景·半音阶技巧练习', key: 'D', harmonicaType: 'chromatic', definitions: D_CHROMATIC, measures: [
    ['1','2','3','5:2'], ['4','3','2','1'], ['3','4','5','6'], ['5:2','-','4','-'],
    ['5','6','7','1̇:2'], ['7','6','5','3'], ['4','3','2','1'], ['1:3','-','-','-'],
  ] },
  { songId: '8', title: '夜空中最亮的星·高音区练习编配', key: 'G', harmonicaType: 'diatonic', definitions: G_DIATONIC, measures: [
    ['5','6','1̇','1̇:2'], ['7','6','5','3'], ['3','5','6','5'], ['3:2','2','-','-'],
    ['1','2','3','5'], ['6','5','3','2'], ['3','5','6','1̇'], ['6:3','-','-','-'],
    ['5','6','1̇','7'], ['6','5','3','2'], ['1','3','5','6'], ['5:3','-','-','-'],
  ] },
];

const CHARTS: Record<string, PracticeChart> = Object.fromEntries(BLUEPRINTS.map((blueprint) => {
  const chart = createChart(blueprint);
  const validation = validatePracticeChart(chart);
  if (!validation.valid) throw new Error(`谱面 ${chart.id} 校验失败：${validation.issues.join('；')}`);
  return [chart.songId, chart];
}));

const FOUNDATION_CHART = CHARTS['1'];

export function getPracticeChart(songId: string) {
  const chart = CHARTS[songId];
  return { chart: chart ?? FOUNDATION_CHART, isFallback: !chart };
}

export function getAvailablePracticeCharts() {
  return Object.values(CHARTS);
}
