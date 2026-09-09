import * as T from 'three/webgpu';
import { box, mesh, batch, rng, mat } from './geometry';
import { roadOrientation } from './road-frame';
import type { Circuit } from './world';

export function buildRoadDetails(root: T.Group, circuit: Circuit) {
  const g = new T.Group();
  root.add(g);
  const random = rng(7351);
  const patch = mat(0x383f43, 0.93),
    seal = mat(0x222a2f, 0.87),
    grate = mat(0x40494d, 0.7, 0.4),
    paint = mat(0xd8d3b5, 0.96);
  const count = Math.floor(circuit.length / 24);
  for (let i = 0; i < count; i++) {
    const a = circuit.at(i * 24 + 8),
      d = new T.Group();
    g.add(d);
    d.position.copy(a.p);
    roadOrientation(a.t, d.quaternion);
    if (i % 3 === 0) {
      const p = mesh(
        new T.PlaneGeometry(1.3 + random() * 1.4, 2 + random() * 4),
        patch,
        d,
        (random() - 0.5) * 11,
        0.023,
        0,
      );
      p.rotation.x = -Math.PI / 2;
      p.rotation.z = (random() - 0.5) * 0.12;
    }
    if (i % 7 === 0) box(d, seal, 16, 0.008, 0.055, 0, 0.025, 0);
    if (i % 4 === 0)
      for (const side of [-1, 1]) {
        box(d, grate, 0.48, 0.035, 0.85, side * 7.96, 0.042, 0);
        for (let j = 0; j < 5; j++)
          box(d, seal, 0.34, 0.006, 0.04, side * 7.96, 0.062, -0.32 + j * 0.16);
      }
    if (i % 5 === 0)
      for (const side of [-1, 1]) box(d, paint, 0.05, 0.008, 2.5, side * 7.65, 0.031, 0);
  }
  g.updateMatrixWorld(true);
  const parts: T.Mesh[] = [];
  g.traverse((o) => {
    if (o instanceof T.Mesh) parts.push(o);
  });
  for (const p of parts) {
    p.geometry = p.geometry.clone().applyMatrix4(p.matrixWorld);
    p.removeFromParent();
    p.position.set(0, 0, 0);
    p.quaternion.identity();
    g.add(p);
  }
  for (const c of [...g.children]) if (!(c instanceof T.Mesh)) g.remove(c);
  batch(g);
}
