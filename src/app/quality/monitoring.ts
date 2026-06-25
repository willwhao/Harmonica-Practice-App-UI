export type MonitoringEventType = 'error' | 'unhandled-rejection' | 'performance' | 'recovery';

export interface MonitoringEvent {
  type: MonitoringEventType;
  message: string;
  createdAt: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface MonitoringConfig {
  endpoint?: string;
  sampleRate: number;
  release?: string;
  environment?: string;
}

export interface MonitoringTransport {
  send: (event: MonitoringEvent, config: MonitoringConfig) => Promise<void>;
}

const MAX_EVENTS = 50;
const monitoringBuffer: MonitoringEvent[] = [];
let monitoringConfig = getDefaultMonitoringConfig();
let monitoringTransport: MonitoringTransport = {
  send: async (event, config) => {
    if (!config.endpoint || typeof fetch === 'undefined') return;
    await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...event,
        release: config.release,
        environment: config.environment,
      }),
      keepalive: true,
    });
  },
};

function getDefaultMonitoringConfig(): MonitoringConfig {
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
  const env = meta.env ?? {};
  const sampleRate = Number(env.VITE_MONITORING_SAMPLE_RATE ?? '1');
  const remoteEnabled = !['0', 'false', 'off', 'disabled'].includes((env.VITE_FEATURE_REMOTE_MONITORING ?? '').trim().toLowerCase());
  return {
    endpoint: remoteEnabled ? env.VITE_MONITORING_ENDPOINT : undefined,
    sampleRate: Number.isFinite(sampleRate) ? Math.max(0, Math.min(1, sampleRate)) : 1,
    release: env.VITE_APP_VERSION,
    environment: env.VITE_RELEASE_CHANNEL,
  };
}

export function configureMonitoring(config: Partial<MonitoringConfig>, transport?: MonitoringTransport) {
  monitoringConfig = { ...monitoringConfig, ...config };
  if (transport) monitoringTransport = transport;
}

export function shouldReportMonitoringEvent(event: MonitoringEvent, config = monitoringConfig, random = Math.random) {
  if (!config.endpoint) return false;
  if (event.type === 'performance') return random() < Math.min(config.sampleRate, 0.25);
  return random() < config.sampleRate;
}

export async function reportMonitoringEvent(event: MonitoringEvent, config = monitoringConfig) {
  if (!shouldReportMonitoringEvent(event, config)) return false;
  try {
    await monitoringTransport.send(event, config);
    return true;
  } catch {
    return false;
  }
}

export function recordMonitoringEvent(event: Omit<MonitoringEvent, 'createdAt'>) {
  const nextEvent: MonitoringEvent = { ...event, createdAt: new Date().toISOString() };
  monitoringBuffer.unshift(nextEvent);
  monitoringBuffer.splice(MAX_EVENTS);
  void reportMonitoringEvent(nextEvent);
  return nextEvent;
}

export function getMonitoringEvents() {
  return [...monitoringBuffer];
}

export function clearMonitoringEvents() {
  monitoringBuffer.length = 0;
}

export function installGlobalMonitoring() {
  if (typeof window === 'undefined') return () => undefined;

  const onError = (event: ErrorEvent) => {
    recordMonitoringEvent({
      type: 'error',
      message: event.message || '未知脚本错误',
      metadata: {
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
      },
    });
  };

  const onRejection = (event: PromiseRejectionEvent) => {
    recordMonitoringEvent({
      type: 'unhandled-rejection',
      message: event.reason instanceof Error ? event.reason.message : String(event.reason ?? '未处理异步错误'),
    });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  window.setTimeout(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!navigation) return;
    recordMonitoringEvent({
      type: 'performance',
      message: '页面加载性能',
      metadata: {
        domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
        loadMs: Math.round(navigation.loadEventEnd),
        transferSize: navigation.transferSize,
      },
    });
  }, 0);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
