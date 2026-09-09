import * as T from 'three/webgpu';
import { V, mat, mesh, box, rod, path, panel, batch } from './geometry';
import { grain, normals, label } from './materials';

// Original reference-built 2025-style roadster. Metres, +Z forward. The axle spacing
// and tire sizes follow the manufacturer; this is not manufacturer CAD.
export const VEHICLE_DIMENSIONS = {
  width: 1.98,
  length: 3.8,
  wheelbase: 2.667,
  frontTrack: 1.755,
  height: 1.318,
};
export function makeVehicle(color: string, withDriver = true) {
  const group = new T.Group();
  group.name = 'SlingMods touring roadster';
  const body = new T.Group();
  group.add(body);
  const paint = new T.MeshPhysicalMaterial({
    color,
    metalness: 0.48,
    roughness: 0.23,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    side: T.DoubleSide,
  });
  const graphite = new T.MeshPhysicalMaterial({
    color: 0x242932,
    metalness: 0.6,
    roughness: 0.25,
    clearcoat: 1,
    side: T.DoubleSide,
  });
  const black = mat(0x121519, 0.72),
    alloy = mat(0x90979f, 0.24, 0.95),
    dark = mat(0x242a30, 0.36, 0.8),
    red = mat(0xe91628, 0.3, 0.5);
  black.side = dark.side = T.DoubleSide;
  const carbonMap = grain('carbon');
  carbonMap.repeat.set(5, 5);
  const carbon = new T.MeshPhysicalMaterial({
    map: carbonMap,
    normalMap: normals(carbonMap, 0.6),
    roughness: 0.38,
    clearcoat: 0.5,
    side: T.DoubleSide,
  });
  const leatherMap = grain('rubber');
  leatherMap.repeat.set(8, 8);
  const leather = new T.MeshStandardMaterial({ color: 0x65676a, map: leatherMap, roughness: 0.85 });
  const lamp = new T.MeshStandardMaterial({
    color: 0xf8ffff,
    emissive: 0xd4efff,
    emissiveIntensity: 2.7,
    roughness: 0.2,
    toneMapped: false,
  });
  const tail = new T.MeshStandardMaterial({
    color: 0xff172d,
    emissive: 0xff0010,
    emissiveIntensity: 1.5,
  });
  const amber = new T.MeshStandardMaterial({
    color: 0xfaa619,
    emissive: 0xff7c00,
    emissiveIntensity: 0.45,
  });
  // Deep floor pan, central tunnel, open footwells and rear bulkhead.
  box(body, black, 1.46, 0.17, 2.32, 0, 0.25, -0.05, 0.06);
  box(body, black, 1.46, 0.42, 0.16, 0, 0.51, -0.97, 0.04);
  box(body, carbon, 0.19, 0.3, 1.6, 0, 0.46, -0.25, 0.04);
  for (const s of [-1, 1]) {
    const pts = [
      [0.72, 0.29, -1.07],
      [0.82, 0.36, -0.89],
      [0.8, 0.48, -0.44],
      [0.73, 0.49, 0.42],
      [0.64, 0.59, 0.73],
      [0.53, 0.7, 0.83],
    ].map((p) => [s * p[0], p[1], p[2]]);
    panel(body, pts, paint);
    panel(
      body,
      [
        [s * 0.72, 0.29, -1.07],
        [s * 0.53, 0.7, 0.83],
        [s * 0.58, 0.28, 0.72],
      ],
      paint,
    );
    path(
      body,
      [
        [s * 0.73, 0.25, -1.02],
        [s * 0.79, 0.29, -0.7],
        [s * 0.7, 0.29, 0.62],
      ],
      0.035,
      carbon,
    );
    // Outer quarter shoulders taper away from the cockpit into the tail.
    panel(
      body,
      [
        [s * 0.4, 0.89, -1.01],
        [s * 0.73, 0.71, -1.05],
        [s * 0.83, 0.64, -0.66],
        [s * 0.78, 0.58, -0.3],
        [s * 0.61, 0.72, -0.72],
      ],
      paint,
    );
    panel(
      body,
      [
        [s * 0.61, 0.72, -0.72],
        [s * 0.78, 0.58, -0.3],
        [s * 0.72, 0.38, -0.2],
        [s * 0.62, 0.52, -0.72],
      ],
      graphite,
    );
    // Front suspension remains visible through the wheel arch, including A arms.
    for (const y of [0.22, 0.39])
      for (const z of [0.71, 1.35])
        rod(body, V(s * 0.48, y, z), V(s * 0.8775, 0.32, 1.197), 0.014, dark);
    rod(body, V(s * 0.49, 0.64, 0.91), V(s * 0.82, 0.25, 1.19), 0.026, alloy);
    const spring: number[][] = [];
    for (let j = 0; j < 85; j++) {
      const f = j / 84;
      spring.push([
        s * (0.51 + 0.27 * f) + 0.041 * Math.cos(f * Math.PI * 16),
        0.61 - 0.33 * f,
        0.94 + 0.22 * f + 0.041 * Math.sin(f * Math.PI * 16),
      ]);
    }
    path(body, spring, 0.008, red, true);
    // Flowing fender arches: they join the front fascia and uncover the rear of the tire.
    const vertices: number[] = [],
      uvs: number[] = [],
      ids: number[] = [];
    for (let j = 0; j <= 24; j++) {
      const a = -0.3 + (j / 24) * 2.78;
      for (let k = 0; k <= 4; k++) {
        const x = s * (0.7 + k * 0.073),
          rad = 0.394 + Math.sin((k / 4) * Math.PI) * 0.025;
        vertices.push(x, 0.333 + Math.sin(a) * rad, 1.197 + Math.cos(a) * rad);
        uvs.push(k / 4, j / 24);
      }
      if (j < 24)
        for (let k = 0; k < 4; k++) {
          const i = j * 5 + k;
          ids.push(i, i + 1, i + 5, i + 1, i + 6, i + 5);
        }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    g.setIndex(ids);
    g.computeVertexNormals();
    mesh(g, paint, body);
    // Doorless sculpted sill and aerodynamic outer trim.
    path(
      body,
      [
        [s * 0.98, 0.21, 1.55],
        [s * 0.94, 0.16, 1.73],
        [s * 0.47, 0.14, 1.86],
      ],
      0.027,
      carbon,
    );
    path(
      body,
      [
        [s * 0.98, 0.3, 1.54],
        [s * 0.96, 0.56, 1.58],
        [s * 0.83, 0.67, 1.62],
      ],
      0.015,
      paint,
    );
  }
  // Vented sport hood, constructed as a crown with continuous cross sections.
  const hoodRows = [
    [-0.02, 0.7, 0.57],
    [0.35, 0.75, 0.65],
    [0.68, 0.76, 0.67],
    [0.95, 0.69, 0.69],
    [1.25, 0.61, 0.65],
    [1.55, 0.46, 0.53],
    [1.77, 0.42, 0.42],
    // A continuous rolled return closes the nose against the grille. Shared
    // vertices keep reflections smooth across the crown and this small bevel.
    [1.799, 0.402, 0.402, 0.018],
    [1.824, 0.39, 0.39, 0],
  ];
  const hp: number[] = [],
    hu: number[] = [],
    hi: number[] = [];
  hoodRows.forEach(([z, y, w, crown = 0.055], j) => {
    for (let k = 0; k <= 12; k++) {
      const u = (k / 12) * 2 - 1;
      hp.push(w * u, y + (1 - u * u) * crown, z);
      hu.push(k / 12, z);
    }
    if (j < hoodRows.length - 1)
      for (let k = 0; k < 12; k++) {
        const i = j * 13 + k;
        hi.push(i, i + 13, i + 1, i + 1, i + 13, i + 14);
      }
  });
  const hg = new T.BufferGeometry();
  hg.setAttribute('position', new T.Float32BufferAttribute(hp, 3));
  hg.setAttribute('uv', new T.Float32BufferAttribute(hu, 2));
  hg.setIndex(hi);
  hg.computeVertexNormals();
  mesh(hg, graphite, body);
  for (const s of [-1, 1]) {
    // Continuous brow sections meet the exact hood edge. The old fan-shaped
    // panel left triangular openings and a diagonal crease over the suspension.
    const browRows = [
      [
        [0.67, 0.76, 0.68],
        [0.705, 0.76, 0.68],
      ],
      [
        [0.69, 0.69, 0.95],
        [0.83, 0.77, 0.95],
      ],
      [
        [0.65, 0.61, 1.25],
        [0.92, 0.76, 1.27],
      ],
      [
        [0.53, 0.46, 1.55],
        [0.97, 0.73, 1.52],
      ],
    ];
    const bp = browRows.flatMap((row) => row.flatMap(([x, y, z]) => [s * x, y, z]));
    const bi: number[] = [];
    for (let j = 0; j < browRows.length - 1; j++) {
      const i = j * 2;
      bi.push(
        ...(s > 0
          ? [i, i + 2, i + 1, i + 1, i + 2, i + 3]
          : [i, i + 1, i + 2, i + 1, i + 3, i + 2]),
      );
    }
    const bg = new T.BufferGeometry();
    bg.setAttribute('position', new T.Float32BufferAttribute(bp, 3));
    bg.setAttribute(
      'uv',
      new T.Float32BufferAttribute(
        browRows.flatMap((_, j) => [0, j / 3, 1, j / 3]),
        2,
      ),
    );
    bg.setIndex(bi);
    bg.computeVertexNormals();
    mesh(bg, graphite, body);
    // Opaque inner engine-bay walls stop underglow leaking through the nose.
    // They remain inboard of the tire so the open wheel arch still exposes arms.
    for (let j = 2; j < hoodRows.length - 1; j++) {
      const [z0, y0, x0] = hoodRows[j];
      const [z1, y1, x1] = hoodRows[j + 1];
      panel(
        body,
        [
          [s * x0, y0, z0],
          [s * x1, y1, z1],
          [s * x1, 0.25, z1],
          [s * x0, 0.25, z0],
        ],
        black,
      );
    }
    panel(
      body,
      [
        [s * 0.53, 0.46, 1.55],
        [s * 0.97, 0.73, 1.52],
        [s * 0.99, 0.68, 1.66],
        [s * 0.42, 0.42, 1.77],
      ],
      paint,
    );
    panel(
      body,
      [
        [s * 0.42, 0.42, 1.77],
        [s * 0.99, 0.68, 1.66],
        [s * 0.39, 0.39, 1.824],
        [s * 0.402, 0.402, 1.799],
      ],
      paint,
    );
    const fascia = [
      [s * 0.39, 0.39, 1.824],
      [s * 0.99, 0.68, 1.66],
      [s * 0.96, 0.22, 1.76],
      [s * 0.47, 0.16, 1.87],
      [s * 0.36, 0.17, 1.88],
      [s * 0.43, 0.27, 1.874],
    ];
    // The grille shoulder is concave: a triangle fan crosses its opening.
    for (const indices of [
      [0, 1, 2],
      [0, 2, 5],
      [2, 3, 5],
      [3, 4, 5],
    ]) {
      panel(
        body,
        (s > 0 ? [...indices].reverse() : indices).map((i) => fascia[i]),
        paint,
      );
    }
    panel(
      body,
      [
        [s * 0.99, 0.68, 1.66],
        [s * 0.98, 0.42, 1.26],
        [s * 0.97, 0.23, 1.62],
        [s * 0.96, 0.22, 1.76],
      ],
      paint,
    );
    // Black lower intakes with separate blades and angular DRL ribbons.
    panel(
      body,
      [
        [s * 0.61, 0.29, 1.831],
        [s * 0.91, 0.48, 1.784],
        [s * 0.92, 0.25, 1.803],
      ],
      black,
    );
    for (let j = 0; j < 4; j++)
      rod(
        body,
        V(s * (0.68 + j * 0.052), 0.27, 1.817),
        V(s * (0.69 + j * 0.052), 0.32 + j * 0.038, 1.816),
        0.008,
        dark,
      );
    path(
      body,
      [
        [s * 0.9, 0.28, 1.828],
        [s * 0.928, 0.47, 1.802],
      ],
      0.012,
      lamp,
    );
    path(
      body,
      [
        [s * 0.58, 0.53, 1.75],
        [s * 0.7, 0.563, 1.74],
        [s * 0.935, 0.673, 1.697],
      ],
      0.037,
      black,
    );
    path(
      body,
      [
        [s * 0.589, 0.537, 1.778],
        [s * 0.704, 0.571, 1.764],
        [s * 0.938, 0.68, 1.72],
      ],
      0.014,
      lamp,
    );
    box(body, amber, 0.039, 0.075, 0.024, s * 0.962, 0.61, 1.721, 0.007);
    // Recessed hood vents with six cooling louvers per bank.
    panel(
      body,
      [
        [s * 0.31, 0.79, 0.33],
        [s * 0.45, 0.774, 0.31],
        [s * 0.4, 0.712, 0.9],
        [s * 0.28, 0.725, 0.91],
      ],
      black,
    );
    for (let j = 0; j < 7; j++)
      rod(
        body,
        V(s * 0.305, 0.795 - j * 0.01, 0.36 + j * 0.072),
        V(s * 0.435, 0.78 - j * 0.01, 0.34 + j * 0.072),
        0.006,
        dark,
      );
    path(
      body,
      [
        [s * 0.5, 0.766, 0.28],
        [s * 0.56, 0.73, 0.73],
        [s * 0.5, 0.62, 1.2],
      ],
      0.015,
      paint,
    );
    // Footwell speakers and contrasting perimeter stitching on bolstered seats.
    const seatX = s * 0.365;
    box(body, black, 0.48, 0.1, 0.5, seatX, 0.37, -0.4, 0.045);
    box(body, leather, 0.37, 0.1, 0.4, seatX, 0.43, -0.4, 0.04);
    const back = box(body, leather, 0.4, 0.59, 0.115, seatX, 0.76, -0.73, 0.06);
    back.rotation.x = -0.16;
    box(body, leather, 0.27, 0.2, 0.12, seatX, 1.04, -0.775, 0.055);
    for (const side of [-1, 1]) {
      const b = box(body, black, 0.09, 0.44, 0.15, seatX + side * 0.19, 0.7, -0.66, 0.032);
      b.rotation.z = -side * 0.12;
      path(
        body,
        [
          [seatX + side * 0.15, 0.46, -0.19],
          [seatX + side * 0.18, 0.51, -0.58],
          [seatX + side * 0.17, 0.94, -0.69],
          [seatX + side * 0.1, 1.09, -0.73],
        ],
        0.004,
        red,
        true,
      );
    }
    // Faceted trapezoidal roll hoops are a defining Slingshot silhouette.
    path(
      body,
      [
        [seatX - 0.235, 0.7, -0.93],
        [seatX - 0.157, 1.258, -0.99],
        [seatX - 0.12, 1.285, -0.99],
        [seatX + 0.12, 1.285, -0.99],
        [seatX + 0.157, 1.258, -0.99],
        [seatX + 0.235, 0.7, -0.93],
      ],
      0.028,
      dark,
    );
    path(
      body,
      [
        [seatX - 0.18, 0.89, -0.942],
        [seatX - 0.11, 1.17, -0.982],
        [seatX + 0.11, 1.17, -0.982],
        [seatX + 0.18, 0.89, -0.942],
      ],
      0.018,
      dark,
    );
    panel(
      body,
      [
        [seatX - 0.19, 0.76, -0.951],
        [seatX - 0.1, 0.94, -0.95],
        [seatX + 0.1, 0.94, -0.95],
        [seatX + 0.19, 0.76, -0.951],
      ],
      paint,
    );
    box(body, black, 0.035, 0.43, 0.024, seatX + s * 0.15, 0.69, -0.58, 0.008).rotation.z =
      s * 0.12;
    // Mirror arm, split supports and reflective glass face.
    rod(body, V(s * 0.65, 0.68, 0.34), V(s * 0.94, 0.84, 0.47), 0.016, dark);
    rod(body, V(s * 0.71, 0.66, 0.48), V(s * 0.93, 0.83, 0.47), 0.012, dark);
    const mirror = box(body, graphite, 0.2, 0.075, 0.12, s * 0.966, 0.865, 0.46, 0.03);
    mirror.rotation.y = s * 0.18;
    const glass = box(body, alloy, 0.16, 0.054, 0.008, s * 0.968, 0.87, 0.397, 0.018);
    glass.rotation.y = s * 0.18;
    // Tail lamps wrap from the shoulders into the rear panel.
    path(
      body,
      [
        [s * 0.22, 0.727, -1.109],
        [s * 0.56, 0.724, -1.1],
        [s * 0.7, 0.665, -1.081],
        [s * 0.73, 0.53, -1.069],
      ],
      0.033,
      black,
    );
    path(
      body,
      [
        [s * 0.22, 0.734, -1.145],
        [s * 0.56, 0.734, -1.137],
        [s * 0.692, 0.67, -1.117],
        [s * 0.72, 0.54, -1.104],
      ],
      0.014,
      tail,
    );
    const speaker = mesh(
      new T.CylinderGeometry(0.095, 0.095, 0.025, 24),
      black,
      body,
      s * 0.57,
      0.51,
      0.03,
    );
    speaker.rotation.x = Math.PI / 2;
    for (let j = 0; j < 6; j++) {
      const ring = mesh(
        new T.TorusGeometry(0.025 + j * 0.011, 0.0015, 4, 24),
        dark,
        body,
        s * 0.57,
        0.51,
        0.014,
      );
      ring.rotation.y = Math.PI;
    }
  }
  // Honeycomb grille is geometry, recessed behind the front bumper opening.
  panel(
    body,
    [
      [-0.39, 0.39, 1.824],
      [0.39, 0.39, 1.824],
      [0.43, 0.27, 1.874],
      [0.36, 0.17, 1.88],
      [-0.36, 0.17, 1.88],
      [-0.43, 0.27, 1.874],
    ],
    black,
  );
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 19; x++) {
      const px = (x - 9) * 0.039 + (y % 2) * 0.019;
      if (Math.abs(px) > 0.37) continue;
      const ring = mesh(
        new T.TorusGeometry(0.023, 0.0035, 3, 6),
        dark,
        body,
        px,
        0.197 + y * 0.034,
        1.891,
      );
      ring.scale.y = 0.6;
    }
  path(
    body,
    [
      [-0.41, 0.17, 1.905],
      [0, 0.15, 1.914],
      [0.41, 0.17, 1.905],
    ],
    0.016,
    carbon,
  );
  box(body, black, 0.31, 0.085, 0.03, 0, 0.515, 1.609, 0.012);
  for (let j = 0; j < 8; j++)
    box(body, lamp, 0.029, 0.05, 0.018, (j - 3.5) * 0.034, 0.518, 1.631, 0.006);
  // Central scoop and subtle brand plate; no borrowed manufacturer decals.
  box(body, black, 0.2, 0.032, 0.12, 0, 0.811, 0.24, 0.006);
  panel(
    body,
    [
      [-0.12, 0.802, 0.13],
      [-0.11, 0.851, 0.19],
      [0.11, 0.851, 0.19],
      [0.12, 0.802, 0.13],
    ],
    graphite,
  );
  panel(
    body,
    [
      [-0.11, 0.851, 0.19],
      [-0.11, 0.816, 0.4],
      [0.11, 0.816, 0.4],
      [0.11, 0.851, 0.19],
    ],
    graphite,
  );
  panel(
    body,
    [
      [0, 0.809, 0.63],
      [-0.04, 0.798, 0.69],
      [0, 0.785, 0.73],
      [0.04, 0.798, 0.69],
    ],
    alloy,
  );
  // One-piece swept, tinted wind deflector with a central peak.
  const glassMat = new T.MeshPhysicalMaterial({
    color: 0x648390,
    metalness: 0.05,
    roughness: 0.08,
    transparent: true,
    opacity: 0.36,
    side: T.DoubleSide,
    depthWrite: false,
  });
  const wp: number[] = [],
    wu: number[] = [],
    wi: number[] = [];
  for (let i = 0; i <= 24; i++) {
    const x = (i / 24 - 0.5) * 1.22,
      z = 0.07 + 0.18 * (1 - Math.pow(x / 0.61, 2)),
      height = 0.18 + 0.05 * Math.cos(x * 3);
    wp.push(x, 0.735, z, x, 0.735 + height, z - 0.07);
    wu.push(i / 24, 0, i / 24, 1);
    if (i < 24) {
      const j = i * 2;
      wi.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
    }
  }
  const wg = new T.BufferGeometry();
  wg.setAttribute('position', new T.Float32BufferAttribute(wp, 3));
  wg.setAttribute('uv', new T.Float32BufferAttribute(wu, 2));
  wg.setIndex(wi);
  wg.computeVertexNormals();
  mesh(wg, glassMat, body);
  path(
    body,
    [
      [-0.61, 0.74, 0.07],
      [-0.32, 0.74, 0.2],
      [0, 0.74, 0.25],
      [0.32, 0.74, 0.2],
      [0.61, 0.74, 0.07],
    ],
    0.011,
    black,
    true,
  );
  // Dashboard, navigation display, console switchgear, driver-side dials.
  box(body, black, 1.13, 0.17, 0.25, 0, 0.66, 0.095, 0.06);
  const display = mesh(
    new T.PlaneGeometry(0.145, 0.092),
    new T.MeshBasicMaterial({ map: label('TOUR', '#12202a', '#e2f2f5') }),
    body,
    0,
    0.698,
    -0.039,
  );
  display.rotation.y = Math.PI;
  display.rotation.x = 0.22;
  for (const x of [0.44, 0.29]) {
    const dial = mesh(
      new T.CylinderGeometry(0.058, 0.058, 0.018, 24),
      alloy,
      body,
      x,
      0.707,
      -0.04,
    );
    dial.rotation.x = Math.PI / 2;
    const face = mesh(new T.CircleGeometry(0.051, 24), black, body, x, 0.707, -0.052);
    face.rotation.y = Math.PI;
    rod(body, V(x, 0.707, -0.054), V(x - 0.03, 0.73, -0.054), 0.003, tail);
  }
  for (let i = 0; i < 4; i++)
    box(body, alloy, 0.021, 0.028, 0.01, (i - 1.5) * 0.032, 0.565, -0.085, 0.004);
  rod(body, V(0, 0.52, -0.36), V(0, 0.64, -0.4), 0.012, dark);
  mesh(new T.SphereGeometry(0.025, 12, 8), black, body, 0, 0.64, -0.4);
  const steering = new T.Group();
  steering.position.set(0.365, 0.687, -0.17);
  steering.rotation.x = 0.23;
  body.add(steering);
  mesh(new T.TorusGeometry(0.133, 0.014, 8, 40), black, steering);
  mesh(new T.CylinderGeometry(0.032, 0.032, 0.038, 16).rotateX(Math.PI / 2), graphite, steering);
  for (let j = 0; j < 3; j++) {
    const a = (j / 3) * Math.PI * 2;
    rod(steering, V(), V(Math.sin(a) * 0.115, Math.cos(a) * 0.115, 0), 0.012, alloy);
  }
  batch(steering);
  // Rear deck fin, storage tubs, exposed swingarm, belt pulley, coil-over.
  box(body, black, 1.21, 0.26, 0.31, 0, 0.5, -1.005, 0.045);
  panel(
    body,
    [
      [-0.6, 0.735, -1.08],
      [0.6, 0.735, -1.08],
      [0.46, 0.79, -0.87],
      [-0.46, 0.79, -0.87],
    ],
    graphite,
  );
  panel(
    body,
    [
      [-0.045, 0.73, -1.13],
      [0, 1.08, -0.79],
      [0.045, 0.73, -1.13],
    ],
    graphite,
  );
  rod(body, V(-0.19, 0.31, -0.81), V(-0.19, 0.345, -1.47), 0.055, dark);
  rod(body, V(0.19, 0.31, -0.81), V(0.19, 0.345, -1.47), 0.045, dark);
  const rearSpring: number[][] = [];
  for (let j = 0; j < 100; j++) {
    const f = j / 99;
    rearSpring.push([
      0.25 + 0.052 * Math.cos(f * Math.PI * 18),
      0.7 - f * 0.35,
      -1.08 - f * 0.34 + 0.052 * Math.sin(f * Math.PI * 18),
    ]);
  }
  path(body, rearSpring, 0.009, red, true);
  rod(body, V(0.25, 0.72, -1.07), V(0.25, 0.34, -1.44), 0.022, alloy);
  for (const y of [0.27, 0.46]) rod(body, V(-0.215, y, -0.76), V(-0.215, y, -1.47), 0.012, black);
  const pulley = mesh(
    new T.CylinderGeometry(0.125, 0.125, 0.027, 40),
    dark,
    body,
    -0.21,
    0.345,
    -1.47,
  );
  pulley.rotation.z = Math.PI / 2;
  const plate = mesh(
    new T.PlaneGeometry(0.25, 0.115),
    new T.MeshStandardMaterial({ map: label('SLINGMODS', '#eef1f4', '#15191f'), roughness: 0.55 }),
    body,
    0,
    0.572,
    -1.22,
  );
  plate.rotation.y = Math.PI;
  const exhaust = rod(body, V(0.46, 0.24, -0.5), V(0.47, 0.25, -0.95), 0.045, dark);
  exhaust.name = 'Exhaust';
  // Tires use a rounded cross section and molded tread normals. Rim faces are open.
  const wheels: T.Group[] = [],
    pivots: T.Group[] = [];
  for (const [x, z, width, radius, rimR] of [
    [-0.8775, 1.197, 0.225, 0.329, 0.2286],
    [0.8775, 1.197, 0.225, 0.329, 0.2286],
    [0, -1.47, 0.305, 0.3455, 0.254],
  ]) {
    const pivot = new T.Group();
    pivot.position.set(x, radius, z);
    group.add(pivot);
    pivots.push(pivot);
    const wheel = new T.Group();
    pivot.add(wheel);
    wheels.push(wheel);
    const tread = grain('rubber');
    tread.repeat.set(2, 8);
    const tireMat = new T.MeshStandardMaterial({
      map: tread,
      normalMap: normals(tread, 4),
      color: 0xc0c2c6,
      roughness: 0.91,
    });
    const profile = [
      new T.Vector2(rimR, -width * 0.48),
      new T.Vector2(radius * 0.9, -width * 0.51),
      new T.Vector2(radius * 0.97, -width * 0.42),
      new T.Vector2(radius, -width * 0.28),
      new T.Vector2(radius, width * 0.28),
      new T.Vector2(radius * 0.97, width * 0.42),
      new T.Vector2(radius * 0.9, width * 0.51),
      new T.Vector2(rimR, width * 0.48),
    ];
    const tg = new T.LatheGeometry(profile, 64);
    tg.rotateZ(Math.PI / 2);
    mesh(tg, tireMat, wheel);
    for (const sign of [-1, 1]) {
      const ox = sign * (width * 0.5 + 0.004);
      for (const r of [rimR, rimR * 0.94]) {
        const ring = mesh(new T.TorusGeometry(r, 0.009, 8, 48), alloy, wheel, ox, 0, 0);
        ring.rotation.y = Math.PI / 2;
      }
      const barrel = mesh(
        new T.CylinderGeometry(rimR * 0.96, rimR * 0.96, width * 0.75, 48, 1, true),
        dark,
        wheel,
      );
      barrel.rotation.z = Math.PI / 2;
      const disc = mesh(
        new T.CylinderGeometry(0.1695, 0.1695, 0.012, 48),
        alloy,
        wheel,
        sign * width * 0.21,
        0,
        0,
      );
      disc.rotation.z = Math.PI / 2;
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * Math.PI * 2;
        for (const delta of [-0.13, 0.13])
          rod(
            wheel,
            V(ox, Math.sin(a) * 0.065, Math.cos(a) * 0.065),
            V(
              ox - 0.016 * sign,
              Math.sin(a + delta) * rimR * 0.91,
              Math.cos(a + delta) * rimR * 0.91,
            ),
            0.014,
            alloy,
            6,
          );
        const lug = mesh(
          new T.CylinderGeometry(0.008, 0.008, 0.012, 6),
          alloy,
          wheel,
          ox + sign * 0.017,
          Math.sin(a) * 0.044,
          Math.cos(a) * 0.044,
        );
        lug.rotation.z = Math.PI / 2;
      }
      const hub = mesh(
        new T.CylinderGeometry(0.034, 0.034, 0.016, 20),
        graphite,
        wheel,
        ox + sign * 0.012,
        0,
        0,
      );
      hub.rotation.z = Math.PI / 2;
      // Actual drilled rotor perforation appearance, discrete tread edge grooves.
      for (let j = 0; j < 28; j++) {
        const a = (j / 28) * Math.PI * 2;
        const h = mesh(
          new T.CircleGeometry(0.0035, 5),
          black,
          wheel,
          sign * (width * 0.21 + 0.007),
          Math.sin(a) * 0.143,
          Math.cos(a) * 0.143,
        );
        h.rotation.y = (sign * Math.PI) / 2;
      }
    }
    box(pivot, red, 0.045, 0.115, 0.065, width * 0.27, 0.08, -0.115, 0.018);
    batch(wheel);
  }
  // Helmeted rider with articulated arms and a restrained racing suit.
  const rider = new T.Group();
  body.add(rider);
  if (withDriver) {
    const suit = mat(0x262b32, 0.84);
    const torso = mesh(new T.CapsuleGeometry(0.12, 0.21, 6, 12), suit, rider, 0.365, 0.72, -0.51);
    torso.scale.z = 0.65;
    torso.rotation.x = -0.12;
    mesh(
      new T.SphereGeometry(0.12, 28, 20),
      new T.MeshPhysicalMaterial({
        color: 0xedeeee,
        roughness: 0.24,
        metalness: 0.2,
        clearcoat: 1,
      }),
      rider,
      0.365,
      1.035,
      -0.54,
    );
    const visor = mesh(
      new T.SphereGeometry(0.121, 24, 12, 0, Math.PI, Math.PI * 0.3, Math.PI * 0.35),
      graphite,
      rider,
      0.365,
      1.035,
      -0.54,
    );
    visor.rotation.y = -Math.PI / 2;
    for (const s of [-1, 1]) {
      path(
        rider,
        [
          [0.365 + s * 0.11, 0.81, -0.51],
          [0.365 + s * 0.15, 0.66, -0.32],
          [0.365 + s * 0.1, 0.69, -0.17],
        ],
        0.032,
        suit,
        true,
      );
      mesh(new T.SphereGeometry(0.036, 12, 8), black, rider, 0.365 + s * 0.1, 0.69, -0.17);
      path(
        rider,
        [
          [0.365 + s * 0.08, 0.47, -0.48],
          [0.365 + s * 0.1, 0.38, -0.1],
          [0.365 + s * 0.1, 0.27, 0.24],
        ],
        0.046,
        suit,
        true,
      );
    }
    batch(rider);
  }
  const flame = mesh(
    new T.ConeGeometry(0.04, 0.35, 12),
    new T.MeshBasicMaterial({ color: 0x81d9ff }),
    group,
    0.47,
    0.25,
    -1.1,
  );
  flame.rotation.x = -Math.PI / 2;
  flame.visible = false;
  batch(body);
  group.userData = {
    paint,
    wheels,
    pivots,
    steering,
    flame,
    tail,
    frontLamp: lamp,
    rider,
    dimensions: VEHICLE_DIMENSIONS,
  };
  return group;
}
