import { useCallback, useEffect, useRef } from 'react';
import type { PracticeSettings } from '../types';

const CHORDS = [
  [130.81, 164.81, 196],
  [174.61, 220, 261.63],
  [196, 246.94, 293.66],
  [130.81, 164.81, 196],
];

export function useGuideAccompaniment(volume = 70) {
  const contextRef = useRef<AudioContext | null>(null);
  const volumeRef = useRef(volume);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const prepare = useCallback(async () => {
    const AudioContextClass = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return false;
    const context = contextRef.current ?? new AudioContextClass();
    contextRef.current = context;
    if (context.state === 'suspended') await context.resume();
    return context.state === 'running';
  }, []);

  const playBeat = useCallback((chartBeat: number, beatDuration: number, mode: PracticeSettings['accompaniment']) => {
    const context = contextRef.current;
    if (!context || context.state !== 'running' || mode === 'none') return;
    const beatInMeasure = ((Math.floor(chartBeat) % 4) + 4) % 4;
    const measure = Math.floor(chartBeat / 4);
    const chord = CHORDS[((measure % CHORDS.length) + CHORDS.length) % CHORDS.length];
    const frequencies = mode === 'simplified' ? [chord[0]] : beatInMeasure === 0 ? chord : [chord[0]];
    const duration = Math.max(0.08, Math.min(beatDuration * (beatInMeasure === 0 ? 0.78 : 0.22), 0.8));
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = mode === 'simplified' ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      const scalar = Math.max(0, Math.min(1, volumeRef.current / 100));
      const baseVolume = mode === 'simplified' ? 0.035 : 0.022 / Math.max(1, frequencies.length / 2);
      gain.gain.setValueAtTime(baseVolume * scalar, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(context.currentTime + index * 0.004);
      oscillator.stop(context.currentTime + duration + index * 0.004);
    });
  }, []);

  const stop = useCallback(() => {
    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== 'closed') void context.close();
  }, []);

  useEffect(() => stop, [stop]);
  return { prepare, playBeat, stop };
}
