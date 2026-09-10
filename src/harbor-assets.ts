import * as T from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const HARBOR_MODULES = [
  'PortContainer',
  'PortWarehouse',
  'PortCrane',
  'PortFreighter',
] as const;
export type HarborModule = (typeof HARBOR_MODULES)[number];
let template: T.Group | undefined;
let pending: Promise<boolean> | undefined;

/** Small, original Blender kit; the procedural harbor remains a load-failure fallback. */
export function loadHarborAssets(): Promise<boolean> {
  if (template) return Promise.resolve(true);
  if (pending) return pending;
  pending = new GLTFLoader()
    .loadAsync('/models/harbor-kit.glb')
    .then((gltf) => {
      for (const name of HARBOR_MODULES)
        if (!gltf.scene.getObjectByName(name)) throw new Error(`Harbor asset missing ${name}`);
      template = gltf.scene;
      return true;
    })
    .catch((error: unknown) => {
      console.warn('Optional harbor art unavailable; procedural scenery retained.', error);
      return false;
    })
    .finally(() => {
      pending = undefined;
    });
  return pending;
}

/** Each scene owns its geometry, textures and palette. Unloading it cannot damage the cache. */
export function harborInstances(night: boolean) {
  const materials = new Map<string, T.MeshStandardMaterial>();
  const textures = new Map<T.Texture, T.Texture>();
  return (name: HarborModule, tint?: number): T.Object3D | null => {
    const source = template?.getObjectByName(name);
    if (!source) return null;
    const instance = source.clone(true);
    instance.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      object.geometry = object.geometry.clone();
      object.castShadow = true;
      object.receiveShadow = true;
      const original = object.material as T.MeshStandardMaterial;
      const key = `${original.name}/${original.name === 'Port_Container' ? (tint ?? '') : ''}`;
      let material = materials.get(key);
      if (!material) {
        material = original.clone();
        for (const slot of [
          'map',
          'normalMap',
          'roughnessMap',
          'metalnessMap',
          'emissiveMap',
        ] as const) {
          const texture = original[slot];
          if (!texture) continue;
          if (!textures.has(texture)) textures.set(texture, texture.clone());
          material[slot] = textures.get(texture)!;
          material[slot]!.anisotropy = 4;
        }
        if (tint !== undefined && original.name === 'Port_Container') material.color.setHex(tint);
        if (original.name === 'Port_Lamp') material.emissiveIntensity = night ? 3 : 0.15;
        materials.set(key, material);
      }
      object.material = material;
    });
    return instance;
  };
}
