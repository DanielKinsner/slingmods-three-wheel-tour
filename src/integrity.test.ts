import { describe, it, expect } from 'vitest';
import { freshSave, rewardRace, sanitizeSave, steeringToLane } from './core';
import { commitRace } from './race-rules';
import { CHAPTERS } from './content';
import { PerspectiveCamera, Vector3 } from 'three/webgpu';
describe('verified source findings', () => {
  it('chapter bonus is paid exactly once in the existing balance, not twice', () => {
    const s = freshSave();
    const r = rewardRace(s, 1, 0, 400);
    expect(s.credits).toBe(650 + 20 + CHAPTERS[0].reward);
    expect(s.credits).toBe(r.total);
  });
  it('duplicate finish and saved-result replay cannot pay a second purse', () => {
    const s = freshSave();
    const result = {
      id: 'test-race-001',
      place: 1,
      chapter: 0,
      style: 400,
      difficulty: 'easy' as const,
    };
    const r = commitRace(s, result);
    const balance = s.credits;
    expect(r?.total).toBe(balance);
    expect(commitRace(s, result)).toBeNull();
    const restored = sanitizeSave(JSON.parse(JSON.stringify(s)));
    expect(commitRace(restored, result)).toBeNull();
    expect(restored.credits).toBe(balance);
    expect(restored.races).toBe(1);
  });
  for (const cameraZ of [-12, -0.35])
    for (const heading of [0, 0.8, 2.7, -2.9]) {
      it(`keyboard/touch/controller right is screen-right at heading ${heading}, camera ${cameraZ}`, () => {
        const forward = new Vector3(Math.sin(heading), 0, Math.cos(heading));
        const lateral = new Vector3(forward.z, 0, -forward.x);
        const c = new PerspectiveCamera(60, 1.6, 0.05, 1000);
        c.position.copy(forward).multiplyScalar(cameraZ);
        c.position.y = 1;
        c.lookAt(forward.clone().multiplyScalar(20));
        c.updateMatrixWorld();
        const center = forward.clone().multiplyScalar(20);
        for (const value of [steeringToLane(false, true), steeringToLane(false, false, 1)]) {
          expect(center.clone().addScaledVector(lateral, value).project(c).x).toBeGreaterThan(
            center.clone().project(c).x,
          );
          // +Z-front model: negative yaw points the front wheels to screen right.
          expect(value * 0.35).toBeLessThan(0);
        }
      });
    }
});
