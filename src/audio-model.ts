import { clamp } from './core';
const SHIFTS = [0, 13, 25, 37, 49, 62, 80];
export function engineTelemetry(speed: number) {
  const gear =
    speed < 0.6
      ? 0
      : Math.min(
          6,
          SHIFTS.findIndex((s) => s > speed),
        );
  const g = gear < 1 ? (speed < 0.6 ? 0 : 6) : gear;
  const start = SHIFTS[Math.max(0, g - 1)],
    end = SHIFTS[g || 1];
  const rpm = speed < 0.6 ? 1200 : 2400 + clamp((speed - start) / (end - start), 0, 1) * 4000;
  const n = clamp((rpm - 1200) / 5200, 0, 1);
  return {
    gear: g,
    rpm,
    redline: n,
    idle: Math.max(0, 1 - n * 2),
    mid: Math.max(0, 1 - Math.abs(n - 0.5) * 2),
    high: Math.max(0, n * 2 - 1),
  };
}
