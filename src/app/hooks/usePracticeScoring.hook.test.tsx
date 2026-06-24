import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { calculateAccuracy, usePracticeScoring } from './usePracticeScoring';
import type { NotePracticeResult } from '../types';

const baseResult: NotePracticeResult = {
  loopIndex: 0,
  beat: 0,
  measure: 1,
  noteNumber: '1',
  hole: 4,
  breath: 'blow',
  judgment: 'Perfect',
  centsDifference: 0,
  detectedNote: 'C4',
  timingDifferenceMs: 0,
  stabilityCents: 5,
};

describe('usePracticeScoring', () => {
  it('records score, combo, counts and note results', () => {
    const { result } = renderHook(() => usePracticeScoring());

    act(() => result.current.recordJudgment(baseResult));
    expect(result.current.score).toBe(100);
    expect(result.current.combo).toBe(1);
    expect(result.current.counts.perfect).toBe(1);
    expect(result.current.feedback).toBe('Perfect');
    expect(result.current.noteResultsRef.current).toHaveLength(1);

    act(() => result.current.recordJudgment({ ...baseResult, beat: 1, judgment: 'Bad' }));
    expect(result.current.score).toBe(120);
    expect(result.current.combo).toBe(0);
    expect(result.current.counts.bad).toBe(1);
    expect(result.current.maxComboRef.current).toBe(1);
  });

  it('resets scoring state and refs', () => {
    const { result } = renderHook(() => usePracticeScoring());
    act(() => {
      result.current.scoredRef.current.add('0:0:1');
      result.current.recordJudgment(baseResult);
      result.current.resetScoring();
    });
    expect(result.current.score).toBe(0);
    expect(result.current.combo).toBe(0);
    expect(result.current.scoredRef.current.size).toBe(0);
    expect(result.current.noteResultsRef.current).toHaveLength(0);
  });
});

describe('calculateAccuracy', () => {
  it('uses weighted accuracy and handles empty totals', () => {
    expect(calculateAccuracy({ perfect: 1, great: 1, good: 1, bad: 1, miss: 1 })).toBe(52);
    expect(calculateAccuracy({ perfect: 0, great: 0, good: 0, bad: 0, miss: 0 })).toBe(100);
    expect(calculateAccuracy({ perfect: 0, great: 0, good: 0, bad: 0, miss: 0 }, 0)).toBe(0);
  });
});
