import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getSessionPlayback, usePracticeSession } from './usePracticeSession';

describe('usePracticeSession', () => {
  it('starts, pauses and resumes a practice clock', () => {
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(1000);
    const { result } = renderHook(() => usePracticeSession());

    act(() => result.current.startSession());
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.displayTime).toBe(0);
    expect(result.current.gameTimeRef.current).toBe(0);
    expect(result.current.startRef.current).toBe(1000);

    act(() => result.current.pauseSession());
    expect(result.current.isPlaying).toBe(false);

    act(() => {
      result.current.gameTimeRef.current = 2.5;
      now.mockReturnValue(5000);
      result.current.resumeSession();
    });
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.startRef.current).toBe(2500);

    now.mockRestore();
  });

  it('advances elapsed time and derives segmented playback state', () => {
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(1000);
    const { result } = renderHook(() => usePracticeSession());

    act(() => result.current.startSession());
    now.mockReturnValue(2500);

    act(() => {
      const snapshot = result.current.advanceSession(2500, 0.5);
      expect(snapshot).toEqual({ elapsed: 1.5, playbackBeat: 3 });
    });

    expect(result.current.displayTime).toBe(1.5);
    expect(result.current.gameTimeRef.current).toBe(1.5);

    now.mockRestore();
  });
});

describe('getSessionPlayback', () => {
  it('maps display time into the active practice loop and progress', () => {
    const playback = getSessionPlayback(5, 0.5, {
      startMeasure: 1,
      endMeasure: 3,
      startBeat: 4,
      endBeat: 12,
      segmentBeats: 8,
      repeatCount: 2,
      totalPlaybackBeats: 16,
    });

    expect(playback.playbackBeatFloat).toBe(10);
    expect(playback.playbackPosition.loopIndex).toBe(1);
    expect(playback.playbackPosition.beatWithinLoop).toBe(2);
    expect(playback.currentBeatFloat).toBe(6);
    expect(playback.currentBeatInt).toBe(6);
    expect(playback.progressPct).toBe(62.5);
  });
});
