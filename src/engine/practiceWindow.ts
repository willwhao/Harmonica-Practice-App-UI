export type PracticeRange = 'full' | 'firstHalf' | 'secondHalf' | 'custom';

export function getPracticeWindow(
  totalMeasures: number,
  range: PracticeRange,
  repeatCount: number,
  customStartMeasure = 0,
  customEndMeasure = totalMeasures,
) {
  const safeMeasures = Math.max(1, totalMeasures);
  const splitMeasure = Math.ceil(safeMeasures / 2);
  const safeCustomStart = Math.max(0, Math.min(safeMeasures - 1, Math.floor(customStartMeasure)));
  const safeCustomEnd = Math.max(safeCustomStart + 1, Math.min(safeMeasures, Math.floor(customEndMeasure)));
  const startMeasure = range === 'custom' ? safeCustomStart : range === 'secondHalf' ? splitMeasure : 0;
  const endMeasure = range === 'custom' ? safeCustomEnd : range === 'firstHalf' ? splitMeasure : safeMeasures;
  const startBeat = startMeasure * 4;
  const endBeat = endMeasure * 4;
  const segmentBeats = Math.max(4, endBeat - startBeat);
  return {
    startMeasure,
    endMeasure,
    startBeat,
    endBeat,
    segmentBeats,
    repeatCount,
    totalPlaybackBeats: segmentBeats * repeatCount,
  };
}

export function getPlaybackPosition(playbackBeat: number, startBeat: number, segmentBeats: number, repeatCount: number) {
  const safePlaybackBeat = Math.max(0, playbackBeat);
  const loopIndex = Math.min(repeatCount - 1, Math.floor(safePlaybackBeat / segmentBeats));
  const beatWithinLoop = safePlaybackBeat >= segmentBeats * repeatCount
    ? segmentBeats
    : safePlaybackBeat - loopIndex * segmentBeats;
  return {
    loopIndex,
    beatWithinLoop,
    chartBeat: startBeat + beatWithinLoop,
  };
}
