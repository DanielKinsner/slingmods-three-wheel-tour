import { describe, it, expect } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from 'three/webgpu';
import { freshSave, sanitizeSave, buyWheels, buyLighting, buyUpgrade } from './core';
import { WHEELS, LIGHTING_PRICE, INSTALLS, installFor, installedParts, applyBuild } from './parts';
import { PRODUCTS } from './catalog';
import { PAINTS, UPGRADES } from './content';

function stubHero() {
  const car = new Group();
  const rims = [0, 1, 2].map(() => new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
  const wheels = [0, 1, 2].map((i) => {
    const w = new Group();
    w.name = `Wheel_${i}`;
    w.add(rims[i]);
    car.add(w);
    return w;
  });
  const exhaust = new Group();
  exhaust.name = 'Exhaust';
  car.add(exhaust);
  car.userData = { rims, wheels, exhaust };
  return car;
}
const spec = (over: Partial<Parameters<typeof applyBuild>[1]> = {}) => ({
  upgrades: { power: 0, grip: 0, boost: 0 },
  wheels: 0,
  lighting: 0,
  rims: 'graphite' as const,
  ...over,
});

describe('real parts on the build', () => {
  it('every stage that names a product points at a catalog entry with a store link', () => {
    for (const u of UPGRADES)
      for (let stage = 0; stage < 3; stage++) {
        const step = installFor(u.id, stage);
        expect(step, `${u.id} stage ${stage}`).toBeDefined();
        if (step!.product) {
          expect(PRODUCTS).toContain(step!.product);
          expect(step!.product.url).toMatch(/^https:\/\/www\.slingmods\.com\//);
        }
      }
    expect(INSTALLS.lighting[0].product?.id).toBe('rgb');
  });
  it('installed parts follow the purchased stages', () => {
    expect(installedParts(spec())).toEqual([]);
    expect(
      installedParts(spec({ upgrades: { power: 2, grip: 3, boost: 3 }, lighting: 1 })),
    ).toEqual(['intake', 'exhaust', 'mounts', 'links', 'shocks', 'rgb']);
  });
  it('wheels are bought once, then switchable for free; unaffordable designs are refused', () => {
    const s = freshSave();
    expect(buyWheels(s, 2)).toBe(false);
    s.credits = WHEELS[2].price;
    expect(buyWheels(s, 2)).toBe(true);
    expect(s.credits).toBe(0);
    expect(s.wheels).toBe(2);
    expect(buyWheels(s, 0)).toBe(true);
    expect(buyWheels(s, 2)).toBe(true);
    expect(s.credits).toBe(0);
    expect(buyWheels(s, 99)).toBe(false);
  });
  it('the underglow kit is a one-time install and locks until bought on a fresh save', () => {
    const s = freshSave();
    expect(s.lighting).toBe(0);
    expect(buyLighting(s)).toBe(false);
    s.credits = LIGHTING_PRICE + 5;
    expect(buyLighting(s)).toBe(true);
    expect(s.credits).toBe(5);
    expect(buyLighting(s)).toBe(false);
  });
  it('older saves keep the underglow they already used; fresh or tampered saves do not', () => {
    const veteran = sanitizeSave({ races: 3, rgb: 2 });
    expect(veteran.lighting).toBe(1);
    expect(sanitizeSave({ races: 0 }).lighting).toBe(0);
    expect(sanitizeSave({ races: 3, lighting: 0 }).lighting).toBe(0);
    expect(sanitizeSave({ lighting: 9 }).lighting).toBe(1);
    const tampered = sanitizeSave({ wheels: 3, ownedWheels: [1] });
    expect(tampered.wheels).toBe(0);
    expect(tampered.ownedWheels).toEqual([0, 1]);
    const ok = sanitizeSave({ wheels: 3, ownedWheels: [0, 3, 'x', 40] });
    expect(ok.wheels).toBe(3);
    expect(ok.ownedWheels).toEqual([0, 3]);
  });
  it('factory palette keeps SlingMods red first and lists the 2025 Polaris names', () => {
    expect(PAINTS[0].name).toBe('SlingMods red');
    for (const name of [
      'Slingshot Red',
      'Jet Black',
      'Liquid Lime',
      'Graphite Gloss',
      'Royal Red',
      'Royal Red Crystal',
      'Nightfall',
    ])
      expect(PAINTS.map((p) => p.name)).toContain(name);
    expect(sanitizeSave({ paint: 99 }).paint).toBe(PAINTS.length - 1);
  });
  it('applyBuild is idempotent and swaps stock rims/exhaust for the installed parts', () => {
    const car = stubHero();
    applyBuild(car, spec());
    expect(car.getObjectByName('BuildParts')!.children.length).toBe(0);
    expect(car.userData.lightingKit).toBe(false);
    const full = spec({ upgrades: { power: 2, grip: 3, boost: 0 }, wheels: 2, lighting: 1 });
    applyBuild(car, full);
    applyBuild(car, full);
    expect(car.children.filter((c) => c.name === 'BuildParts').length).toBe(1);
    expect(car.getObjectByName('Dual rear exit exhaust')).toBeDefined();
    expect(car.getObjectByName('Exhaust')!.visible).toBe(false);
    expect(car.getObjectByName('Front coilover')).toBeDefined();
    expect(car.getObjectByName('Sway bar end links')).toBeDefined();
    expect(car.userData.rims.every((r: Mesh) => !r.visible)).toBe(true);
    expect(
      car.userData.wheels[0].children.filter((c: Group) => c.name === 'Aftermarket wheel').length,
    ).toBe(1);
    expect(car.userData.lightingKit).toBe(true);
    applyBuild(car, spec());
    expect(car.getObjectByName('Exhaust')!.visible).toBe(true);
    expect(car.userData.rims.every((r: Mesh) => r.visible)).toBe(true);
    expect(car.getObjectByName('Aftermarket wheel')).toBeUndefined();
  });
  it('low quality drops the tiny brackets and links but keeps the parts you can see', () => {
    const car = stubHero();
    applyBuild(car, spec({ upgrades: { power: 2, grip: 3, boost: 0 }, quality: 'low' }));
    expect(car.getObjectByName('Sway bar mounting brackets')).toBeUndefined();
    expect(car.getObjectByName('Sway bar end links')).toBeUndefined();
    expect(car.getObjectByName('Front coilover')).toBeDefined();
    expect(car.getObjectByName('Dual rear exit exhaust')).toBeDefined();
  });
  it('a full nine-stage build still charges each stage once', () => {
    const s = freshSave();
    s.credits = 100000;
    for (const u of UPGRADES) for (let i = 0; i < 3; i++) expect(buyUpgrade(s, u.id)).toBe(true);
    expect(s.credits).toBe(
      100000 - UPGRADES.reduce((a, u) => a + u.prices.reduce((x, y) => x + y, 0), 0),
    );
  });
});

describe('install moments and rival builds', () => {
  it('every product-backed install step maps to a scene group name that applyBuild creates', async () => {
    const { PART_GROUPS, rivalBuild } = await import('./parts');
    const car = stubHero();
    applyBuild(car, spec({ upgrades: { power: 2, grip: 3, boost: 0 }, wheels: 1 }));
    for (const names of Object.values(PART_GROUPS))
      for (const name of names) expect(car.getObjectByName(name), name).toBeDefined();
    const a = rivalBuild(3),
      b = rivalBuild(3);
    expect(a).toEqual(b);
    expect(a.wheels).toBeGreaterThanOrEqual(0);
    expect(a.wheels).toBeLessThan(WHEELS.length);
    expect(a.upgrades.grip).toBeLessThanOrEqual(3);
  });
});
