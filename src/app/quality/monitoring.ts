export type MonitoringEventType = 'error' | 'unhandled-rejection' | 'performance' | 'recovery';

export interface MonitoringEvent {
  type: MonitoringEventType;
  message: string;
  createdAt: string;
  metadata?: Record<string, string | number | boolean | null>;
}

const MAX_EVENTS = 50;
const monitoringBuffer: MonitoringEvent[] = [];

export function recordMonitoringEvent(event: Omit<MonitoringEvent, 'createdAt'>) {
  const nextEvent: MonitoringEvent = { ...event, createdAt: new Date().toISOString() };
  monitoringBuffer.unshift(nextEvent);
  monitoringBuffer.splice(MAX_EVENTS);
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
