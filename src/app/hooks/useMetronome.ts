import { useCallback, useEffect, useRef } from 'react';

export function useMetronome(volume = 65) {
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

  const tick = useCallback((accent = false) => {
    const context = contextRef.current;
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = accent ? 1320 : 880;
    oscillator.type = 'sine';
    const scalar = Math.max(0, Math.min(1, volumeRef.current / 100));
    gain.gain.setValueAtTime((accent ? 0.13 : 0.08) * scalar, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.045);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.05);
  }, []);

  const stop = useCallback(() => {
    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== 'closed') void context.close();
  }, []);

  useEffect(() => stop, [stop]);
  return { prepare, tick, stop };
}
