import * as T from 'three/webgpu';
import { V, mat, mesh, box, rod, path } from './geometry';
import { PRODUCTS, type Product } from './catalog';

/**
 * Visible build parts. Each garage stage that maps to a real SlingMods product now
 * bolts original game geometry onto the hero vehicle. Metres, +Z forward, Y up, in
 * the vehicle's own frame. Shapes are artistic approximations of the catalog photos;
 * they are not fitment models.
 */
export type WheelDesign = {
  id: string;
  name: string;
  note: string;
  price: number;
  spokes: number;
};
export const WHEELS: WheelDesign[] = [
  { id: 'stock', name: 'Factory forged', note: 'Stock R split five-spoke', price: 0, spokes: 5 },
  {
    id: 'six',
    name: 'Six-spoke split',
    note: 'Machined face · graphite pockets',
    price: 900,
    spokes: 6,
  },
  { id: 'mesh', name: 'Mesh V', note: 'Ten thin spokes · deep lip', price: 1400, spokes: 10 },
  {
    id: 'concave',
    name: 'Deep concave',
    note: 'Seven spoke · stepped lip',
    price: 2000,
    spokes: 7,
  },
];
export const LIGHTING_PRICE = 450;

export interface BuildSpec {
  upgrades: { power: number; grip: number; boost: number };
  wheels: number;
  lighting: number;
  rims: 'graphite' | 'silver' | 'bronze';
  quality?: 'full' | 'low';
}

/** The install moment: which real product a stage bolts on, and where the camera should look. */
export interface InstallStep {
  id: string;
  product?: Product;
  label: string;
  view: number;
  mood?: 'night';
}
export const INSTALLS: Record<string, InstallStep[]> = {
  power: [
    {
      id: 'intake',
      product: PRODUCTS[0],
      label: 'Cold air intake fitted under the hood.',
      view: 0,
    },
    { id: 'exhaust', product: PRODUCTS[1], label: 'Dual rear-exit exhaust bolted on.', view: 2.1 },
    { id: 'calibration', label: 'Crew calibration complete.', view: 0 },
  ],
  grip: [
    {
      id: 'mounts',
      product: PRODUCTS[3],
      label: 'Sway bar mounting brackets installed.',
      view: 0.9,
    },
    { id: 'links', product: PRODUCTS[4], label: 'Billet sway bar end links installed.', view: 0.9 },
    {
      id: 'shocks',
      product: PRODUCTS[2],
      label: 'Three-way adjustable coilovers fitted.',
      view: 2.1,
    },
  ],
  boost: [
    { id: 'boost1', label: 'Tour Boost stage 1 armed.', view: 2.1 },
    { id: 'boost2', label: 'Tour Boost stage 2 armed.', view: 2.1 },
    { id: 'boost3', label: 'Tour Boost stage 3 armed.', view: 2.1 },
  ],
  lighting: [
    {
      id: 'underglow',
      product: PRODUCTS[5],
      label: 'RGB underglow kit wired in.',
      view: 0,
      mood: 'night',
    },
  ],
};
export const installFor = (id: string, stage: number) => INSTALLS[id]?.[stage];

/** Which product ids are physically on the car for a given spec, for the garage parts list. */
export function installedParts(spec: BuildSpec): string[] {
  const parts: string[] = [];
  if (spec.upgrades.power >= 1) parts.push('intake');
  if (spec.upgrades.power >= 2) parts.push('exhaust');
  if (spec.upgrades.grip >= 1) parts.push('mounts');
  if (spec.upgrades.grip >= 2) parts.push('links');
  if (spec.upgrades.grip >= 3) parts.push('shocks');
  if (spec.lighting >= 1) parts.push('rgb');
  return parts;
}

const PART_GROUP = 'BuildParts';
let cache: Record<string, T.MeshStandardMaterial> | undefined;
function materials() {
  if (cache) return cache;
  cache = {
    // Metalness stays below 1 so parts read in the dim studio instead of mirroring darkness.
    polished: new T.MeshStandardMaterial({ color: 0xe3e7ec, metalness: 0.7, roughness: 0.28 }),
    brushed: new T.MeshStandardMaterial({ color: 0xc4c9d0, metalness: 0.6, roughness: 0.48 }),
    ceramic: new T.MeshStandardMaterial({ color: 0x1f2226, metalness: 0.35, roughness: 0.55 }),
    billet: new T.MeshStandardMaterial({ color: 0xd4d9df, metalness: 0.7, roughness: 0.34 }),
    red: new T.MeshStandardMaterial({ color: 0xc41529, metalness: 0.4, roughness: 0.4 }),
    black: mat(0x15181c, 0.8),
  };
  return cache;
}

/** DDMWorks-style coilover: polished body, coil spring, adjuster collars and rod ends. */
function coilover(parent: T.Object3D, a: T.Vector3, b: T.Vector3, scale = 1) {
  const m = materials();
  const g = new T.Group();
  parent.add(g);
  const dir = b.clone().sub(a);
  const length = dir.length();
  rod(g, a, a.clone().addScaledVector(dir, 0.55), 0.028 * scale, m.polished, 14).name =
    'Coilover body';
  rod(g, a.clone().addScaledVector(dir, 0.5), b, 0.012 * scale, m.polished, 10).name = 'Shaft';
  const turns = 7;
  const pts: number[][] = [];
  const up = dir.clone().normalize();
  const side = new T.Vector3()
    .crossVectors(up, Math.abs(up.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0))
    .normalize();
  const fwd = new T.Vector3().crossVectors(up, side).normalize();
  const radius = 0.046 * scale;
  const steps = turns * 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * turns * Math.PI * 2;
    const p = a
      .clone()
      .addScaledVector(up, 0.12 * scale + t * (length - 0.28 * scale))
      .addScaledVector(side, Math.cos(angle) * radius)
      .addScaledVector(fwd, Math.sin(angle) * radius);
    pts.push([p.x, p.y, p.z]);
  }
  path(g, pts, 0.0085 * scale, m.brushed, true).name = 'Coil spring';
  for (const t of [0.1, 0.16, 0.78])
    rod(
      g,
      a.clone().addScaledVector(dir, t - 0.012),
      a.clone().addScaledVector(dir, t + 0.012),
      0.05 * scale,
      m.billet,
      14,
    ).name = 'Adjuster collar';
  for (const p of [a, b]) {
    const eye = mesh(new T.TorusGeometry(0.02 * scale, 0.009 * scale, 8, 14), m.billet, g);
    eye.position.copy(p);
    eye.name = 'Rod end';
  }
  return g;
}

/** Thermal R&D-style dual rear-exit: black ceramic pipes, twin angular polished tips. */
function dualExhaust(parent: T.Object3D) {
  const m = materials();
  const g = new T.Group();
  g.name = 'Dual rear exit exhaust';
  parent.add(g);
  path(
    g,
    [
      [0.5, 0.27, 0.15],
      [0.5, 0.27, -0.7],
      [0.36, 0.34, -1.1],
      [0, 0.38, -1.4],
    ],
    0.032,
    m.ceramic,
    true,
  ).name = 'Cat-back pipe';
  rod(g, V(0.45, 0.28, -0.35), V(0.45, 0.28, -0.95), 0.068, m.ceramic, 16).name = 'Muffler';
  for (const side of [-1, 1]) {
    path(
      g,
      [
        [0, 0.38, -1.4],
        [side * 0.3, 0.44, -1.5],
        [side * 0.42, 0.48, -1.57],
      ],
      0.03,
      m.ceramic,
      true,
    ).name = 'Tailpipe';
    // Tips clear the boat-tail's rear face (Z -1.55) and sit just under the tail lamps.
    const tip = box(g, m.polished, 0.15, 0.085, 0.09, side * 0.45, 0.485, -1.61, 0.012);
    tip.rotation.z = side * 0.28;
    tip.name = 'Exhaust tip';
    const bore = box(g, m.black, 0.12, 0.058, 0.02, side * 0.45, 0.485, -1.655);
    bore.rotation.z = side * 0.28;
    bore.name = 'Exhaust bore';
    const flange = box(g, m.brushed, 0.17, 0.1, 0.012, side * 0.45, 0.485, -1.57, 0.004);
    flange.rotation.z = side * 0.28;
    flange.name = 'Tip flange';
  }
  return g;
}

/** Adjustable billet end links near each front lower arm, plus the bar they reach. */
function endLinks(parent: T.Object3D) {
  const m = materials();
  const g = new T.Group();
  g.name = 'Sway bar end links';
  parent.add(g);
  for (const side of [-1, 1]) {
    const a = V(side * 0.76, 0.29, 1.31),
      b = V(side * 0.72, 0.47, 1.36);
    rod(g, a, b, 0.011, m.red, 10).name = 'End link';
    for (const p of [a, b]) {
      const eye = mesh(new T.TorusGeometry(0.016, 0.007, 8, 12), m.billet, g);
      eye.position.copy(p);
      eye.rotation.y = Math.PI / 2;
    }
  }
  path(
    g,
    [
      [-0.74, 0.47, 1.36],
      [-0.5, 0.5, 1.3],
      [0.5, 0.5, 1.3],
      [0.74, 0.47, 1.36],
    ],
    0.012,
    m.black,
    true,
  ).name = 'Sway bar';
  return g;
}
function swayBarMounts(parent: T.Object3D) {
  const m = materials();
  const g = new T.Group();
  g.name = 'Sway bar mounting brackets';
  parent.add(g);
  for (const side of [-1, 1]) {
    box(g, m.billet, 0.06, 0.05, 0.045, side * 0.3, 0.505, 1.3, 0.006).name = 'Bracket';
    box(g, m.black, 0.045, 0.02, 0.05, side * 0.3, 0.535, 1.3).name = 'Bracket clamp';
  }
  return g;
}
/** Original aftermarket-style wheel drawn inside a Wheel_i node (axle along local X). */
function aftermarketWheel(wheel: T.Object3D, design: WheelDesign, finish: BuildSpec['rims']) {
  const face = new T.MeshStandardMaterial({
    // Machined faces read lighter than the stock graphite so the spoke pattern is legible.
    color: finish === 'silver' ? 0xd2d8dd : finish === 'bronze' ? 0xa8875a : 0x5a616a,
    metalness: 0.6,
    roughness: 0.3,
  });
  const pocket = mat(0x16191d, 0.6, 0.6);
  const g = new T.Group();
  g.name = 'Aftermarket wheel';
  wheel.add(g);
  const width = 0.2;
  const barrel = mesh(new T.CylinderGeometry(0.25, 0.25, width, 28, 1, true), pocket, g);
  barrel.rotation.z = Math.PI / 2;
  barrel.name = 'Barrel';
  for (const side of [-1, 1]) {
    const lip = mesh(new T.TorusGeometry(0.245, 0.014, 8, 28), face, g);
    lip.position.x = side * (width / 2);
    lip.rotation.y = Math.PI / 2;
    lip.name = 'Lip';
    const hub = mesh(new T.CylinderGeometry(0.07, 0.075, 0.03, 16), face, g);
    hub.rotation.z = Math.PI / 2;
    hub.position.x = side * (width / 2 - 0.02 + (design.id === 'concave' ? -0.04 : 0));
    hub.name = 'Hub';
    for (let i = 0; i < design.spokes; i++) {
      const angle = (i / design.spokes) * Math.PI * 2;
      const spoke = new T.Mesh(
        new T.BoxGeometry(
          0.02,
          0.19,
          design.id === 'mesh' ? 0.024 : design.id === 'six' ? 0.06 : 0.044,
        ),
        face,
      );
      spoke.castShadow = true;
      spoke.position.set(
        hub.position.x + side * 0.004,
        Math.cos(angle) * 0.155,
        Math.sin(angle) * 0.155,
      );
      spoke.rotation.x = -angle;
      if (design.id === 'concave') spoke.rotation.z = side * 0.18;
      spoke.name = 'Spoke';
      g.add(spoke);
    }
  }
  return g;
}

/** Remove anything a previous applyBuild added, restore the stock rims/exhaust. */
function reset(car: T.Group) {
  car.getObjectByName(PART_GROUP)?.removeFromParent();
  const stale: T.Object3D[] = [];
  car.traverse((o) => {
    if (o.name === 'Aftermarket wheel') stale.push(o);
  });
  stale.forEach((o) => o.removeFromParent());
  for (const rim of (car.userData.rims as T.Object3D[]) || []) rim.visible = true;
  const stockExhaust = car.userData.exhaust as T.Object3D | undefined;
  if (stockExhaust) stockExhaust.visible = true;
  car.userData.lightingKit = false;
}

/** Idempotent: bolt the visible parts a save has earned onto the hero vehicle. */
export function applyBuild(car: T.Group, spec: BuildSpec) {
  reset(car);
  const parts = new T.Group();
  parts.name = PART_GROUP;
  car.add(parts);
  const low = spec.quality === 'low';
  // Stage 1 (cold air intake) sits under the closed hood; it is a stat and a product card, not geometry.
  if (spec.upgrades.power >= 2) {
    const stock = car.userData.exhaust as T.Object3D | undefined;
    if (stock) stock.visible = false;
    dualExhaust(parts);
  }
  if (spec.upgrades.grip >= 1 && !low) swayBarMounts(parts);
  if (spec.upgrades.grip >= 2 && !low) endLinks(parts);
  if (spec.upgrades.grip >= 3) {
    for (const side of [-1, 1])
      // Rearward of the tire so the side and rear views can see it past the closed fender.
      coilover(parts, V(side * 0.74, 0.26, 0.86), V(side * 0.58, 0.66, 0.8)).name =
        'Front coilover';
    coilover(parts, V(0.3, 0.29, -1.36), V(0.3, 0.66, -1.16), 0.95).name = 'Rear coilover';
  }
  const design = WHEELS[spec.wheels] ?? WHEELS[0];
  if (design.id !== 'stock') {
    for (const rim of (car.userData.rims as T.Object3D[]) || []) rim.visible = false;
    for (const wheel of (car.userData.wheels as T.Object3D[]) || [])
      aftermarketWheel(wheel, design, spec.rims);
  }
  car.userData.lightingKit = spec.lighting >= 1;
  parts.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.castShadow = !low;
      o.receiveShadow = true;
    }
  });
  return parts;
}
