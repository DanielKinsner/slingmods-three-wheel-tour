import * as T from 'three/webgpu';
import {
  positionLocal,
  positionWorld,
  normalWorld,
  time,
  sin,
  cos,
  vec3,
  mix,
  color,
  float,
  uniform,
} from 'three/tsl';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { V, mat, mesh, box, rod, path, panel, batch, rng } from './geometry';
import { surface, grain, canvasTexture, label, skyHDR, buildingMaterial } from './materials';
import { glowTexture } from './lighting';
import type { Circuit } from './world';
import type { Track } from './content';
import type { CollisionWorld } from './collision';

function flatten(group: T.Group) {
  group.updateMatrixWorld(true);
  const parts: T.Mesh[] = [];
  group.traverse((o) => {
    if (o instanceof T.Mesh) parts.push(o);
  });
  const inverse = group.matrixWorld.clone().invert();
  for (const part of parts) {
    const matrix = inverse.clone().multiply(part.matrixWorld);
    part.removeFromParent();
    part.geometry = part.geometry.clone().applyMatrix4(matrix);
    part.position.set(0, 0, 0);
    part.rotation.set(0, 0, 0);
    part.scale.set(1, 1, 1);
    group.add(part);
  }
  for (const child of [...group.children]) if (!(child instanceof T.Mesh)) group.remove(child);
  batch(group);
}
function palmGeometry() {
  const g = new T.Group(),
    m = mat(0x35582e);
  m.side = T.DoubleSide;
  for (let f = 0; f < 9; f++) {
    const a = (f * Math.PI * 2) / 9,
      dir = V(Math.cos(a), 0, Math.sin(a)),
      side = V(-Math.sin(a), 0, Math.cos(a));
    const center = (t: number) =>
      dir
        .clone()
        .multiplyScalar(t * 4.1)
        .add(V(0, Math.sin(t * Math.PI) * 1.03 - t * t * 1.22, 0));
    const spine: number[][] = [];
    for (let k = 0; k <= 12; k++) spine.push(center(k / 12).toArray());
    path(g, spine, 0.035, m, true);
    for (let k = 1; k < 23; k++)
      for (const sign of [-1, 1]) {
        const t = k / 24,
          c = center(t),
          width = Math.sin(t * Math.PI) * 0.85;
        panel(
          g,
          [
            c.toArray(),
            c
              .clone()
              .addScaledVector(side, sign * width)
              .addScaledVector(dir, 0.46)
              .add(V(0, -0.24, 0))
              .toArray(),
            center(t + 0.045).toArray(),
          ],
          m,
        );
      }
  }
  batch(g);
  return (g.children[0] as T.Mesh).geometry;
}
function pineTexture(region: string) {
  return canvasTexture((ctx, n) => {
    ctx.clearRect(0, 0, n, n);
    const random = rng(92);
    ctx.strokeStyle = '#554632';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(n * 0.5, n);
    ctx.lineTo(n * 0.5, n * 0.1);
    ctx.stroke();
    if (region !== 'smokies') {
      for (let i = 0; i < 2400; i++) {
        const a = random() * Math.PI * 2,
          r = Math.sqrt(random()),
          x = n * 0.5 + Math.cos(a) * r * n * 0.46,
          y = n * 0.4 + Math.sin(a) * r * n * 0.34;
        ctx.fillStyle = ['#233929', '#365538', '#4a6a3e', '#647849'][i % 4];
        ctx.beginPath();
        ctx.ellipse(x, y, 3 + random() * 11, 2 + random() * 8, random() * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    // Irregular branch whorls and individual needles leave visible sky gaps.
    // A continuous triangle silhouette would look like a cone even on crossed cards.
    for (let layer = 0; layer < 23; layer++) {
      const f = (layer + 1) / 24,
        by = n * (0.05 + f * 0.82),
        width = n * 0.44 * Math.pow(f, 0.83) * (0.78 + random() * 0.22);
      for (const sign of [-1, 1]) {
        const slope = 5 + random() * 12;
        ctx.strokeStyle = '#344e32';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(n * 0.5, by);
        ctx.lineTo(n * 0.5 + sign * width, by + slope);
        ctx.stroke();
        for (let j = 0; j < width; j += 2.4) {
          const t = j / width,
            x = n * 0.5 + sign * j,
            y = by + t * slope + Math.sin(t * 5) * 3;
          for (let k = 0; k < 12; k++) {
            const len = (5 + random() * 13) * (1 - t * 0.45),
              a = (random() - 0.5) * 2.1;
            ctx.strokeStyle = ['#26402b', '#325733', '#467342', '#5c7d49'][
              Math.floor(random() * 4)
            ];
            ctx.lineWidth = 1 + random() * 0.8;
            ctx.beginPath();
            ctx.moveTo(x + random() * 4 - 2, y + random() * 5);
            ctx.lineTo(x + sign * Math.cos(a) * len, y + Math.sin(a) * len + 4);
            ctx.stroke();
          }
        }
      }
    }
  });
}
export function buildEnvironment(
  root: T.Group,
  circuit: Circuit,
  data: Track,
  collision: CollisionWorld,
  night = false,
) {
  const streetLights: T.Vector3[] = [];
  const random = rng(714 + data.id.length),
    coast = data.id === 'coast',
    desert = data.id === 'desert';
  const moving: T.Object3D[] = [],
    flags: T.Mesh[] = [];
  const clock = uniform(0);
  const sky = new SkyMesh();
  sky.scale.setScalar(2000);
  sky.turbidity.value = coast ? 3.8 : 2.2;
  sky.rayleigh.value = coast ? 1.8 : 2.4;
  sky.mieCoefficient.value = 0.005;
  sky.sunPosition.value
    .set(-0.7, coast ? 0.27 : 0.65, 0.38)
    .normalize()
    .multiplyScalar(450000);
  sky.cloudCoverage.value = 0.31;
  sky.cloudDensity.value = 0.24;
  sky.cloudScale.value = 0.0008;
  sky.cloudSpeed.value = 0.000014;
  if (!skyHDR && !night) root.add(sky);
  const foliageGroup = new T.Group();
  root.add(foliageGroup);
  const trunkMat = mat(coast ? 0x706555 : 0x504a3c);
  trunkMat.map = grain('stone');
  trunkMat.map.repeat.set(2, 8);
  if (coast) {
    const pg = palmGeometry(),
      leafMat = mat(0x527e38, 0.85);
    leafMat.side = T.DoubleSide;
    const palms = new T.InstancedMesh(pg, leafMat, 150),
      trunks = new T.InstancedMesh(new T.CylinderGeometry(0.14, 0.28, 1, 10, 6), trunkMat, 150),
      dummy = new T.Object3D();
    let used = 0;
    for (let i = 0; i < 170; i++) {
      const a = circuit.at((i / 170) * circuit.length),
        side = i % 2 ? 1 : -1,
        off = side * (16 + random() * 5),
        p = a.p.clone().addScaledVector(a.r, off);
      if (circuit.terrainAt(p.x, p.z).distance < 14 || p.x < -65 || used >= 150) continue;
      const height = 8 + random() * 5;
      p.y = a.p.y - 0.18;
      dummy.position.copy(p).add(V(0, height / 2, 0));
      dummy.rotation.set(0.03 * Math.sin(i), i * 0.71, 0.05 * Math.cos(i));
      dummy.scale.set(1, height, 1);
      dummy.updateMatrix();
      trunks.setMatrixAt(used, dummy.matrix);
      dummy.position.copy(p).add(V(0, height, 0));
      dummy.rotation.set(0, i * 1.71, 0);
      dummy.scale.setScalar(0.8 + random() * 0.3);
      dummy.updateMatrix();
      palms.setMatrixAt(used, dummy.matrix);
      palms.setColorAt(
        used,
        new T.Color().setHSL(0.24 + random() * 0.025, 0.32, 0.33 + random() * 0.14),
      );
      used++;
    }
    palms.count = trunks.count = used;
    palms.castShadow = trunks.castShadow = true;
    palms.receiveShadow = true;
    foliageGroup.add(trunks, palms);
    const original = pg.getAttribute('position').array.slice() as Float32Array;
    moving.push(palms);
    palms.userData.wind = { original, geometry: pg };
  } else {
    const count = desert ? 230 : 700,
      leafMat = new T.MeshStandardMaterial({
        map: pineTexture(data.id),
        alphaTest: 0.35,
        side: T.DoubleSide,
        roughness: 1,
      });
    const treeGeos: T.BufferGeometry[] = [];
    for (let j = 0; j < 4; j++)
      treeGeos.push(new T.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateY((j * Math.PI) / 4));
    const leaf = new T.InstancedMesh(mergeGeometries(treeGeos)!, leafMat, count),
      trunk = new T.InstancedMesh(new T.CylinderGeometry(0.13, 0.25, 1, 7), trunkMat, count),
      dummy = new T.Object3D();
    let used = 0;
    for (let i = 0; i < count; i++) {
      const a = circuit.at(random() * circuit.length),
        p = a.p.clone().addScaledVector(a.r, (20 + random() * 130) * (random() > 0.5 ? 1 : -1));
      const terrain = circuit.terrainAt(p.x, p.z),
        h = desert ? 1.5 + random() * 2.5 : 9 + random() * 16;
      if (terrain.distance < 18 + h * 0.2) continue;
      p.y = terrain.height;
      dummy.position.copy(p);
      dummy.scale.set(h * 0.65, h, h * 0.65);
      dummy.rotation.set(0, random() * 6.28, 0);
      dummy.updateMatrix();
      leaf.setMatrixAt(used, dummy.matrix);
      leaf.setColorAt(used, new T.Color().setScalar(0.7 + random() * 0.6));
      dummy.position.y += h * 0.35;
      dummy.scale.set(1, h * 0.7, 1);
      dummy.updateMatrix();
      trunk.setMatrixAt(used, dummy.matrix);
      used++;
    }
    leaf.count = trunk.count = used;
    leaf.castShadow = trunk.castShadow = true;
    leaf.receiveShadow = true;
    foliageGroup.add(leaf, trunk);
    const rockMat = surface('stone');
    rockMat.color.set(desert ? 0xcfa581 : 0x82916b);
    const rocks = new T.InstancedMesh(new T.IcosahedronGeometry(1, 3), rockMat, desert ? 150 : 95);
    const pos = rocks.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        y = pos.getY(i),
        z = pos.getZ(i),
        f = 1 + Math.sin(x * 13 + y * 6) * Math.cos(z * 11) * 0.13;
      pos.setXYZ(i, x * f, y * f, z * f);
    }
    rocks.geometry.computeVertexNormals();
    for (let i = 0; i < rocks.count; i++) {
      const a = circuit.at(random() * circuit.length),
        s = desert ? 8 + random() * 17 : 1 + random() * 4,
        p = a.p
          .clone()
          .addScaledVector(a.r, (30 + s * 2 + random() * 115) * (random() > 0.5 ? 1 : -1));
      const terrain = circuit.terrainAt(p.x, p.z);
      dummy.position.copy(p);
      dummy.position.y = terrain.height + s * 0.1;
      dummy.rotation.set(random() * 0.5, random() * 6.2, random() * 0.4);
      dummy.scale.set(s, s * (desert ? 1.5 : 0.7), s * 0.8);
      if (terrain.distance < s * 1.8 + 16) dummy.scale.setScalar(0);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    rocks.castShadow = rocks.receiveShadow = true;
    root.add(rocks);
    collision.add(rocks);
    // Terrain ridges with irregular silhouettes and textured slopes.
    const mountains = new T.Group();
    root.add(mountains);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2,
        h = 120 + random() * 260,
        geo = new T.SphereGeometry(1, 28, 16),
        p = geo.getAttribute('position');
      for (let j = 0; j < p.count; j++) {
        const x = p.getX(j),
          y = p.getY(j),
          z = p.getZ(j);
        p.setXYZ(j, x, Math.max(0, y) * (1 + Math.sin(x * 8 + z * 7) * 0.2), z);
      }
      geo.computeVertexNormals();
      const m = mesh(
        geo,
        rockMat,
        mountains,
        Math.sin(a) * 1000,
        h * 0.1 - 45,
        Math.cos(a) * 1000 + 200,
      );
      m.scale.set(330, h, 310);
      m.castShadow = false;
    }
    flatten(mountains);
  }
  if (coast) {
    // Four lanes of Florida architecture: Art Deco storefronts, balcony hotels,
    // glazed towers, roof plant, bus shelters and an ocean-side promenade.
    const city = new T.Group();
    root.add(city);
    const concrete = surface('concrete'),
      metal = mat(0x35434b, 0.4, 0.65),
      white = mat(0xe4e1d8),
      glass = new T.MeshPhysicalMaterial({
        color: 0x3b727f,
        metalness: 0.72,
        roughness: 0.18,
        clearcoat: 1,
      });
    const warmGlass = new T.MeshStandardMaterial({
      color: 0x7d806f,
      emissive: 0xf4b96c,
      emissiveIntensity: night ? 1.8 : 0.19,
      metalness: 0.55,
      roughness: 0.27,
    });
    const colors = [0xe5d6c7, 0xcbd6d6, 0xdba9a0, 0xb6c9c0, 0xe8e3d6].map((c) =>
      buildingMaterial(c),
    );
    const facades = [0xe8e3d6, 0xc6d6d2, 0xdfb9ae].map((c) => buildingMaterial(c, true));
    const interior = canvasTexture((c, n) => {
      c.fillStyle = '#efd9ab';
      c.fillRect(0, 0, n, n);
      for (let i = 0; i < n; i += 12) {
        c.fillStyle = i % 24 ? '#7a7764' : '#d4bf95';
        c.fillRect(i, 0, 3, n);
      }
      c.fillStyle = '#292f32';
      c.fillRect(n * 0.48, 0, n * 0.04, n);
      c.fillRect(0, n * 0.62, n, n * 0.035);
    }, 128);
    warmGlass.map = interior;
    warmGlass.emissiveMap = interior;
    const signMats = [
      'THE ATLANTIC',
      'PALM HOUSE',
      'OCEAN DRIVE',
      'COASTAL CLUB',
      'DAYTONA',
      'SLINGMODS',
    ].map(
      (s, i) =>
        new T.MeshStandardMaterial({
          map: label(s, i === 5 ? '#ce1026' : '#152830', '#f6f5ef'),
          roughness: 0.6,
          emissive: 0xffffff,
          emissiveIntensity: night ? 1.7 : 0.12,
        }),
    );
    const building = (p: T.Vector3, angle: number, index: number, tower = false) => {
      const g = new T.Group();
      g.position.copy(p);
      g.rotation.y = angle;
      city.add(g);
      const w = tower ? 19 + random() * 13 : 14 + random() * 8,
        d = tower ? 18 : 11 + random() * 6,
        floors = tower ? 10 + Math.floor(random() * 12) : 2 + Math.floor(random() * 4),
        h = floors * 3.2,
        paint = colors[index % 5];
      const structure = box(g, paint, w, h, d, 0, h / 2, 0, 0.1);
      const back = mesh(new T.PlaneGeometry(w, h), facades[index % 3], g, 0, h / 2, -d / 2 - 0.012);
      back.rotation.y = Math.PI;
      collision.add(structure);
      box(g, concrete, w + 1, 0.4, d + 1, 0, 0.2, 0);
      box(g, white, w + 1, 0.3, d + 1, 0, h + 0.1, 0);
      for (let floor = 0; floor < floors; floor++) {
        const y = 1.6 + floor * 3.2;
        for (let col = 0; col < Math.floor(w / 2.5); col++) {
          const x = -w / 2 + 1.3 + col * 2.5,
            wm = (col + floor * 3 + index) % (night ? 3 : 7) === 0 ? warmGlass : glass;
          box(g, wm, 1.9, 2.15, 0.1, x, y, d / 2 + 0.05);
          box(g, white, 0.07, 2.2, 0.14, x, y, d / 2 + 0.13);
          box(g, wm, 0.1, 2.15, 2.1, w / 2 + 0.06, y, -d / 2 + 1.6 + ((col * 2.8) % (d - 1)));
        }
        if (tower || index % 2 === 0) {
          box(g, white, w + 0.3, 0.14, 1.4, 0, y - 1.14, d / 2 + 0.6);
          box(g, glass, w - 0.3, 0.63, 0.035, 0, y - 0.7, d / 2 + 1.21);
          box(g, metal, w + 0.1, 0.035, 0.045, 0, y - 0.35, d / 2 + 1.23);
          for (let j = -w / 2; j < w / 2; j += 2.5)
            box(g, white, 0.08, 0.82, 1.4, j, y - 0.69, d / 2 + 0.58);
        } else box(g, white, w + 0.25, 0.16, 0.4, 0, y + 1.31, d / 2 + 0.14);
      }
      box(g, paint, w * 0.17, h + 0.6, d * 0.09, -w * 0.35, h / 2, d / 2 + 0.3);
      const sign = mesh(
        new T.PlaneGeometry(Math.min(9, w * 0.65), 1.4),
        signMats[index % 6],
        g,
        0,
        3.05,
        d / 2 + 1.3,
      );
      sign.castShadow = false;
      const sm = sign.material as T.MeshStandardMaterial;
      sm.emissiveMap = sm.map;
      if (night) {
        const neon = new T.MeshBasicMaterial({
          color: index % 2 ? 0x5cc9df : 0xf28b91,
          toneMapped: false,
        });
        box(g, neon, w + 0.4, 0.055, 0.045, 0, 3.9, d / 2 + 0.22);
        box(g, neon, 0.055, h, 0.045, -w / 2 - 0.08, h / 2, d / 2 + 0.22);
      }
      // Stripe awning, recessed glass entrance, roof HVAC and service ladder.
      const awning = box(
        g,
        index % 3 ? colors[(index + 2) % 5] : white,
        w * 0.84,
        0.12,
        2.2,
        0,
        2.63,
        d / 2 + 0.95,
      );
      awning.rotation.x = -0.08;
      box(g, glass, 2.2, 2.4, 0.15, 0, 1.25, d / 2 + 0.1);
      box(g, metal, 0.06, 2.4, 0.2, 0, 1.25, d / 2 + 0.2);
      for (let j = 0; j < 3; j++) {
        box(g, metal, 2, 1.1, 1.8, -w * 0.27 + j * 3, h + 0.7, 0, 0.06);
        for (let l = 0; l < 6; l++)
          box(g, white, 1.75, 0.05, 0.02, -w * 0.27 + j * 3, h + 0.3 + l * 0.14, 0.91);
      }
      if (index % 3 === 0) {
        box(g, paint, 3, h + 2, 1.3, w / 2 - 1.5, (h + 2) / 2, d / 2);
        for (let j = 0; j < 3; j++)
          box(g, white, 4, 0.16, 1.6, w / 2 - 1.5, h + 0.3 + j * 0.45, d / 2);
      }
    };
    let index = 0;
    for (let d = 35; d < circuit.length; d += 35) {
      const a = circuit.at(d);
      // Reserve western shoreline; buildings occupy the inland sides of the loop.
      for (const side of [-1, 1]) {
        const p = a.p.clone().addScaledVector(a.r, side * (29 + random() * 4));
        if (p.x < -13 || circuit.terrainAt(p.x, p.z).distance < 25) continue;
        p.y = a.p.y - 0.2;
        building(p, Math.atan2(a.r.x * -side, a.r.z * -side), index++);
      }
    }
    for (let z = -120; z < 650; z += 68)
      for (let x = 360; x < 570; x += 65) {
        const terrain = circuit.terrainAt(x, z);
        building(V(x, terrain.height, z), -Math.PI / 2, index++, true);
      }
    // Sidewalk panels, ornamental grass planters, luminaires and street signs.
    const fixture = new T.Group();
    root.add(fixture);
    const lightPoolMaterial = new T.MeshBasicMaterial({
      map: glowTexture(),
      color: 0xffd6a4,
      transparent: true,
      opacity: night ? 0.17 : 0,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    const glow = new T.MeshStandardMaterial({
        color: 0xffecd3,
        emissive: 0xffd29a,
        emissiveIntensity: 2.5,
      }),
      bark = mat(0x77815a),
      red = mat(0xd5172d);
    for (let d = 10; d < circuit.length; d += 22) {
      const a = circuit.at(d);
      for (const side of [-1, 1]) {
        const p = a.p.clone().addScaledVector(a.r, side * 12.7),
          g = new T.Group();
        g.position.copy(p);
        g.rotation.y = Math.atan2(a.t.x, a.t.z);
        fixture.add(g);
        box(g, concrete, 5, 0.18, 21, 0, 0, 0);
        if (d % 44 < 22) {
          rod(g, V(side * 1.2, 0.1, 0), V(side * 1.2, 7.5, 0), 0.09, metal);
          path(
            g,
            [
              [side * 1.2, 6.7, 0],
              [side * 1.1, 7.6, 0],
              [-side * 0.8, 7.7, 0],
              [-side * 1.4, 7.4, 0],
            ],
            0.065,
            metal,
            true,
          );
          box(g, metal, 1.1, 0.15, 0.4, -side * 1.3, 7.35, 0, 0.06);
          box(g, glow, 0.9, 0.04, 0.3, -side * 1.3, 7.25, 0);
          streetLights.push(
            V(-side * 1.3, 7.25, 0)
              .applyAxisAngle(V(0, 1, 0), g.rotation.y)
              .add(p),
          );
          if (night) {
            const pool = mesh(
              new T.PlaneGeometry(25, 31),
              lightPoolMaterial,
              g,
              -side * 5,
              0.085,
              0,
            );
            pool.rotation.x = -Math.PI / 2;
            pool.castShadow = false;
          }
          const flag = mesh(
            new T.PlaneGeometry(1.1, 2.7, 8, 10),
            new T.MeshStandardNodeMaterial({
              map: label('SLINGMODS', '#cf1227'),
              side: T.DoubleSide,
              roughness: 0.8,
            }),
            g,
            side * 1.1,
            5.6,
            1.1,
          );
          const fm = flag.material as T.MeshStandardNodeMaterial;
          fm.positionNode = positionLocal.add(
            vec3(0, 0, sin(positionLocal.y.mul(3).add(clock)).mul(0.13)),
          );
          flags.push(flag);
        }
        if (d % 66 < 22) {
          box(g, white, 2, 0.55, 1, 0, 0.4, 5);
          box(g, bark, 1.8, 0.55, 0.8, 0, 0.8, 5, 0.15);
          const bench = box(g, metal, 2, 0.1, 0.55, 0, 0.65, -4, 0.04);
          bench.name = 'Promenade bench';
          for (let j = 0; j < 5; j++) box(g, white, 2, 0.08, 0.035, 0, 0.85 + j * 0.11, -4.25);
        }
      }
    }
    // Track entrances are closed by race furniture; signals are ambient course dressing.
    for (let d = 180; d < circuit.length; d += 300) {
      const a = circuit.at(d),
        g = new T.Group();
      g.position.copy(a.p).addScaledVector(a.r, 10.5);
      g.rotation.y = Math.atan2(a.t.x, a.t.z);
      fixture.add(g);
      rod(g, V(0, 0, 0), V(0, 7, 0), 0.12, metal);
      rod(g, V(0, 7, 0), V(-17, 7, 0), 0.1, metal);
      for (const x of [-5, -11]) {
        box(g, metal, 0.45, 1.45, 0.38, x, 6.2, 0, 0.07);
        for (let j = 0; j < 3; j++) {
          const l = mesh(
            new T.CylinderGeometry(0.13, 0.13, 0.03, 16),
            j === 2 ? glow : blackSignal,
            g,
            x,
            6.68 - j * 0.43,
            0.21,
          );
          l.rotation.x = Math.PI / 2;
        }
      }
    }
    flatten(city);
    flatten(fixture);
    // Wide Atlantic, moving Gerstner-like wave field, normal shading and shore foam.
    const waterMat = new T.MeshPhysicalNodeMaterial({
      color: 0x287d88,
      roughness: 0.19,
      metalness: 0.65,
      clearcoat: 1,
      clearcoatRoughness: 0.16,
    });
    const waveA = positionLocal.x.mul(0.055).add(positionLocal.z.mul(0.09)).add(clock.mul(0.8));
    const waveB = positionLocal.x.mul(0.12).sub(positionLocal.z.mul(0.047)).add(clock.mul(1.2));
    waterMat.positionNode = positionLocal.add(
      vec3(0, sin(waveA).mul(0.25).add(sin(waveB).mul(0.12)), 0),
    );
    waterMat.normalNode = vec3(
      cos(waveA).mul(-0.06).sub(cos(waveB).mul(0.04)),
      float(1),
      cos(waveA).mul(-0.09).add(cos(waveB).mul(0.03)),
    ).normalize();
    waterMat.colorNode = mix(
      color(0x08697f),
      color(0x4bbac7),
      sin(positionWorld.x.mul(0.07).add(clock.mul(0.3)))
        .mul(0.3)
        .add(0.35),
    );
    const wg = new T.PlaneGeometry(2000, 2200, 150, 150);
    wg.rotateX(-Math.PI / 2);
    const sea = mesh(wg, waterMat, root, -1080, 0.3, 250);
    sea.castShadow = false;
    const sand = surface('sand');
    const beach = mesh(new T.PlaneGeometry(140, 1900), sand, root, -36, 0.5, 260);
    beach.rotation.x = -Math.PI / 2;
    sand.map!.repeat.set(22, 190);
    sand.normalMap!.repeat.copy(sand.map!.repeat);
    const foamMat = new T.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
    });
    foamMat.colorNode = color(0xcce8e4);
    foamMat.opacityNode = sin(
      positionWorld.x
        .mul(1.4)
        .add(sin(positionWorld.z.mul(0.13)))
        .add(clock.mul(0.7)),
    )
      .max(0)
      .pow(7)
      .mul(0.38);
    const foam = mesh(new T.PlaneGeometry(24, 1800), foamMat, root, -91, 0.58, 240);
    foam.rotation.x = -Math.PI / 2;
    foam.castShadow = false;
    // Pier and small sailboats make the water feel inhabited.
    const pier = new T.Group();
    root.add(pier);
    const wood = mat(0x8a7761);
    for (let x = -210; x < -20; x += 5) {
      box(pier, wood, 4.8, 0.25, 5, x, 3.3, 200);
      for (const z of [-2, 2]) {
        rod(pier, V(x, -1, 200 + z), V(x, 4.1, 200 + z), 0.17, wood);
      }
    }
    for (let x = -208; x < -23; x += 5)
      for (const z of [-2.4, 2.4])
        rod(pier, V(x, 4.2, 200 + z), V(x + 5, 4.2, 200 + z), 0.055, white);
    flatten(pier);
    for (let i = 0; i < 7; i++) {
      const boat = new T.Group();
      boat.position.set(-200 - random() * 700, 1, random() * 1300 - 400);
      boat.rotation.y = random() * 6;
      root.add(boat);
      const hull = mesh(new T.SphereGeometry(1, 20, 12), white, boat, 0, 0, 0);
      hull.scale.set(1.2, 0.7, 4.5);
      rod(boat, V(0, 0.4, 0), V(0, 10, 0), 0.05, metal);
      panel(
        boat,
        [
          [0.08, 1, 0],
          [0.08, 9.6, 0],
          [0.08, 1, 3.6],
        ],
        white,
      );
      panel(
        boat,
        [
          [-0.08, 1, -0.2],
          [-0.08, 8.8, -0.2],
          [-0.08, 1, -2.8],
        ],
        white,
      );
      batch(boat);
      boat.userData.boat = i;
      moving.push(boat);
    }
  }
  return {
    streetLights,
    update: (elapsed: number, motion: boolean) => {
      clock.value = motion ? elapsed : 0;
      for (const o of moving)
        if (o.userData.boat !== undefined) {
          o.position.y = 1 + Math.sin(elapsed * 0.7 + o.userData.boat) * 0.16;
          o.rotation.z = Math.sin(elapsed * 0.5 + o.userData.boat) * 0.025;
        }
      // Vertex wind is updated at a restrained rate, independent of the race simulation.
      if (motion && Math.floor(elapsed * 12) % 2 === 0)
        for (const o of moving)
          if (o.userData.wind) {
            const { original, geometry } = o.userData.wind as {
              original: Float32Array;
              geometry: T.BufferGeometry;
            };
            const p = geometry.getAttribute('position');
            for (let i = 0; i < p.count; i++) {
              const x = original[i * 3],
                y = original[i * 3 + 1],
                z = original[i * 3 + 2];
              p.setY(i, y + Math.sin(elapsed * 1.3 + x * 0.7 + z * 0.4) * Math.hypot(x, z) * 0.035);
            }
            p.needsUpdate = true;
          }
    },
  };
}
const blackSignal = mat(0x182423, 0.55);
