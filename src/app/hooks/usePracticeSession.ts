import { useCallback, useRef, useState } from 'react';
import { getPlaybackPosition, type getPracticeWindow } from '../../engine/practiceWindow';

type PracticeWindow = ReturnType<typeof getPracticeWindow>;

export function getSessionPlayback(displayTime: number, beatDurationSec: number, practiceWindow: PracticeWindow) {
  const playbackBeatFloat = displayTime / beatDurationSec;
  const playbackPosition = getPlaybackPosition(
    playbackBeatFloat,
    practiceWindow.startBeat,
    practiceWindow.segmentBeats,
    practiceWindow.repeatCount,
  );
  return {
    playbackBeatFloat,
    playbackPosition,
    currentBeatFloat: playbackPosition.chartBeat,
    currentBeatInt: Math.floor(playbackPosition.chartBeat),
    progressPct: Math.min(100, (playbackBeatFloat / practiceWindow.totalPlaybackBeats) * 100),
  };
}

export function usePracticeSession() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);
  const gameTimeRef = useRef(0);
  const startRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);

  const startSession = useCallback(() => {
    gameTimeRef.current = 0;
    setDisplayTime(0);
    startRef.current = performance.now();
    setIsPlaying(true);
  }, []);

  const resumeSession = useCallback(() => {
    startRef.current = performance.now() - gameTimeRef.current * 1000;
    setIsPlaying(true);
  }, []);

  const pauseSession = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const advanceSession = useCallback((now: number, beatDurationSec: number) => {
    const elapsed = (now - startRef.current) / 1000;
    gameTimeRef.current = elapsed;
    setDisplayTime(elapsed);
    return {
      elapsed,
      playbackBeat: elapsed / beatDurationSec,
    };
  }, []);

  const getPlaybackSnapshot = useCallback(
    (beatDurationSec: number, practiceWindow: PracticeWindow) => getSessionPlayback(displayTime, beatDurationSec, practiceWindow),
    [displayTime],
  );

  return {
    isPlaying,
    displayTime,
    gameTimeRef,
    startRef,
    rafRef,
    setDisplayTime,
    startSession,
    resumeSession,
    pauseSession,
    advanceSession,
    getPlaybackSnapshot,
  };
}
