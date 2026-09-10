import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as T from 'three/webgpu';
import { updateHeroSuspension } from './hero-vehicle';

// Read the actual exported node hierarchy, without a browser or texture-loader mock.
function exportedRig(tier: string) {
  const bytes = readFileSync(`public/models/slingshot-r-${tier}.glb`);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const nodes: T.Object3D[] = gltf.nodes.map((n: any) => {
    const o = new T.Object3D();
    o.name = n.name ?? '';
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    o.userData = n.extras ?? {};
    return o;
  });
  gltf.nodes.forEach((n: any, i: number) =>
    n.children?.forEach((j: number) => nodes[i].add(nodes[j])),
  );
  const car = new T.Group();
  gltf.scenes[gltf.scene ?? 0].nodes.forEach((i: number) => car.add(nodes[i]));
  car.userData.pivots = [0, 1, 2].map((i) => car.getObjectByName(`Pivot_${i}`)!);
  car.userData.suspension = nodes.filter((n) => Array.isArray(n.userData.suspensionAnchor));
  return car;
}
function expectAttached(car: T.Group) {
  car.updateMatrixWorld(true);
  for (const link of car.userData.suspension as T.Object3D[]) {
    const { suspensionAnchor, restLength, wheelOffset, wheelIndex } = link.userData;
    const anchor = link.parent!.localToWorld(new T.Vector3().fromArray(suspensionAnchor));
    const hub = car.userData.pivots[wheelIndex].getWorldPosition(new T.Vector3());
    const end = link.parent!.localToWorld(
      link.parent!.worldToLocal(hub).add(new T.Vector3().fromArray(wheelOffset)),
    );
    expect(link.getWorldPosition(new T.Vector3()).distanceTo(anchor)).toBeLessThan(1e-6);
    expect(link.localToWorld(new T.Vector3(0, restLength, 0)).distanceTo(end)).toBeLessThan(1e-6);
  }
}
describe('shipped Blender suspension rig', () => {
  for (const tier of ['hero', 'lod']) {
    it(`${tier}: preserves all eleven link anchors and exported local axes`, () => {
      const car = exportedRig(tier);
      expect(car.userData.suspension).toHaveLength(11);
      expectAttached(car);
    });
    it(`${tier}: stays joined through unequal wheel travel, body roll, yaw and steering`, () => {
      const car = exportedRig(tier);
      car.position.set(12, 1.2, -57);
      car.rotation.set(0.03, 2.1, -0.05);
      car.getObjectByName('Body')!.rotation.set(0.05, 0, 0.06);
      const pivots = car.userData.pivots as T.Object3D[];
      pivots[0].position.y += 0.045;
      pivots[1].position.y -= 0.035;
      pivots[2].position.y += 0.012;
      for (const steer of [-0.5, 0, 0.5]) {
        pivots[0].rotation.y = steer;
        pivots[1].rotation.y = steer * 0.85;
        updateHeroSuspension(car);
        expectAttached(car);
      }
      // Returning to the garage cannot accumulate scale or orientation errors.
      pivots.forEach((p, i) => {
        p.position.y = i === 2 ? 0.354 : 0.333;
        p.rotation.set(0, 0, 0);
      });
      car.getObjectByName('Body')!.rotation.set(0, 0, 0);
      updateHeroSuspension(car);
      expectAttached(car);
    });
  }
});
