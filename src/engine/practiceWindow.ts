export type PracticeRange = 'full' | 'firstHalf' | 'secondHalf' | 'custom';

export function getPracticeWindow(
  totalMeasures: number,
  range: PracticeRange,
  repeatCount: number,
  customStartMeasure = 0,
  customEndMeasure = totalMeasures,
  measureBeats = 4,
) {
  const safeMeasures = Math.max(1, totalMeasures);
  const safeMeasureBeats = Number.isFinite(measureBeats) && measureBeats > 0 ? measureBeats : 4;
  const splitMeasure = Math.ceil(safeMeasures / 2);
  const safeCustomStart = Math.max(0, Math.min(safeMeasures - 1, Math.floor(customStartMeasure)));
  const safeCustomEnd = Math.max(safeCustomStart + 1, Math.min(safeMeasures, Math.floor(customEndMeasure)));
  const startMeasure = range === 'custom' ? safeCustomStart : range === 'secondHalf' ? splitMeasure : 0;
  const endMeasure = range === 'custom' ? safeCustomEnd : range === 'firstHalf' ? splitMeasure : safeMeasures;
  const startBeat = startMeasure * safeMeasureBeats;
  const endBeat = endMeasure * safeMeasureBeats;
  const segmentBeats = Math.max(safeMeasureBeats, endBeat - startBeat);
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
