import assert from 'node:assert/strict';
import test from 'node:test';
import { clearMonitoringEvents, getMonitoringEvents, recordMonitoringEvent } from './monitoring.ts';

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
