import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderStatus = 'idle' | 'recording' | 'ready' | 'unsupported' | 'error';

export interface PracticeRecording {
  url: string;
  durationMs: number;
  mimeType: string;
}

function getSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

export function usePracticeRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [recording, setRecording] = useState<PracticeRecording | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const urlRef = useRef<string | null>(null);

  const revokeCurrentUrl = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  const reset = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    chunksRef.current = [];
    revokeCurrentUrl();
    setRecording(null);
    setStatus('idle');
  }, [revokeCurrentUrl]);

  const start = useCallback((stream: MediaStream | null) => {
    if (!stream) return false;
    if (typeof MediaRecorder === 'undefined') {
      setStatus('unsupported');
      return false;
    }
    try {
      reset();
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      startedAtRef.current = performance.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => setStatus('error');
      recorder.start(250);
      recorderRef.current = recorder;
      setStatus('recording');
      return true;
    } catch {
      setStatus('error');
      return false;
    }
  }, [reset]);

  const stop = useCallback(() => new Promise<PracticeRecording | null>((resolve) => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      resolve(recording);
      return;
    }
    recorder.onstop = () => {
      const durationMs = Math.max(0, Math.round(performance.now() - startedAtRef.current));
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      revokeCurrentUrl();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const nextRecording = { url, durationMs, mimeType: blob.type };
      setRecording(nextRecording);
      setStatus('ready');
      recorderRef.current = null;
      resolve(nextRecording);
    };
    recorder.requestData();
    recorder.stop();
  }), [recording, revokeCurrentUrl]);

  useEffect(() => () => {
    recorderRef.current?.stop();
    revokeCurrentUrl();
  }, [revokeCurrentUrl]);

  return { status, recording, start, stop, reset };
}
