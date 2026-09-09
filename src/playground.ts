import { clamp, type Driver } from './core';
import type { Circuit } from './world';

export type PlayMode = 'race' | 'drift' | 'free';
export const DRIFT_SECONDS = 90;
export const driftKey = (route: string, difficulty: string, night: boolean) =>
  `${route}-${difficulty}-${night ? 'night' : 'day'}-drift-v1`;

/** Score is earned from actual forward travel and body slip, not the drift input. */
export class DriftAttack {
  remaining = DRIFT_SECONDS;
  banked = 0;
  pending = 0;
  combo = 1;
  controlledSeconds = 0;
  cleanSeconds = 0;
  done = false;
  feedback = 'SLIDE, STRAIGHTEN, BANK';
  bank() {
    const score = Math.floor(this.pending * this.combo);
    this.banked += score;
    if (score) this.feedback = `BANKED +${score.toLocaleString()}`;
    this.pending = this.controlledSeconds = 0;
    this.combo = 1;
    return score;
  }
  breakCombo() {
    if (this.pending > 0) this.feedback = 'COMBO LOST · FIND YOUR LINE';
    this.pending = this.controlledSeconds = this.cleanSeconds = 0;
    this.combo = 1;
  }
  step(p: Driver, forwardTravel: number, dt: number, wrongWay = false) {
    if (this.done) return;
    const slice = Math.min(dt, this.remaining);
    this.remaining = Math.max(0, this.remaining - slice);
    const angle = Math.abs(p.telemetry.slipAngle);
    const invalid =
      p.hit > 0 || p.speed < 0 || wrongWay || angle > 0.85 || p.telemetry.surface !== 'road';
    const moving = p.speed > 8 && forwardTravel > slice * 4 && forwardTravel < slice * 90;
    if (invalid) this.breakCombo();
    else if (moving && angle > 0.1 && angle < 0.65) {
      this.cleanSeconds = 0;
      this.controlledSeconds += slice;
      this.combo = Math.min(5, 1 + Math.floor(this.controlledSeconds / 2));
      this.pending += slice * clamp(p.speed, 8, 45) * clamp(angle * 8, 0.8, 4) * 2;
      this.feedback = 'HOLD THE SLIDE';
    } else {
      this.cleanSeconds += slice;
      if (this.cleanSeconds >= 1.15) this.bank();
    }
    if (this.remaining <= 0.00001) {
      this.bank();
      this.done = true;
    }
  }
}

export class RouteTokens {
  collected = new Set<number>();
  constructor(public points: { x: number; y: number; z: number }[]) {}
  static forCircuit(circuit: Circuit) {
    return new RouteTokens(
      Array.from({ length: 12 }, (_, i) => {
        const a = circuit.at(55 + (i * circuit.length) / 12);
        return a.p.addScaledVector(a.r, i % 2 ? 2.5 : -2.5);
      }),
    );
  }
  collect(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }) {
    const dx = to.x - from.x,
      dz = to.z - from.z,
      length2 = dx * dx + dz * dz;
    // A reset/teleport must not collect a whole row of tokens.
    if (length2 > 25) return [];
    const hits: number[] = [];
    this.points.forEach((p, i) => {
      if (this.collected.has(i)) return;
      const f = clamp(((p.x - from.x) * dx + (p.z - from.z) * dz) / Math.max(0.001, length2), 0, 1);
      if (
        Math.hypot(from.x + dx * f - p.x, from.z + dz * f - p.z) < 2.2 &&
        Math.abs(to.y - p.y) < 2
      ) {
        this.collected.add(i);
        hits.push(i);
      }
    });
    return hits;
  }
}
