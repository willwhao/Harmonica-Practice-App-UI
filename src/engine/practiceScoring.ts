import type { NoteJudgment } from '../app/types';

export interface JudgmentCounts {
  perfect: number;
  great: number;
  good: number;
  bad: number;
  miss: number;
}

export const EMPTY_JUDGMENT_COUNTS: JudgmentCounts = {
  perfect: 0,
  great: 0,
  good: 0,
  bad: 0,
  miss: 0,
};

export const SCORE_TABLE: Record<NoteJudgment, number> = {
  Perfect: 100,
  Great: 80,
  Good: 60,
  Bad: 20,
  Miss: 0,
};

export function calculateAccuracy(counts: JudgmentCounts, total?: number) {
  const denominator = total ?? counts.perfect + counts.great + counts.good + counts.bad + counts.miss;
  if (denominator <= 0) return total === undefined ? 100 : 0;
  return Math.round(((counts.perfect + counts.great * 0.9 + counts.good * 0.7) / denominator) * 100);
}

export function nextCombo(currentCombo: number, judgment: NoteJudgment) {
  return judgment === 'Miss' || judgment === 'Bad' ? 0 : currentCombo + 1;
}

export function addJudgmentCount(counts: JudgmentCounts, judgment: NoteJudgment): JudgmentCounts {
  const key = judgment.toLowerCase() as keyof JudgmentCounts;
  return {
    ...counts,
    [key]: counts[key] + 1,
  };
}
