import assert from 'node:assert/strict';
import test from 'node:test';
import { getPracticeChart } from '../data/practiceCharts.ts';
import {
  buildCalibrationSample,
  buildCalibrationTargets,
  calibratedCentsFromTarget,
  clearPitchProfile,
  createPitchProfile,
  loadPitchProfile,
  savePitchProfile,
} from './pitchProfile.ts';

function createMemoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
  };
}

test('builds a compact calibration target set from a practice chart', () => {
  const { chart } = getPracticeChart('1');
  const targets = buildCalibrationTargets(chart, 4);
  assert.equal(targets.length, 4);
  assert.equal(new Set(targets.map((target) => target.id)).size, 4);
  assert.ok(targets.every((target) => target.targetFrequency > 0));
  assert.ok(targets.some((target) => target.label.includes('第')));
});

test('creates a personal pitch profile from usable calibration samples', () => {
  const { chart } = getPracticeChart('1');
  const [targetA, targetB] = buildCalibrationTargets(chart, 2);
  const samples = [
    buildCalibrationSample(targetA, targetA.targetFrequency * Math.pow(2, 16 / 1200), 92, '2026-06-24T00:00:00.000Z'),
    buildCalibrationSample(targetB, targetB.targetFrequency * Math.pow(2, 20 / 1200), 87, '2026-06-24T00:00:01.000Z'),
    buildCalibrationSample(targetB, targetB.targetFrequency * Math.pow(2, 260 / 1200), 94, '2026-06-24T00:00:02.000Z'),
    buildCalibrationSample(targetB, targetB.targetFrequency, 20, '2026-06-24T00:00:03.000Z'),
  ];

  const profile = createPitchProfile({
    userId: 'u1',
    harmonicaType: chart.harmonicaType,
    key: chart.key,
    samples,
    now: '2026-06-24T00:01:00.000Z',
  });

  assert.equal(profile.sampleCount, 2);
  assert.equal(profile.averageOffsetCents, 18);
  assert.equal(profile.noteOffsetsCents[targetA.noteNumber], 16);
  assert.equal(profile.noteOffsetsCents[targetB.noteNumber], 20);
});

test('applies profile offset when comparing detected frequency to a target', () => {
  const { chart } = getPracticeChart('1');
  const [target] = buildCalibrationTargets(chart, 1);
  const profile = createPitchProfile({
    harmonicaType: chart.harmonicaType,
    key: chart.key,
    samples: [buildCalibrationSample(target, target.targetFrequency * Math.pow(2, 25 / 1200), 90)],
    now: '2026-06-24T00:01:00.000Z',
  });

  assert.equal(Math.round(calibratedCentsFromTarget(target.targetFrequency * Math.pow(2, 25 / 1200), target.targetFrequency, profile)), 0);
});

test('stores and clears profiles by user key', () => {
  const storage = createMemoryStorage();
  const { chart } = getPracticeChart('1');
  const [target] = buildCalibrationTargets(chart, 1);
  const profile = createPitchProfile({
    userId: 'u1',
    harmonicaType: chart.harmonicaType,
    key: chart.key,
    samples: [buildCalibrationSample(target, target.targetFrequency, 91)],
    now: '2026-06-24T00:01:00.000Z',
  });

  savePitchProfile(profile, 'u1', storage);
  assert.deepEqual(loadPitchProfile('u1', storage), profile);
  assert.equal(loadPitchProfile('u2', storage), null);
  clearPitchProfile('u1', storage);
  assert.equal(loadPitchProfile('u1', storage), null);
});
