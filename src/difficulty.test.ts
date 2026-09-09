import { describe, it, expect } from 'vitest';
import { newDriver, drive, freshSave, sanitizeSave, rewardRace } from './core';
import { assistedSteer, rivalTarget, bestKey } from './difficulty';
import { engineTelemetry } from './audio-model';
const input = { steer: 0, throttle: true, brake: false, boost: false, drift: false };
describe('race modes', () => {
  it('Hard has faster opponents, with real corner speed limits and no player-distance rubber band', () => {
    const easy = rivalTarget('easy', 0.002, 1, 2, 0, 5, 0),
      hard = rivalTarget('hard', 0.002, 1, 2, 0, 5, 0);
    expect(hard).toBeGreaterThan(easy + 10);
    expect(rivalTarget('hard', 0.035, 1, 2, 0, 5, 0)).toBeLessThan(hard - 15);
  });
  it('Easy recenters unattended steering while preserving direct left and right input', () => {
    const p = { ...newDriver(), lane: 5, speed: 40 };
    expect(assistedSteer(p, 0, 0, 'easy')).toBeLessThan(0);
    expect(assistedSteer(p, 0, 0, 'hard')).toBe(0);
    expect(assistedSteer(p, 1, 0, 'easy')).toBe(1);
    expect(assistedSteer(p, -1, 0, 'easy')).toBe(-1);
  });
  it('Hard requires earlier braking and consumes more boost', () => {
    const e = { ...newDriver(), speed: 48 },
      h = { ...e };
    for (let i = 0; i < 120; i++) {
      drive(e, { ...input, boost: true }, 0, freshSave().upgrades, 1 / 120, 'easy');
      drive(h, { ...input, boost: true }, 0, freshSave().upgrades, 1 / 120, 'hard');
    }
    expect(h.boost).toBeLessThan(e.boost - 8);
    const ec = { ...newDriver(), speed: 48 },
      hc = { ...ec };
    for (let i = 0; i < 60; i++) {
      drive(ec, input, 0.03, freshSave().upgrades, 1 / 120, 'easy');
      drive(hc, input, 0.03, freshSave().upgrades, 1 / 120, 'hard');
    }
    expect(Math.abs(hc.lane)).toBeGreaterThan(Math.abs(ec.lane) + 1);
    expect(hc.speed).toBeLessThan(ec.speed);
  });
  it('separates day/night and difficulty records and awards the Hard purse without changing sponsor rewards', () => {
    expect(
      new Set(
        ['easy', 'hard'].flatMap((d) =>
          [true, false].map((n) => bestKey('coast', 1, d as 'easy' | 'hard', n)),
        ),
      ).size,
    ).toBe(4);
    const e = rewardRace(freshSave(), 1, 0, 0, 'easy'),
      h = rewardRace(freshSave(), 1, 0, 0, 'hard');
    expect(h.base).toBe(Math.round(e.base * 1.3));
    expect(h.sponsor).toBe(e.sponsor);
  });
  it('migrates old saves and clamps corrupt lighting and mix settings', () => {
    const s = sanitizeSave({
      credits: 1000,
      rgb: 100,
      rgbCycle: true,
      settings: {
        difficulty: 'impossible',
        night: true,
        musicVolume: NaN,
        effectsVolume: 2,
        voiceVolume: -2,
      },
      bests: { 'coast-1-hard-night': 41, 'coast-1-hard-unknown': 2 },
    });
    expect(s.credits).toBe(1000);
    expect(s.rgb).toBe(5);
    expect(s.settings.difficulty).toBe('easy');
    expect(s.settings.night).toBe(true);
    expect(s.settings.effectsVolume).toBe(1);
    expect(s.settings.voiceVolume).toBe(0);
    expect(s.settings.musicVolume).toBe(0.24);
    expect(s.bests).toEqual({ 'coast-1-hard-night': 41 });
  });
});
describe('sampled engine telemetry', () => {
  it('drops revs on an upshift and crossfades without silence or out-of-range RPM', () => {
    expect(engineTelemetry(13.01).rpm).toBeLessThan(engineTelemetry(12.99).rpm - 2500);
    for (let speed = 0; speed < 100; speed += 0.1) {
      const a = engineTelemetry(speed);
      expect(a.idle + a.mid + a.high).toBeCloseTo(1);
      expect(a.rpm).toBeGreaterThanOrEqual(1200);
      expect(a.rpm).toBeLessThanOrEqual(6400);
      expect(a.gear).toBeGreaterThanOrEqual(0);
      expect(a.gear).toBeLessThanOrEqual(6);
    }
  });
});
