import { newDrivetrain, type Drivetrain } from './drivetrain';
import { CHAPTERS, UPGRADES, PAINTS } from './content';
import { DIFFICULTIES, assistedSteer, type Difficulty } from './difficulty';
import { WHEELS, LIGHTING_PRICE } from './parts';
export type UpgradeId = 'power' | 'grip' | 'boost';
export interface Save {
  version: 2;
  committedRaceIds: string[];
  transmission: 'automatic' | 'manual';
  rims: 'graphite' | 'silver' | 'bronze';
  exhaust: 'standard' | 'sport';
  credits: number;
  chapter: number;
  upgrades: Record<UpgradeId, number>;
  /** Index into WHEELS; 0 is the factory wheel. */
  wheels: number;
  /** Wheel designs already paid for, so a player can switch back without re-buying. */
  ownedWheels: number[];
  /** 1 once the underglow kit is installed; the picker stays locked until then. */
  lighting: number;
  paint: number;
  rgb: number;
  rgbCycle: boolean;
  bests: Record<string, number>;
  driftBests: Record<string, number>;
  races: number;
  wins: number;
  settings: {
    sound: boolean;
    music: boolean;
    autoThrottle: boolean;
    quality: 'auto' | 'high' | 'low';
    motion: boolean;
    difficulty: Difficulty;
    night: boolean;
    voice: boolean;
    effectsVolume: number;
    musicVolume: number;
    voiceVolume: number;
  };
}
export const freshSave = (): Save => ({
  version: 2,
  committedRaceIds: [],
  transmission: 'automatic',
  rims: 'graphite',
  exhaust: 'standard',
  credits: 0,
  chapter: 0,
  upgrades: { power: 0, grip: 0, boost: 0 },
  wheels: 0,
  ownedWheels: [0],
  lighting: 0,
  paint: 0,
  rgb: 0,
  rgbCycle: false,
  bests: {},
  driftBests: {},
  races: 0,
  wins: 0,
  settings: {
    sound: true,
    music: true,
    autoThrottle: true,
    quality: 'auto',
    motion: true,
    difficulty: 'easy',
    night: false,
    voice: true,
    effectsVolume: 0.85,
    musicVolume: 0.24,
    voiceVolume: 0.85,
  },
});
export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
// The circuit's lane normal points left in the chase camera. Convert screen-right
// controls at this boundary; keep the simulation's signed curvature convention.
export const steeringToLane = (left: boolean, right: boolean, axis = 0) =>
  clamp(Number(left) - Number(right) - axis, -1, 1);
export function sanitizeSave(raw: unknown): Save {
  const s = freshSave();
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Partial<Save>;
  s.committedRaceIds = Array.isArray(r.committedRaceIds)
    ? [
        ...new Set(
          r.committedRaceIds.filter(
            (id): id is string => typeof id === 'string' && id.length > 0 && id.length < 100,
          ),
        ),
      ]
    : [];
  if (r.transmission === 'manual') s.transmission = 'manual';
  if (r.rims === 'silver' || r.rims === 'bronze') s.rims = r.rims;
  if (r.exhaust === 'sport') s.exhaust = 'sport';
  const num = (v: unknown, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.floor(clamp(v, 0, max)) : 0;
  s.credits = num(r.credits, 9999999);
  s.chapter = num(r.chapter, CHAPTERS.length);
  s.paint = num(r.paint, PAINTS.length - 1);
  s.rgb = num(r.rgb, 5);
  s.rgbCycle = r.rgbCycle === true;
  s.races = num(r.races, 999999);
  s.wins = num(r.wins, s.races);
  for (const key of ['power', 'grip', 'boost'] as const)
    s.upgrades[key] = num(r.upgrades?.[key], 3);
  s.ownedWheels = [
    ...new Set([
      0,
      ...(Array.isArray(r.ownedWheels) ? r.ownedWheels : [])
        .filter((w) => typeof w === 'number' && Number.isFinite(w) && w > 0 && w < WHEELS.length)
        .map((w) => Math.floor(w)),
    ]),
  ];
  s.wheels = num(r.wheels, WHEELS.length - 1);
  if (!s.ownedWheels.includes(s.wheels)) s.wheels = 0;
  // Saves from before the lighting kit existed already had free underglow; players who
  // had actually raced keep it rather than losing a feature to an update.
  s.lighting = r.lighting === undefined ? (s.races > 0 ? 1 : 0) : num(r.lighting, 1);
  if (r.bests && typeof r.bests === 'object')
    for (const [k, v] of Object.entries(r.bests))
      if (
        /^(smokies|coast|texas|desert|miami|harbor)-(1|2)(-(easy|hard)-(day|night))?(-(owner-v1|playground-v2))?$/.test(
          k,
        ) &&
        typeof v === 'number' &&
        Number.isFinite(v) &&
        v > 0
      )
        s.bests[k] = v;
  if (r.driftBests && typeof r.driftBests === 'object')
    for (const [key, value] of Object.entries(r.driftBests))
      if (
        /^(smokies|coast|texas|desert|miami|harbor)-(easy|hard)-(day|night)-drift-v1$/.test(key) &&
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0
      )
        s.driftBests[key] = Math.floor(clamp(value, 0, 99999999));
  if (r.settings && typeof r.settings === 'object') {
    for (const key of ['sound', 'music', 'autoThrottle', 'motion', 'night', 'voice'] as const)
      if (typeof r.settings[key] === 'boolean') s.settings[key] = r.settings[key];
    if (['auto', 'high', 'low'].includes(r.settings.quality))
      s.settings.quality = r.settings.quality;
    if (r.settings.difficulty === 'hard' || r.settings.difficulty === 'easy')
      s.settings.difficulty = r.settings.difficulty;
    for (const k of ['effectsVolume', 'musicVolume', 'voiceVolume'] as const)
      if (typeof r.settings[k] === 'number' && Number.isFinite(r.settings[k]))
        s.settings[k] = clamp(r.settings[k], 0, 1);
  }
  return s;
}
export function buyUpgrade(save: Save, id: UpgradeId): boolean {
  const u = UPGRADES.find((u) => u.id === id);
  const stage = save.upgrades[id];
  if (!u || stage >= 3 || save.credits < u.prices[stage]) return false;
  save.credits -= u.prices[stage];
  save.upgrades[id]++;
  return true;
}
export function buyWheels(save: Save, index: number): boolean {
  const design = WHEELS[index];
  if (!design) return false;
  if (save.ownedWheels.includes(index)) {
    save.wheels = index;
    return true;
  }
  if (save.credits < design.price) return false;
  save.credits -= design.price;
  save.ownedWheels.push(index);
  save.wheels = index;
  return true;
}
export function buyLighting(save: Save): boolean {
  if (save.lighting >= 1 || save.credits < LIGHTING_PRICE) return false;
  save.credits -= LIGHTING_PRICE;
  save.lighting = 1;
  return true;
}
export function rewardRace(
  save: Save,
  place: number,
  chapter: number | null,
  style: number,
  difficulty: Difficulty = 'easy',
) {
  const base = Math.round(
    [650, 450, 320, 240, 180, 140][clamp(place - 1, 0, 5)] * DIFFICULTIES[difficulty].reward,
  );
  const bonus = Math.min(350, Math.floor(style / 20));
  const complete =
    chapter !== null && chapter === save.chapter && place <= CHAPTERS[chapter].maxPlace;
  const sponsor = complete ? CHAPTERS[chapter!].reward : 0;
  save.credits += base + bonus + sponsor;
  save.races++;
  if (place === 1) save.wins++;
  if (complete) save.chapter++;
  return { base, bonus, sponsor, total: base + bonus + sponsor, complete };
}
export function formatTime(seconds: number) {
  const centiseconds = Math.round(seconds * 100);
  const m = Math.floor(centiseconds / 6000);
  const s = ((centiseconds % 6000) / 100).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
}
export interface Driver {
  telemetry: Drivetrain;
  previousPose?: { x: number; y: number; z: number; yaw: number; yawRate: number };
  pose?: { x: number; y: number; z: number; yaw: number; yawRate: number };
  distance: number;
  lane: number;
  velocity: number;
  speed: number;
  boost: number;
  style: number;
  drift: number;
  draft: number;
  hit: number;
  boosting: boolean;
}
export interface Input {
  steer: number;
  throttle: boolean | number;
  brake: boolean | number;
  drift: boolean;
  boost: boolean;
}
export const newDriver = (): Driver => ({
  telemetry: newDrivetrain(),
  distance: 0,
  lane: 0,
  velocity: 0,
  speed: 0,
  boost: 100,
  style: 0,
  drift: 0,
  draft: 0,
  hit: 0,
  boosting: false,
});
export function drive(
  p: Driver,
  input: Input,
  curve: number,
  upgrades: Save['upgrades'],
  dt: number,
  difficulty: Difficulty = 'easy',
) {
  const mode = DIFFICULTIES[difficulty];
  const steer = assistedSteer(p, input.steer, curve, difficulty);
  const capacity = 100 + upgrades.boost * 24;
  const maxSpeed = 49 + upgrades.power * 3.5;
  const onRoad = Math.abs(p.lane) < 8.2;
  p.hit = Math.max(0, p.hit - dt);
  p.boosting = input.boost && p.boost > 1 && p.speed > 12 && onRoad;
  const cornerDrag =
    Math.min(8, Math.abs(curve) * p.speed * p.speed * 0.045) / (1 + upgrades.grip * 0.2);
  const target = (input.throttle ? maxSpeed : 0) + (p.boosting ? 17 : 0) + (p.draft > 0 ? 4 : 0);
  const acceleration = input.brake
    ? -28 - upgrades.grip * 4
    : input.throttle
      ? 14 + upgrades.power * 2
      : -6;
  p.speed = clamp(
    p.speed + acceleration * dt,
    0,
    target > 0 ? Math.max(target, p.speed - 9 * dt) : 100,
  );
  if (p.speed > target) p.speed = Math.max(target, p.speed - 10 * dt);
  p.speed = Math.max(0, p.speed - cornerDrag * dt - (onRoad ? 0 : 19 * dt));
  const drifting = input.drift && p.speed > 20 && Math.abs(input.steer) > 0.2;
  const grip = 1 + upgrades.grip * 0.24;
  const centrifugal = (-curve * p.speed * p.speed * 0.115 * mode.cornerForce) / grip;
  const lateral = steer * (3.1 + p.speed * 0.105) * (drifting ? 1.3 : 1) + centrifugal;
  if (difficulty === 'hard') {
    const overload = Math.max(0, Math.abs(curve) * p.speed * p.speed - (29 + upgrades.grip * 4));
    p.speed = Math.max(0, p.speed - overload * 0.21 * dt);
  }
  p.velocity += (lateral - p.velocity) * Math.min(1, dt * (drifting ? 2.7 : 7));
  p.lane = clamp(p.lane + p.velocity * dt, -13, 13);
  if (Math.abs(p.lane) >= 12.9) {
    p.speed = Math.max(0, p.speed - 28 * dt);
    p.velocity *= 0.7;
  }
  if (drifting && onRoad) {
    p.drift += dt;
    p.style += dt * 65;
    p.boost = Math.min(capacity, p.boost + dt * 7);
  } else p.drift = 0;
  if (p.boosting) p.boost = Math.max(0, p.boost - dt * mode.boostDrain);
  else
    p.boost = Math.min(
      capacity,
      p.boost + dt * mode.boostRegen * (4 + upgrades.boost * 1.1 + (p.draft > 0 ? 8 : 0)),
    );
  p.distance += p.speed * dt;
}
