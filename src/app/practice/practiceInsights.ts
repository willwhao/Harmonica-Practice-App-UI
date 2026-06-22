import type { NoteJudgment, NotePracticeResult, WeakMeasureSummary } from '../types';

const JUDGMENT_ORDER: NoteJudgment[] = ['Perfect', 'Great', 'Good', 'Bad', 'Miss'];

export function adjustJudgment(judgment: NoteJudgment, timingDifferenceMs: number | null, stabilityCents: number | null) {
  if (judgment === 'Miss') return judgment;
  const timingPenalty = timingDifferenceMs !== null && Math.abs(timingDifferenceMs) > 180 ? 1 : 0;
  const stabilityPenalty = stabilityCents !== null && stabilityCents > 35 ? 1 : 0;
  const currentIndex = JUDGMENT_ORDER.indexOf(judgment);
  return JUDGMENT_ORDER[Math.min(JUDGMENT_ORDER.length - 1, currentIndex + timingPenalty + stabilityPenalty)];
}

export function summarizeTimingAndStability(results: NotePracticeResult[]) {
  const timing = results.map((item) => item.timingDifferenceMs).filter((value): value is number => value !== null);
  const stability = results.map((item) => item.stabilityCents).filter((value): value is number => value !== null);
  return {
    averageTimingDeviationMs: timing.length ? Math.round(timing.reduce((total, value) => total + Math.abs(value), 0) / timing.length) : null,
    earlyNotes: timing.filter((value) => value < -80).length,
    lateNotes: timing.filter((value) => value > 80).length,
    averageStabilityCents: stability.length ? Math.round(stability.reduce((total, value) => total + value, 0) / stability.length) : null,
  };
}

export function summarizeWeakMeasures(results: NotePracticeResult[]): WeakMeasureSummary[] {
  const grouped = new Map<number, NotePracticeResult[]>();
  results.forEach((result) => {
    const items = grouped.get(result.measure) ?? [];
    items.push(result);
    grouped.set(result.measure, items);
  });

  return [...grouped.entries()].map(([measure, items]) => {
    const errors = items.filter((item) => item.judgment === 'Bad' || item.judgment === 'Miss').length;
    const cents = items.map((item) => item.centsDifference).filter((value): value is number => value !== null);
    return {
      measure,
      errors,
      total: items.length,
      averageCents: cents.length ? Math.round(cents.reduce((total, value) => total + Math.abs(value), 0) / cents.length) : null,
    };
  }).sort((a, b) => b.errors / b.total - a.errors / a.total || (b.averageCents ?? 0) - (a.averageCents ?? 0));
}

export function getWeakestMeasure(results: NotePracticeResult[]) {
  return summarizeWeakMeasures(results).find((item) => item.errors > 0) ?? null;
}
