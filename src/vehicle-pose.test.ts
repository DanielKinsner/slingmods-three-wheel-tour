import { describe, expect, it } from 'vitest';
import * as T from 'three/webgpu';
import { TRACKS } from './content';
import { Circuit, World, type TrackPoint } from './world';

const up = new T.Vector3(0, 1, 0);
function carFixture() {
  const car = new T.Group();
  car.userData = {
    steering: new T.Group(),
    wheels: [new T.Group(), new T.Group(), new T.Group()],
    pivots: [new T.Group(), new T.Group(), new T.Group()],
  };
  return car;
}
function place(car: T.Group, frame: TrackPoint, yaw = 0) {
  const context = {
    circuit: { at: () => frame },
    collision: { roadHeight: () => undefined },
  } as unknown as World;
  World.prototype.placeCar.call(context, car, 0, 0, yaw, 0);
}
function frameFor(t: T.Vector3): TrackPoint {
  return {
    p: new T.Vector3(0, 3, 0),
    t: t.normalize(),
    r: new T.Vector3().crossVectors(up, t).normalize(),
    curve: 0,
  };
}

describe('vehicle road orientation', () => {
  it('stays upright when travelling toward negative Z on a shallow slope', () => {
    const car = carFixture();
    const frame = frameFor(new T.Vector3(0, 0.03, -1));
    place(car, frame);
    expect(up.clone().applyQuaternion(car.quaternion).y).toBeGreaterThan(0.99);
    expect(new T.Vector3(0, 0, 1).applyQuaternion(car.quaternion).dot(frame.t)).toBeCloseTo(1);
  });

  for (const data of TRACKS)
    it(`keeps the body upright throughout ${data.id}, including both steering extremes`, () => {
      const circuit = new Circuit(data);
      const car = carFixture();
      let minimumAlignment = 1;
      for (let distance = 0; distance < circuit.length; distance += 0.5) {
        const frame = circuit.at(distance);
        const roadNormal = frame.t.clone().cross(frame.r).normalize();
        for (const yaw of [-0.6, 0, 0.6]) {
          place(car, frame, yaw);
          minimumAlignment = Math.min(
            minimumAlignment,
            up.clone().applyQuaternion(car.quaternion).dot(roadNormal),
          );
        }
      }
      expect(minimumAlignment).toBeGreaterThan(Math.cos(T.MathUtils.degToRad(3)));
    });

  it('turns continuously through the reverse heading without rolling the cockpit underground', () => {
    const car = carFixture();
    let previous: T.Quaternion | undefined;
    let maximumJump = 0;
    let minimumCockpitHeight = Infinity;
    for (let heading = Math.PI - 0.1; heading <= Math.PI + 0.1; heading += 0.001) {
      const frame = frameFor(new T.Vector3(Math.sin(heading), 0.03, Math.cos(heading)));
      place(car, frame);
      if (previous) maximumJump = Math.max(maximumJump, previous.angleTo(car.quaternion));
      previous = car.quaternion.clone();
      minimumCockpitHeight = Math.min(
        minimumCockpitHeight,
        new T.Vector3(0, 1, 0).applyQuaternion(car.quaternion).y,
      );
    }
    expect(maximumJump).toBeLessThan(0.002);
    expect(minimumCockpitHeight).toBeGreaterThan(0.99);
  });

  it('limits visual steering and body lean even under an excessive lateral impulse', () => {
    const car = carFixture();
    const frame = frameFor(new T.Vector3(0, 0, 1));
    for (const yaw of [-1000, -12, 12, 1000]) {
      place(car, frame, yaw);
      expect(up.clone().applyQuaternion(car.quaternion).y).toBeGreaterThan(0.998);
      expect(new T.Vector3(0, 0, 1).applyQuaternion(car.quaternion).dot(frame.t)).toBeGreaterThan(
        0.8,
      );
      expect(Math.abs(car.userData.pivots[0].rotation.y)).toBeLessThan(0.8);
    }
  });
});
