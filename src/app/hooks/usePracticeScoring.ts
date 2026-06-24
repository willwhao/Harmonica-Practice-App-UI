import { useCallback, useRef, useState } from 'react';
import type { NoteJudgment, NotePracticeResult } from '../types';
import {
  addJudgmentCount,
  EMPTY_JUDGMENT_COUNTS,
  nextCombo,
  SCORE_TABLE,
  type JudgmentCounts,
} from '../../engine/practiceScoring';

export { calculateAccuracy, type JudgmentCounts } from '../../engine/practiceScoring';

export function usePracticeScoring() {
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [counts, setCounts] = useState<JudgmentCounts>(EMPTY_JUDGMENT_COUNTS);
  const [feedback, setFeedback] = useState<NoteJudgment | null>(null);
  const [feedbackKey, setFeedbackKey] = useState(0);
  const scoredRef = useRef(new Set<string>());
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const countsRef = useRef<JudgmentCounts>({ ...EMPTY_JUDGMENT_COUNTS });
  const noteResultsRef = useRef<NotePracticeResult[]>([]);

  const resetScoring = useCallback(() => {
    scoredRef.current.clear();
    scoreRef.current = 0;
    comboRef.current = 0;
    maxComboRef.current = 0;
    countsRef.current = { ...EMPTY_JUDGMENT_COUNTS };
    noteResultsRef.current = [];
    setScore(0);
    setCombo(0);
    setCounts({ ...EMPTY_JUDGMENT_COUNTS });
    setFeedback(null);
    setFeedbackKey(0);
  }, []);

  const recordJudgment = useCallback((result: NotePracticeResult) => {
    noteResultsRef.current.push(result);
    const points = SCORE_TABLE[result.judgment];
    scoreRef.current += points;
    comboRef.current = nextCombo(comboRef.current, result.judgment);
    if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current;
    countsRef.current = addJudgmentCount(countsRef.current, result.judgment);

    setScore(scoreRef.current);
    setCombo(comboRef.current);
    setCounts({ ...countsRef.current });
    setFeedback(result.judgment);
    setFeedbackKey((current) => current + 1);
  }, []);

  return {
    score,
    combo,
    counts,
    feedback,
    feedbackKey,
    scoredRef,
    scoreRef,
    comboRef,
    maxComboRef,
    countsRef,
    noteResultsRef,
    resetScoring,
    recordJudgment,
  };
}
