// SI units. ProStar-era inspired GAME calibration, not a measured dyno or OEM ratios.
export const POWERTRAIN = {
  mass: 840,
  wheelRadius: 0.329,
  wheelbase: 2.667,
  frontTrack: 1.755,
  idle: 1100,
  redline: 8500,
  finalDrive: 3.73,
  ratios: [3.75, 2.27, 1.55, 1.16, 0.91],
  shiftTime: 0.22,
  reverseRatio: 3.4,
} as const;
const bound = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export interface Drivetrain {
  rpm: number;
  gear: number;
  load: number;
  throttle: number;
  brake: number;
  shiftRemaining: number;
  shiftSerial: number;
  shiftCooldown: number;
  acceleration: number;
  steeringAngle: number;
  slipRatio: number;
  wheelSpeeds: [number, number, number];
  wheelAngles: [number, number, number];
  grounded: [boolean, boolean, boolean];
  suspension: [number, number, number];
  normalLoads: [number, number, number];
  surface: 'road' | 'shoulder';
  reverseHold: number;
  driftGrip: number;
  slipAngle: number;
  bodyRoll: number;
  bodyPitch: number;
  wheelSurfaces: ('road' | 'shoulder')[];
  wheelSlip: number[];
  contacts: { x: number; y: number; z: number }[];
}
export const newDrivetrain = (): Drivetrain => ({
  rpm: 1100,
  gear: 1,
  load: 0,
  throttle: 0,
  brake: 0,
  shiftRemaining: 0,
  shiftSerial: 0,
  shiftCooldown: 0,
  acceleration: 0,
  steeringAngle: 0,
  slipRatio: 0,
  wheelSpeeds: [0, 0, 0],
  wheelAngles: [0, 0, 0],
  grounded: [true, true, true],
  suspension: [0, 0, 0],
  normalLoads: [2500, 2500, 3240],
  surface: 'road',
  reverseHold: 0,
  driftGrip: 0,
  slipAngle: 0,
  bodyRoll: 0,
  bodyPitch: 0,
  wheelSurfaces: ['road', 'road', 'road'],
  wheelSlip: [0, 0, 0],
  contacts: [],
});
export function torqueAt(rpm: number) {
  const points = [
    [1100, 115],
    [2500, 155],
    [4500, 190],
    [6500, 198],
    [8000, 175],
    [8500, 145],
  ];
  for (let i = 1; i < points.length; i++)
    if (rpm < points[i][0]) {
      const a = points[i - 1],
        b = points[i];
      return a[1] + (b[1] - a[1]) * bound((rpm - a[0]) / (b[0] - a[0]), 0, 1);
    }
  return 145;
}
export function shift(t: Drivetrain, direction: number) {
  if (t.shiftCooldown > 0 || t.gear < 1) return;
  const next = bound(t.gear + direction, 1, 5);
  if (next === t.gear) return;
  t.gear = next;
  t.shiftRemaining = POWERTRAIN.shiftTime;
  t.shiftCooldown = 0.65;
  t.shiftSerial++;
}
export function stepPowertrain(
  t: Drivetrain,
  speed: number,
  throttle: boolean | number,
  brake: boolean | number,
  dt: number,
  power = 0,
  automatic = true,
  boost = false,
  traction = 1,
  brakeTraction = traction,
  grade = 0,
) {
  const gasInput = bound(Number(throttle), 0, 1),
    brakeInput = bound(Number(brake), 0, 1);
  t.shiftRemaining = Math.max(0, t.shiftRemaining - dt);
  t.shiftCooldown = Math.max(0, t.shiftCooldown - dt);
  // Brake-to-reverse requires holding the brake almost stationary for .65 s.
  t.reverseHold = brakeInput > 0.5 && Math.abs(speed) < 0.45 ? t.reverseHold + dt : 0;
  if (t.reverseHold > 0.65 && t.gear > 0) {
    t.gear = -1;
    t.reverseHold = 0;
    t.shiftSerial++;
  }
  if (t.gear < 0 && throttle && !brake && Math.abs(speed) < 0.6) {
    t.gear = 1;
    t.shiftRemaining = 0.2;
    t.shiftSerial++;
  }
  const reverse = t.gear < 0,
    gas = reverse ? brakeInput : gasInput * (1 - brakeInput);
  t.throttle = gas;
  t.brake = reverse ? gasInput * (1 - brakeInput) : brakeInput;
  const ratio =
    (reverse ? POWERTRAIN.reverseRatio : POWERTRAIN.ratios[t.gear - 1]) * POWERTRAIN.finalDrive;
  const wheelRpm = ((Math.abs(speed) / POWERTRAIN.wheelRadius) * 60) / (2 * Math.PI);
  const coupled = wheelRpm * ratio;
  const target = bound(
    Math.max(POWERTRAIN.idle, coupled, gas && Math.abs(speed) < 5 ? 2300 : 0),
    POWERTRAIN.idle,
    POWERTRAIN.redline + 200,
  );
  t.rpm += (target - t.rpm) * (1 - Math.exp(-dt * (t.shiftRemaining > 0 ? 12 : 22)));
  if (automatic && !reverse && t.shiftCooldown <= 0) {
    if (t.rpm > 7600 && t.gear < 5) shift(t, 1);
    else if (
      t.rpm < 2900 &&
      t.gear > 1 &&
      wheelRpm * POWERTRAIN.ratios[t.gear - 2] * POWERTRAIN.finalDrive < 6800
    )
      shift(t, -1);
  }
  const cut = t.shiftRemaining > 0 || t.rpm >= POWERTRAIN.redline;
  t.load += ((cut ? 0 : gas) - t.load) * (1 - Math.exp(-dt * 12));
  const raw =
    gas && !cut
      ? (gas * torqueAt(t.rpm) * ratio * 0.86 * (1 + power * 0.1) * (boost ? 1.36 : 1)) /
        POWERTRAIN.wheelRadius
      : 0;
  // Only the single rear contact supplies engine torque. Its load limits traction.
  const available = Math.max(0, t.normalLoads[2]) * traction;
  const force = Math.min(raw, available);
  t.slipRatio +=
    (bound((raw - available) / Math.max(1000, available), 0, 1.5) - t.slipRatio) *
    (1 - Math.exp(-dt * 10));
  const drag = 0.5 * 1.225 * 0.75 * speed * Math.abs(speed) + Math.sign(speed) * 125;
  const engineBrake = !gas ? (Math.sign(speed) * ratio * 12) / POWERTRAIN.wheelRadius : 0;
  const braking = t.brake * POWERTRAIN.mass * Math.min(11, 9.81 * brakeTraction) * Math.sign(speed);
  let acceleration =
    ((reverse ? -force : force) - drag - engineBrake - braking) / POWERTRAIN.mass - 9.81 * grade;
  if (t.brake && Math.abs(speed) < Math.abs(acceleration * dt)) acceleration = -speed / dt;
  if (!gas && Math.abs(speed) < 0.05) acceleration = -speed / dt;
  t.acceleration = acceleration;
  const next = bound(speed + acceleration * dt, -7, 85);
  const front = next / POWERTRAIN.wheelRadius;
  t.wheelSpeeds = [front, front, front * (1 + t.slipRatio)];
  t.wheelSpeeds.forEach((w, i) => (t.wheelAngles[i] += w * dt));
  return next;
}
export function engineMix(t: Drivetrain) {
  const n = bound((t.rpm - 1100) / 6900, 0, 1);
  const weights = [
    Math.max(0, 1 - n * 2),
    Math.max(0, 1 - Math.abs(n - 0.5) * 2),
    Math.max(0, n * 2 - 1),
  ];
  return {
    rpm: t.rpm,
    gear: t.gear,
    redline: bound(t.rpm / POWERTRAIN.redline, 0, 1),
    idle: Math.sqrt(weights[0]),
    mid: Math.sqrt(weights[1]),
    high: Math.sqrt(weights[2]),
  };
}
