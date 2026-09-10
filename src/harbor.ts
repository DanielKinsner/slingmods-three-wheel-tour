import * as T from 'three/webgpu';
import { box, mesh, rod, mat, V, batch, rng } from './geometry';
import { canvasTexture, label, surface } from './materials';
import type { Circuit } from './world';
import type { CollisionWorld } from './collision';
import { harborInstances } from './harbor-assets';

/** Original modular port kit: no downloaded models, added lights use the shared pool. */
export function buildHarbor(
  root: T.Group,
  circuit: Circuit,
  collision: CollisionWorld,
  night: boolean,
) {
  const kit = new T.Group();
  root.add(kit);
  const authored = harborInstances(night);
  // Keep the simpler repeating cargo stacks on small screens; landmarks retain their detail.
  const detailedCargo = !matchMedia('(max-width:800px)').matches;
  const streetLights: T.Vector3[] = [],
    random = rng(503);
  const steel = mat(0x324c56, 0.62, 0.5),
    dark = mat(0x182832, 0.65, 0.35),
    ivory = mat(0xd7d4c0, 0.86);
  const concrete = surface('concrete');
  concrete.color.set(0x899695);
  const yellow = mat(0xe9b253, 0.56, 0.25);
  const lamp = new T.MeshStandardMaterial({
    color: 0xffe9c3,
    emissive: 0xffdba2,
    emissiveIntensity: night ? 3 : 0.15,
  });
  const corrugated = canvasTexture((c, n) => {
    c.fillStyle = '#b7bec1';
    c.fillRect(0, 0, n, n);
    for (let x = 0; x < n; x += 16) {
      c.fillStyle = '#78878c';
      c.fillRect(x, 0, 3, n);
      c.fillStyle = '#cdd1d0';
      c.fillRect(x + 3, 0, 3, n);
    }
    c.strokeStyle = '#687a80';
    c.lineWidth = 3;
    c.strokeRect(7, 7, n - 14, n - 14);
    for (let i = 0; i < 250; i++) {
      c.fillStyle = 'rgba(64,49,35,.12)';
      c.fillRect(random() * n, random() * n, 1 + random() * 5, 1 + random() * 35);
    }
  }, 256);
  const colors = [0x357b85, 0xba5946, 0x596b82, 0xccb885];
  const containerMats = colors.map(
    (color) =>
      new T.MeshStandardMaterial({ color, map: corrugated, roughness: 0.78, metalness: 0.22 }),
  );
  const place = (distance: number, lane: number) => {
    const a = circuit.at(distance),
      g = new T.Group();
    g.position.copy(a.p).addScaledVector(a.r, lane);
    // Off-road art sits on the apron, which is lower than the road centerline.
    if (Math.abs(lane) > 20) g.position.y = circuit.terrainAt(g.position.x, g.position.z).height;
    g.rotation.y = Math.atan2(a.t.x, a.t.z);
    kit.add(g);
    return g;
  };
  for (let i = 0; i < 36; i++) {
    const d = 40 + (i % 18) * 22,
      lane = (i < 18 ? -1 : 1) * (27 + (i % 3) * 7),
      g = place(d, lane);
    if (circuit.terrainAt(g.position.x, g.position.z).distance < 21) {
      g.removeFromParent();
      continue;
    }
    for (let j = 0; j < 1 + (i % 3); j++) {
      const m = box(g, containerMats[(i + j) % 4], 5, 2.65, 12, 0, 1.33 + j * 2.68, 0);
      collision.add(m);
      const cargo = detailedCargo ? authored('PortContainer', colors[(i + j) % 4]) : null;
      if (cargo) {
        cargo.position.y = j * 2.68;
        g.add(cargo);
        m.removeFromParent();
        m.geometry.dispose();
      } else {
        for (const x of [-2.2, 2.2]) box(g, ivory, 0.08, 2.4, 0.1, x, 1.35 + j * 2.68, 6.06);
      }
    }
    batch(g);
  }
  // Warehouse apron and dock doors form the close foreground on the opening straight.
  for (let i = 0; i < 4; i++) {
    const g = place(80 + i * 85, -49);
    const warehouse = authored('PortWarehouse');
    if (warehouse) g.add(warehouse);
    else {
      box(g, concrete, 35, 9, 52, 0, 4.3, 0);
      box(g, dark, 37, 0.5, 54, 0, 9, 0);
      for (let z = -18; z <= 18; z += 12) {
        box(g, steel, 0.12, 5, 8, 17.6, 2.5, z);
        box(g, lamp, 0.25, 0.12, 7, 17.8, 5.4, z);
      }
    }
    const sign = mesh(
      new T.PlaneGeometry(19, 2),
      new T.MeshBasicMaterial({ map: label(`PIER 0${i + 1} / FREIGHT`) }),
      g,
      17.9,
      8.05,
      0,
    );
    sign.rotation.y = Math.PI / 2;
    batch(g);
  }
  // Covered inspection lane, full-width clearance. No road-height discontinuity or jump.
  const tunnel = place(245, 0);
  box(tunnel, concrete, 30, 0.65, 38, 0, 7.6, 0);
  for (const x of [-13.4, 13.4])
    for (const z of [-17, 0, 17]) {
      const post = box(tunnel, concrete, 1.1, 7.5, 1.1, x, 3.6, z);
      collision.add(post);
    }
  for (const z of [-14, 0, 14]) {
    box(tunnel, lamp, 20, 0.08, 0.3, 0, 7.2, z);
    const p = V(0, 6.5, z);
    tunnel.localToWorld(p);
    streetLights.push(p);
  }
  batch(tunnel);
  // Port cranes: tall readable silhouettes, geometry stays outside the route corridor.
  for (let i = 0; i < 4; i++) {
    const g = place(circuit.length * (0.38 + i * 0.075), -52);
    const crane = authored('PortCrane');
    if (crane) {
      g.add(crane);
      continue;
    }
    for (const x of [-10, 10])
      for (const z of [-9, 9]) {
        rod(g, V(x, 0, z), V(x * 0.7, 37, z * 0.7), 0.65, yellow, 6);
        rod(g, V(x, 5, z), V(-x * 0.7, 30, z * 0.7), 0.2, steel, 6);
      }
    box(g, yellow, 46, 1.4, 3, 5, 37, 0);
    box(g, yellow, 8, 7, 6, -14, 34, 0);
    for (const x of [-5, 12, 25]) rod(g, V(x, 37, 0), V(x, 19, 0), 0.075, dark, 5);
    box(g, steel, 12, 0.6, 4, 12, 19, 0);
    batch(g);
  }
  // Tank farm and pipe racks fill the middle distance along the port approach.
  for (let i = 0; i < 9; i++) {
    const g = place(circuit.length * (0.24 + i * 0.026), i % 2 ? 42 : -43);
    if (circuit.terrainAt(g.position.x, g.position.z).distance < 28) {
      g.removeFromParent();
      continue;
    }
    mesh(new T.CylinderGeometry(7, 7, 12, 16), ivory, g, 0, 6, 0);
    mesh(new T.ConeGeometry(7.1, 1.5, 16), steel, g, 0, 12.7, 0);
    for (const h of [3, 9]) {
      const ring = mesh(new T.TorusGeometry(7.04, 0.08, 4, 20), steel, g, 0, h, 0);
      ring.rotation.x = Math.PI / 2;
    }
    rod(g, V(-8, 2, 0), V(-8, 11, 0), 0.16, yellow, 6);
    batch(g);
  }
  // Small stacked freight bays punctuate the approach to the returning straight.
  for (let i = 0; i < 12; i++) {
    const g = place(circuit.length * (0.69 + i * 0.023), i % 2 ? 31 : -34);
    if (circuit.terrainAt(g.position.x, g.position.z).distance < 24) {
      g.removeFromParent();
      continue;
    }
    for (let j = 0; j < 2 + (i % 2); j++) {
      const cargo = detailedCargo ? authored('PortContainer', colors[(i + j) % 4]) : null;
      if (cargo) {
        cargo.position.y = j * 2.65;
        g.add(cargo);
      } else box(g, containerMats[(i + j) % 4], 5, 2.6, 12, 0, 1.3 + j * 2.65, 0);
    }
    batch(g);
  }
  const vessel = new T.Group();
  kit.add(vessel);
  vessel.position.set(570, 0, 210);
  const freighter = authored('PortFreighter');
  if (freighter) vessel.add(freighter);
  else {
    box(vessel, dark, 24, 7, 108, 0, 1, 0);
    box(vessel, steel, 25, 0.8, 110, 0, 4.8, 0);
    box(vessel, ivory, 20, 15, 16, 0, 12, -40);
    box(vessel, dark, 22, 3, 17, 0, 17, -40);
    for (let z = -20; z <= 35; z += 14)
      for (let x = -7; x <= 7; x += 7)
        for (let h = 0; h < 2; h++)
          box(vessel, containerMats[(Math.round(z + 20) + h) % 4], 6, 3.5, 12, x, 7 + h * 3.6, z);
    rod(vessel, V(0, 19, -40), V(0, 30, -40), 0.2, steel, 6);
  }
  batch(vessel);
  // Water and shore skyline sit beyond the eastern waterfront sweeper.
  // Quay face separates the concrete apron from the lower water plane.
  box(kit, concrete, 2.8, 4, 1300, 476, -0.3, 180);
  const water = mesh(
    new T.PlaneGeometry(1400, 2400, 12, 12),
    new T.MeshStandardMaterial({
      color: night ? 0x173641 : 0x2c7785,
      metalness: 0.4,
      roughness: 0.34,
    }),
    kit,
    990,
    -0.8,
    100,
  );
  water.rotation.x = -Math.PI / 2;
  const glass = new T.MeshPhysicalMaterial({
    color: 0x476c7b,
    roughness: 0.31,
    metalness: 0.35,
    clearcoat: 0.35,
  });
  const windowLight = new T.MeshStandardMaterial({
    color: 0xd9c9a5,
    emissive: 0xffdba2,
    emissiveIntensity: night ? 0.65 : 0.015,
    roughness: 0.6,
  });
  for (let i = 0; i < 18; i++) {
    const x = 690 + random() * 130,
      z = -200 + i * 49,
      h = 18 + random() * 85,
      w = 13 + random() * 16;
    box(kit, i % 3 ? steel : concrete, w, h, 18, x, h / 2 - 1, z);
    box(kit, dark, w + 0.6, 0.8, 18.6, x, h - 0.8, z);
    box(kit, concrete, w * 0.5, 3, 9, x + 2, h + 1, z);
    for (let y = 4; y < h - 2; y += 4)
      for (let dz = -6; dz <= 6; dz += 4)
        box(
          kit,
          random() > 0.65 ? windowLight : glass,
          0.08,
          2.4,
          2.5,
          x - w / 2 - 0.05,
          y,
          z + dz,
        );
    for (let y = 4; y < h - 2; y += 4)
      for (let dx = -w / 2 + 3; dx < w / 2 - 1; dx += 4)
        box(kit, glass, 2.5, 2.4, 0.08, x + dx, y, z - 9.05);
  }
  const landmark = place(10, 0);
  for (const x of [-13, 13]) box(landmark, yellow, 1.1, 13, 1.1, x, 6.5, 0);
  box(landmark, steel, 27, 3.5, 1, 0, 11.5, 0);
  for (const side of [-1, 1]) {
    const sign = mesh(
      new T.PlaneGeometry(23, 2.4),
      new T.MeshBasicMaterial({ map: label('SLINGMODS / HARBOR RUN', '#162630', '#f5cc7a') }),
      landmark,
      0,
      11.5,
      side * 0.52,
    );
    if (side < 0) sign.rotation.y = Math.PI;
  }
  batch(landmark);
  // Reflective chevrons, dock bollards and luminaire silhouettes establish scale at speed.
  const lightCount = Math.floor(circuit.length / 38);
  for (let i = 0; i < lightCount; i++) {
    const g = place(i * 38, i % 2 ? 13 : -13);
    box(g, steel, 0.2, 7, 0.2, 0, 3.5, 0);
    box(g, steel, 2, 0.13, 0.13, 0, 7, 0);
    box(g, lamp, 1.4, 0.1, 0.45, 0, 6.95, 0);
    const p = g.position.clone();
    p.y += 6.8;
    streetLights.push(p);
    batch(g);
  }
  // Batch static siblings after flattening their transforms; lamps share one emissive material.
  kit.updateMatrixWorld(true);
  const staticRoot = new T.Group();
  root.add(staticRoot);
  const parts: T.Mesh[] = [];
  kit.traverse((o) => {
    if (o instanceof T.Mesh) parts.push(o);
  });
  for (const part of parts) {
    part.geometry.applyMatrix4(part.matrixWorld);
    part.removeFromParent();
    part.position.set(0, 0, 0);
    part.quaternion.identity();
    part.scale.set(1, 1, 1);
    staticRoot.add(part);
  }
  batch(staticRoot);
  root.remove(kit);
  return { streetLights, update: (_elapsed: number, _motion: boolean) => {} };
}
