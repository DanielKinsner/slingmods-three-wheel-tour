import { expect, test } from 'vitest';
import { Vector3 } from 'three/webgpu';
import { DriftAttack, RouteTokens, driftKey } from './playground';
import { newDriver, freshSave, sanitizeSave } from './core';
import { Circuit } from './world';
import { TRACKS, CHAPTERS } from './content';
import { simulateVehicle, spawnVehicle, SIM_STEP } from './simulation';
import { newDrivetrain, stepPowertrain } from './drivetrain';
import { CollisionWorld } from './collision';
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three/webgpu';

test('stationary, reversed, wall-contact and spin attempts never earn drift points', () => {
  for (const mode of ['stationary', 'reverse', 'impact', 'spin', 'wrong-way']) {
    const run = new DriftAttack(),
      p = newDriver();
    p.speed = mode === 'stationary' ? 0 : mode === 'reverse' ? -20 : 20;
    p.telemetry.slipAngle = mode === 'spin' ? 1.2 : 0.3;
    p.hit = mode === 'impact' ? 0.3 : 0;
    for (let i = 0; i < 600; i++)
      run.step(p, mode === 'stationary' ? 0 : 0.33, SIM_STEP, mode === 'wrong-way');
    run.bank();
    expect(run.banked, mode).toBe(0);
  }
});
test('moving slides build a combo, clean exit banks it and later impact cannot erase banked score', () => {
  const run = new DriftAttack(),
    p = newDriver();
  p.speed = 22;
  p.telemetry.slipAngle = 0.25;
  for (let i = 0; i < 180; i++) run.step(p, 22 * SIM_STEP, SIM_STEP);
  expect(run.combo).toBe(2);
  expect(run.banked).toBe(0);
  expect(run.pending).toBeGreaterThan(200);
  p.telemetry.slipAngle = 0;
  for (let i = 0; i < 75; i++) run.step(p, 22 * SIM_STEP, SIM_STEP);
  const bank = run.banked;
  expect(bank).toBeGreaterThan(400);
  p.telemetry.slipAngle = 0.3;
  run.step(p, 0.4, SIM_STEP);
  p.hit = 0.3;
  run.step(p, 0.4, SIM_STEP);
  expect(run.pending).toBe(0);
  expect(run.banked).toBe(bank);
});
test('attack ends once after 90 simulation seconds and ignores further scoring', () => {
  const run = new DriftAttack(),
    p = newDriver();
  p.speed = 20;
  p.telemetry.slipAngle = 0.22;
  for (let i = 0; i < 5401; i++) run.step(p, 20 * SIM_STEP, SIM_STEP);
  expect(run.done).toBe(true);
  const score = run.banked;
  run.step(p, 20, 1);
  expect(run.banked).toBe(score);
  expect(run.remaining).toBeCloseTo(0);
});
test('route tokens collect once along real travel and reset only with a new session', () => {
  const tokens = new RouteTokens([{ x: 0, y: 0, z: 2 }]);
  expect(tokens.collect(new Vector3(), new Vector3(0, 0, 3))).toEqual([0]);
  expect(tokens.collect(new Vector3(), new Vector3(0, 0, 3))).toEqual([]);
  const fresh = new RouteTokens(tokens.points);
  expect(fresh.collect(new Vector3(0, 0, -100), new Vector3(0, 0, 3))).toEqual([]);
  expect(fresh.collected.size).toBe(0);
});
test('new score records preserve purchased builds and old race times without sharing the economy', () => {
  const save = freshSave();
  save.credits = 902;
  save.chapter = 5;
  save.upgrades.grip = 3;
  save.rgb = 4;
  save.paint = 2;
  save.bests['miami-1-easy-day-owner-v1'] = 91.3;
  save.driftBests[driftKey('harbor', 'hard', true)] = 4823;
  const loaded = sanitizeSave(JSON.parse(JSON.stringify(save)));
  expect(loaded).toEqual(save);
  expect(CHAPTERS).toHaveLength(8);
  expect(TRACKS).toHaveLength(6);
  expect(new Circuit(TRACKS[5]).length).toBeGreaterThan(1500);
  expect(TRACKS[5].points).not.toEqual(TRACKS[4].points);
});
test('braking distance reflects grip and analog pressure; grade influences coasting', () => {
  const stop = (grip: number, pressure: number) => {
    const t = newDrivetrain();
    let v = 25,
      d = 0;
    for (let i = 0; i < 600 && v > 0.1; i++) {
      v = stepPowertrain(t, v, false, pressure, SIM_STEP, 0, true, false, grip);
      d += v * SIM_STEP;
    }
    return d;
  };
  expect(stop(0.55, 1)).toBeGreaterThan(stop(1.12, 1) * 1.3);
  expect(stop(1.12, 0.3)).toBeGreaterThan(stop(1.12, 1) * 1.8);
  const uphill = stepPowertrain(
    newDrivetrain(),
    20,
    false,
    false,
    SIM_STEP,
    0,
    true,
    false,
    1,
    1,
    0.1,
  );
  const downhill = stepPowertrain(
    newDrivetrain(),
    20,
    false,
    false,
    SIM_STEP,
    0,
    true,
    false,
    1,
    1,
    -0.1,
  );
  expect(downhill).toBeGreaterThan(uphill);
});
test('Easy never auto-steers against neutral input and drift has no stationary sideways shove', () => {
  const c = new Circuit(TRACKS[0]),
    p = newDriver();
  spawnVehicle(p, c, 250, 3);
  p.speed = 12;
  simulateVehicle(
    p,
    { steer: 0, throttle: false, brake: false, drift: false, boost: false },
    c,
    { power: 0, grip: 0, boost: 0 },
    SIM_STEP,
    'easy',
  );
  expect(p.telemetry.steeringAngle).toBe(0);
  const stopped = newDriver();
  spawnVehicle(stopped, c);
  for (let i = 0; i < 120; i++)
    simulateVehicle(
      stopped,
      { steer: 1, throttle: false, brake: false, drift: true, boost: false },
      c,
      { power: 0, grip: 0, boost: 0 },
      SIM_STEP,
      'hard',
    );
  expect(Math.abs(stopped.velocity)).toBeLessThan(0.01);
});
test('glancing collision retains tangent speed; head-on contact loses inward momentum', () => {
  const world = new CollisionWorld();
  world.add(new Mesh(new BoxGeometry(0.2, 3, 100), new MeshBasicMaterial()));
  world.build();
  const p = newDriver();
  p.pose = { x: 0.75, y: 0, z: 0, yaw: 0, yawRate: 0 };
  p.speed = 25;
  p.velocity = -3;
  world.resolveWorld(p);
  expect(p.speed).toBeGreaterThan(23);
  expect(p.velocity).toBeGreaterThanOrEqual(0);
  const q = newDriver();
  q.pose = { x: 0.75, y: 0, z: 0, yaw: -Math.PI / 2, yawRate: 0 };
  q.speed = 25;
  world.resolveWorld(q);
  expect(Math.abs(q.speed)).toBeLessThan(5);
  world.dispose();
});
