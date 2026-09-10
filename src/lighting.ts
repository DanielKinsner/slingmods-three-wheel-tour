import * as T from 'three/webgpu';
import { box, mesh, mat, path, V, batch, rng } from './geometry';
import { surface, label, canvasTexture } from './materials';
export const RGB_COLORS = [
  { name: 'SlingMods red', color: '#ff1641' },
  { name: 'Ice blue', color: '#20dfff' },
  { name: 'Ultraviolet', color: '#aa50ff' },
  { name: 'Mint', color: '#40ffad' },
  { name: 'Amber', color: '#ffa833' },
  { name: 'Ice white', color: '#e0f3ff' },
];
export function glowTexture() {
  return canvasTexture((c, n) => {
    const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,.65)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, n, n);
  }, 128);
}

/** Surface-aligned halos: always face the nose, never the camera or the rear of the car. */
function frontLampHalo(width: number, hero = false) {
  // Hero positions follow the lofted 2025 nose: centre light bar, rising brow slash on each
  // pod front and a short vertical accent beside the corner intake.
  const strips = hero
    ? [
        [
          [-0.16, 0.565, 1.958],
          [0.16, 0.565, 1.958],
        ],
      ]
    : [
        [
          [-0.127, 0.518, 1.655],
          [0.127, 0.518, 1.655],
        ],
      ];
  for (const side of [-1, 1]) {
    strips.push(
      hero
        ? [
            [side * 0.58, 0.47, 1.945],
            [side * 0.74, 0.52, 1.94],
            [side * 0.89, 0.575, 1.92],
          ]
        : [
            [side * 0.589, 0.537, 1.797],
            [side * 0.704, 0.571, 1.783],
            [side * 0.938, 0.68, 1.739],
          ],
    );
    strips.push(
      hero
        ? [
            [side * 0.905, 0.3, 1.89],
            [side * 0.92, 0.44, 1.88],
          ]
        : [
            [side * 0.9, 0.28, 1.847],
            [side * 0.928, 0.47, 1.821],
          ],
    );
  }
  const vertices: number[] = [];
  const uvs: number[] = [];
  for (const points of strips) {
    for (let i = 1; i < points.length; i++) {
      const a = V(...points[i - 1]);
      const b = V(...points[i]);
      const along = b.clone().sub(a).normalize();
      const across = V(0, 0, 1)
        .cross(along)
        .normalize()
        .multiplyScalar(width / 2);
      // Soft end caps overlap gently at the bend without extending into adjacent body panels.
      a.addScaledVector(along, -width * 0.16);
      b.addScaledVector(along, width * 0.16);
      const corners = [
        a.clone().sub(across),
        b.clone().sub(across),
        b.clone().add(across),
        a.clone().add(across),
      ];
      for (const index of [0, 1, 2, 0, 2, 3]) vertices.push(...corners[index].toArray());
      uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}
export function environmentTexture(studio = false) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, studio ? '#151d2b' : '#071123');
  g.addColorStop(0.49, studio ? '#343b47' : '#27344c');
  g.addColorStop(0.55, '#080c15');
  g.addColorStop(1, '#020409');
  x.fillStyle = g;
  x.fillRect(0, 0, 1024, 512);
  if (studio) {
    // Broad softboxes trace the sculpted panels without razor-thin white streaks.
    for (const [cx, cy, w, h] of [
      [200, 115, 220, 70],
      [705, 155, 280, 60],
    ]) {
      const soft = x.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
      soft.addColorStop(0, 'rgba(238,246,255,0)');
      soft.addColorStop(0.3, 'rgba(238,246,255,.85)');
      soft.addColorStop(0.7, 'rgba(238,246,255,.85)');
      soft.addColorStop(1, 'rgba(238,246,255,0)');
      x.fillStyle = soft;
      x.fillRect(cx - w / 2, cy - h / 2, w, h);
    }
    x.fillStyle = '#d52543';
    x.fillRect(840, 210, 110, 16);
  } else {
    const r = rng(875);
    for (let i = 0; i < 300; i++) {
      x.fillStyle = `rgba(190,215,255,${0.12 + r() * 0.22})`;
      const size = 0.3 + r() * 0.5;
      x.fillRect(r() * 1024, r() * 185, size, size);
    }
    x.fillStyle = '#fff2d7';
    x.beginPath();
    x.arc(760, 125, 1.8, 0, Math.PI * 2);
    x.fill();
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.mapping = T.EquirectangularReflectionMapping;
  return t;
}
export function makeShowroom(root: T.Group) {
  const g = new T.Group();
  g.name = 'SlingMods studio garage';
  root.add(g);
  const floor = surface('concrete', 9);
  floor.color.set(0x626972);
  floor.roughness = 0.3;
  floor.metalness = 0.2;
  const ground = mesh(new T.PlaneGeometry(44, 44), floor, g);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.025;
  const black = mat(0x11151d, 0.45, 0.35),
    gray = mat(0x313844, 0.6, 0.35),
    red = mat(0xa20c27, 0.36, 0.6),
    metal = mat(0x9ba3b0, 0.23, 0.85);
  mesh(new T.CylinderGeometry(3.8, 3.82, 0.055, 96), black, g, 0, -0.022, 0);
  const ring = new T.MeshBasicMaterial({ color: 0xe81538 });
  mesh(new T.TorusGeometry(3.73, 0.018, 8, 120).rotateX(Math.PI / 2), ring, g, 0, 0.016, 0);
  for (const s of [-1, 1]) {
    box(g, gray, 0.2, 7, 24, s * 11, 3.5, -4);
    box(g, black, 22, 7, 0.2, 0, 3.5, -10);
    for (let i = 0; i < 8; i++)
      box(g, black, 0.055, 6.5, 0.25, s * 11 - s * 0.14, 3.4, -10 + i * 2);
    const light = new T.DirectionalLight(s === 1 ? 0xc9dfff : 0xffe9db, s === 1 ? 2.4 : 3.8);
    light.position.set(s * 5, 6, 4);
    light.target.position.set(0, 0.5, 0);
    g.add(light, light.target);
    if (s === -1) {
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      Object.assign(light.shadow.camera, {
        left: -8,
        right: 8,
        top: 8,
        bottom: -8,
        near: 0.1,
        far: 25,
      });
      light.shadow.normalBias = 0.02;
    }
    for (let z = -6; z < 6; z += 4) {
      box(g, gray, 0.28, 0.12, 3, s * 4.5, 5.6, z);
      box(g, new T.MeshBasicMaterial({ color: 0xe7f3ff }), 0.18, 0.035, 2.85, s * 4.5, 5.52, z);
    }
  }
  g.add(new T.HemisphereLight(0xc2d3ed, 0x16121a, 0.75));
  for (let i = 0; i < 5; i++) {
    box(g, i === 2 ? red : gray, 1.9, 1.6, 0.8, -5 + i * 2, 0.8, -8.9, 0.04);
    for (let j = 0; j < 4; j++) {
      box(g, black, 1.76, 0.025, 0.035, -5 + i * 2, 0.3 + j * 0.34, -8.47);
      box(g, metal, 0.85, 0.03, 0.055, -5 + i * 2, 0.49 + j * 0.34, -8.43);
    }
  }
  box(g, metal, 11, 0.11, 1, 0, 1.66, -8.9);
  const brand = new T.TextureLoader().load('./slingmods-logo.png');
  brand.colorSpace = T.SRGBColorSpace;
  const sign = new T.MeshBasicMaterial({ map: brand, transparent: true });
  mesh(new T.PlaneGeometry(8, 1.91), sign, g, 0, 4, -9.83);
  box(g, ring, 12, 0.045, 0.05, 0, 2.35, -9.83);
  for (let i = 0; i < 3; i++)
    mesh(
      new T.TorusGeometry(0.42, 0.15, 14, 32).rotateX(Math.PI / 2),
      black,
      g,
      -7,
      0.17 + i * 0.29,
      -7,
    );
  for (let i = 0; i < 7; i++) box(g, metal, 0.045, 0.43, 0.05, 4.3 + i * 0.22, 2.45, -9.8);
  batch(g);
  g.visible = false;
  return g;
}
export function vehicleLighting(car: T.Group, main: boolean) {
  const softLight = glowTexture();
  const haloMaterials = [
    new T.MeshBasicMaterial({
      color: 0x93c5ff,
      map: softLight,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      depthTest: true,
      side: T.FrontSide,
      blending: T.AdditiveBlending,
      toneMapped: false,
    }),
    new T.MeshBasicMaterial({
      color: 0xe5f2ff,
      map: softLight,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      depthTest: true,
      side: T.FrontSide,
      blending: T.AdditiveBlending,
      toneMapped: false,
    }),
  ];
  haloMaterials.forEach((material, i) => {
    const halo = mesh(frontLampHalo(i === 0 ? 0.2 : 0.075, !!car.userData.modelId), material, car);
    halo.name = i === 0 ? 'Front lamp soft bloom' : 'Front lamp luminous edge';
    halo.castShadow = false;
    halo.receiveShadow = false;
  });
  const frontLamp = car.userData.frontLamp as T.MeshStandardMaterial | undefined;
  const rgb = new T.MeshStandardMaterial({
    color: 0xff1641,
    emissive: 0xff1641,
    emissiveIntensity: 3.5,
    toneMapped: false,
  });
  const strips = new T.Group();
  car.add(strips);
  for (const side of [-1, 1]) {
    path(
      strips,
      [
        [side * 0.65, 0.19, -0.94],
        [side * 0.76, 0.19, -0.56],
        [side * 0.68, 0.19, 0.7],
      ],
      0.013,
      rgb,
    );
    path(
      strips,
      [
        [side * 0.48, 0.47, -0.75],
        [side * 0.5, 0.47, -0.15],
      ],
      0.006,
      rgb,
    );
  }
  path(
    strips,
    [
      [-0.63, 0.2, 0.76],
      [0, 0.19, 1.15],
      [0.63, 0.2, 0.76],
    ],
    0.009,
    rgb,
  );
  const glowMat = new T.MeshBasicMaterial({
    color: 0xff1641,
    map: softLight,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: T.AdditiveBlending,
    toneMapped: false,
  });
  const pool = mesh(new T.PlaneGeometry(4.4, 5.4), glowMat, car, 0, 0.055, -0.08);
  pool.rotation.x = -Math.PI / 2;
  pool.castShadow = false;
  pool.receiveShadow = false;
  let light: T.PointLight | undefined;
  const headlights: T.SpotLight[] = [];
  if (main) {
    light = new T.PointLight(0xff1641, 12, 4, 2);
    light.position.set(0, 0.13, -0.15);
    car.add(light);
    for (const x of [-0.72, 0.72]) {
      const head = new T.SpotLight(0xe4efff, 230, 84, 0.4, 0.78, 1.7);
      head.position.set(x, 0.55, 1.9);
      head.target.position.set(x, 0.03, 29);
      car.add(head, head.target);
      headlights.push(head);
    }
  }
  return {
    update(color: T.Color, enabled: boolean, night: boolean) {
      if (frontLamp) frontLamp.emissiveIntensity = night ? 5.2 : 1.3;
      haloMaterials[0].opacity = night ? 0.24 : 0.025;
      haloMaterials[1].opacity = night ? 0.55 : 0.09;
      rgb.color.copy(color);
      rgb.emissive.copy(color);
      rgb.emissiveIntensity = night ? 3.5 : 1;
      strips.visible = enabled;
      pool.visible = enabled;
      glowMat.color.copy(color);
      glowMat.opacity = night ? 0.65 : 0.17;
      if (light) {
        light.color.copy(color);
        light.intensity = enabled ? (night ? 12 : 3) : 0;
      }
      headlights.forEach((h) => (h.intensity = night ? 230 : 0));
    },
  };
}
export function streetLightPool(root: T.Group, positions: T.Vector3[], night: boolean) {
  const lights = Array.from({ length: 6 }, () => {
    const l = new T.PointLight(0xffd2a2, 0, 43, 1.65);
    root.add(l);
    return l;
  });
  let timer = 0;
  return (dt: number, p: T.Vector3, active: boolean) => {
    timer -= dt;
    if (timer > 0) return;
    timer = 0.18;
    const nearest =
      night && active
        ? [...positions].sort((a, b) => a.distanceToSquared(p) - b.distanceToSquared(p)).slice(0, 6)
        : [];
    lights.forEach((l, i) => {
      l.intensity = nearest[i] ? 320 : 0;
      if (nearest[i]) l.position.copy(nearest[i]);
    });
  };
}
