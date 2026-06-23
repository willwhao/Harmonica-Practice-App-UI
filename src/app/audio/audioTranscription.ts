import { detectPitch, frequencyToNote } from './pitchDetection.ts';

export interface TranscribedNote {
  startSec: number;
  endSec: number;
  frequency: number;
  noteName: string;
  jianpu: string;
  confidence: number;
}

export interface AudioTranscription {
  durationSec: number;
  key: string;
  notes: TranscribedNote[];
  jianpuLine: string;
  warning?: string;
}

const KEY_TO_MIDI_CLASS: Record<string, number> = {
  C: 0,
  'C#': 1,
  'C♯': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  'D♯': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  'F♯': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  'G♯': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  'A♯': 10,
  Bb: 10,
  B: 11,
};

const JIANPU_BY_SEMITONE = ['1', '♯1', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'];

function normalizeKey(key: string) {
  return key.trim().replace('调', '').replace('♭', 'b').replace('＃', '#');
}

export function midiToJianpu(midi: number, key: string) {
  const rootClass = KEY_TO_MIDI_CLASS[normalizeKey(key)] ?? 0;
  const semitone = ((midi - rootClass) % 12 + 12) % 12;
  const base = JIANPU_BY_SEMITONE[semitone];
  const rootMidiNearC4 = 60 + ((rootClass - 0 + 12) % 12);
  const octaveOffset = Math.floor((midi - rootMidiNearC4) / 12);
  if (octaveOffset > 0) return `${base}${'̇'.repeat(Math.min(2, octaveOffset))}`;
  if (octaveOffset < 0) return `${base}${'̣'.repeat(Math.min(2, Math.abs(octaveOffset)))}`;
  return base;
}

function appendFrameNote(notes: TranscribedNote[], next: TranscribedNote) {
  const previous = notes.at(-1);
  if (previous && previous.jianpu === next.jianpu && next.startSec - previous.endSec <= 0.18) {
    const previousDuration = previous.endSec - previous.startSec;
    const nextDuration = next.endSec - next.startSec;
    const totalDuration = previousDuration + nextDuration;
    previous.endSec = next.endSec;
    previous.frequency = (previous.frequency * previousDuration + next.frequency * nextDuration) / totalDuration;
    previous.confidence = Math.round((previous.confidence + next.confidence) / 2);
    return;
  }
  notes.push(next);
}

export function transcribeMonoAudio({
  samples,
  sampleRate,
  key,
  maxNotes = 96,
}: {
  samples: Float32Array;
  sampleRate: number;
  key: string;
  maxNotes?: number;
}): AudioTranscription {
  const frameSize = 4096;
  const hopSize = 2048;
  const notes: TranscribedNote[] = [];
  for (let offset = 0; offset + frameSize <= samples.length && notes.length < maxNotes; offset += hopSize) {
    const frame = samples.slice(offset, offset + frameSize);
    const pitch = detectPitch(frame, sampleRate, 0.01);
    if (!pitch || pitch.confidence < 68) continue;
    const note = frequencyToNote(pitch.frequency);
    appendFrameNote(notes, {
      startSec: offset / sampleRate,
      endSec: (offset + frameSize) / sampleRate,
      frequency: pitch.frequency,
      noteName: note.note,
      jianpu: midiToJianpu(note.midi, key),
      confidence: pitch.confidence,
    });
  }
  return {
    durationSec: samples.length / sampleRate,
    key,
    notes,
    jianpuLine: notes.map((note) => note.jianpu).join(' '),
    warning: notes.length === 0
      ? '没有识别到稳定单旋律音高，请尝试上传更清晰的口琴独奏或示范音轨。'
      : notes.length >= maxNotes
        ? '音符较多，当前仅展示前半段识别草稿。'
        : undefined,
  };
}

export async function transcribeAudioFile(file: File, key: string): Promise<AudioTranscription> {
  const AudioContextClass = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error('当前浏览器不支持音频解码');
  const context = new AudioContextClass();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const length = buffer.length;
    const mono = new Float32Array(length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        mono[index] += data[index] / buffer.numberOfChannels;
      }
    }
    return transcribeMonoAudio({ samples: mono, sampleRate: buffer.sampleRate, key });
  } finally {
    if (context.state !== 'closed') void context.close();
  }
}
