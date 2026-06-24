export type ReleaseChannel = 'development' | 'preview' | 'production';

export type FeatureFlagKey =
  | 'audioUploadTranscription'
  | 'practiceRecording'
  | 'cloudSync'
  | 'learningCenter'
  | 'chromaticCharts'
  | 'localMonitoring'
  | 'operationsPanel';

export interface FeatureFlag {
  key: FeatureFlagKey;
  label: string;
  description: string;
  enabled: boolean;
  source: 'default' | 'environment';
}

export interface ReleaseConfig {
  appVersion: string;
  channel: ReleaseChannel;
  flags: Record<FeatureFlagKey, FeatureFlag>;
}

export type ReleaseEnv = Partial<Record<string, string | boolean | undefined>>;

const FEATURE_ENV_KEYS: Record<FeatureFlagKey, string> = {
  audioUploadTranscription: 'VITE_FEATURE_AUDIO_UPLOAD',
  practiceRecording: 'VITE_FEATURE_PRACTICE_RECORDING',
  cloudSync: 'VITE_FEATURE_CLOUD_SYNC',
  learningCenter: 'VITE_FEATURE_LEARNING_CENTER',
  chromaticCharts: 'VITE_FEATURE_CHROMATIC_CHARTS',
  localMonitoring: 'VITE_FEATURE_LOCAL_MONITORING',
  operationsPanel: 'VITE_FEATURE_OPERATIONS_PANEL',
};

const FEATURE_LABELS: Record<FeatureFlagKey, Pick<FeatureFlag, 'label' | 'description'>> = {
  audioUploadTranscription: {
    label: '上传音频识谱',
    description: '允许用户上传 MP3/WAV/M4A 并生成临时简谱草稿。',
  },
  practiceRecording: {
    label: '练习录音回放',
    description: '保留本次练习录音，支持结果页回放和错音定位。',
  },
  cloudSync: {
    label: '云端账户与历史同步',
    description: '启用 API 账户、令牌刷新和练习历史增量同步。',
  },
  learningCenter: {
    label: '学习中心',
    description: '展示每日目标、课程路径、历史趋势和难点复练。',
  },
  chromaticCharts: {
    label: '半音阶谱面',
    description: '开放半音阶口琴孔位、滑键和进阶练习谱面。',
  },
  localMonitoring: {
    label: '本地异常监控',
    description: '记录本地错误、未处理异步异常和基础性能事件。',
  },
  operationsPanel: {
    label: '运营状态面板',
    description: '在账户页展示发布通道、版本和功能开关状态。',
  },
};

const DEFAULT_FLAGS_BY_CHANNEL: Record<ReleaseChannel, Record<FeatureFlagKey, boolean>> = {
  development: {
    audioUploadTranscription: true,
    practiceRecording: true,
    cloudSync: true,
    learningCenter: true,
    chromaticCharts: true,
    localMonitoring: true,
    operationsPanel: true,
  },
  preview: {
    audioUploadTranscription: true,
    practiceRecording: true,
    cloudSync: true,
    learningCenter: true,
    chromaticCharts: true,
    localMonitoring: true,
    operationsPanel: true,
  },
  production: {
    audioUploadTranscription: false,
    practiceRecording: true,
    cloudSync: true,
    learningCenter: true,
    chromaticCharts: true,
    localMonitoring: true,
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

export function buildReleaseConfig(env: ReleaseEnv = getViteEnv()): ReleaseConfig {
  const channel = parseReleaseChannel(env.VITE_RELEASE_CHANNEL);
  const appVersion = typeof env.VITE_APP_VERSION === 'string' && env.VITE_APP_VERSION.trim() ? env.VITE_APP_VERSION.trim() : '0.0.1';
  const defaults = DEFAULT_FLAGS_BY_CHANNEL[channel];
  const flags = Object.fromEntries(
    (Object.keys(FEATURE_ENV_KEYS) as FeatureFlagKey[]).map((key) => {
      const override = parseBooleanFlag(env[FEATURE_ENV_KEYS[key]]);
      return [key, {
        key,
        ...FEATURE_LABELS[key],
        enabled: override ?? defaults[key],
        source: override === undefined ? 'default' : 'environment',
      }];
    }),
  ) as Record<FeatureFlagKey, FeatureFlag>;

  return { appVersion, channel, flags };
}

export function isFeatureEnabled(config: ReleaseConfig, key: FeatureFlagKey) {
  return config.flags[key]?.enabled === true;
}

export function summarizeReleaseReadiness(config: ReleaseConfig) {
  const flags = Object.values(config.flags);
  const enabled = flags.filter((flag) => flag.enabled).length;
  const environmentOverrides = flags.filter((flag) => flag.source === 'environment').length;
  return {
    enabled,
    total: flags.length,
    environmentOverrides,
    label: `${config.channel} · v${config.appVersion}`,
  };
}

function getViteEnv(): ReleaseEnv {
  const meta = import.meta as unknown as { env?: ReleaseEnv };
  return meta.env ?? {};
}
