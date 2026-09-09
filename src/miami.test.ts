import { afterEach, expect, test, vi } from 'vitest';
import * as T from 'three/webgpu';
import { buildMiami } from './miami';
import { Circuit } from './world';
import { CollisionWorld } from './collision';
import type { Track } from './content';

afterEach(() => vi.restoreAllMocks());

test('Miami structures leave the full racing corridor clear and stay within geometry budget', () => {
  // Geometry check, not a substitute for browser texture/lighting validation.
  vi.spyOn(T.TextureLoader.prototype, 'load').mockReturnValue(new T.Texture());
  const track = {
    id: 'miami',
    points: [
      [0, 3, 0],
      [0, 3, 230],
      [35, 3, 380],
      [180, 4, 420],
      [320, 5, 360],
      [340, 6, 200],
      [270, 6, 80],
      [340, 4, -80],
      [210, 3, -200],
      [40, 3, -170],
      [-80, 3, -70],
    ],
  } as Track;
  const circuit = new Circuit(track),
    root = new T.Group(),
    collision = new CollisionWorld();
  const kit = buildMiami(root, circuit, true, collision);
  expect(kit.metrics.buildings).toBeGreaterThan(25);
  expect(kit.metrics.staticMeshes).toBeLessThan(180);
  expect(kit.metrics.triangles).toBeLessThan(160000);
  // Project every collision-shell corner onto the route: this catches buildings
  // intruding around hairpins even when their own placement sample looks safe.
  let minimum = Infinity;
  for (const solid of collision.solids) {
    const p = solid.getAttribute('position');
    for (let i = 0; i < p.count; i++)
      minimum = Math.min(minimum, circuit.terrainAt(p.getX(i), p.getZ(i)).distance);
  }
  expect(minimum).toBeGreaterThan(10.5); // 8.5m road half-width + 2m vehicle margin.
  const boat = root.children.find((o) => o.userData.baseY !== undefined)!;
  kit.update(12, true);
  expect(boat.position.y).not.toEqual(boat.userData.baseY);
  kit.update(12, false);
  expect(boat.position.y).toEqual(boat.userData.baseY);
  console.info(
    JSON.stringify({ miamiGeometry: kit.metrics, minimumCollisionRoadClearance: minimum }),
  );
  collision.dispose();
});
