import type { PracticeSettings, Song } from '../types';

export type PracticeAudioAssetKind = 'synthetic-accompaniment' | 'licensed-backing' | 'licensed-demo';
export type PracticeAudioAssetStatus = 'available' | 'requires-license' | 'license-expired' | 'cdn-missing';
export type LicensedAudioGrantStatus = 'approved' | 'pending' | 'expired';

export interface PracticeAudioAsset {
  id: string;
  kind: PracticeAudioAssetKind;
  label: string;
  status: PracticeAudioAssetStatus;
  license: string;
  source: string;
  rightsHolder?: string;
  licenseStatus?: LicensedAudioGrantStatus;
  expiresAt?: string;
  url?: string;
}

export interface LicensedAudioGrant {
  songId: string;
  kind: Extract<PracticeAudioAssetKind, 'licensed-backing' | 'licensed-demo'>;
  assetPath: string;
  label: string;
  rightsHolder: string;
  licenseId: string;
  status: LicensedAudioGrantStatus;
  validFrom: string;
  expiresAt?: string;
}

export interface LicensedAudioOptions {
  cdnBaseUrl?: string;
  now?: string;
  grants?: LicensedAudioGrant[];
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

const DEFAULT_LICENSED_AUDIO_GRANTS: LicensedAudioGrant[] = [
  {
    songId: '5',
    kind: 'licensed-demo',
    assetPath: 'demo/amazing-grace-teacher-demo.m4a',
    label: '教师示范音轨',
    rightsHolder: 'Commissioned teacher recording placeholder',
    licenseId: 'internal-demo-placeholder-001',
    status: 'pending',
    validFrom: '2026-06-24',
  },
];

function getViteAudioCdnBaseUrl() {
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
  return meta.env?.VITE_AUDIO_CDN_BASE_URL;
}

export function buildCdnAssetUrl(cdnBaseUrl: string, assetPath: string) {
  const base = cdnBaseUrl.replace(/\/+$/, '');
  const path = assetPath.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `${base}/${path}`;
}

function isGrantActive(grant: LicensedAudioGrant, now = new Date().toISOString()) {
  if (grant.status !== 'approved') return false;
  if (grant.validFrom > now.slice(0, 10)) return false;
  if (grant.expiresAt && grant.expiresAt < now.slice(0, 10)) return false;
  return true;
}

function assetStatusForGrant(grant: LicensedAudioGrant | undefined, cdnBaseUrl: string | undefined, now: string | undefined): PracticeAudioAssetStatus {
  if (!grant) return 'requires-license';
  if (grant.status === 'expired' || (grant.expiresAt && grant.expiresAt < (now ?? new Date().toISOString()).slice(0, 10))) return 'license-expired';
  if (!isGrantActive(grant, now)) return 'requires-license';
  if (!cdnBaseUrl) return 'cdn-missing';
  return 'available';
}

function licensedAssetFor({
  song,
  kind,
  fallbackLabel,
  options,
}: {
  song: Song;
  kind: Extract<PracticeAudioAssetKind, 'licensed-backing' | 'licensed-demo'>;
  fallbackLabel: string;
  options: Required<Pick<LicensedAudioOptions, 'grants'>> & Omit<LicensedAudioOptions, 'grants'>;
}): PracticeAudioAsset {
  const grant = options.grants.find((item) => item.songId === song.id && item.kind === kind);
  const status = assetStatusForGrant(grant, options.cdnBaseUrl, options.now);
  const label = grant?.label ?? fallbackLabel;
  return {
    id: grant ? `${kind}-${song.id}-${grant.licenseId}` : `${kind}-placeholder-${song.id}`,
    kind,
    label,
    status,
    license: grant
      ? `${grant.licenseId} · ${grant.status}${grant.expiresAt ? ` · expires ${grant.expiresAt}` : ''}`
      : `Requires explicit ${kind === 'licensed-backing' ? 'backing-track' : 'teacher-demo'} license before enabling`,
    source: grant ? `OSS/CDN: ${grant.assetPath}` : 'Not bundled',
    rightsHolder: grant?.rightsHolder,
    licenseStatus: grant?.status,
    expiresAt: grant?.expiresAt,
    url: grant && status === 'available' && options.cdnBaseUrl ? buildCdnAssetUrl(options.cdnBaseUrl, grant.assetPath) : undefined,
  };
}

export function getPracticeAudioAssets(song: Song, options: LicensedAudioOptions = {}): PracticeAudioAsset[] {
  const resolvedOptions = {
    grants: options.grants ?? DEFAULT_LICENSED_AUDIO_GRANTS,
    cdnBaseUrl: options.cdnBaseUrl ?? getViteAudioCdnBaseUrl(),
    now: options.now,
  };
  return [
    ...SYNTHETIC_ASSETS,
    licensedAssetFor({ song, kind: 'licensed-backing', fallbackLabel: '原曲版权伴奏', options: resolvedOptions }),
    licensedAssetFor({ song, kind: 'licensed-demo', fallbackLabel: '教师示范音轨', options: resolvedOptions }),
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
  return assets.every((asset) => {
    const hasRequiredFields = asset.id && asset.label && asset.license && asset.source;
    const availableLicensedAssetHasUrl = asset.kind === 'synthetic-accompaniment' || asset.status !== 'available' || Boolean(asset.url);
    return hasRequiredFields && availableLicensedAssetHasUrl;
  });
}

export function summarizeLicensedAudioReadiness(assets: PracticeAudioAsset[]) {
  const licensed = assets.filter((asset) => asset.kind !== 'synthetic-accompaniment');
  return {
    total: licensed.length,
    available: licensed.filter((asset) => asset.status === 'available').length,
    pending: licensed.filter((asset) => asset.status === 'requires-license').length,
    expired: licensed.filter((asset) => asset.status === 'license-expired').length,
    cdnMissing: licensed.filter((asset) => asset.status === 'cdn-missing').length,
  };
}
