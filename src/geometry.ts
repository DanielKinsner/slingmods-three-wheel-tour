import * as T from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
export const mat = (color: T.ColorRepresentation, roughness = 0.7, metalness = 0) =>
  new T.MeshStandardMaterial({ color, roughness, metalness });
export function mesh(g: T.BufferGeometry, m: T.Material, p: T.Object3D, x = 0, y = 0, z = 0) {
  const o = new T.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  p.add(o);
  return o;
}
export function box(
  p: T.Object3D,
  m: T.Material,
  w: number,
  h: number,
  d: number,
  x = 0,
  y = 0,
  z = 0,
  r = 0,
) {
  return mesh(
    r
      ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3))
      : new T.BoxGeometry(w, h, d),
    m,
    p,
    x,
    y,
    z,
  );
}
export function rod(
  p: T.Object3D,
  a: T.Vector3,
  b: T.Vector3,
  r: number,
  m: T.Material,
  sides = 10,
) {
  const o = mesh(new T.CylinderGeometry(r, r, a.distanceTo(b), sides), m, p);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  return o;
}
export function path(p: T.Object3D, points: number[][], r: number, m: T.Material, curved = false) {
  const curve = curved
    ? new T.CatmullRomCurve3(points.map((a) => V(...a)))
    : new T.CurvePath<T.Vector3>();
  if (curve instanceof T.CurvePath)
    for (let i = 1; i < points.length; i++)
      curve.add(new T.LineCurve3(V(...points[i - 1]), V(...points[i])));
  return mesh(
    new T.TubeGeometry(
      curve,
      Math.max(12, Math.ceil(points.length * (curved ? 1.4 : 1))),
      r,
      8,
      false,
    ),
    m,
    p,
  );
}
export function panel(p: T.Object3D, points: number[][], m: T.Material) {
  const v: number[] = [];
  for (let i = 1; i < points.length - 1; i++) v.push(...points[0], ...points[i], ...points[i + 1]);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(v, 3));
  g.setAttribute(
    'uv',
    new T.Float32BufferAttribute(
      v.flatMap((_, i) => (i % 3 === 0 ? [v[i], v[i + 2]] : [])),
      2,
    ),
  );
  g.computeVertexNormals();
  return mesh(g, m, p);
}
/** Merge static parts by material, retaining articulated groups separately. */
export function batch(parent: T.Group) {
  const buckets = new Map<T.Material, T.Mesh[]>();
  for (const o of [...parent.children])
    if (o instanceof T.Mesh && !Array.isArray(o.material)) {
      const a = buckets.get(o.material) || [];
      a.push(o);
      buckets.set(o.material, a);
    }
  for (const [m, parts] of buckets) {
    if (parts.length < 2) continue;
    const gs = parts.map((o) => {
      o.updateMatrix();
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrix);
      if (!g.getAttribute('uv'))
        g.setAttribute(
          'uv',
          new T.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2),
        );
      return g;
    });
    const merged = mergeGeometries(gs);
    if (merged) {
      parts.forEach((o) => {
        parent.remove(o);
        o.geometry.dispose();
      });
      mesh(merged, m, parent);
    }
    gs.forEach((g) => g.dispose());
  }
}
export function rng(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
