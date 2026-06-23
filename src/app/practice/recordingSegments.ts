import type { NotePracticeResult, PracticeErrorSegment } from '../types';

export function buildRecordingErrorSegments({
  results,
  beatDurationSec,
  startBeat,
  segmentBeats,
}: {
  results: NotePracticeResult[];
  beatDurationSec: number;
  startBeat: number;
  segmentBeats: number;
}): PracticeErrorSegment[] {
  return results
    .filter((item) => item.judgment === 'Bad' || item.judgment === 'Miss')
    .slice(0, 8)
    .map((item, index) => {
      const playbackBeat = item.loopIndex * segmentBeats + (item.beat - startBeat);
      const centerMs = playbackBeat * beatDurationSec * 1000;
      const startMs = Math.max(0, Math.round(centerMs - 550));
      const endMs = Math.round(centerMs + 1250);
      const breath = item.breath === 'blow' ? '吹' : '吸';
      const reason = item.judgment === 'Miss'
        ? '未识别到目标音'
        : item.centsDifference === null
          ? '音准或起音不稳定'
          : `音准偏差 ${item.centsDifference > 0 ? '+' : ''}${item.centsDifference}¢`;
      return {
        id: `${item.loopIndex}-${item.beat}-${item.hole}-${index}`,
        label: `第 ${item.measure} 小节 · ${item.noteNumber} · ${item.hole}孔${breath}`,
        startMs,
        endMs,
        reason,
      };
    });
}
