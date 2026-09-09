import { afterAll, describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Vector3,
} from 'three/webgpu';
import { TRACKS } from './content';
import { newDriver, steeringToLane, type Input } from './core';
import { Circuit } from './world';
import {
  aiInput,
  FixedClock,
  positionOf,
  SIM_STEP,
  simulateVehicle,
  spawnVehicle,
} from './simulation';
import { makeGates, RaceProgress } from './race-rules';
import type { Difficulty } from './difficulty';
import { CollisionWorld } from './collision';
import { roadOrientation } from './road-frame';

const upgrades = { power: 0, grip: 0, boost: 0 };
// This test-only evidence writer stays outside the browser's configured TS types.
const nodeFs = 'node:fs';
const { writeFileSync, mkdirSync } = (await import(/* @vite-ignore */ nodeFs)) as {
  writeFileSync(path: string, contents: string): void;
  mkdirSync(path: string, options: { recursive: boolean }): void;
};
const neutral: Input = { steer: 0, throttle: false, brake: false, drift: false, boost: false };
const diagnostics: Record<string, unknown>[] = [];
afterAll(() => {
  mkdirSync('evidence', { recursive: true });
  writeFileSync(
    'evidence/simulation-results.json',
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        scope: 'Node deterministic simulation tests; no browser or physical-device claim',
        simStep: SIM_STEP,
        upgrades,
        collisionScope:
          'Controller plus actual CollisionWorld road/shoulder BVHs, runtime-sized instanced rail fixtures, three-wheel ground queries, seam, shoulder containment and thin-wall impact tests. Not full 3D rigid-body or physical-device proof.',
        results: diagnostics,
      },
      null,
      2,
    ) + '\n',
  );
});

describe('shared controller route completion', () => {
  for (const track of TRACKS)
    for (const planning of ['easy', 'hard'] as Difficulty[]) {
      it(`${planning} AI completes ${track.id} through every ordered gate`, () => {
        const route = new Circuit(track),
          driver = newDriver();
        spawnVehicle(driver, route, 0, 0);
        const gates = new RaceProgress(makeGates(route), 1, route.length);
        let steps = 0,
          offRoadSeconds = 0,
          maxLane = 0,
          maxSpeed = 0,
          accepted = 0;
        const observed: number[] = [];
        while (gates.finishedAt === null && steps < 60 * 240) {
          const before = positionOf(driver),
            input = aiInput(driver, route, [], 1, planning, 0);
          // Runtime opponents do not get the player's Easy steering assist.
          simulateVehicle(driver, input, route, upgrades, SIM_STEP, 'hard', true);
          steps++;
          if (gates.cross(before, positionOf(driver), steps * SIM_STEP, SIM_STEP)) {
            accepted++;
            observed.push(gates.lastGate);
          }
          maxLane = Math.max(maxLane, Math.abs(driver.lane));
          maxSpeed = Math.max(maxSpeed, Math.abs(driver.speed));
          if (Math.abs(driver.lane) > 8.4) offRoadSeconds += SIM_STEP;
        }
        const result = {
          kind: 'ai-route',
          track: track.id,
          planning,
          finishedAt: gates.finishedAt,
          simulationSeconds: steps * SIM_STEP,
          routeLength: route.length,
          acceptedGates: accepted,
          gateOrder: observed,
          nextGate: gates.next,
          offRoadSeconds,
          maxLane,
          maxSpeed,
          finalDistance: driver.distance,
          finalPose: driver.pose,
        };
        diagnostics.push(result);
        expect(gates.finishedAt, JSON.stringify(result)).not.toBeNull();
        expect(observed).toEqual([...Array.from({ length: 31 }, (_, i) => i + 1), 0]);
        expect(gates.lap).toBe(1);
        expect(gates.sectors.every((t) => t > 0)).toBe(true);
        expect(offRoadSeconds, JSON.stringify(result)).toBeLessThan(8);
      }, 15000);
    }
});

describe('fixed-step determinism and input orientation', () => {
  it('30, 60, 120 and 144 Hz render schedules yield the same controller state and gate events', () => {
    const results = [];
    for (const hz of [30, 60, 120, 144]) {
      const route = new Circuit(TRACKS[0]),
        driver = newDriver(),
        clock = new FixedClock();
      spawnVehicle(driver, route);
      const race = new RaceProgress(makeGates(route), 1, route.length);
      for (let frame = 0; frame < hz * 45; frame++)
        clock.advance(1 / hz, (dt) => {
          const from = positionOf(driver);
          simulateVehicle(
            driver,
            aiInput(driver, route, [], 1, 'hard', 0),
            route,
            upgrades,
            dt,
            'hard',
          );
          race.cross(from, positionOf(driver), (clock.steps + 1) * dt, dt);
        });
      results.push({
        hz,
        steps: clock.steps,
        pose: driver.pose,
        speed: driver.speed,
        rpm: driver.telemetry.rpm,
        gear: driver.telemetry.gear,
        next: race.next,
        sectors: race.sectors,
      });
    }
    diagnostics.push({ kind: 'render-schedule', results });
    for (const result of results.slice(1)) expect({ ...result, hz: 30 }).toEqual(results[0]);
    expect(results[0].steps).toBe(2700);
  });

  it('stall policy freezes race time instead of simulating a hidden backlog', () => {
    const clock = new FixedClock();
    let time = 0;
    clock.advance(1 / 60, (dt) => {
      time += dt;
    });
    clock.advance(5, (dt) => {
      time += dt;
    });
    expect(clock.pausedForStall).toBe(true);
    expect(time).toBe(SIM_STEP);
    clock.advance(SIM_STEP, (dt) => {
      time += dt;
    });
    expect(time).toBe(SIM_STEP * 2);
    diagnostics.push({
      kind: 'stall-policy',
      simulatedSeconds: time,
      discardedStallSeconds: 5,
      steps: clock.steps,
    });
  });

  for (const distance of [0, 200, 600, 1100])
    for (const cameraDistance of [-12, -0.35]) {
      it(`physical right/left motion projects correctly at route ${distance}, camera ${cameraDistance}`, () => {
        const route = new Circuit(TRACKS[0]),
          anchor = route.at(distance);
        const camera = new PerspectiveCamera(60, 1.6, 0.05, 1000);
        camera.position
          .copy(anchor.p)
          .addScaledVector(anchor.t, cameraDistance)
          .add(new Vector3(0, 1, 0));
        camera.lookAt(anchor.p.clone().addScaledVector(anchor.t, 30));
        camera.updateMatrixWorld();
        const projected = [];
        for (const steer of [steeringToLane(false, true), 0, steeringToLane(true, false)]) {
          const driver = newDriver();
          spawnVehicle(driver, route, distance, 0);
          driver.speed = 16;
          for (let i = 0; i < 30; i++)
            simulateVehicle(
              driver,
              { ...neutral, steer, throttle: true },
              route,
              upgrades,
              SIM_STEP,
              'hard',
              false,
            );
          projected.push(positionOf(driver).project(camera).x);
        }
        expect(projected[0]).toBeGreaterThan(projected[1]);
        expect(projected[2]).toBeLessThan(projected[1]);
        diagnostics.push({
          kind: 'steering',
          distance,
          cameraDistance,
          screenXRightStraightLeft: projected,
        });
      });
    }
});

describe('race progress rejects illegal travel and recovery exploits', () => {
  const route = new Circuit(TRACKS[4]);
  const crossing = (
    race: RaceProgress,
    gate: number,
    time: number,
    reverse = false,
    lane = 0,
    extent = 0.3,
  ) => {
    const g = race.gates[gate],
      center = g.p.clone().addScaledVector(g.r, lane);
    const a = center.clone().addScaledVector(g.t, reverse ? extent : -extent);
    const b = center.clone().addScaledVector(g.t, reverse ? -extent : extent);
    return race.cross(a, b, time, SIM_STEP);
  };
  it('finish-line, skipped gates, reverse, shoulder and teleports cannot finish', () => {
    const race = new RaceProgress(makeGates(route), 1, route.length);
    expect(crossing(race, 0, 1)).toBe(false);
    expect(crossing(race, 2, 2)).toBe(false);
    expect(crossing(race, 1, 3, true)).toBe(false);
    expect(crossing(race, 1, 4, false, 10)).toBe(false);
    expect(crossing(race, 1, 5, false, 0, 20)).toBe(false);
    for (let gate = 2; gate < 32; gate++) crossing(race, gate, gate + 6);
    crossing(race, 0, 40);
    expect(race.next).toBe(1);
    expect(race.lap).toBe(0);
    expect(race.finishedAt).toBeNull();
    diagnostics.push({
      kind: 'illegal-progress',
      next: race.next,
      lap: race.lap,
      finishedAt: race.finishedAt,
    });
  });
  it('repeated recovery after one valid gate neither skips nor re-awards a gate', () => {
    const race = new RaceProgress(makeGates(route), 1, route.length),
      driver = newDriver();
    expect(crossing(race, 1, 1)).toBe(true);
    const recovery = race.recoveryDistance;
    for (let i = 0; i < 10; i++) {
      spawnVehicle(driver, route, recovery, 0);
      const from = positionOf(driver);
      simulateVehicle(driver, { ...neutral, throttle: true }, route, upgrades, SIM_STEP, 'hard');
      expect(race.cross(from, positionOf(driver), 2 + i * SIM_STEP, SIM_STEP)).toBe(false);
    }
    expect(race.sectors).toHaveLength(1);
    expect(race.next).toBe(2);
    expect(race.finishedAt).toBeNull();
    diagnostics.push({
      kind: 'repeated-recovery',
      repetitions: 10,
      recoveryDistance: recovery,
      next: race.next,
      sectors: race.sectors,
    });
  });
  it('brake-to-reverse moves backward without awarding a forward checkpoint', () => {
    const race = new RaceProgress(makeGates(route), 1, route.length),
      driver = newDriver();
    const first = race.gates[1];
    spawnVehicle(driver, route, first.distance + 1, 0);
    const start = positionOf(driver);
    for (let i = 0; i < 180; i++) {
      const before = positionOf(driver);
      simulateVehicle(driver, { ...neutral, brake: true }, route, upgrades, SIM_STEP, 'hard');
      race.cross(before, positionOf(driver), (i + 1) * SIM_STEP, SIM_STEP);
    }
    expect(driver.telemetry.gear).toBe(-1);
    expect(driver.speed).toBeLessThan(-0.5);
    expect(positionOf(driver).sub(start).dot(first.t)).toBeLessThan(-1);
    expect(race.next).toBe(1);
    expect(race.sectors).toHaveLength(0);
    diagnostics.push({
      kind: 'reverse',
      gear: driver.telemetry.gear,
      speed: driver.speed,
      next: race.next,
    });
  });
});

/** Match runtime road/shoulder ribbons and 0.24 x 0.55 m rail sections. */
function roadFixture(route: Circuit, withBarriers = true) {
  const collision = new CollisionWorld(),
    positions: number[] = [],
    indices: number[] = [],
    shoulderPositions: number[] = [];
  for (let i = 0; i <= 800; i++) {
    const a = route.at((i * route.length) / 800);
    for (const side of [-8.5, 8.5])
      positions.push(a.p.x + a.r.x * side, a.p.y + 0.015, a.p.z + a.r.z * side);
    for (const side of [-15, 15])
      shoulderPositions.push(a.p.x + a.r.x * side, a.p.y - 0.16, a.p.z + a.r.z * side);
    if (i < 800) {
      const j = i * 2;
      indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
    }
  }
  const roadGeometry = new BufferGeometry();
  roadGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  roadGeometry.setIndex(indices);
  const material = new MeshBasicMaterial(),
    roadMesh = new Mesh(roadGeometry, material);
  collision.setRoad(roadMesh);
  const shoulderGeometry = new BufferGeometry();
  shoulderGeometry.setAttribute('position', new Float32BufferAttribute(shoulderPositions, 3));
  shoulderGeometry.setIndex(indices);
  collision.addGround(new Mesh(shoulderGeometry, material));
  if (withBarriers) {
    const count = Math.floor(route.length / 4),
      railGeometry = new BoxGeometry(0.24, 0.55, 1);
    const rails = new InstancedMesh(railGeometry, material, count * 2),
      dummy = new Object3D();
    for (let i = 0; i < count * 2; i++) {
      const distance = (Math.floor(i / 2) * route.length) / count,
        a = route.at(distance),
        b = route.at(distance + route.length / count),
        side = i % 2 ? 1 : -1;
      const start = a.p.clone().addScaledVector(a.r, side * 11),
        end = b.p.clone().addScaledVector(b.r, side * 11),
        direction = end.clone().sub(start);
      dummy.position.copy(start).add(end).multiplyScalar(0.5);
      dummy.position.y += 0.73;
      roadOrientation(direction.clone().normalize(), dummy.quaternion);
      dummy.scale.set(1, 1, direction.length() + 0.08);
      dummy.updateMatrix();
      rails.setMatrixAt(i, dummy.matrix);
    }
    collision.add(rails);
    railGeometry.dispose();
    collision.build();
  }
  return {
    collision,
    dispose() {
      collision.dispose();
      roadGeometry.dispose();
      shoulderGeometry.dispose();
      material.dispose();
    },
  };
}

describe('actual triangle-road contacts and swept barrier recovery', () => {
  for (const track of TRACKS)
    it(`Easy assisted driving completes ${track.id} validly`, () => {
      const route = new Circuit(track),
        fixture = roadFixture(route),
        driver = newDriver();
      spawnVehicle(driver, route, 0, -3);
      const race = new RaceProgress(makeGates(route), 1, route.length);
      let steps = 0,
        lost = 0,
        maxLane = 0,
        offRoadSeconds = 0;
      while (race.finishedAt === null && steps < 60 * 240) {
        const before = positionOf(driver);
        simulateVehicle(
          driver,
          aiInput(driver, route, [], 1, 'easy', 0),
          route,
          upgrades,
          SIM_STEP,
          'easy',
          true,
          fixture.collision,
        );
        steps++;
        race.cross(before, positionOf(driver), steps * SIM_STEP, SIM_STEP);
        if (driver.telemetry.grounded.some((g) => !g)) lost++;
        maxLane = Math.max(maxLane, Math.abs(driver.lane));
        if (Math.abs(driver.lane) > 8.4) offRoadSeconds += SIM_STEP;
      }
      const record = {
        kind: 'easy-guided-road-bvh',
        track: track.id,
        finishedAt: race.finishedAt,
        nextGate: race.next,
        acceptedGates: race.sectors.length,
        maxLane,
        offRoadSeconds,
        groundLoss: lost,
        contacts: fixture.collision.contacts,
        pose: driver.pose,
      };
      diagnostics.push(record);
      fixture.dispose();
      expect(race.finishedAt, JSON.stringify(record)).not.toBeNull();
      expect(race.sectors).toHaveLength(32);
      expect(lost).toBe(0);
      expect(offRoadSeconds).toBeLessThan(8);
      expect(maxLane).toBeLessThan(10.5);
    }, 15000);

  for (const side of [-1, 1])
    for (const initialSpeed of [8, 35, 65])
      it(`shoulder supports chassis against ${side > 0 ? 'right' : 'left'} rail at ${initialSpeed} m/s`, () => {
        const route = new Circuit(TRACKS[1]),
          fixture = roadFixture(route),
          driver = newDriver();
        spawnVehicle(driver, route, 120, side * 7.4);
        driver.speed = initialSpeed;
        let maxOutwardLane = 0,
          minRoadHeight = Infinity,
          shoulderFrames = 0,
          groundLoss = 0;
        for (let i = 0; i < 360; i++) {
          simulateVehicle(
            driver,
            { ...neutral, throttle: true, steer: side },
            route,
            upgrades,
            SIM_STEP,
            'hard',
            true,
            fixture.collision,
          );
          maxOutwardLane = Math.max(maxOutwardLane, side * driver.lane);
          minRoadHeight = Math.min(minRoadHeight, driver.pose!.y - route.at(driver.distance).p.y);
          if (driver.telemetry.surface === 'shoulder') shoulderFrames++;
          if (driver.telemetry.grounded.some((g) => !g)) groundLoss++;
        }
        const record = {
          kind: 'shoulder-rail-containment',
          side,
          initialSpeed,
          maxOutwardLane,
          minRoadHeight,
          shoulderFrames,
          groundLoss,
          contacts: fixture.collision.contacts,
          pose: driver.pose,
        };
        diagnostics.push(record);
        fixture.dispose();
        expect(shoulderFrames, JSON.stringify(record)).toBeGreaterThan(0);
        expect(record.contacts).toBeGreaterThan(0);
        expect(maxOutwardLane, JSON.stringify(record)).toBeLessThan(10.7);
        expect(minRoadHeight, JSON.stringify(record)).toBeGreaterThan(-0.3);
        expect(groundLoss).toBe(0);
        expect(Object.values(driver.pose!).every(Number.isFinite)).toBe(true);
      });

  for (const track of TRACKS)
    it(`all three contacts remain grounded through ${track.id} gates and road seam`, () => {
      const route = new Circuit(track),
        fixture = roadFixture(route),
        driver = newDriver();
      spawnVehicle(driver, route, 0, 0);
      const race = new RaceProgress(makeGates(route), 1, route.length);
      let steps = 0,
        contactLossFrames = 0,
        largestHeightStep = 0,
        maxSuspension = 0,
        maxLane = 0;
      while (race.finishedAt === null && steps < 60 * 180) {
        const before = positionOf(driver);
        simulateVehicle(
          driver,
          aiInput(driver, route, [], 1, 'hard', 0),
          route,
          upgrades,
          SIM_STEP,
          'hard',
          true,
          fixture.collision,
        );
        steps++;
        race.cross(before, positionOf(driver), steps * SIM_STEP, SIM_STEP);
        if (driver.telemetry.grounded.some((g) => !g)) contactLossFrames++;
        largestHeightStep = Math.max(largestHeightStep, Math.abs(driver.pose!.y - before.y));
        maxSuspension = Math.max(maxSuspension, ...driver.telemetry.suspension.map(Math.abs));
        maxLane = Math.max(maxLane, Math.abs(driver.lane));
      }
      const record = {
        kind: 'road-bvh-route',
        track: track.id,
        finishedAt: race.finishedAt,
        acceptedGates: race.sectors.length,
        contactLossFrames,
        largestHeightStep,
        maxSuspension,
        maxLane,
        barrierContacts: fixture.collision.contacts,
        finalPose: driver.pose,
        finalGrounded: driver.telemetry.grounded,
      };
      diagnostics.push(record);
      fixture.dispose();
      expect(race.finishedAt, JSON.stringify(record)).not.toBeNull();
      expect(race.sectors).toHaveLength(32);
      expect(contactLossFrames).toBe(0);
      expect(driver.telemetry.grounded).toEqual([true, true, true]);
      expect(largestHeightStep).toBeLessThan(0.6);
      expect(maxSuspension).toBeLessThanOrEqual(0.09);
      expect(Object.values(driver.pose!).every(Number.isFinite)).toBe(true);
    }, 15000);

  for (const initialSpeed of [35, 65])
    it(`swept ${initialSpeed} m/s front impact does not cross a thin wall`, () => {
      const route = new Circuit(TRACKS[1]),
        fixture = roadFixture(route, false),
        wallAt = route.at(130);
      const wallGeometry = new PlaneGeometry(40, 3),
        material = new MeshBasicMaterial(),
        wall = new Mesh(wallGeometry, material);
      wall.position.copy(wallAt.p).add(new Vector3(0, 1.4, 0));
      wall.rotation.y = Math.atan2(wallAt.t.x, wallAt.t.z);
      fixture.collision.add(wall);
      fixture.collision.build();
      const driver = newDriver();
      spawnVehicle(driver, route, 120, 0);
      driver.speed = initialSpeed;
      let maxPlaneDistance = -Infinity,
        groundLoss = 0;
      for (let i = 0; i < 120; i++) {
        simulateVehicle(
          driver,
          { ...neutral, throttle: true },
          route,
          upgrades,
          SIM_STEP,
          'hard',
          true,
          fixture.collision,
        );
        maxPlaneDistance = Math.max(
          maxPlaneDistance,
          positionOf(driver).sub(wallAt.p).dot(wallAt.t),
        );
        if (driver.telemetry.grounded.some((v) => !v)) groundLoss++;
      }
      const result = {
        kind: 'thin-wall-impact',
        initialSpeed,
        maxPlaneDistance,
        contacts: fixture.collision.contacts,
        speedAfter: driver.speed,
        finalPose: driver.pose,
        groundLoss,
      };
      diagnostics.push(result);
      fixture.dispose();
      wallGeometry.dispose();
      material.dispose();
      expect(result.contacts).toBeGreaterThan(0);
      expect(maxPlaneDistance, JSON.stringify(result)).toBeLessThan(-1);
      expect(result.speedAfter).toBeLessThan(initialSpeed * 0.5);
      expect(groundLoss).toBe(0);
      expect(Object.values(driver.pose!).every(Number.isFinite)).toBe(true);
    });

  it('reverse traverses the closed road seam with three ground contacts and no finish credit', () => {
    const route = new Circuit(TRACKS[1]),
      fixture = roadFixture(route),
      driver = newDriver();
    spawnVehicle(driver, route, 2, 0);
    const race = new RaceProgress(makeGates(route), 1, route.length);
    let lost = 0;
    for (let i = 0; i < 180; i++) {
      const before = positionOf(driver);
      simulateVehicle(
        driver,
        { ...neutral, brake: true },
        route,
        upgrades,
        SIM_STEP,
        'hard',
        true,
        fixture.collision,
      );
      race.cross(before, positionOf(driver), (i + 1) * SIM_STEP, SIM_STEP);
      if (driver.telemetry.grounded.some((v) => !v)) lost++;
    }
    diagnostics.push({
      kind: 'reverse-road-seam',
      distance: driver.distance,
      groundLoss: lost,
      nextGate: race.next,
      pose: driver.pose,
    });
    fixture.dispose();
    expect(driver.distance).toBeLessThan(0);
    expect(lost).toBe(0);
    expect(race.finishedAt).toBeNull();
    expect(race.sectors).toHaveLength(0);
  });
});
