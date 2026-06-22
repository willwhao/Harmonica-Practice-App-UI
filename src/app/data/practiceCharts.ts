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
}

export interface ScoreBeat {
  n: string;
  t: BreathDirection | 'rest';
  technique?: HarmonicaTechnique;
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
  noteFrequencies: Record<string, number>;
  noteNames: Record<string, string>;
  notes: PracticeNote[];
  measures: ScoreBeat[][];
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

function createChart(blueprint: ChartBlueprint): PracticeChart {
  const scoreMeasures = blueprint.measures.map((measure) => measure.map((token): ScoreBeat => {
    if (token === REST) return { n: REST, t: 'rest' };
    const definition = blueprint.definitions[token];
    if (!definition) throw new Error(`谱面 ${blueprint.songId} 使用了未定义音符 ${token}`);
    return { n: token, t: definition.type, technique: definition.technique ?? 'natural' };
  }));
  const notes = blueprint.measures.flatMap((measure, measureIndex) => measure.flatMap((token, beatIndex) => {
    if (token === REST) return [];
    const definition = blueprint.definitions[token];
    return [{
      beat: measureIndex * 4 + beatIndex,
      durationBeats: 1,
      track: definition.track,
      number: token,
      type: definition.type,
      hole: definition.hole,
      technique: definition.technique ?? 'natural',
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
  const issues: string[] = [];
  if (chart.schemaVersion !== 2) issues.push('schemaVersion 必须为 2');
  if (!chart.id || !chart.songId || !chart.title) issues.push('id、songId 和 title 不能为空');
  if (!Number.isInteger(chart.version) || chart.version < 1) issues.push('version 必须为正整数');
  if (chart.measures.length === 0 || chart.measures.some((measure) => measure.length !== 4)) issues.push('每个谱面必须包含四拍小节');
  if (chart.totalBeats !== chart.measures.length * 4) issues.push('totalBeats 与小节数量不一致');
  let previousBeat = -1;
  chart.notes.forEach((note, index) => {
    if (note.beat < 0 || note.beat >= chart.totalBeats) issues.push(`音符 ${index} 的 beat 越界`);
    if (note.beat <= previousBeat) issues.push(`音符 ${index} 未按 beat 严格递增`);
    if (note.hole < 1 || note.hole > (chart.harmonicaType === 'chromatic' ? 12 : 10)) issues.push(`音符 ${index} 的孔位无效`);
    if (!chart.noteFrequencies[note.number] || !chart.noteNames[note.number]) issues.push(`音符 ${index} 缺少频率或音名映射`);
    if (chart.harmonicaType === 'diatonic' && note.technique === 'slide') issues.push(`十孔谱音符 ${index} 不能使用半音阶滑键`);
    previousBeat = note.beat;
  });
  return { valid: issues.length === 0, issues };
}

export function migrateChart(input: PracticeChart | LegacyPracticeChart): PracticeChart {
  if ('schemaVersion' in input && input.schemaVersion === 2) return input as PracticeChart;
  return {
    ...input,
    schemaVersion: 2,
    source: 'practice-arrangement',
    notes: input.notes.map((note) => ({ ...note, durationBeats: note.durationBeats ?? 1, technique: note.technique ?? 'natural' })),
  } as PracticeChart;
}

const C_DIATONIC: Record<string, NoteDefinition> = {
  '1': { frequency: 261.63, name: 'C4', track: 0, hole: 4, type: 'blow' },
  '2': { frequency: 293.66, name: 'D4', track: 1, hole: 4, type: 'draw' },
  '3': { frequency: 329.63, name: 'E4', track: 2, hole: 5, type: 'blow' },
  '4': { frequency: 349.23, name: 'F4', track: 3, hole: 5, type: 'draw' },
  '5': { frequency: 392, name: 'G4', track: 4, hole: 6, type: 'blow' },
  '6': { frequency: 440, name: 'A4', track: 5, hole: 6, type: 'draw' },
  '7': { frequency: 493.88, name: 'B4', track: 6, hole: 7, type: 'draw' },
  '1̇': { frequency: 523.25, name: 'C5', track: 6, hole: 7, type: 'blow' },
  '♭3': { frequency: 311.13, name: 'D#4', track: 2, hole: 3, type: 'draw', technique: 'bend-half' },
};

const G_DIATONIC: Record<string, NoteDefinition> = {
  '1': { frequency: 196, name: 'G3', track: 0, hole: 3, type: 'blow' },
  '2': { frequency: 220, name: 'A3', track: 1, hole: 3, type: 'draw' },
  '3': { frequency: 246.94, name: 'B3', track: 2, hole: 4, type: 'blow' },
  '4': { frequency: 261.63, name: 'C4', track: 3, hole: 4, type: 'draw' },
  '5': { frequency: 293.66, name: 'D4', track: 4, hole: 5, type: 'blow' },
  '6': { frequency: 329.63, name: 'E4', track: 5, hole: 5, type: 'draw' },
  '7': { frequency: 369.99, name: 'F#4', track: 6, hole: 6, type: 'draw' },
  '1̇': { frequency: 392, name: 'G4', track: 6, hole: 6, type: 'blow' },
};

const D_CHROMATIC: Record<string, NoteDefinition> = {
  '1': { frequency: 293.66, name: 'D4', track: 0, hole: 1, type: 'blow' },
  '2': { frequency: 329.63, name: 'E4', track: 1, hole: 1, type: 'draw' },
  '3': { frequency: 369.99, name: 'F#4', track: 2, hole: 2, type: 'blow', technique: 'slide' },
  '4': { frequency: 392, name: 'G4', track: 3, hole: 2, type: 'draw' },
  '5': { frequency: 440, name: 'A4', track: 4, hole: 3, type: 'blow' },
  '6': { frequency: 493.88, name: 'B4', track: 5, hole: 3, type: 'draw' },
  '7': { frequency: 554.37, name: 'C#5', track: 6, hole: 4, type: 'draw', technique: 'slide' },
  '1̇': { frequency: 587.33, name: 'D5', track: 6, hole: 4, type: 'blow' },
};

const BLUEPRINTS: ChartBlueprint[] = [
  { songId: '1', title: '天空之城·主题练习编配', key: 'C', harmonicaType: 'diatonic', definitions: C_DIATONIC, measures: [
    ['3','3','4','5'], ['5','4','3','2'], ['1','2','3','5'], ['4','3','2','-'],
    ['3','4','5','6'], ['5','3','2','1'], ['2','3','4','2'], ['1','-','-','-'],
    ['5','6','1̇','6'], ['5','4','3','2'], ['3','5','4','2'], ['1','-','-','-'],
  ] },
  { songId: '2', title: '月亮代表我的心·旋律练习编配', key: 'G', harmonicaType: 'diatonic', definitions: G_DIATONIC, measures: [
    ['1','3','5','5'], ['6','5','3','2'], ['1','2','3','5'], ['3','-','2','-'],
    ['3','5','6','1̇'], ['7','6','5','3'], ['2','3','2','1'], ['1','-','-','-'],
    ['5','5','6','5'], ['3','2','1','2'], ['3','5','3','2'], ['1','-','-','-'],
  ] },
  { songId: '3', title: '童年·节奏练习编配', key: 'C', harmonicaType: 'diatonic', definitions: C_DIATONIC, measures: [
    ['1','1','3','3'], ['5','5','3','-'], ['2','2','4','4'], ['6','6','5','-'],
    ['3','3','4','5'], ['5','4','3','2'], ['1','3','2','4'], ['3','-','-','-'],
    ['5','6','5','3'], ['4','5','4','2'], ['3','4','5','2'], ['1','-','-','-'],
  ] },
  { songId: '7', title: '故乡的原风景·半音阶技巧练习', key: 'D', harmonicaType: 'chromatic', definitions: D_CHROMATIC, measures: [
    ['1','2','3','5'], ['4','3','2','1'], ['3','4','5','6'], ['5','-','4','-'],
    ['5','6','7','1̇'], ['7','6','5','3'], ['4','3','2','1'], ['1','-','-','-'],
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
