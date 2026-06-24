import { useCallback, useEffect, useRef, useState } from 'react';
import { detectPitch, measureRms, type PitchSample } from '../audio/pitchDetection';
import { inspectCurrentBrowserAudio } from '../audio/audioCompatibility';
import type { PitchWorkerRequest, PitchWorkerResponse } from '../audio/pitchWorkerProtocol';

export interface LivePitchSample extends PitchSample {
  capturedAt: number;
  onset: boolean;
  stabilityCents: number;
}

export type MicrophoneStatus =
  | 'idle'
  | 'requesting'
  | 'calibrating'
  | 'listening'
  | 'denied'
  | 'no-device'
  | 'unsupported'
  | 'error';

const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function calculateStability(frequencies: number[]) {
  if (frequencies.length < 3) return 0;
  const average = frequencies.reduce((total, value) => total + value, 0) / frequencies.length;
  const cents = frequencies.map((frequency) => 1200 * Math.log2(frequency / average));
  return Math.round(Math.sqrt(cents.reduce((total, value) => total + value * value, 0) / cents.length));
}

export function usePitchDetection() {
  const [status, setStatus] = useState<MicrophoneStatus>('idle');
  const [sample, setSample] = useState<LivePitchSample | null>(null);
  const [message, setMessage] = useState('点击开始后启用麦克风');
  const [inputLevel, setInputLevel] = useState(0);
  const [noiseFloor, setNoiseFloor] = useState(0);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | undefined>(undefined);
  const lastAnalysisRef = useRef(0);
  const startingRef = useRef(false);
  const minimumRmsRef = useRef(0.012);
  const previousSampleRef = useRef<LivePitchSample | null>(null);
  const previousLevelRef = useRef(0);
  const frequencyWindowRef = useRef<number[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const workerBusyRef = useRef(false);
  const workerRequestIdRef = useRef(0);

  const stop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = undefined;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
    workerBusyRef.current = false;
    setStream(null);
    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== 'closed') void context.close();
    previousSampleRef.current = null;
    frequencyWindowRef.current = [];
    setSample(null);
    setInputLevel(0);
    setStatus('idle');
    setMessage('麦克风已关闭');
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current && contextRef.current?.state === 'running') return streamRef.current;
    if (startingRef.current) return null;
    const compatibility = inspectCurrentBrowserAudio();
    if (!compatibility.supported) {
      setStatus('unsupported');
      setMessage(compatibility.missing.includes('secure-context')
        ? '麦克风需要 HTTPS 或本地安全环境'
        : '当前浏览器缺少必要的音频能力');
      return null;
    }

    setStatus('requesting');
    setMessage('正在请求麦克风权限…');
    startingRef.current = true;
    let pendingStream: MediaStream | null = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
      pendingStream = stream;
      const AudioContextClass = window.AudioContext
        ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        stream.getTracks().forEach((track) => track.stop());
        setStatus('unsupported');
        setMessage('当前浏览器不支持音频分析');
        return null;
      }

      const context = new AudioContextClass();
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      let worker: Worker | null = null;

      streamRef.current = stream;
      setStream(stream);
      pendingStream = null;
      contextRef.current = context;
      setStatus('calibrating');
      setMessage('环境校准中，请保持安静…');
      setCalibrationProgress(0);
      const noiseSamples: number[] = [];
      for (let index = 0; index < 20; index += 1) {
        analyser.getFloatTimeDomainData(buffer);
        const level = measureRms(buffer);
        noiseSamples.push(level);
        setInputLevel(Math.round(Math.min(1, level * 8) * 100));
        setCalibrationProgress(Math.round((index + 1) / 20 * 100));
        await delay(50);
      }
      const sortedNoise = [...noiseSamples].sort((a, b) => a - b);
      const measuredFloor = sortedNoise[Math.floor(sortedNoise.length * 0.75)] ?? 0;
      minimumRmsRef.current = Math.max(0.012, measuredFloor * 2.5);
      setNoiseFloor(Math.round(Math.min(1, measuredFloor * 8) * 100));
      setStatus('listening');
      setMessage('校准完成，等待吹奏');

      const applyDetectedSample = (detected: PitchSample | null, rms: number) => {
        if (detected) {
          const previous = previousSampleRef.current;
          const onset = !previous || previous.note !== detected.note || rms > previousLevelRef.current * 1.35;
          if (!previous || previous.note !== detected.note) frequencyWindowRef.current = [];
          frequencyWindowRef.current = [...frequencyWindowRef.current.slice(-7), detected.frequency];
          const nextSample: LivePitchSample = {
            ...detected,
            capturedAt: performance.now(),
            onset,
            stabilityCents: calculateStability(frequencyWindowRef.current),
          };
          previousSampleRef.current = nextSample;
          setSample(nextSample);
          setMessage('正在识别演奏音高');
        } else {
          previousSampleRef.current = null;
          frequencyWindowRef.current = [];
          setSample(null);
          setMessage(rms <= minimumRmsRef.current ? '等待口琴声音' : '输入不稳定，请靠近麦克风');
        }
        previousLevelRef.current = rms;
      };

      if (typeof Worker !== 'undefined') {
        worker = new Worker(new URL('../audio/pitchDetection.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<PitchWorkerResponse & { rms?: number }>) => {
          workerBusyRef.current = false;
          if (!contextRef.current) return;
          applyDetectedSample(event.data.sample, event.data.rms ?? previousLevelRef.current);
        };
        worker.onerror = () => {
          worker?.terminate();
          workerRef.current = null;
          workerBusyRef.current = false;
          setMessage('Worker 不可用，已回退到主线程识别');
        };
        workerRef.current = worker;
      }

      const analyse = (time: number) => {
        if (time - lastAnalysisRef.current >= 50) {
          analyser.getFloatTimeDomainData(buffer);
          const rms = measureRms(buffer);
          const level = Math.round(Math.min(1, rms * 8) * 100);
          setInputLevel(level);

          if (workerRef.current && !workerBusyRef.current) {
            workerBusyRef.current = true;
            const samples = new Float32Array(buffer);
            const request: PitchWorkerRequest & { rms: number } = {
              id: workerRequestIdRef.current += 1,
              samples,
              sampleRate: context.sampleRate,
              minimumRms: minimumRmsRef.current,
              rms,
            };
            workerRef.current.postMessage(request, [samples.buffer]);
          } else {
            const detected = detectPitch(buffer, context.sampleRate, minimumRmsRef.current);
            applyDetectedSample(detected, rms);
          }
          lastAnalysisRef.current = time;
        }
        frameRef.current = requestAnimationFrame(analyse);
      };
      frameRef.current = requestAnimationFrame(analyse);
      return stream;
    } catch (error) {
      pendingStream?.getTracks().forEach((track) => track.stop());
      setSample(null);
      if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
        setStatus('denied');
        setMessage('麦克风权限被拒绝，请在浏览器设置中允许');
      } else if (error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError')) {
        setStatus('no-device');
        setMessage('没有检测到可用麦克风');
      } else {
        setStatus('error');
        setMessage('麦克风启动失败，请检查设备后重试');
      }
      return null;
    } finally {
      startingRef.current = false;
    }
  }, []);

  useEffect(() => stop, [stop]);
  return { status, sample, message, inputLevel, noiseFloor, calibrationProgress, stream, start, stop };
}
