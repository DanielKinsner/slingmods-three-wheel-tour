import { clamp, type Driver } from './core';
export type Difficulty = 'easy' | 'hard';
export const DIFFICULTIES = {
  easy: {
    name: 'EASY',
    description: 'Steering and corner-braking assist · relaxed rivals · quick boost recovery',
    cornerForce: 0.7,
    boostDrain: 20,
    boostRegen: 1.3,
    reward: 1,
  },
  hard: {
    name: 'HARD',
    description: 'Unassisted handling · faster rivals · brake before the apex',
    cornerForce: 1.3,
    boostDrain: 29,
    boostRegen: 0.65,
    reward: 1.3,
  },
};
export function rivalTarget(
  mode: Difficulty,
  bend: number,
  skill: number,
  chapter: number,
  power: number,
  time: number,
  index: number,
) {
  const base = mode === 'hard' ? 53 + power * 3 + chapter * 0.45 : 40 + chapter * 0.65;
  const cornerLimit = Math.sqrt((mode === 'hard' ? 26 : 22) / Math.max(0.006, bend));
  const straightBoost = mode === 'hard' && bend < 0.008 && (time + index * 2.7) % 14 < 2.5 ? 7 : 0;
  return Math.max(
    23,
    Math.min(base * skill + straightBoost, cornerLimit) + Math.sin(time * 0.43 + index) * 0.75,
  );
}
export function assistedSteer(p: Driver, steer: number, curve: number, mode: Difficulty) {
  if (mode === 'hard' || Math.abs(steer) > 0.05) return steer;
  return clamp(
    (-p.lane * 0.95 - p.velocity * 0.35 + curve * p.speed * p.speed * 0.08) /
      (3.1 + p.speed * 0.105),
    -0.75,
    0.75,
  );
}
export const bestKey = (track: string, laps: number, mode: Difficulty, night: boolean) =>
  `${track}-${laps}-${mode}-${night ? 'night' : 'day'}`;
