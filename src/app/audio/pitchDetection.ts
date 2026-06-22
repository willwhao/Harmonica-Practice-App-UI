const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export interface PitchSample {
  frequency: number;
  note: string;
  midi: number;
  cents: number;
  confidence: number;
  level: number;
}

export function frequencyToNote(frequency: number) {
  const exactMidi = 69 + 12 * Math.log2(frequency / 440);
  const midi = Math.round(exactMidi);
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return {
    midi,
    note: `${NOTE_NAMES[noteIndex]}${octave}`,
    cents: Math.round((exactMidi - midi) * 100),
  };
}

export function measureRms(buffer: Float32Array) {
  let sumSquares = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    sumSquares += buffer[i] * buffer[i];
  }
  return Math.sqrt(sumSquares / buffer.length);
}

export function detectPitch(buffer: Float32Array, sampleRate: number, minimumRms = 0.012): PitchSample | null {
  const rms = measureRms(buffer);
  if (rms < minimumRms) return null;

  const minLag = Math.max(2, Math.floor(sampleRate / 1600));
  const maxLag = Math.min(buffer.length - 2, Math.floor(sampleRate / 80));
  const correlations = new Float32Array(maxLag + 1);
  let bestLag = -1;
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    let energyA = 0;
    let energyB = 0;
    const length = buffer.length - lag;
    for (let i = 0; i < length; i += 1) {
      const a = buffer[i];
      const b = buffer[i + lag];
      correlation += a * b;
      energyA += a * a;
      energyB += b * b;
    }
    const normalized = correlation / Math.sqrt(energyA * energyB || 1);
    correlations[lag] = normalized;
    if (normalized > bestCorrelation) {
      bestCorrelation = normalized;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || bestCorrelation < 0.62) return null;

  const peakThreshold = Math.max(0.62, bestCorrelation * 0.9);
  for (let lag = minLag + 1; lag < maxLag; lag += 1) {
    const current = correlations[lag];
    if (
      current >= peakThreshold
      && current >= correlations[lag - 1]
      && current >= correlations[lag + 1]
    ) {
      bestLag = lag;
      bestCorrelation = current;
      break;
    }
  }

  const left = correlations[bestLag - 1] || bestCorrelation;
  const right = correlations[bestLag + 1] || bestCorrelation;
  const denominator = left - 2 * bestCorrelation + right;
  const offset = denominator === 0 ? 0 : 0.5 * (left - right) / denominator;
  const refinedLag = bestLag + Math.max(-1, Math.min(1, offset));
  const frequency = sampleRate / refinedLag;
  if (!Number.isFinite(frequency) || frequency < 80 || frequency > 1600) return null;

  const note = frequencyToNote(frequency);
  return {
    frequency,
    ...note,
    confidence: Math.round(Math.min(1, bestCorrelation) * 100),
    level: Math.round(Math.min(1, rms * 8) * 100),
  };
}

export function centsFromTarget(frequency: number, targetFrequency: number) {
  return 1200 * Math.log2(frequency / targetFrequency);
}
