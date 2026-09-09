import { rewardRace, type Save } from './core';
import type { Difficulty } from './difficulty';
import { Vector3 } from 'three/webgpu';
export const RULES_VERSION = 'playground-v2';
export interface RaceResult {
  id: string;
  place: number;
  chapter: number | null;
  style: number;
  difficulty: Difficulty;
}
/** The receipt is persisted in the same save write as credits and progression. */
export function commitRace(save: Save, result: RaceResult) {
  if (!result.id || save.committedRaceIds.includes(result.id)) return null;
  if (
    !Number.isInteger(result.place) ||
    result.place < 1 ||
    result.place > 6 ||
    !Number.isFinite(result.style)
  )
    return null;
  if (
    result.chapter !== null &&
    (!Number.isInteger(result.chapter) || result.chapter < 0 || result.chapter >= 8)
  )
    return null;
  const receipt = rewardRace(
    save,
    result.place,
    result.chapter,
    Math.max(0, result.style),
    result.difficulty,
  );
  save.committedRaceIds.push(result.id);
  return receipt;
}
export interface Gate {
  p: Vector3;
  t: Vector3;
  r: Vector3;
  distance: number;
}
export function makeGates(
  route: { length: number; at(d: number): { p: Vector3; t: Vector3; r: Vector3 } },
  count = 32,
): Gate[] {
  return Array.from({ length: count }, (_, i) => ({
    ...route.at((i * route.length) / count),
    distance: (i * route.length) / count,
  }));
}
export class RaceProgress {
  next = 1;
  lap = 0;
  finishedAt: number | null = null;
  lastGate = 0;
  lastGateTime = 0;
  lastSector = 0;
  sectors: number[] = [];
  lapTimes: number[] = [];
  resets = 0;
  wrongWay = false;
  startedAt = 0;
  constructor(
    public gates: Gate[],
    public laps: number,
    public length: number,
  ) {}
  cross(from: Vector3, to: Vector3, time: number, dt: number) {
    if (this.finishedAt !== null) return false;
    const g = this.gates[this.next];
    const before = from.clone().sub(g.p).dot(g.t),
      after = to.clone().sub(g.p).dot(g.t);
    if (before >= 0 || after < 0 || after - before < 1e-6) return false;
    // A teleport cannot count as travel, even if it spans the expected plane.
    if (from.distanceTo(to) > Math.max(4, 100 * dt)) return false;
    const f = -before / (after - before),
      point = from.clone().lerp(to, f).sub(g.p);
    if (Math.abs(point.dot(g.r)) > 8.6 || Math.abs(point.y) > 1.8) return false;
    const crossedAt = time - dt + dt * f;
    this.lastSector = crossedAt - this.lastGateTime;
    this.sectors.push(this.lastSector);
    this.lastGateTime = crossedAt;
    this.lastGate = this.next;
    if (this.next === 0) {
      const prior = this.lapTimes.reduce((a, b) => a + b, 0);
      this.lapTimes.push(crossedAt - prior);
      this.lap++;
      if (this.lap >= this.laps) this.finishedAt = crossedAt;
    }
    this.next = (this.next + 1) % this.gates.length;
    return true;
  }
  get validProgress() {
    return this.lap * this.length + this.gates[this.lastGate].distance;
  }
  get recoveryDistance() {
    return this.lap * this.length + this.gates[this.lastGate].distance + 2;
  }
}
