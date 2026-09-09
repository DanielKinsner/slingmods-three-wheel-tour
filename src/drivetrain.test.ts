import { expect, it } from 'vitest';
import { newDrivetrain, stepPowertrain, shift, engineMix } from './drivetrain';
import { sanitizeSave } from './core';
it('manual gear selection changes coupled RPM at the same road speed', () => {
  const low = newDrivetrain(),
    high = newDrivetrain();
  high.gear = 3;
  for (let i = 0; i < 120; i++) {
    stepPowertrain(low, 12, false, false, 1 / 60, 0, false);
    stepPowertrain(high, 12, false, false, 1 / 60, 0, false);
  }
  expect(low.rpm).toBeGreaterThan(high.rpm * 2);
  expect(engineMix(high).rpm).toBe(high.rpm);
  expect(engineMix(high).gear).toBe(3);
});
it('a shift cuts drive torque briefly and rejects held-repeat gear changes', () => {
  const t = newDrivetrain();
  t.rpm = 6500;
  shift(t, 1);
  const serial = t.shiftSerial;
  shift(t, 1);
  expect(t.gear).toBe(2);
  expect(t.shiftSerial).toBe(serial);
  const during = stepPowertrain(t, 15, true, false, 1 / 60, 0, false);
  expect(during).toBeLessThan(15);
  expect(t.load).toBe(0);
  for (let i = 0; i < 20; i++) stepPowertrain(t, 15, true, false, 1 / 60, 0, false);
  expect(t.shiftRemaining).toBe(0);
  expect(t.load).toBeGreaterThan(0.5);
});
it('engine crossfade energy stays bounded across the full RPM range', () => {
  const t = newDrivetrain();
  for (let rpm = 1100; rpm <= 8500; rpm += 100) {
    t.rpm = rpm;
    const a = engineMix(t);
    expect(a.idle * a.idle + a.mid * a.mid + a.high * a.high).toBeCloseTo(1, 12);
  }
});
it('version-one owner progress migrates without erasing earned content or records', () => {
  const old = {
    version: 1,
    credits: 12753,
    chapter: 6,
    paint: 3,
    rgb: 4,
    rgbCycle: true,
    upgrades: { power: 2, grip: 3, boost: 1 },
    bests: { 'coast-2-hard-night': 86.12, 'smokies-1': 55.5 },
    races: 19,
    wins: 8,
    settings: {
      sound: false,
      music: false,
      voice: false,
      autoThrottle: false,
      quality: 'low',
      motion: false,
      difficulty: 'hard',
      night: true,
      effectsVolume: 0.4,
      musicVolume: 0.1,
      voiceVolume: 0.3,
    },
  };
  const migrated = sanitizeSave(old);
  for (const key of [
    'credits',
    'chapter',
    'paint',
    'rgb',
    'rgbCycle',
    'upgrades',
    'bests',
    'races',
    'wins',
    'settings',
  ] as const)
    expect(migrated[key]).toEqual(old[key]);
  expect(migrated.version).toBe(2);
  expect(migrated.committedRaceIds).toEqual([]);
  expect(migrated.transmission).toBe('automatic');
});
