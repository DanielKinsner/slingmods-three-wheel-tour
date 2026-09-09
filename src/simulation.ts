import { Vector3 } from 'three/webgpu';
import { clamp, type Driver, type Input, type Save } from './core';
import { POWERTRAIN, stepPowertrain } from './drivetrain';
import type { Circuit } from './world';
import type { CollisionWorld } from './collision';
import { DIFFICULTIES, type Difficulty } from './difficulty';
export const SIM_STEP = 1 / 60;
export const angleDifference = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const positionOf = (p: Driver) => new Vector3(p.pose!.x, p.pose!.y, p.pose!.z);
export function spawnVehicle(p: Driver, circuit: Circuit, distance = 0, lane = 0) {
  const a = circuit.at(distance),
    v = a.p.clone().addScaledVector(a.r, lane);
  p.distance = distance;
  p.lane = lane;
  p.speed = 0;
  p.velocity = 0;
  p.pose = { x: v.x, y: v.y, z: v.z, yaw: Math.atan2(a.t.x, a.t.z), yawRate: 0 };
  p.previousPose = { ...p.pose };
  p.telemetry.steeringAngle = 0;
  p.telemetry.contacts = [];
  p.telemetry.driftGrip = p.telemetry.slipAngle = 0;
}
export function steeringLimit(speed: number) {
  return 0.49 / (1 + Math.abs(speed) * 0.055);
}
export function steeringForTarget(p: Driver, target: Vector3) {
  const pose = p.pose!;
  const dx = target.x - pose.x,
    dz = target.z - pose.z;
  const error = angleDifference(Math.atan2(dx, dz), pose.yaw);
  const desired = Math.atan2(
    2 * POWERTRAIN.wheelbase * Math.sin(error),
    Math.max(4, Math.hypot(dx, dz)),
  );
  return clamp(desired / steeringLimit(p.speed), -1, 1);
}
/** Planar three-contact simcade: independent X/Z/yaw; the spline is queried, never followed forcibly.
 * No full rigid-body rollover/jump claim. Suspension contacts query real road triangles. */
export function simulateVehicle(
  p: Driver,
  input: Input,
  circuit: Circuit,
  upgrades: Save['upgrades'],
  dt: number,
  mode: Difficulty,
  automatic = true,
  collision?: CollisionWorld,
) {
  if (!p.pose) spawnVehicle(p, circuit, p.distance, p.lane);
  p.previousPose = { ...p.pose! };
  const pose = p.pose!,
    t = p.telemetry,
    road = circuit.at(p.distance);
  // Wheel queries are shared by grip, ground attitude, animation and tire effects.
  const sampleContacts = () => {
    const samples = [
      [-0.8775, 1.197],
      [0.8775, 1.197],
      [0, -1.47],
    ];
    return samples.map(([x, z], i) => {
      const wx = pose.x + Math.cos(pose.yaw) * x + Math.sin(pose.yaw) * z;
      const wz = pose.z - Math.sin(pose.yaw) * x + Math.cos(pose.yaw) * z;
      const roadH = collision?.roadHeight(wx, wz, pose.y);
      const groundH = roadH ?? collision?.groundHeight(wx, wz, pose.y);
      const localLane = p.lane + x;
      t.wheelSurfaces[i] = (collision ? roadH !== undefined : Math.abs(localLane) < 8.5)
        ? 'road'
        : 'shoulder';
      t.grounded[i] = groundH !== undefined || !collision;
      const ground =
        groundH ?? (collision ? circuit.terrainAt(wx, wz).height : circuit.at(p.distance + z).p.y);
      t.contacts[i] = { x: wx, y: ground, z: wz };
      return ground;
    });
  };
  sampleContacts();
  const wheelMu = t.wheelSurfaces.map(
    (s) => (s === 'road' ? 1.12 : 0.63) * (1 + upgrades.grip * 0.07),
  );
  const mu = (wheelMu[0] + wheelMu[1] + wheelMu[2]) / 3;
  t.surface = t.wheelSurfaces.filter((s) => s === 'shoulder').length >= 2 ? 'shoulder' : 'road';
  // Easy stabilizes slip and limits corner entry speed, never steers toward the spline.
  const steer = clamp(input.steer, -1, 1);
  t.steeringAngle +=
    (steer * steeringLimit(p.speed) - t.steeringAngle) *
    (1 - Math.exp(-dt * (Math.abs(steer) < 0.02 ? 7 : 11)));
  const rearLoad =
    POWERTRAIN.mass * 9.81 * 0.43 +
    (POWERTRAIN.mass * t.acceleration * 0.34) / POWERTRAIN.wheelbase;
  const transfer = (POWERTRAIN.mass * p.speed * pose.yawRate * 0.34) / POWERTRAIN.frontTrack;
  t.normalLoads = [
    clamp((POWERTRAIN.mass * 9.81 - rearLoad) / 2 - transfer, 350, 6500),
    clamp((POWERTRAIN.mass * 9.81 - rearLoad) / 2 + transfer, 350, 6500),
    clamp(rearLoad, 1000, 6500),
  ];
  t.driftGrip +=
    ((input.drift && p.speed > 9 ? 1 : 0) - t.driftGrip) *
    (1 - Math.exp(-dt * (input.drift ? 4 : 2.8)));
  const lateralUse = clamp(Math.abs(p.speed * pose.yawRate) / (mu * 9.81), 0, 0.95);
  const bend = Math.max(...[15, 35, 60].map((d) => Math.abs(circuit.at(p.distance + d).curve)));
  const safeSpeed = Math.sqrt(7 / Math.max(0.002, bend));
  const assistBrake =
    mode === 'easy' && !input.drift ? clamp((p.speed - safeSpeed * 1.05) / 8, 0, 0.7) : 0;
  const brake = Math.max(Number(input.brake), assistBrake);
  p.boosting =
    input.boost && p.boost > 1 && p.speed > 10 && t.wheelSurfaces[2] === 'road' && brake < 0.1;
  const grade = road.t.y * Math.cos(pose.yaw - Math.atan2(road.t.x, road.t.z));
  p.speed = stepPowertrain(
    t,
    p.speed,
    Number(input.throttle) * (1 - assistBrake),
    brake,
    dt,
    upgrades.power,
    automatic,
    p.boosting,
    wheelMu[2] * Math.sqrt(Math.max(0.18, 1 - lateralUse * lateralUse)),
    mu * Math.sqrt(Math.max(0.22, 1 - lateralUse * lateralUse)),
    grade,
  );
  // Rolling resistance blends per contact. Crossing the paint never destroys speed.
  const shoulderFraction = t.wheelSurfaces.filter((s) => s === 'shoulder').length / 3;
  p.speed *= Math.exp(-dt * shoulderFraction * 0.095);
  const maxYaw =
    (mu * 9.81 * Math.sqrt(Math.max(0.3, 1 - (brake * 0.8) ** 2))) / Math.max(4, Math.abs(p.speed));
  const desiredYaw = (p.speed / POWERTRAIN.wheelbase) * Math.tan(t.steeringAngle);
  const targetYaw = clamp(desiredYaw, -maxYaw, maxYaw) * (1 + t.driftGrip * 0.1);
  pose.yawRate += (targetYaw - pose.yawRate) * (1 - Math.exp(-dt * (8 - t.driftGrip * 3)));
  const yawStep = pose.yawRate * dt;
  // Rotate the existing velocity into the new body frame: inertial slide, no lateral shove.
  const forward = p.speed * Math.cos(yawStep) + p.velocity * Math.sin(yawStep);
  p.velocity = p.velocity * Math.cos(yawStep) - p.speed * Math.sin(yawStep);
  p.speed = forward;
  pose.yaw += yawStep;
  const response = (mode === 'easy' ? 10 : 9) * (1 - t.driftGrip * 0.85);
  const sideGrip = mu * 9.81 * Math.sqrt(Math.max(0.28, 1 - (brake * 0.8) ** 2));
  const recovery = -p.velocity * response;
  p.velocity += clamp(recovery, -sideGrip, sideGrip) * dt;
  if (Math.abs(p.speed) < 2) p.velocity *= Math.exp(-dt * 5);
  t.slipAngle = Math.atan2(p.velocity, Math.max(1, Math.abs(p.speed)));
  const steps = Math.max(1, Math.ceil((Math.hypot(p.speed, p.velocity) * dt) / 0.45));
  for (let i = 0; i < steps; i++) {
    pose.x += ((Math.sin(pose.yaw) * p.speed + Math.cos(pose.yaw) * p.velocity) * dt) / steps;
    pose.z += ((Math.cos(pose.yaw) * p.speed - Math.sin(pose.yaw) * p.velocity) * dt) / steps;
    collision?.resolveWorld(p);
  }
  const projected = circuit.project(new Vector3(pose.x, pose.y, pose.z), p.distance);
  p.distance = projected.distance;
  p.lane = projected.lane;
  const heights = sampleContacts();
  pose.y += (heights.reduce((a, b) => a + b, 0) / 3 - pose.y) * (1 - Math.exp(-dt * 20));
  t.suspension = heights.map((h) => clamp(h - pose.y, -0.09, 0.09)) as [number, number, number];
  t.bodyRoll +=
    (clamp(-p.speed * pose.yawRate * 0.0045, -0.055, 0.055) - t.bodyRoll) * (1 - Math.exp(-dt * 7));
  t.bodyPitch +=
    (clamp(-t.acceleration * 0.004, -0.035, 0.045) - t.bodyPitch) * (1 - Math.exp(-dt * 6));
  // Contact slip is local to each axle; front scrub and rear wheelspin are distinct.
  const v = Math.max(3, Math.abs(p.speed));
  const frontSlip = Math.abs(Math.atan2(p.velocity + pose.yawRate * 1.197, v) - t.steeringAngle);
  const rearSlip = Math.abs(Math.atan2(p.velocity - pose.yawRate * 1.47, v));
  t.wheelSlip = [frontSlip, frontSlip, Math.max(rearSlip, t.slipRatio * 0.23)];
  for (let i = 0; i < 2; i++)
    t.wheelSpeeds[i] = (p.speed + pose.yawRate * (i ? 0.8775 : -0.8775)) / POWERTRAIN.wheelRadius;
  p.hit = Math.max(0, p.hit - dt);
  const controlled =
    p.speed > 9 &&
    Math.abs(t.slipAngle) > 0.095 &&
    Math.abs(t.slipAngle) < 0.65 &&
    p.hit <= 0 &&
    t.surface === 'road';
  p.drift = controlled ? p.drift + dt : 0;
  if (controlled) p.style += dt * 25 * clamp(Math.abs(t.slipAngle) * 5, 0.5, 2);
  const rules = DIFFICULTIES[mode];
  p.boost = clamp(
    p.boost + dt * (p.boosting ? -rules.boostDrain : rules.boostRegen * (4 + upgrades.boost)),
    0,
    100 + upgrades.boost * 24,
  );
  return road;
}

export function aiInput(
  p: Driver,
  circuit: Circuit,
  others: Driver[],
  skill: number,
  mode: Difficulty,
  ordinal: number,
): Input {
  const look = Math.max(12, Math.abs(p.speed) * 0.75);
  let lane = ordinal % 2 ? -1.7 : 1.7;
  const ahead = others.find(
    (o) =>
      o !== p &&
      o.distance - p.distance > 0 &&
      o.distance - p.distance < 24 &&
      Math.abs(o.lane - p.lane) < 2,
  );
  if (ahead) lane = ahead.lane > 0 ? -3.5 : 3.5;
  const target = circuit.at(p.distance + look);
  target.p.addScaledVector(target.r, lane);
  const curve = Math.max(
    ...[12, 28, 48, 70].map((d) => Math.abs(circuit.at(p.distance + d).curve)),
  );
  const cornerSpeed = Math.sqrt((mode === 'hard' ? 8.9 : 7.4) / Math.max(0.002, curve));
  const desired = Math.min(mode === 'hard' ? 53 : 44, cornerSpeed) * (0.89 + skill * 0.11);
  return {
    steer: steeringForTarget(p, target.p),
    throttle: p.speed < desired,
    brake: p.speed > desired + 1.4,
    drift: false,
    boost: mode === 'hard' && curve < 0.0025 && p.speed > 35 && p.boost > 55,
  };
}
export class FixedClock {
  accumulated = 0;
  steps = 0;
  pausedForStall = false;
  advance(dt: number, step: (dt: number) => void) {
    this.pausedForStall = dt > 0.25;
    if (this.pausedForStall) {
      this.accumulated = 0;
      return 0;
    }
    this.accumulated += Math.max(0, dt);
    let count = 0;
    while (this.accumulated + 1e-10 >= SIM_STEP && count < 15) {
      step(SIM_STEP);
      this.accumulated -= SIM_STEP;
      count++;
      this.steps++;
    }
    return this.accumulated / SIM_STEP;
  }
  reset() {
    this.accumulated = 0;
    this.pausedForStall = false;
  }
}
