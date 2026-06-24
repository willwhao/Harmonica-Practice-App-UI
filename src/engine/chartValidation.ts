import type { PracticeChart, PracticeNote } from '../app/data/practiceCharts';

export interface ChartValidationResult {
  valid: boolean;
  issues: string[];
}

type LegacyPracticeNote = Omit<PracticeNote, 'durationBeats' | 'technique'> & {
  durationBeats?: number;
  technique?: PracticeNote['technique'];
};

type LegacyPracticeChart = Omit<PracticeChart, 'schemaVersion' | 'source' | 'notes'> & {
  schemaVersion?: 1;
  notes: LegacyPracticeNote[];
};

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
    if (!Number.isFinite(note.durationBeats) || note.durationBeats <= 0) issues.push(`音符 ${index} 的 durationBeats 无效`);
    if (note.beat + note.durationBeats > chart.totalBeats) issues.push(`音符 ${index} 的长音越过谱面结尾`);
    if (note.beat <= previousBeat) issues.push(`音符 ${index} 未按 beat 严格递增`);
    if (note.hole < 1 || note.hole > (chart.harmonicaType === 'chromatic' ? 12 : 10)) issues.push(`音符 ${index} 的孔位无效`);
    const expectedTrack = note.hole - 1;
    if (note.track !== expectedTrack) issues.push(`音符 ${index} 的轨道必须与孔位一致`);
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
