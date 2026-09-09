import * as T from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Bespoke 2025 R-inspired art, not manufacturer CAD or an exact fitment model. */
export const HERO_MODEL = {
  id: 'slingshot-r-inspired-2025',
  label: '2025 R-inspired',
  full: '/models/slingshot-r-hero.glb',
  low: '/models/slingshot-r-lod.glb',
  width: 1.98,
  length: 3.8,
  wheelbase: 2.667,
  frontTrack: 1.755,
  height: 1.318,
} as const;
type Quality = 'full' | 'low';
const templates = new Map<Quality, T.Group>();
const pending = new Map<Quality, Promise<boolean>>();

/** Cache each tier once. A failed/missing optional GLB leaves the existing mesh usable. */
export function loadHeroAsset(quality: Quality = 'full'): Promise<boolean> {
  if (templates.has(quality)) return Promise.resolve(true);
  const active = pending.get(quality);
  if (active) return active;
  const request = new GLTFLoader()
    .loadAsync(HERO_MODEL[quality])
    .then((gltf) => {
      // Validate the actual animation contract before accepting the optional asset.
      for (const name of [
        'Body',
        'Rider',
        'Steering',
        'Pivot_0',
        'Pivot_1',
        'Pivot_2',
        'Wheel_0',
        'Wheel_1',
        'Wheel_2',
      ]) {
        if (!gltf.scene.getObjectByName(name)) throw new Error(`Hero asset missing ${name}`);
      }
      templates.set(quality, gltf.scene);
      return true;
    })
    .catch((error: unknown) => {
      console.warn('Optional hero vehicle unavailable; procedural fallback retained.', error);
      return false;
    })
    .finally(() => pending.delete(quality));
  pending.set(quality, request);
  return request;
}

/** Instantiates shared immutable geometry with per-owner paint, lights and wheel finish. */
export function makeHeroVehicle(
  color: string,
  withDriver = true,
  quality: Quality = 'full',
): T.Group | null {
  const template = templates.get(quality) ?? templates.get('full') ?? templates.get('low');
  if (!template) return null;
  const group = template.clone(true);
  group.name = 'SlingMods 2025 R-inspired hero roadster';
  const materials = new Map<string, T.MeshStandardMaterial>();
  const rims: T.Mesh[] = [];
  const exhaustTips: T.Mesh[] = [];
  group.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const original = object.material as T.MeshStandardMaterial;
    if (!materials.has(original.name)) materials.set(original.name, original.clone());
    object.material = materials.get(original.name)!;
    if (original.name === 'WheelFinish') rims.push(object);
    if (original.name === 'ExhaustFinish') exhaustTips.push(object);
    if (original.name === 'Windscreen') {
      object.material.transparent = true;
      object.material.opacity = 0.27;
      object.material.depthWrite = false;
      object.material.side = T.DoubleSide;
    }
  });
  const paint = materials.get('BodyPaint')!;
  paint.color.set(color);
  const frontLamp = materials.get('FrontLamp')!;
  frontLamp.toneMapped = false;
  const wheels = [0, 1, 2].map((i) => group.getObjectByName(`Wheel_${i}`)!);
  const pivots = [0, 1, 2].map((i) => group.getObjectByName(`Pivot_${i}`)!);
  const rider = group.getObjectByName('Rider')!;
  rider.visible = withDriver;
  // Fictional game boost flame is kept separate from the naturally aspirated engine.
  const flame = new T.Mesh(
    new T.ConeGeometry(0.035, 0.28, 10),
    new T.MeshBasicMaterial({ color: 0x81d9ff }),
  );
  flame.position.set(0.51, 0.26, -1.27);
  flame.rotation.x = -Math.PI / 2;
  flame.visible = false;
  group.add(flame);
  group.userData = {
    paint,
    wheels,
    pivots,
    steering: group.getObjectByName('Steering')!,
    rpmNeedle: group.getObjectByName('RpmNeedle'),
    speedNeedle: group.getObjectByName('SpeedNeedle'),
    flame,
    tail: materials.get('TailLamp')!,
    frontLamp,
    rider,
    rims,
    wheelFinish: materials.get('WheelFinish'),
    exhaust: group.getObjectByName('Exhaust'),
    exhaustTips,
    dimensions: HERO_MODEL,
    modelId: HERO_MODEL.id,
    assetQuality: quality,
  };
  return group;
}
