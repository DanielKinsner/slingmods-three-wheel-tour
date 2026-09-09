import { describe, it, expect } from 'vitest';
import * as T from 'three/webgpu';
import { CollisionWorld } from './collision';
import { newDriver } from './core';
const frame = {
  p: new T.Vector3(),
  t: new T.Vector3(0, 0, 1),
  r: new T.Vector3(1, 0, 0),
  curve: 0,
};
function fixture() {
  const c = new CollisionWorld();
  const walls = new T.InstancedMesh(
    new T.BoxGeometry(0.24, 0.55, 4.25),
    new T.MeshBasicMaterial(),
    12,
  );
  let i = 0;
  for (const side of [-1, 1])
    for (let z = -10; z <= 10; z += 4)
      walls.setMatrixAt(i++, new T.Matrix4().makeTranslation(side * 11, 0.73, z));
  c.add(walls);
  c.build();
  return c;
}
describe('triangle mesh contact', () => {
  for (const side of [-1, 1])
    it(`resolves barrier penetration on side ${side} and loses speed`, () => {
      const world = fixture(),
        p = newDriver();
      p.lane = side * 10.2;
      p.velocity = side * 5;
      p.speed = 35;
      expect(world.resolve(p, frame)).toBe(true);
      expect(Math.abs(p.lane)).toBeLessThan(10.05);
      expect(p.speed).toBeLessThan(30);
      expect(p.velocity * side).toBeLessThan(0);
      expect(world.contacts).toBe(1);
      world.dispose();
    });
  it('leaves a clean racing line untouched', () => {
    const world = fixture(),
      p = newDriver();
    p.lane = 3;
    p.speed = 45;
    expect(world.resolve(p, frame)).toBe(false);
    expect(p.speed).toBe(45);
    expect(p.lane).toBe(3);
    world.dispose();
  });
  it('uses road triangle height and returns no contact beyond the road', () => {
    const world = new CollisionWorld();
    const mesh = new T.Mesh(
      new T.PlaneGeometry(17, 40).rotateX(-Math.PI / 2).translate(0, 3, 0),
      new T.MeshBasicMaterial(),
    );
    world.setRoad(mesh);
    expect(world.roadHeight(2, 10, 3)).toBeCloseTo(3);
    expect(world.roadHeight(12, 0, 3)).toBeUndefined();
    world.dispose();
  });
  it('honors rotated and translated scenery meshes', () => {
    const world = new CollisionWorld(),
      wall = new T.Mesh(new T.BoxGeometry(2, 2, 3), new T.MeshBasicMaterial());
    wall.position.set(10, 1, 0);
    wall.rotation.y = 0.25;
    world.add(wall);
    world.build();
    const p = newDriver();
    p.lane = 8.9;
    p.speed = 30;
    expect(world.resolve(p, frame)).toBe(true);
    expect(p.lane).toBeLessThan(8.9);
    world.dispose();
  });
});
