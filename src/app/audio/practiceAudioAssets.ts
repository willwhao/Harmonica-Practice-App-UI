import type { PracticeSettings, Song } from '../types';

export type PracticeAudioAssetKind = 'synthetic-accompaniment' | 'licensed-backing' | 'licensed-demo';
export type PracticeAudioAssetStatus = 'available' | 'requires-license';

export interface PracticeAudioAsset {
  id: string;
  kind: PracticeAudioAssetKind;
  label: string;
  status: PracticeAudioAssetStatus;
  license: string;
  source: string;
  url?: string;
}

export interface PlaybackSyncPlan {
  bpm: number;
  speed: number;
  effectiveBpm: number;
  beatDurationSec: number;
  playbackRate: number;
  segmentStartBeat: number;
  segmentEndBeat: number;
  repeatCount: number;
}

const SYNTHETIC_ASSETS: PracticeAudioAsset[] = [
  {
    id: 'synth-chords',
    kind: 'synthetic-accompaniment',
    label: '合成练习和弦',
    status: 'available',
    license: 'Generated in-browser; no external recording',
    source: 'Web Audio oscillator chords',
  },
  {
    id: 'synth-root',
    kind: 'synthetic-accompaniment',
    label: '合成简化根音',
    status: 'available',
    license: 'Generated in-browser; no external recording',
    source: 'Web Audio oscillator root notes',
  },
];

export function getPracticeAudioAssets(_song: Song): PracticeAudioAsset[] {
  return [
    ...SYNTHETIC_ASSETS,
    {
      id: 'licensed-backing-placeholder',
      kind: 'licensed-backing',
      label: '原曲版权伴奏',
      status: 'requires-license',
      license: 'Requires explicit backing-track license before enabling',
      source: 'Not bundled',
    },
    {
      id: 'licensed-demo-placeholder',
      kind: 'licensed-demo',
      label: '教师示范音轨',
      status: 'requires-license',
      license: 'Requires owned or commissioned demo recording before enabling',
      source: 'Not bundled',
    },
  ];
}

export function getSelectedSyntheticAsset(mode: PracticeSettings['accompaniment']) {
  if (mode === 'original') return SYNTHETIC_ASSETS[0];
  if (mode === 'simplified') return SYNTHETIC_ASSETS[1];
  return null;
}

export function buildPlaybackSyncPlan({
  song,
  speed,
  segmentStartBeat,
  segmentEndBeat,
  repeatCount,
}: {
  song: Pick<Song, 'bpm'>;
  speed: number;
  segmentStartBeat: number;
  segmentEndBeat: number;
  repeatCount: number;
}): PlaybackSyncPlan {
  const effectiveBpm = Math.round(song.bpm * speed / 100);
  return {
    bpm: song.bpm,
    speed,
    effectiveBpm,
    beatDurationSec: 60 / effectiveBpm,
    playbackRate: speed / 100,
    segmentStartBeat,
    segmentEndBeat,
    repeatCount,
  };
}

export function validatePracticeAudioAssets(assets: PracticeAudioAsset[]) {
  return assets.every((asset) => asset.id && asset.label && asset.license && asset.source);
}
