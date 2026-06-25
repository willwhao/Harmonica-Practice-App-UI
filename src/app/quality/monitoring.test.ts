import assert from 'node:assert/strict';
import test from 'node:test';
import { clearMonitoringEvents, configureMonitoring, getMonitoringEvents, recordMonitoringEvent, reportMonitoringEvent, shouldReportMonitoringEvent } from './monitoring.ts';

test('records monitoring events with timestamps and newest first', () => {
  clearMonitoringEvents();
  const first = recordMonitoringEvent({ type: 'error', message: 'first' });
  const second = recordMonitoringEvent({ type: 'recovery', message: 'second' });
  const events = getMonitoringEvents();
  assert.equal(events.length, 2);
  assert.equal(events[0].message, 'second');
  assert.equal(events[1].message, 'first');
  assert.ok(first.createdAt);
  assert.ok(second.createdAt);
});

test('caps monitoring buffer to the latest 50 events', () => {
  clearMonitoringEvents();
  for (let index = 0; index < 60; index += 1) {
    recordMonitoringEvent({ type: 'performance', message: `event-${index}` });
  }
  const events = getMonitoringEvents();
  assert.equal(events.length, 50);
  assert.equal(events[0].message, 'event-59');
  assert.equal(events.at(-1)?.message, 'event-10');
});

test('samples monitoring reports with lower default rate for performance events', () => {
  const event = { type: 'performance' as const, message: 'load', createdAt: '2026-06-24T00:00:00.000Z' };
  assert.equal(shouldReportMonitoringEvent(event, { endpoint: '/api/monitoring/events', sampleRate: 1 }, () => 0.3), false);
  assert.equal(shouldReportMonitoringEvent(event, { endpoint: '/api/monitoring/events', sampleRate: 1 }, () => 0.2), true);
  assert.equal(shouldReportMonitoringEvent({ ...event, type: 'error' }, { endpoint: '/api/monitoring/events', sampleRate: 0.5 }, () => 0.49), true);
  assert.equal(shouldReportMonitoringEvent({ ...event, type: 'error' }, { sampleRate: 1 }, () => 0), false);
});

test('reports monitoring events through the configured transport', async () => {
  const sent: string[] = [];
  configureMonitoring(
    { endpoint: '/api/monitoring/events', sampleRate: 1, release: '1.0.0', environment: 'test' },
    { send: async (event) => { sent.push(event.message); } },
  );
  const reported = await reportMonitoringEvent({ type: 'error', message: 'boom', createdAt: '2026-06-24T00:00:00.000Z' });
  assert.equal(reported, true);
  assert.deepEqual(sent, ['boom']);
  configureMonitoring({ endpoint: undefined, sampleRate: 1 });
});
