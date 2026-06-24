import { detectPitch, type PitchSample } from './pitchDetection.ts';

export interface PitchWorkerRequest {
  id: number;
  samples: Float32Array;
  sampleRate: number;
  minimumRms: number;
  rms?: number;
}

export interface PitchWorkerResponse {
  id: number;
  sample: PitchSample | null;
  rms?: number;
}

export function analyzePitchFrame({ id, samples, sampleRate, minimumRms, rms }: PitchWorkerRequest): PitchWorkerResponse {
  return {
    id,
    sample: detectPitch(samples, sampleRate, minimumRms),
    rms,
  };
}
