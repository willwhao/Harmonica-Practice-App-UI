import type { PracticeChart, PracticeNote, ScoreBeat } from '../app/data/practiceCharts';

export interface VisibleScoreBeat {
  beat: ScoreBeat;
  absoluteBeat: number;
  measure: number;
  beatInMeasure: number;
}

export function getHarmonicaTrackCount(harmonicaType: PracticeChart['harmonicaType']) {
  return harmonicaType === 'chromatic' ? 12 : 10;
}

export function getNoteTrackIndex(note: Pick<PracticeNote, 'hole'>) {
  return note.hole - 1;
}

export function getVisibleTraditionalScore(
  measures: ScoreBeat[][],
  currentBeat: number,
  beatsPerLine = 8,
): [VisibleScoreBeat[], VisibleScoreBeat[]] {
  const currentMeasure = Math.max(0, Math.floor(currentBeat / 4));
  const startMeasure = Math.max(0, Math.min(Math.max(0, measures.length - 4), currentMeasure - 1));
  const startBeat = startMeasure * 4;
  const beats = Array.from({ length: beatsPerLine * 2 }, (_, index) => {
    const absoluteBeat = startBeat + index;
    const measure = Math.floor(absoluteBeat / 4);
    const beatInMeasure = absoluteBeat % 4;
    return {
      absoluteBeat,
      measure,
      beatInMeasure,
      beat: measures[measure]?.[beatInMeasure] ?? { n: '-', t: 'rest' as const },
    };
  });
  return [beats.slice(0, beatsPerLine), beats.slice(beatsPerLine)];
}

export function getFallingNoteGeometry({
  note,
  currentBeat,
  judgmentY,
  beatHeight,
  trackWidth,
}: {
  note: Pick<PracticeNote, 'beat' | 'durationBeats' | 'hole'>;
  currentBeat: number;
  judgmentY: number;
  beatHeight: number;
  trackWidth: number;
}) {
  const beatsUntilStart = note.beat - currentBeat;
  const startY = judgmentY - beatsUntilStart * beatHeight;
  const durationHeight = Math.max(24, note.durationBeats * beatHeight);
  const centerX = (getNoteTrackIndex(note) + 0.5) * trackWidth;
  return { startY, durationHeight, centerX };
}
