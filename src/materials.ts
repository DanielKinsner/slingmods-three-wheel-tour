import * as T from 'three/webgpu';
import { rng } from './geometry';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
export let skyHDR: T.DataTexture | undefined;

export function canvasTexture(draw: (c: CanvasRenderingContext2D, n: number) => void, n = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  draw(canvas.getContext('2d')!, n);
  const t = new T.CanvasTexture(canvas);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
const grainCache = new Map<string, HTMLCanvasElement>();
const normalCache = new WeakMap<object, Map<number, HTMLCanvasElement>>();
export function grain(
  kind: 'grass' | 'sand' | 'stone' | 'concrete' | 'carbon' | 'rubber',
  seed = 12,
) {
  const key = kind + seed;
  const cached = grainCache.get(key);
  if (cached) {
    const t = new T.CanvasTexture(cached);
    t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }
  const generated = canvasTexture((ctx, n) => {
    const rand = rng(seed),
      bases = {
        grass: [76, 85, 49],
        sand: [173, 156, 121],
        stone: [142, 121, 102],
        concrete: [164, 167, 164],
        carbon: [24, 26, 30],
        rubber: [34, 36, 39],
      };
    const base = bases[kind],
      data = ctx.createImageData(n, n);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const i = (y * n + x) * 4;
        let noise =
          (rand() - 0.5) * (kind === 'carbon' ? 8 : 34) +
          Math.sin(x * 0.039) * Math.sin(y * 0.055) * 8;
        if (kind === 'carbon') noise += ((Math.floor(x / 4) + Math.floor(y / 4)) % 2) * 10;
        if (kind === 'rubber')
          noise += x % 128 < 7 || (y + Math.abs((x % 128) - 64) * 0.7) % 74 < 7 ? -23 : 0;
        for (let k = 0; k < 3; k++) data.data[i + k] = base[k] + noise;
        data.data[i + 3] = 255;
      }
    ctx.putImageData(data, 0, 0);
    if (kind === 'grass')
      for (let i = 0; i < 12000; i++) {
        ctx.strokeStyle = rand() > 0.5 ? '#79815466' : '#262f2544';
        const x = rand() * n,
          y = rand() * n;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + rand() * 4 - 2, y - 2 - rand() * 8);
        ctx.stroke();
      }
    if (kind === 'concrete') {
      ctx.strokeStyle = '#727777';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, n - 2, n - 2);
    }
  });
  grainCache.set(key, generated.image);
  return generated;
}
/** Tangent-space normals calculated from a height field, never baked directional light. */
export function normals(source: T.Texture, strength = 0.55) {
  const im = source.image as CanvasImageSource & { width: number; height: number };
  const existing = normalCache.get(im)?.get(strength);
  if (existing) {
    const t = new T.CanvasTexture(existing);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(im, 0, 0, 512, 512);
  const src = ctx.getImageData(0, 0, 512, 512).data,
    out = ctx.createImageData(512, 512);
  const h = (x: number, y: number) => src[(((y + 512) % 512) * 512 + ((x + 512) % 512)) * 4] / 255;
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
      const v = new T.Vector3(
          (h(x - 1, y) - h(x + 1, y)) * strength,
          (h(x, y - 1) - h(x, y + 1)) * strength,
          1,
        ).normalize(),
        i = (y * 512 + x) * 4;
      out.data[i] = (v.x * 0.5 + 0.5) * 255;
      out.data[i + 1] = (v.y * 0.5 + 0.5) * 255;
      out.data[i + 2] = (v.z * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  ctx.putImageData(out, 0, 0);
  const cached = normalCache.get(im) || new Map();
  cached.set(strength, c);
  normalCache.set(im, cached);
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
let roadSource: T.Texture | undefined;
let stuccoSource: T.Texture | undefined;
let facadeSource: T.Texture | undefined;
export async function loadSurfaceAssets() {
  [stuccoSource, facadeSource] = await Promise.all(
    ['coastal-stucco.webp', 'deco-facade.webp'].map((name) =>
      new T.TextureLoader().loadAsync(`./textures/${name}`).catch(() => grain('concrete')),
    ),
  );
  stuccoSource.colorSpace = facadeSource.colorSpace = T.SRGBColorSpace;
  skyHDR = await new HDRLoader().loadAsync('./textures/coastal-sky.hdr').catch(() => undefined);
  if (skyHDR) skyHDR.mapping = T.EquirectangularReflectionMapping;
  roadSource = await new T.TextureLoader()
    .loadAsync('./textures/asphalt.webp')
    .catch(() => grain('concrete'));
  roadSource.colorSpace = T.SRGBColorSpace;
}
export function buildingMaterial(color: T.ColorRepresentation, facade = false) {
  const map = (facade ? facadeSource : stuccoSource)?.clone() || grain('concrete');
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.repeat.set(facade ? 2 : 5, facade ? 3 : 4);
  map.anisotropy = 8;
  map.needsUpdate = true;
  const normalMap = normals(map, facade ? 0.65 : 1.1);
  normalMap.repeat.copy(map.repeat);
  return new T.MeshStandardMaterial({ color, map, normalMap, roughness: 0.85 });
}
export function surface(kind: 'asphalt' | 'grass' | 'sand' | 'stone' | 'concrete', repeat = 1) {
  const map =
    kind === 'asphalt' && roadSource
      ? roadSource.clone()
      : grain(kind === 'asphalt' ? 'concrete' : kind);
  map.needsUpdate = true;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.repeat.set(
    repeat * (kind === 'asphalt' ? 1.45 : 1),
    repeat * (kind === 'asphalt' ? 1.45 : 1),
  );
  map.anisotropy = 16;
  const normalMap = normals(map, kind === 'asphalt' ? 0.55 : 1);
  normalMap.repeat.copy(map.repeat);
  return new T.MeshStandardMaterial({
    map,
    normalMap,
    roughness: kind === 'asphalt' ? 0.89 : 0.96,
    color: kind === 'asphalt' ? 0xb7bbc2 : 0xffffff,
    side: T.DoubleSide,
  });
}
export function label(text: string, bg = '#111317', fg = '#f4f5f7') {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.font = '700 92px "Barlow Condensed"';
  ctx.textAlign = 'center';
  ctx.fillStyle = fg;
  ctx.fillText(text, 512, 158);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
