import * as T from 'three/webgpu';
import { positionLocal, sin, cos, vec3, uniform } from 'three/tsl';
import { V, mat, mesh, box, rod, panel, batch, rng } from './geometry';
import type { Circuit } from './world';
import type { CollisionWorld } from './collision';

/** Fictional Biscayne circuit kit. Metres; +Z is the front of each building.
 * Original generated surface maps are neutral, not photographs with baked light.
 * Static details merge per city block, retaining useful frustum culling. */
const sources = new Map<string, T.Texture>();
let loading: Promise<void> | undefined;
export function loadMiamiAssets() {
  return loading ??= Promise.all([
    ...['limewash', 'pavers', 'terrazzo'].flatMap(f => ['color', 'normal', 'roughness'].map(m => `${f}-${m}`)),
    'storefront-atlas',
  ].map(async name => {
    const texture = await new T.TextureLoader().loadAsync(`./textures/miami/${name}.webp`);
    if (name.endsWith('color') || name === 'storefront-atlas') texture.colorSpace = T.SRGBColorSpace;
    sources.set(name, texture);
  })).then(() => undefined).catch(error => {
    // Neutral materials remain playable if an optional art request fails.
    console.warn('Miami texture kit unavailable; retaining geometry and neutral materials.', error);
    loading = undefined;
  });
}

function texture(name: string, repeat = 1) {
  const source = sources.get(name);
  if (!source) return null;
  const t = source.clone();
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function flatten(group: T.Group) {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert();
  const children: T.Mesh[] = [];
  group.traverse(o => { if (o instanceof T.Mesh) children.push(o); });
  for (const m of children) {
    const geometry = m.geometry;
    m.geometry = geometry.clone().applyMatrix4(inverse.clone().multiply(m.matrixWorld));
    geometry.dispose();
    m.removeFromParent();
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
    group.add(m);
  }
  for (const c of [...group.children]) if (!(c instanceof T.Mesh)) group.remove(c);
  batch(group);
}

export function buildMiami(root: T.Group, circuit: Circuit, night: boolean, collision: CollisionWorld) {
  const random = rng(90309);
  const streetLights: T.Vector3[] = [];
  const boats: T.Group[] = [];
  const waterClock = uniform(0);
  const metrics = { buildings: 0, facadeFamilies: 3, blocks: 8, staticMeshes: 0, triangles: 0,
    streetLights: 0, movingBoats: 0, sponsorPanels: 0, minBuildingRoadClearance: Infinity };
  const chunks = Array.from({ length: metrics.blocks }, (_, i) => {
    const group = new T.Group(); group.name = `Miami streetscape block ${i + 1}`; root.add(group); return group;
  });
  const pbr = (family: string, color: number, repeat = 3) => new T.MeshStandardMaterial({
    color, map: texture(`${family}-color`, repeat), normalMap: texture(`${family}-normal`, repeat),
    roughnessMap: texture(`${family}-roughness`, repeat), roughness: 1, normalScale: new T.Vector2(.35,.35),
  });
  const coral = pbr('limewash', 0xe8b9a5), mint = pbr('limewash', 0xb8d3c6), cream = pbr('limewash', 0xf7ead5);
  const plaster = [coral, mint, cream];
  const white = mat(0xe6e6df, .69), concrete = pbr('pavers', 0xe8e1d4, 4);
  const terrazzo = pbr('terrazzo', 0xe0e8dc, 3);
  const metal = mat(0x293d44, .38, .75), wood = mat(0x8f7656, .9), red = mat(0xcf1227, .55);
  const dark = mat(0x172c32, .7), foliage = mat(0x477044, .9);
  const glass = new T.MeshPhysicalMaterial({ color: 0x416c76, metalness: .62, roughness: .19, clearcoat: .7 });
  const warm = new T.MeshStandardMaterial({ color: 0x817c69, emissive: 0xffd69c,
    emissiveIntensity: night ? .95 : .04, roughness: .45, metalness: .25 });
  const strip = new T.MeshStandardMaterial({ color: 0xefdfbf, emissive: 0xf9d9a3,
    emissiveIntensity: night ? 1.8 : .05, roughness: .45 });
  const atlasMaterial = new T.MeshStandardMaterial({ color: 0xffffff, map: texture('storefront-atlas'),
    emissiveMap: texture('storefront-atlas'), emissive: 0xffffff, emissiveIntensity: night ? .35 : 0, roughness: .8 });
  const logo = new T.TextureLoader().load('./slingmods-logo.png'); logo.colorSpace = T.SRGBColorSpace;
  const sponsor = new T.MeshStandardMaterial({ map: logo, transparent: true, alphaTest: .05,
    emissive: 0xffffff, emissiveMap: logo, emissiveIntensity: night ? .35 : .02, roughness: .65 });

  function sign(parent: T.Group, id: number, w: number, h: number, x: number, y: number, z: number) {
    const geometry = new T.PlaneGeometry(w, h), uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i,
      ((id % 2) + .02 + uv.getX(i) * .96) / 2,
      (3 - Math.floor(id / 2) + .025 + uv.getY(i) * .95) / 4);
    mesh(geometry, atlasMaterial, parent, x, y, z);
  }

  function building(p: T.Vector3, angle: number, index: number, family: number, chunk: T.Group) {
    const g = new T.Group(); g.position.copy(p); g.rotation.y = angle; chunk.add(g);
    const w = family === 2 ? 24 : family === 1 ? 27 : 22;
    const d = family === 2 ? 20 : 14;
    const floors = family === 2 ? 13 + index % 7 : family === 1 ? 6 + index % 3 : 3 + index % 2;
    const h = 3.15 * floors + 3.4, paint = plaster[index % 3];
    const shell = box(g, family === 2 ? glass : paint, w, h, d, 0, h / 2, 0);
    collision.add(shell);
    box(g, terrazzo, w + 1.3, .35, d + 2, 0, .05, .4);
    box(g, white, w + .8, .35, d + .7, 0, h, 0);
    // Recessed shopfront and 2.3 m doors give the facade a human scale.
    box(g, dark, w - 1, 2.7, .13, 0, 1.45, d / 2 + .01);
    for (let x = -w / 2 + 1.4; x < w / 2; x += 2.8) {
      mesh(new T.PlaneGeometry(2.5,2.25),glass,g,x,1.4,d/2+.15);
      box(g, white, .11, 2.7, .26, x + 1.35, 1.4, d / 2 + .11);
      box(g, metal, .025, .55, .07, x + .9, 1.2, d / 2 + .19);
    }
    box(g, white, w + .8, .24, 2.5, 0, 3.18, d / 2 + .8);
    box(g, strip, w - .5, .035, .045, 0, 3.02, d / 2 + 1.85);
    sign(g, family === 2 ? 4 : index % 2 ? 3 : 0, Math.min(9, w * .5), 2.15, 0, 4.2, d / 2 + .15);
    for (let floor = 0; floor < floors; floor++) {
      const y = 5.7 + floor * 3.15;
      for (let c = 0; c < Math.floor(w / 3.1); c++) {
        const x = -w / 2 + 1.8 + c * 3.1;
        mesh(new T.PlaneGeometry(2.2,2.15),(index+c*7+floor*3)%5<2?warm:glass,g,x,y,d/2+.14);
        if (family !== 2) {
          box(g, white, .09, 2.18, .15, x, y, d / 2 + .15);
          box(g, white, 2.4, .12, .4, x, y - 1.15, d / 2 + .12);
        }
      }
      if (family === 1) {
        // Continuous stepped balcony slab with believable guardrails and dividers.
        box(g, white, w + .6, .15, 1.7, 0, y - 1.25, d / 2 + .72);
        box(g, glass, w, .8, .055, 0, y - .65, d / 2 + 1.52);
        box(g, metal, w + .1, .045, .06, 0, y - .23, d / 2 + 1.56);
        for (let x = -w/2; x <= w/2; x += 3.2) box(g, white, .075, 1.02, 1.45, x, y - .73, d / 2 + .75);
      } else box(g, family === 2 ? metal : white, w + .3, .13, .32, 0, y + 1.35, d / 2 + .08);
    }
    if (family === 0) {
      // Streamline Moderne eyebrow, stepped parapet and vertical corner blade.
      for (let j = 0; j < 3; j++) box(g, white, w + .6 - j * 2.2, .26, 1, 0, h + j * .5, d / 2 - .05);
      box(g, paint, 2.9, h + 2.1, 1.1, -w * .35, (h + 2.1) / 2, d / 2 + .13);
      for (const x of [-.68, 0, .68]) box(g, white, .14, h + 1.7, .23, -w * .35 + x, (h + 1.7) / 2, d / 2 + .78);
      const awning = box(g, index % 2 ? mint : coral, w * .68, .14, 2.15, w * .1, 2.9, d / 2 + 1.18);
      awning.rotation.x = -.1;
      sign(g, index % 2 ? 1 : 7, 6.4, 1.6, w*.15, 3.9, d/2+.19);
    }
    if (family === 2) {
      // Continuous mullions, side glazing and a roof crown break up tower boxes.
      for (let x = -w/2; x <= w/2; x += 3) box(g, white, .14, h, .2, x, h/2, d/2+.18);
      for (const side of [-1, 1]) {
        for (let z = -d/2+1; z < d/2; z += 3) box(g, white, .18, h, .14, side*(w/2+.06), h/2, z);
        for (let y = 3.3; y < h; y += 3.15) box(g, metal, .18, .12, d, side*(w/2+.08), y, 0);
      }
      box(g, metal, w*.74, 3, d*.7, 0, h+1.5, 0);
      box(g, white, w*.78, .2, d*.74, 0, h+3, 0);
    } else {
      for (const x of [-4, 4]) { box(g, metal, 2.4, 1.2, 2.3, x, h+.7, -1); box(g, white, 2.1, .12, 2, x, h+1.34, -1); }
    }
    metrics.buildings++;
  }

  // Readable geographic sequence: hotel boulevard -> downtown -> marina return.
  // Sites are tested against all sampled road points, not just their local offset.
  for (let distance = 38, index = 0; distance < circuit.length - 55; distance += 38, index++) {
    const f = distance / circuit.length, a = circuit.at(distance), chunk = chunks[Math.floor(f * chunks.length)];
    if (f > .64 && f < .91) continue;
    const family = f < .33 ? index % 4 === 0 ? 1 : 0 : f < .64 ? 2 : 1;
    for (const side of [-1, 1]) {
      const off = family === 2 ? 38 : 32, p = a.p.clone().addScaledVector(a.r, side * off);
      const clearance = circuit.terrainAt(p.x, p.z).distance;
      if (clearance < off - 3 || p.x < -35) continue;
      p.y = a.p.y - .3;
      building(p, Math.atan2(-side * a.r.x, -side * a.r.z), index, family, chunk);
      metrics.minBuildingRoadClearance = Math.min(metrics.minBuildingRoadClearance, clearance);
    }
  }

  // Street modules are outside the existing track barriers; fixtures never enter the lane.
  for (let distance = 12, index = 0; distance < circuit.length; distance += 24, index++) {
    const f = distance / circuit.length, a = circuit.at(distance), chunk = chunks[Math.floor(f * chunks.length)];
    for (const side of [-1, 1]) {
      const g = new T.Group(); g.position.copy(a.p).addScaledVector(a.r, side * 14.4);
      g.rotation.y = Math.atan2(a.t.x, a.t.z); chunk.add(g);
      box(g, concrete, 5.9, .2, 24.25, 0, -.02, 0);
      box(g, white, .23, .3, 24.3, -side * 2.9, .01, 0);
      if (index % 2 === 0) {
        rod(g, V(side * 1.6, .05, 0), V(side * 1.6, 7, 0), .075, metal);
        rod(g, V(side * 1.6, 6.95, 0), V(-side * 1.45, 6.95, 0), .065, metal);
        box(g, metal, .7, .15, .42, -side * 1.3, 6.9, 0);
        box(g, strip, .57, .035, .32, -side * 1.3, 6.81, 0);
        streetLights.push(V(-side * 1.3, 6.81, 0).applyAxisAngle(V(0,1,0), g.rotation.y).add(g.position));
      }
      if (index % 3 === 0) {
        box(g, terrazzo, 1.6, .6, 1.2, side*.6, .4, 5.5);
        const shrub = mesh(new T.SphereGeometry(1, 8, 5), foliage, g, side*.6, .9, 5.5); shrub.scale.set(.8,.45,.57);
        box(g, metal, 1.9, .09, .5, 0, .6, -5.2);
        for (const x of [-.72,.72]) box(g, metal, .075, .6, .45, x,.3,-5.2);
        for (let y=.76; y<1.2; y+=.13) box(g, wood,1.9,.095,.075,0,y,-5.42);
      }
      if (index % 8 === 0) {
        box(g, red, 3.8, 1.1, .15, 0, 1.8, 8.4);
        const s = mesh(new T.PlaneGeometry(3.45,.825), sponsor,g,0,1.8,8.49);
        s.rotation.y = 0;
        // Logo on both faces, using the approved source pixels, never regenerated text.
        const back=mesh(new T.PlaneGeometry(3.45,.825),sponsor,g,0,1.8,8.31); back.rotation.y=Math.PI;
        for(const x of [-1.55,1.55]) box(g,metal,.075,1.8,.075,x,.9,8.4);
        metrics.sponsorPanels++;
      }
    }
  }

  // Marina district: a real boardwalk edge, finger piers and small moored craft.
  const marina = chunks[6];
  const bayMaterial = new T.MeshPhysicalNodeMaterial({ color: night ? 0x102d39 : 0x247c89,
    roughness: .24, metalness: .55, clearcoat: .8, clearcoatRoughness: .22 });
  const phase=positionLocal.x.mul(.17).add(positionLocal.z.mul(.1)).add(waterClock.mul(.55));
  bayMaterial.positionNode=positionLocal.add(vec3(0,sin(phase).mul(.055),0));
  bayMaterial.normalNode=vec3(cos(phase).mul(-.025),1,cos(phase).mul(-.015)).normalize();
  const bayGeometry=new T.PlaneGeometry(900,400,60,28); bayGeometry.rotateX(-Math.PI/2);
  const bay=mesh(bayGeometry,bayMaterial,root,140,1.4,-350); bay.name='Biscayne marina water'; bay.castShadow=false;
  for (let distance = circuit.length * .755; distance < circuit.length * .855; distance += 33) {
    const a = circuit.at(distance), g = new T.Group(); g.position.copy(a.p).addScaledVector(a.r, -20);
    g.rotation.y = Math.atan2(a.t.x,a.t.z)+Math.PI; marina.add(g);
    box(g, concrete, 8,.4,34,0,-.1,0);
    for(let z=-15; z<=15; z+=5) { rod(g,V(4,.3,z),V(4,1.3,z),.055,metal); }
    for(const y of [.6,1.3]) rod(g,V(4,y,-17),V(4,y,17),.045,metal);
    box(g,wood,15,.25,2.6,11,-.25,0);
    for(const x of [5,11,17]) for(const z of [-1.1,1.1]) rod(g,V(x,-3,z),V(x,.6,z),.14,wood);
    const boat = new T.Group(); boat.position.copy(g.position).add(V(16,-1.3,5.2).applyAxisAngle(V(0,1,0),g.rotation.y));
    boat.rotation.y=g.rotation.y; root.add(boat);
    const hull=mesh(new T.SphereGeometry(1,16,8),white,boat); hull.scale.set(1.15,.62,3.8);
    box(boat,wood,1.75,.16,4,0,.35,0); box(boat,glass,1.5,.65,1.6,0,.74,-.3);
    rod(boat,V(0,.4,0),V(0,7.4,0),.037,metal);
    panel(boat,[[.02,.8,.15],[.02,7.1,.15],[.02,.8,3]],cream);
    batch(boat); boat.userData.baseY=boat.position.y; boats.push(boat);
  }
  const marinaAnchor = circuit.at(circuit.length*.76), marinaSign=new T.Group();
  marinaSign.position.copy(marinaAnchor.p).addScaledVector(marinaAnchor.r,-19);
  marinaSign.rotation.y=Math.atan2(marinaAnchor.r.x,marinaAnchor.r.z); marina.add(marinaSign);
  box(marinaSign,dark,7.8,2.2,.18,0,3.3,0); sign(marinaSign,2,7.5,1.95,0,3.3,.1);
  for(const x of [-3.4,3.4]) box(marinaSign,metal,.15,4.6,.15,x,2.3,0);

  // Distant skyline is an intentionally cheaper silhouette tier, beyond circuit solids.
  const skyline = new T.Group(); skyline.name='Miami distant skyline'; root.add(skyline);
  for(let i=0;i<20;i++) {
    const x=455+(i%5)*43, z=-130+Math.floor(i/5)*155, h=45+random()*75;
    box(skyline,i%3?glass:white,27+random()*12,h,25,x,h/2-1,z);
    box(skyline,metal,19,h*.04,19,x,h+h*.02-1,z);
    for(let y=9;y<h;y+=10) box(skyline,white,28,.25,.2,x,y,z+12.7);
  }
  flatten(skyline);
  for(const chunk of chunks) flatten(chunk);
  for(const group of [...chunks,skyline]) group.traverse(o => {
    if(o instanceof T.Mesh) { metrics.staticMeshes++; metrics.triangles+=(o.geometry.index?.count ?? o.geometry.getAttribute('position').count)/3; }
  });
  metrics.streetLights=streetLights.length; metrics.movingBoats=boats.length;
  root.userData.miamiMetrics=metrics;
  return { streetLights, metrics, update(elapsed: number, motion: boolean) {
    waterClock.value=motion?elapsed:0;
    for(let i=0;i<boats.length;i++) {
      boats[i].position.y=boats[i].userData.baseY+(motion?Math.sin(elapsed*.8+i)*.1:0);
      boats[i].rotation.z=motion?Math.sin(elapsed*.65+i)*.02:0;
    }
  }};
}
