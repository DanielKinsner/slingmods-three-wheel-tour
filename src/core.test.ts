import { describe, it, expect } from 'vitest';
import { PerspectiveCamera } from 'three/webgpu';
import {
  freshSave,
  sanitizeSave,
  buyUpgrade,
  rewardRace,
  newDriver,
  drive,
  formatTime,
  clamp,
  steeringToLane,
} from './core';
import { CHAPTERS, TRACKS } from './content';
import { Circuit } from './world';
const neutral = { steer: 0, throttle: true, brake: false, drift: false, boost: false };
describe('save resilience and economy', () => {
  it('recovers corrupt, old and malicious fields without breaking progression', () => {
    const s = sanitizeSave({
      credits: Infinity,
      chapter: 99,
      paint: -2,
      upgrades: { power: 18, boost: 'oops' },
      bests: { 'smokies-1': 42, __proto__: 4, 'coast-2': NaN },
      settings: { sound: false, quality: 'invalid' },
      races: 4,
      wins: 9,
    });
    expect(s.credits).toBe(0);
    expect(s.chapter).toBe(8);
    expect(s.upgrades).toEqual({ power: 3, grip: 0, boost: 0 });
    expect(s.bests).toEqual({ 'smokies-1': 42 });
    expect(s.wins).toBe(4);
    expect(s.settings.quality).toBe('auto');
    expect(s.settings.sound).toBe(false);
    expect(sanitizeSave(null)).toEqual(freshSave());
  });
  it('rejects unaffordable and maxed upgrades; charges each stage once', () => {
    const s = freshSave();
    expect(buyUpgrade(s, 'power')).toBe(false);
    s.credits = 5000;
    expect(buyUpgrade(s, 'power')).toBe(true);
    expect(s.credits).toBe(4300);
    expect(buyUpgrade(s, 'power')).toBe(true);
    expect(buyUpgrade(s, 'power')).toBe(true);
    expect(s.credits).toBe(900);
    expect(buyUpgrade(s, 'power')).toBe(false);
    expect(s.credits).toBe(900);
  });
  it('awards first race sponsor credits and prevents replaying its chapter bonus', () => {
    const s = freshSave();
    const r = rewardRace(s, 6, 0, 500);
    expect(r.complete).toBe(true);
    expect(r.total).toBe(1065);
    expect(s.chapter).toBe(1);
    const replay = rewardRace(s, 1, 0, 0);
    expect(replay.sponsor).toBe(0);
    expect(s.chapter).toBe(1);
  });
  it('failed objectives still pay a purse and all eight chapters are completable', () => {
    const s = freshSave();
    for (let i = 0; i < CHAPTERS.length; i++) {
      if (CHAPTERS[i].maxPlace < 6) {
        const r = rewardRace(s, 6, i, 0);
        expect(r.complete).toBe(false);
        expect(s.chapter).toBe(i);
        expect(r.total).toBeGreaterThan(0);
      }
      expect(rewardRace(s, CHAPTERS[i].maxPlace, i, 0).complete).toBe(true);
      expect(s.chapter).toBe(i + 1);
    }
    expect(s.chapter).toBe(8);
  });
  it('caps farmed style payout and keeps quick racing separate from the story', () => {
    const s = freshSave();
    const r = rewardRace(s, 1, null, 999999);
    expect(r.bonus).toBe(350);
    expect(r.sponsor).toBe(0);
    expect(s.chapter).toBe(0);
  });
});
describe('driving behavior', () => {
  it('right controls move toward screen right in the actual chase-camera basis', () => {
    const c = new Circuit(TRACKS[0]);
    const a = c.at(140);
    const camera = new PerspectiveCamera(55, 1.6, 0.1, 1000);
    camera.position.copy(a.p).addScaledVector(a.t, -12);
    camera.position.y += 5;
    camera.lookAt(a.p);
    camera.updateMatrixWorld();
    const center = a.p.clone().project(camera).x;
    const right = a.p.clone().addScaledVector(a.r, steeringToLane(false, true)).project(camera).x;
    const left = a.p.clone().addScaledVector(a.r, steeringToLane(true, false)).project(camera).x;
    expect(right).toBeGreaterThan(center);
    expect(left).toBeLessThan(center);
    expect(steeringToLane(false, false, 1)).toBe(steeringToLane(false, true));
    expect(steeringToLane(true, true)).toBe(0);
  });
  it('braking slows the car and power stages improve acceleration and top speed', () => {
    const a = newDriver(),
      b = newDriver();
    for (let i = 0; i < 1200; i++) {
      drive(a, neutral, 0, { power: 0, grip: 0, boost: 0 }, 1 / 120);
      drive(b, neutral, 0, { power: 3, grip: 0, boost: 0 }, 1 / 120);
    }
    expect(b.speed).toBeGreaterThan(a.speed + 9);
    const speed = a.speed;
    drive(a, { ...neutral, brake: true }, 0, { power: 0, grip: 0, boost: 0 }, 0.1);
    expect(a.speed).toBeLessThan(speed);
  });
  it('boost drains its meter, increases speed, and refills without exceeding capacity', () => {
    const p = newDriver();
    p.speed = 49;
    for (let i = 0; i < 120; i++)
      drive(p, { ...neutral, boost: true }, 0, { power: 0, grip: 0, boost: 0 }, 1 / 120);
    expect(p.speed).toBeGreaterThan(49);
    expect(p.boost).toBeLessThan(80);
    for (let i = 0; i < 5000; i++) drive(p, neutral, 0, { power: 0, grip: 0, boost: 0 }, 1 / 120);
    expect(p.boost).toBe(100);
  });
  it('steering, drift rewards, road penalties and recovery remain finite', () => {
    const p = newDriver();
    p.speed = 40;
    drive(p, { ...neutral, steer: 1, drift: true }, 0.004, { power: 0, grip: 0, boost: 0 }, 0.1);
    expect(p.lane).toBeGreaterThan(0);
    expect(p.style).toBeGreaterThan(0);
    p.lane = 12;
    p.speed = 40;
    for (let i = 0; i < 120; i++) drive(p, neutral, 0, { power: 0, grip: 0, boost: 0 }, 1 / 120);
    expect(p.speed).toBeLessThan(40);
    for (let i = 0; i < 300; i++)
      drive(p, { ...neutral, steer: -1 }, 0, { power: 0, grip: 0, boost: 0 }, 1 / 120);
    expect(p.lane).toBeLessThan(8);
    expect(Number.isFinite(p.distance)).toBe(true);
  });
  it('uses a stable fixed timestep across input frame rates', () => {
    const simulate = (dt: number) => {
      const p = newDriver();
      for (let i = 0; i < Math.round(8 / dt); i++)
        drive(p, { ...neutral, steer: 0.1 }, 0.002, { power: 1, grip: 1, boost: 1 }, dt);
      return p;
    };
    const a = simulate(1 / 120),
      b = simulate(1 / 60);
    expect(Math.abs(a.distance - b.distance)).toBeLessThan(1);
    expect(Math.abs(a.lane - b.lane)).toBeLessThan(0.2);
  });
});
describe('tour circuits', () => {
  for (const t of TRACKS) {
    it(`${t.location} has a closed, finite, drivable loop`, () => {
      const c = new Circuit(t);
      expect(c.length).toBeGreaterThan(1400);
      expect(c.at(0).p.distanceTo(c.at(c.length).p)).toBeLessThan(0.001);
      for (const a of c.samples) {
        expect(a.p.toArray().every(Number.isFinite)).toBe(true);
        expect(c.terrainAt(a.p.x, a.p.z).height).toBeLessThan(a.p.y - 0.5);
        expect(c.terrainAt(a.p.x, a.p.z).distance).toBeLessThan(4);
        expect(Math.abs(a.t.length() - 1)).toBeLessThan(0.01);
      }
      const p = newDriver();
      let time = 0;
      while (p.distance < c.length && time < 150) {
        const a = c.at(p.distance);
        const bend = Math.abs(c.at(p.distance + 18).curve);
        const centrifugal = -a.curve * p.speed * p.speed * 0.115;
        const steer = clamp(
          (-p.lane * 1.8 - p.velocity * 0.6 - centrifugal) / (3.1 + p.speed * 0.105),
          -1,
          1,
        );
        drive(
          p,
          { ...neutral, steer, brake: bend > 0.026 && p.speed > 30 },
          a.curve,
          { power: 0, grip: 0, boost: 0 },
          1 / 120,
        );
        time += 1 / 120;
      }
      expect(p.distance).toBeGreaterThanOrEqual(c.length);
      expect(time).toBeLessThan(80);
      expect(Math.abs(p.lane)).toBeLessThan(8.2);
    });
  }
  it('formats lap and race timers', () => {
    expect(formatTime(65.42)).toBe('1:05.42');
    expect(formatTime(59.999)).toBe('1:00.00');
  });
});
