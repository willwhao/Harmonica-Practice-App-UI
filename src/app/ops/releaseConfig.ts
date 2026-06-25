export type ReleaseChannel = 'development' | 'preview' | 'production';

export type FeatureFlagKey =
  | 'audioUploadTranscription'
  | 'practiceRecording'
  | 'cloudSync'
  | 'learningCenter'
  | 'chromaticCharts'
  | 'licensedAudioDelivery'
  | 'contentManagement'
  | 'localMonitoring'
  | 'remoteMonitoring'
  | 'operationsPanel';

export interface FeatureFlag {
  key: FeatureFlagKey;
  label: string;
  description: string;
  enabled: boolean;
  source: 'default' | 'remote' | 'environment';
  rolloutPercent: number;
  rolloutMatched: boolean;
}

export interface ReleaseConfig {
  appVersion: string;
  channel: ReleaseChannel;
  audienceKey: string;
  flags: Record<FeatureFlagKey, FeatureFlag>;
}

export interface RemoteFeatureFlag {
  enabled?: boolean | null;
  rolloutPercent?: number | null;
  note?: string | null;
  updatedAt?: string | null;
}

export interface RemoteReleaseConfig {
  appVersion?: string;
  channel?: ReleaseChannel;
  flags?: Partial<Record<FeatureFlagKey, RemoteFeatureFlag>>;
  serverTime?: string;
}

export type ReleaseEnv = Partial<Record<string, string | boolean | undefined>>;

const FEATURE_ENV_KEYS: Record<FeatureFlagKey, string> = {
  audioUploadTranscription: 'VITE_FEATURE_AUDIO_UPLOAD',
  practiceRecording: 'VITE_FEATURE_PRACTICE_RECORDING',
  cloudSync: 'VITE_FEATURE_CLOUD_SYNC',
  learningCenter: 'VITE_FEATURE_LEARNING_CENTER',
  chromaticCharts: 'VITE_FEATURE_CHROMATIC_CHARTS',
  licensedAudioDelivery: 'VITE_FEATURE_LICENSED_AUDIO',
  contentManagement: 'VITE_FEATURE_CONTENT_MANAGEMENT',
  localMonitoring: 'VITE_FEATURE_LOCAL_MONITORING',
  remoteMonitoring: 'VITE_FEATURE_REMOTE_MONITORING',
  operationsPanel: 'VITE_FEATURE_OPERATIONS_PANEL',
};

const FEATURE_LABELS: Record<FeatureFlagKey, Pick<FeatureFlag, 'label' | 'description'>> = {
  audioUploadTranscription: {
    label: '上传音频识别',
    description: '允许用户上传 MP3/WAV/M4A 并生成临时简谱草稿。',
  },
  practiceRecording: {
    label: '练习录音回放',
    description: '保留本次练习录音，支持结果页回放和错音定位。',
  },
  cloudSync: {
    label: '云端账号与历史同步',
    description: '启用 API 账号、令牌刷新和练习历史增量同步。',
  },
  learningCenter: {
    label: '学习中心',
    description: '展示每日目标、课程路径、历史趋势和难点复练。',
  },
  chromaticCharts: {
    label: '半音阶谱面',
    description: '开放半音阶口琴孔位、滑键和进阶练习谱面。',
  },
  licensedAudioDelivery: {
    label: '授权音频投放',
    description: '允许已授权的原曲伴奏和教师示范音轨通过 OSS/CDN 分发。',
  },
  contentManagement: {
    label: '运营内容管理',
    description: '启用曲库、谱面、课程和授权音频的 CMS 内容源。',
  },
  localMonitoring: {
    label: '本地异常监控',
    description: '记录本地错误、未处理异步异常和基础性能事件。',
  },
  remoteMonitoring: {
    label: '远端错误监控',
    description: '将采样后的错误、恢复和性能事件发送到监控接收端。',
  },
  operationsPanel: {
    label: '运营状态面板',
    description: '在账号页展示发布通道、版本、灰度比例和功能开关状态。',
  },
};

const DEFAULT_FLAGS_BY_CHANNEL: Record<ReleaseChannel, Record<FeatureFlagKey, boolean>> = {
  development: {
    audioUploadTranscription: true,
    practiceRecording: true,
    cloudSync: true,
    learningCenter: true,
    chromaticCharts: true,
    licensedAudioDelivery: false,
    contentManagement: false,
    localMonitoring: true,
    remoteMonitoring: false,
    operationsPanel: true,
  },
  preview: {
    audioUploadTranscription: true,
    practiceRecording: true,
    cloudSync: true,
    learningCenter: true,
    chromaticCharts: true,
    licensedAudioDelivery: false,
    contentManagement: true,
    localMonitoring: true,
    remoteMonitoring: true,
    operationsPanel: true,
  },
  production: {
    audioUploadTranscription: false,
    practiceRecording: true,
    cloudSync: true,
    learningCenter: true,
    chromaticCharts: true,
    licensedAudioDelivery: false,
    contentManagement: true,
    localMonitoring: true,
    remoteMonitoring: true,
    operationsPanel: false,
  },
};

export function parseReleaseChannel(value: string | boolean | undefined): ReleaseChannel {
  if (value === 'production' || value === 'preview' || value === 'development') return value;
  return 'development';
}

export function parseBooleanFlag(value: string | boolean | undefined) {
  if (typeof value === 'boolean') return value;
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return undefined;
}

export function normalizeRolloutPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 100;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getRolloutBucket(flagKey: FeatureFlagKey, audienceKey = 'anonymous') {
  const input = `${flagKey}:${audienceKey}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % 100;
}

export function isInRollout(flagKey: FeatureFlagKey, audienceKey: string, rolloutPercent: number) {
  if (rolloutPercent >= 100) return true;
  if (rolloutPercent <= 0) return false;
  return getRolloutBucket(flagKey, audienceKey) < rolloutPercent;
}

export function buildReleaseConfig(
  env: ReleaseEnv = getViteEnv(),
  remoteConfig?: RemoteReleaseConfig | null,
  audienceKey = 'anonymous',
): ReleaseConfig {
  const channel = parseReleaseChannel(env.VITE_RELEASE_CHANNEL) || remoteConfig?.channel || 'development';
  const appVersion = typeof env.VITE_APP_VERSION === 'string' && env.VITE_APP_VERSION.trim()
    ? env.VITE_APP_VERSION.trim()
    : remoteConfig?.appVersion ?? '0.0.1';
  const defaults = DEFAULT_FLAGS_BY_CHANNEL[channel];
  const flags = Object.fromEntries(
    (Object.keys(FEATURE_ENV_KEYS) as FeatureFlagKey[]).map((key) => {
      const override = parseBooleanFlag(env[FEATURE_ENV_KEYS[key]]);
      const remote = remoteConfig?.flags?.[key];
      const remoteHasEnabled = typeof remote?.enabled === 'boolean';
      const source = override !== undefined ? 'environment' : remote ? 'remote' : 'default';
      const intendedEnabled = override ?? (remoteHasEnabled ? remote.enabled === true : defaults[key]);
      const rolloutPercent = source === 'remote' ? normalizeRolloutPercent(remote?.rolloutPercent) : 100;
      const rolloutMatched = isInRollout(key, audienceKey, rolloutPercent);
      return [key, {
        key,
        ...FEATURE_LABELS[key],
        enabled: intendedEnabled && rolloutMatched,
        source,
        rolloutPercent,
        rolloutMatched,
      }];
    }),
  ) as Record<FeatureFlagKey, FeatureFlag>;

  return { appVersion, channel, audienceKey, flags };
}

export function isFeatureEnabled(config: ReleaseConfig, key: FeatureFlagKey) {
  return config.flags[key]?.enabled === true;
}

export function summarizeReleaseReadiness(config: ReleaseConfig) {
  const flags = Object.values(config.flags);
  const enabled = flags.filter((flag) => flag.enabled).length;
  const environmentOverrides = flags.filter((flag) => flag.source === 'environment').length;
  const remoteOverrides = flags.filter((flag) => flag.source === 'remote').length;
  const rolloutLimited = flags.filter((flag) => flag.rolloutPercent < 100).length;
  return {
    enabled,
    total: flags.length,
    environmentOverrides,
    remoteOverrides,
    rolloutLimited,
    label: `${config.channel} 路 v${config.appVersion}`,
  };
}

function getViteEnv(): ReleaseEnv {
  const meta = import.meta as unknown as { env?: ReleaseEnv };
  return meta.env ?? {};
}
