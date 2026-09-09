import { loadHeroAsset, makeHeroVehicle } from './hero-vehicle';
import { buildMiami } from './miami';
import * as T from 'three/webgpu';
import { makeVehicle } from './vehicle';
import { surface, loadSurfaceAssets, skyHDR } from './materials';
import { buildEnvironment } from './environment';
import { CollisionWorld } from './collision';
import { roadOrientation } from './road-frame';
import { TRACKS, type Track } from './content';
import { clamp, type Driver } from './core';
import {
  makeShowroom,
  environmentTexture,
  vehicleLighting,
  streetLightPool,
  RGB_COLORS,
} from './lighting';

let brandImage: HTMLImageElement | undefined;
export async function loadBrand() {
  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      brandImage = img;
      resolve();
    };
    img.onerror = () => resolve();
    img.src = './slingmods-logo.png';
  });
}
const UP = new T.Vector3(0, 1, 0);
const material = (color: number | string, roughness = 0.8, metalness = 0) =>
  new T.MeshStandardMaterial({ color, roughness, metalness });
function mesh(geo: T.BufferGeometry, mat: T.Material, parent: T.Object3D, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(
  parent: T.Object3D,
  mat: T.Material,
  w: number,
  h: number,
  d: number,
  x = 0,
  y = 0,
  z = 0,
) {
  return mesh(new T.BoxGeometry(w, h, d), mat, parent, x, y, z);
}
function rod(parent: T.Object3D, a: T.Vector3, b: T.Vector3, r: number, mat: T.Material) {
  const m = mesh(new T.CylinderGeometry(r, r, a.distanceTo(b), 8), mat, parent);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
  return m;
}
function textTexture(title: string, subtitle = '', bg = '#f1eee2', fg = '#222924') {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.font = 'italic 900 130px "Barlow Condensed", sans-serif';
  if (title === 'SLINGMODS' && brandImage) {
    const w = 760,
      h = (w * brandImage.height) / brandImage.width;
    ctx.drawImage(brandImage, (1024 - w) / 2, subtitle ? 8 : 35, w, h);
  } else ctx.fillText(title, 512, subtitle ? 147 : 174);
  if (subtitle) {
    ctx.font = '600 34px Barlow, sans-serif';
    ctx.fillText(subtitle, 512, 215);
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
function poly(parent: T.Object3D, points: number[][], mat: T.Material) {
  const v: number[] = [];
  for (let i = 1; i < points.length - 1; i++) v.push(...points[0], ...points[i], ...points[i + 1]);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return mesh(g, mat, parent);
}

export interface TrackPoint {
  p: T.Vector3;
  t: T.Vector3;
  r: T.Vector3;
  curve: number;
}
export class Circuit {
  curve: T.CatmullRomCurve3;
  length: number;
  samples: TrackPoint[] = [];
  constructor(public data: Track) {
    this.curve = new T.CatmullRomCurve3(
      data.points.map((p) => new T.Vector3(...p)),
      true,
      'catmullrom',
      0.45,
    );
    this.curve.arcLengthDivisions = 2000;
    this.length = this.curve.getLength();
    for (let i = 0; i < 1600; i++) {
      const u = i / 1600,
        p = this.curve.getPointAt(u),
        t = this.curve.getTangentAt(u).normalize();
      const next = this.curve.getTangentAt((u + 0.002) % 1);
      const angle = Math.atan2(t.z * next.x - t.x * next.z, t.dot(next));
      this.samples.push({
        p,
        t,
        r: new T.Vector3(t.z, 0, -t.x).normalize(),
        curve: angle / (this.length * 0.002),
      });
    }
  }
  at(distance: number): TrackPoint {
    const s =
      ((((distance % this.length) + this.length) % this.length) / this.length) *
      this.samples.length;
    const a = this.samples[Math.floor(s)],
      b = this.samples[(Math.floor(s) + 1) % this.samples.length],
      f = s % 1;
    return {
      p: a.p.clone().lerp(b.p, f),
      t: a.t.clone().lerp(b.t, f).normalize(),
      r: a.r.clone().lerp(b.r, f).normalize(),
      curve: a.curve + (b.curve - a.curve) * f,
    };
  }
  project(position:T.Vector3,hint:number){
    const step=this.length/this.samples.length;
    const center=Math.round((((hint%this.length)+this.length)%this.length)/step);
    let best=Infinity,bestIndex=center;
    for(let offset=-55;offset<=55;offset++){
      const i=(center+offset+this.samples.length)%this.samples.length;
      const q=this.samples[i].p;const d=(q.x-position.x)**2+(q.z-position.z)**2;
      if(d<best){best=d;bestIndex=i;}
    }
    if(best>80*80)for(let i=0;i<this.samples.length;i+=3){
      const q=this.samples[i].p;const d=(q.x-position.x)**2+(q.z-position.z)**2;
      if(d<best){best=d;bestIndex=i;}
    }
    const nearest=this.samples[bestIndex];
    const offset=position.clone().sub(nearest.p).dot(nearest.t);
    const wrapped=bestIndex*step+offset;
    const delta=((wrapped-hint+this.length*1.5)%this.length+this.length)%this.length-this.length*.5;
    const distance=hint+delta,point=this.at(distance);
    return {distance,lane:position.clone().sub(point.p).dot(point.r),point};
  }
  terrainAt(x: number, z: number) {
    let closest = Infinity,
      y = 0;
    for (let i = 0; i < this.samples.length; i += 4) {
      const p = this.samples[i].p,
        d = (x - p.x) ** 2 + (z - p.z) ** 2;
      if (d < closest) {
        closest = d;
        y = p.y;
      }
    }
    const distance = Math.sqrt(closest),
      fade = clamp((distance - 13) / 65, 0, 1);
    let height = y - 1.1 + (Math.sin(x * 0.022) * 5 + Math.cos(z * 0.018) * 4) * fade;
    if (this.data.id === 'miami') { height = y - 1.1; if(z < -185 && distance > 23) height += (-2-height)*clamp((distance-23)/10,0,1); }
    if (this.data.id === 'coast' && x < -95) height -= Math.min(9, (-95 - x) * 0.13);
    return { height, distance };
  }
  svg() {
    const pts = this.samples.filter((_, i) => i % 20 === 0).map((s) => s.p);
    const minX = Math.min(...pts.map((p) => p.x)),
      maxX = Math.max(...pts.map((p) => p.x)),
      minZ = Math.min(...pts.map((p) => p.z)),
      maxZ = Math.max(...pts.map((p) => p.z));
    const scale = 120 / Math.max(maxX - minX, maxZ - minZ);
    return (
      pts
        .map(
          (p, i) =>
            `${i ? 'L' : 'M'}${((p.x - minX) * scale + 14).toFixed(1)},${((p.z - minZ) * scale + 10).toFixed(1)}`,
        )
        .join(' ') + 'Z'
    );
  }
}

export class World {
  renderer: T.WebGPURenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(52, 1, 0.2, 2400);
  root = new T.Group();
  cars: T.Group[] = [];
  circuit!: Circuit;
  sun!: T.DirectionalLight;
  elapsed = 0;
  lastRace = false;
  cameraReady = false;
  lastCarPosition = new T.Vector3();
  quality = 'auto';
  frameMs = 16;
  cpu = { environment: 0, render: 0, frame: 0 };
  backend = '';
  collision = new CollisionWorld();
  environment?: ReturnType<typeof buildEnvironment>;
  vehicleView = 0;
  cockpit = false;
  interpolationAlpha=1;
  photoPending=false;
  studioMood='studio';
  miami?: ReturnType<typeof buildMiami>;
  orbitAngle = 0;
  smoke!: T.InstancedMesh;
  skids!: T.InstancedMesh;
  particleIndex = 0;
  skidIndex = 0;
  particles: { p: T.Vector3; life: number; size: number }[] = [];
  effectClock = 0;
  qualityClock = 0;
  night = false;
  rgb = 0;
  rgbCycle = false;
  inShowroom = false;
  showroom!: T.Group;
  outdoorEnvironment?: T.Texture;
  studioEnvironment?: T.Texture;
  carLights: ReturnType<typeof vehicleLighting>[] = [];
  updateStreetLights?: ReturnType<typeof streetLightPool>;
  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGPURenderer({
      canvas,
      antialias: true,
      alpha: false,
      forceWebGL: new URLSearchParams(location.search).has('webgl'),
    });
  }
  async init() {
    await this.renderer.init();
    await Promise.all([loadSurfaceAssets(), ...(matchMedia('(max-width:800px)').matches ? [loadHeroAsset('low')] : [loadHeroAsset(),loadHeroAsset('low')])]);
    this.backend = (this.renderer.backend as unknown as { isWebGPUBackend?: boolean })
      .isWebGPUBackend
      ? 'WebGPU'
      : 'WebGL 2';
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
  setQuality(q: string) {
    this.quality = q;
    this.renderer.setPixelRatio(
      q === 'low' ? 1 : Math.min(devicePixelRatio, q === 'high' ? 2 : 1.6),
    );
    this.renderer.shadowMap.enabled = q !== 'low';
    this.resize();
  }
  load(data: Track, paint: string, night = false) {
    night = night && ['coast','miami'].includes(data.id);
    if (this.circuit?.data === data && this.cars.length && this.night === night) {
      this.repaint(paint);
      this.cameraReady = false;
      return;
    }
    this.collision.dispose();
    this.night = night;
    if (this.outdoorEnvironment && this.outdoorEnvironment !== skyHDR)
      this.outdoorEnvironment.dispose();
    this.studioEnvironment?.dispose();
    this.collision = new CollisionWorld();
    this.scene.remove(this.root);
    const geometries = new Set<T.BufferGeometry>();
    const materials = new Set<T.Material>();
    const textures = new Set<T.Texture>();
    this.root.traverse((o) => {
      if (o instanceof T.Mesh) {
        if(o.parent && this.cars.some(c=>{let parent:T.Object3D|null=o;while(parent){if(parent===c)return true;parent=parent.parent;}return false;})) return;
        geometries.add(o.geometry);
        for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
          materials.add(material);
          for (const value of Object.values(material)) {
            if (value instanceof T.Texture && value !== skyHDR) textures.add(value);
          }
        }
      }
    });
    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
    geometries.forEach((geometry) => geometry.dispose());
    this.root = new T.Group();
    this.scene.add(this.root);
    this.circuit = new Circuit(data);
    this.scene.background = new T.Color(data.sky);
    this.scene.fog = new T.FogExp2(night ? 0x0a1424 : data.fog, night ? 0.0015 : 0.00065);
    const hemi = new T.HemisphereLight(night ? 0x829acb : 0xc7dfee, 0x242537, night ? 0.4 : 1.25);
    this.root.add(hemi);
    this.sun = new T.DirectionalLight(
      night ? 0x94b8fa : data.id === 'coast' ? 0xffd9b2 : 0xfff0d8,
      night ? 0.45 : 3.5,
    );
    this.sun.position.set(-140, 180, 80);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -70,
      right: 70,
      top: 70,
      bottom: -70,
      near: 1,
      far: 500,
    });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.015;
    this.sun.shadow.radius = 2;
    this.root.add(this.sun, this.sun.target);
    if (this.scene.environment !== skyHDR) this.scene.environment?.dispose();
    const env = document.createElement('canvas');
    env.width = 512;
    env.height = 256;
    const ec = env.getContext('2d')!;
    const gradient = ec.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#91b7c7');
    gradient.addColorStop(0.46, '#fff5dc');
    gradient.addColorStop(0.53, '#9c9e83');
    gradient.addColorStop(1, '#485247');
    ec.fillStyle = gradient;
    ec.fillRect(0, 0, 512, 256);
    ec.fillStyle = '#fff8e1';
    ec.fillRect(320, 60, 75, 30);
    const envTexture = new T.CanvasTexture(env);
    envTexture.colorSpace = T.SRGBColorSpace;
    envTexture.mapping = T.EquirectangularReflectionMapping;
    this.scene.environment = skyHDR || envTexture;
    if (skyHDR) {
      this.scene.background = skyHDR;
      this.scene.backgroundIntensity = 0.75;
      this.scene.backgroundRotation.y = 0.7;
      this.scene.environmentRotation.y = 0.7;
      envTexture.dispose();
    }
    this.scene.environmentIntensity = 0.65;
    if (night) {
      this.scene.environment = environmentTexture();
      this.scene.background = this.scene.environment;
      this.scene.backgroundIntensity = 0.75;
      this.scene.environmentIntensity = 0.3;
    }
    this.outdoorEnvironment = this.scene.environment!;
    this.studioEnvironment = environmentTexture(true);
    this.buildRoad(data);
    this.environment = buildEnvironment(this.root, this.circuit, data, this.collision, night);
    this.miami = data.id === 'miami' ? buildMiami(this.root,this.circuit,night,this.collision) : undefined;
    this.updateStreetLights = streetLightPool(this.root, [...this.environment.streetLights,...(this.miami?.streetLights || [])], night);
    this.collision.build();
    this.cars = [
      makeHeroVehicle(paint,true,this.quality==='low'?'low':'full') || makeVehicle(paint),
      ...['#b1d969', '#4ca7b3', '#ddd6bf', '#8c829a', '#dbad52'].map((c) => makeHeroVehicle(c,true,'low') || makeVehicle(c)),
    ];
    this.cars.forEach((c) => this.root.add(c));
    this.carLights = this.cars.map((c, i) => vehicleLighting(c, i === 0));
    this.showroom = makeShowroom(this.root);
    this.inShowroom = false;
    this.cars.forEach((c, i) => this.placeCar(c, -i * 9, i % 2 ? 3 : -3, 0, 0));
    this.lastRace = false;
    this.cameraReady = false;
    this.particles = Array.from({ length: 70 }, () => ({ p: new T.Vector3(), life: 0, size: 1 }));
    this.smoke = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 1),
      new T.MeshBasicMaterial({
        color: 0xbebdae,
        transparent: true,
        opacity: 0.19,
        depthWrite: false,
      }),
      70,
    );
    this.smoke.frustumCulled = false;
    this.skids = new T.InstancedMesh(
      new T.PlaneGeometry(0.24, 1.2),
      new T.MeshBasicMaterial({
        color: 0x232622,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
      400,
    );
    this.skids.frustumCulled = false;
    const zero = new T.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < 70; i++) this.smoke.setMatrixAt(i, zero);
    for (let i = 0; i < 400; i++) this.skids.setMatrixAt(i, zero);
    this.root.add(this.smoke, this.skids);
    this.skidIndex = 0;
    this.particleIndex = 0;
  }
  ribbon(start: number, end: number, offset: number, color: number, segments = 800) {
    const vertices: number[] = [],
      indices: number[] = [],
      uvs: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const p = this.circuit.at((i / segments) * this.circuit.length);
      for (const side of [start, end]) {
        vertices.push(p.p.x + p.r.x * side, p.p.y + offset, p.p.z + p.r.z * side);
        uvs.push(side / 4, ((i / segments) * this.circuit.length) / 4);
      }
      if (i < segments) {
        const j = i * 2;
        indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    const mat = material(color);
    mat.side = T.DoubleSide;
    return mesh(g, mat, this.root);
  }
  buildRoad(data: Track) {
    const shoulder = this.ribbon(-15, 15, -0.16, data.ground);
    shoulder.material.dispose();
    shoulder.material = surface(
      ['coast','miami'].includes(data.id) ? 'sand' : data.id === 'desert' ? 'stone' : 'grass',
    );
    this.collision.addGround(shoulder);
    const road = this.ribbon(-8.5, 8.5, 0.015, 0x444846);
    road.material.dispose();
    road.material = surface('asphalt');
    this.collision.setRoad(road);
    this.ribbon(-8.52, -8.39, 0.04, 0xf0e8ce);
    this.ribbon(8.39, 8.52, 0.04, 0xf0e8ce);
    const positions: number[] = [],
      idx: number[] = [],
      groundUV: number[] = [];
    const points = this.circuit.samples.map((s) => s.p);
    const minX = Math.min(...points.map((p) => p.x)) - 180,
      maxX = Math.max(...points.map((p) => p.x)) + 180;
    const minZ = Math.min(...points.map((p) => p.z)) - 180,
      maxZ = Math.max(...points.map((p) => p.z)) + 180;
    const resolution = 160;
    for (let z = 0; z <= resolution; z++)
      for (let x = 0; x <= resolution; x++) {
        const px = minX + ((maxX - minX) * x) / resolution,
          pz = minZ + ((maxZ - minZ) * z) / resolution;
        positions.push(px, this.circuit.terrainAt(px, pz).height, pz);
        groundUV.push(px / 7, pz / 7);
        if (x < resolution && z < resolution) {
          const a = z * (resolution + 1) + x;
          idx.push(a, a + resolution + 1, a + 1, a + 1, a + resolution + 1, a + resolution + 2);
        }
      }
    const ground = new T.BufferGeometry();
    ground.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    ground.setAttribute('uv', new T.Float32BufferAttribute(groundUV, 2));
    ground.setIndex(idx);
    ground.computeVertexNormals();
    const groundmat = surface(
      ['coast','miami'].includes(data.id) ? 'sand' : data.id === 'desert' ? 'stone' : 'grass',
    );
    groundmat.side = T.DoubleSide;
    this.collision.addGround(mesh(ground, groundmat, this.root));
    mesh(new T.PlaneGeometry(6000, 6000), groundmat, this.root, 0, -12, 0).rotation.x =
      -Math.PI / 2;
    const dashes = new T.InstancedMesh(
      new T.BoxGeometry(0.16, 0.02, 3.5),
      material(0xe5d4a3),
      Math.floor(this.circuit.length / 12),
    );
    const dummy = new T.Object3D();
    for (let i = 0; i < dashes.count; i++) {
      const a = this.circuit.at(i * 12);
      dummy.position.copy(a.p).add(new T.Vector3(0, 0.04, 0));
      roadOrientation(a.t, dummy.quaternion);
      dummy.updateMatrix();
      dashes.setMatrixAt(i, dummy.matrix);
    }
    dashes.receiveShadow = true;
    this.root.add(dashes);
    const count = Math.floor(this.circuit.length / 4);
    const curb = new T.InstancedMesh(
      new T.BoxGeometry(0.75, 0.12, 3.8),
      material(0xf1ede1),
      count * 2,
    );
    for (let i = 0; i < count; i++)
      for (let s = 0; s < 2; s++) {
        const a = this.circuit.at(i * 4);
        dummy.position.copy(a.p).addScaledVector(a.r, s ? 8.9 : -8.9);
        roadOrientation(a.t, dummy.quaternion);
        dummy.updateMatrix();
        curb.setMatrixAt(i * 2 + s, dummy.matrix);
        curb.setColorAt(i * 2 + s, new T.Color(i % 2 ? 0xf2f2f2 : 0xcf142b));
      }
    curb.receiveShadow = true;
    this.root.add(curb);
    // Closed-course barriers and sponsor markers.
    const posts = new T.InstancedMesh(
      new T.BoxGeometry(0.16, 0.8, 0.16),
      material(0x777f74),
      count * 2,
    );
    const rails = new T.InstancedMesh(
      new T.BoxGeometry(0.24, 0.55, 1),
      material(0xc3c5b4),
      count * 2,
    );
    for (let i = 0; i < count * 2; i++) {
      const distance = (Math.floor(i / 2) * this.circuit.length) / count;
      const a = this.circuit.at(distance);
      const b = this.circuit.at(distance + this.circuit.length / count);
      const side = i % 2 ? 1 : -1;
      dummy.position.copy(a.p).addScaledVector(a.r, side * 11);
      dummy.position.y += 0.45;
      dummy.rotation.set(0, Math.atan2(a.t.x, a.t.z), 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      posts.setMatrixAt(i, dummy.matrix);
      const start = a.p.clone().addScaledVector(a.r, side * 11);
      const end = b.p.clone().addScaledVector(b.r, side * 11);
      const direction = end.clone().sub(start);
      dummy.position.copy(start).add(end).multiplyScalar(0.5);
      dummy.position.y += 0.73;
      roadOrientation(direction.clone().normalize(), dummy.quaternion);
      dummy.scale.z = direction.length() + 0.08;
      dummy.updateMatrix();
      rails.setMatrixAt(i, dummy.matrix);
    }
    this.root.add(posts, rails);
    this.collision.add(rails);
    for (let i = 0; i < 10; i++) {
      const a = this.circuit.at((i * this.circuit.length) / 10 + 50);
      const g = new T.Group();
      g.position.copy(a.p).addScaledVector(a.r, -12);
      g.rotation.y = Math.atan2(a.t.x, a.t.z) + Math.PI / 2;
      const b = mesh(
        new T.PlaneGeometry(8, 2),
        new T.MeshStandardMaterial({
          map: textTexture(
            i % 2 ? 'THREE-WHEEL TOUR' : 'SLINGMODS',
            'BUILT FOR THE RIDE',
            i % 2 ? '#14171d' : '#d20d27',
            '#f4f5f7',
          ),
          side: T.DoubleSide,
        }),
        g,
        0,
        2,
        0,
      );
      b.castShadow = false;
      box(g, material(0x353d35), 0.12, 2.8, 0.12, -3, 1.3, 0);
      box(g, material(0x353d35), 0.12, 2.8, 0.12, 3, 1.3, 0);
      this.root.add(g);
    }
    const a = this.circuit.at(0);
    const arch = new T.Group();
    arch.position.copy(a.p);
    arch.rotation.y = Math.atan2(a.t.x, a.t.z);
    const orange = material(0xd20d27),
      dark = material(0x252f2b);
    box(arch, dark, 0.8, 11, 0.8, -10, 5.4, 0);
    box(arch, dark, 0.8, 11, 0.8, 10, 5.4, 0);
    box(arch, orange, 21, 1.6, 0.65, 0, 10.8, 0);
    for (const side of [-1, 1]) {
      const sign = mesh(
        new T.PlaneGeometry(18, 1.3),
        new T.MeshBasicMaterial({
          map: textTexture('SLINGMODS', 'THREE-WHEEL TOUR', '#d20d27', '#fff5de'),
        }),
        arch,
        0,
        10.8,
        side * 0.34,
      );
      if (side < 0) sign.rotation.y = Math.PI;
    }
    for (let x = 0; x < 18; x++)
      for (let z = 0; z < 3; z++)
        box(arch, material((x + z) % 2 ? 0x222925 : 0xe7e4d8), 1, 0.025, 1, x - 8.5, 0.06, z - 1);
    this.root.add(arch);
  }
  placeCar(car: T.Group, distance: number, lane: number, yaw: number, wheelSpin: number) {
    const a = this.circuit.at(distance);
    const slipAngle = clamp(yaw, -0.55, 0.55);
    car.position.copy(a.p).addScaledVector(a.r, lane);
    roadOrientation(a.t, car.quaternion);
    car.rotateY(slipAngle);
    const contact = this.collision.roadHeight(car.position.x, car.position.z, car.position.y);
    if (contact !== undefined) car.position.y = contact + 0.005;
    car.rotateZ(-slipAngle * 0.06);
    (car.userData.steering as T.Group).rotation.z = -slipAngle * 3;
    const wheels = car.userData.wheels as T.Group[];
    wheels.forEach((w, i) => {
      w.rotation.x = wheelSpin;
      const pivot = (car.userData.pivots as T.Group[])[i];
      if (i < 2) pivot.rotation.y = slipAngle * 1.4;
    });
  }
  placeSimCar(car:T.Group, p:Driver) {
    if(!p.pose){this.placeCar(car,p.distance,p.lane,0,0);return;}
    const previous=p.previousPose || p.pose,alpha=this.interpolationAlpha;
    const pose={...p.pose,x:previous.x+(p.pose.x-previous.x)*alpha,y:previous.y+(p.pose.y-previous.y)*alpha,z:previous.z+(p.pose.z-previous.z)*alpha,
      yaw:previous.yaw+Math.atan2(Math.sin(p.pose.yaw-previous.yaw),Math.cos(p.pose.yaw-previous.yaw))*alpha},t=p.telemetry;
    car.position.set(pose.x,pose.y+.02,pose.z);
    const slope=this.circuit.at(p.distance).t.y;
    car.rotation.set(0,pose.yaw,0);
    car.rotateX(-Math.asin(clamp(slope,-.18,.18)));
    car.rotateZ(clamp(-p.speed*pose.yawRate*.0018,-.035,.035));
    car.userData.steering.rotation.z=-t.steeringAngle*8;
    if(car.userData.rpmNeedle)car.userData.rpmNeedle.rotation.z=-clamp(t.rpm/8500,0,1)*Math.PI*1.5;
    if(car.userData.speedNeedle)car.userData.speedNeedle.rotation.z=-clamp(Math.abs(p.speed)*2.237/160,0,1)*Math.PI*1.5;
    (car.userData.wheels as T.Object3D[]).forEach((wheel,i)=>{
      wheel.rotation.x=t.wheelAngles[i];
      if(i<2)car.userData.pivots[i].rotation.y=t.steeringAngle;
    });
  }
  setStudioMood(mood:string){
    this.studioMood=mood;
    this.showroom?.traverse(o=>{if(o instanceof T.DirectionalLight){o.intensity=mood==='night'?.7:o.position.x>0?2.4:3.8;o.color.set(mood==='warm'?0xffd4ac:o.position.x>0?0xc9dfff:0xffe9db);}});
  }
  customize(rims:string,exhaust:string) {
    const c=this.cars[0];if(!c)return;
    const finish=c.userData.wheelFinish as T.MeshStandardMaterial|undefined;
    finish?.color.set(rims==='silver'?'#c1c9ce':rims==='bronze'?'#947446':'#262b31');
    for(const tip of c.userData.exhaustTips || []) {
      tip.material.color.set(exhaust==='sport'?'#898e96':'#33373b');
    }
  }
  update(
    dt: number,
    player: Driver,
    ai: Driver[],
    mode: 'menu' | 'garage' | 'race' | 'finish',
    motion = true,
  ) {
    const start = performance.now();
    this.elapsed += dt;
    this.environment?.update(this.elapsed, motion);
    this.miami?.update(this.elapsed,motion);
    this.cpu.environment = performance.now() - start;
    const race = mode === 'race' || mode === 'finish';
    const garage = mode === 'garage';
    if (garage !== this.inShowroom) {
      this.inShowroom = garage;
      for (const child of this.root.children)
        if (child !== this.cars[0] && child !== this.showroom) child.visible = !garage;
      this.showroom.visible = garage;
      this.scene.environment = garage ? this.studioEnvironment! : this.outdoorEnvironment!;
      this.scene.background = garage
        ? new T.Color(0x080d16)
        : this.night
          ? this.outdoorEnvironment!
          : skyHDR || new T.Color(this.circuit.data.sky);
      this.scene.environmentIntensity = garage ? 0.7 : this.night ? 0.3 : 0.65;
      this.scene.fog = garage
        ? new T.FogExp2(0x080d16, 0.035)
        : new T.FogExp2(
            this.night ? 0x0a1424 : this.circuit.data.fog,
            this.night ? 0.0015 : 0.00065,
          );
      this.cameraReady = false;
    }
    this.cars.slice(1).forEach((c, i) => {
      c.visible = race;
      if (race) this.placeSimCar(c,ai[i]);
    });
    const a = garage
      ? { p: new T.Vector3(), t: new T.Vector3(0, 0, 1), r: new T.Vector3(1, 0, 0), curve: 0 }
      : this.circuit.at(race ? player.distance : 95);
    this.placeCar(
      this.cars[0],
      race ? player.distance : 95,
      race ? player.lane : 0,
      race ? player.velocity * 0.045 : 0,
      player.distance / 0.329,
    );
    if (race) this.placeSimCar(this.cars[0],player);
    if (garage) {
      this.cars[0].position.set(0, 0.006, 0);
      this.cars[0].quaternion.identity();
    }
    this.carLights.forEach((l, i) => {
      const c = new T.Color(RGB_COLORS[i ? i % 6 : this.rgb].color);
      if (!i && this.rgbCycle && motion) c.setHSL((this.elapsed * 0.035) % 1, 0.95, 0.55);
      l.update(c, true, this.night || garage);
    });
    this.updateStreetLights?.(dt, this.cars[0].position, !garage);
    this.cars[0].userData.flame.visible = race && player.boosting;
    this.cars[0].userData.rider.visible = race;
    this.cars[0].userData.tail.emissiveIntensity = race && player.telemetry.brake > 0 ? 3 : 1.3;
    const target = new T.Vector3(),
      desired = new T.Vector3();
    if (race) {
      const forward=new T.Vector3(Math.sin(player.pose!.yaw),0,Math.cos(player.pose!.yaw));
      target.copy(this.cars[0].position).addScaledVector(forward,8);target.y+=1.1;
      desired.copy(this.cars[0].position).addScaledVector(forward,-8.6-Math.abs(player.speed)*.02);
      desired.y+=3.3+Math.abs(player.speed)*.008;
      if(this.cockpit){desired.copy(this.cars[0].position).add(new T.Vector3(.365,1.12,-.57).applyQuaternion(this.cars[0].quaternion));target.copy(desired).addScaledVector(forward,30);}
      const fov = 54 + (motion ? player.speed * 0.09 + (player.boosting ? 5 : 0) : 0);
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4);
    } else {
      this.orbitAngle +=
        ((mode === 'garage' ? this.vehicleView : 0) - this.orbitAngle) * (1 - Math.exp(-dt * 5));
      const orbit = (motion ? Math.sin(this.elapsed * 0.13) * 0.06 : 0) + this.orbitAngle;
      desired
        .copy(a.p)
        .addScaledVector(a.r, 8.2 * Math.sin(0.65 + orbit))
        .addScaledVector(a.t, 8.2 * Math.cos(0.65 + orbit));
      desired.y += mode === 'garage' ? 2.3 : 2.2;
      target.copy(a.p);
      target.y += 0.65;
      const viewRight = new T.Vector3().crossVectors(target.clone().sub(desired).normalize(), UP);
      target.addScaledVector(viewRight, mode === 'garage' ? 1.05 : -1.4);
      this.camera.fov = 43;
    }
    if (race && !this.cockpit && this.camera.aspect < 0.8) {
      const next = this.circuit.at(player.distance + 12);
      target.copy(next.p).addScaledVector(a.r, player.lane * 0.9);
      target.y += 1;
      desired.copy(this.cars[0].position).addScaledVector(a.t, -9.5 - player.speed * 0.018);
      desired.y += 5.8;
      this.camera.fov = 58;
    }
    if (!race && this.camera.aspect < 0.8) {
      const garage = mode === 'garage';
      desired
        .copy(a.p)
        .addScaledVector(a.r, (garage ? 10 : 12) * Math.sin(0.65 + this.orbitAngle))
        .addScaledVector(a.t, (garage ? 10 : 12) * Math.cos(0.65 + this.orbitAngle));
      desired.y += garage ? 3.6 : 4.5;
      target.copy(a.p);
      target.y += garage ? 1.0 : 2.7;
      const right = new T.Vector3().crossVectors(target.clone().sub(desired).normalize(), UP);
      target.addScaledVector(right, garage ? 0 : -0.25);
      this.camera.fov = 48;
    }
    if (!race || this.cockpit || !this.cameraReady || this.lastRace !== race) {
      this.camera.position.copy(desired);
      this.cameraReady = true;
    } else {
      // Follow translation immediately; smooth the orbit offset, so speed does not
      // leave the camera several extra metres behind the player's vehicle.
      this.camera.position.add(this.cars[0].position.clone().sub(this.lastCarPosition));
      this.camera.position.lerp(desired, 1 - Math.exp(-dt * 8));
    }
    this.lastCarPosition.copy(this.cars[0].position);
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
    this.lastRace = race;
    this.effectClock += dt;
    if (
      race &&
      this.effectClock > 0.045 &&
      player.speed > 12 &&
      (player.drift > 0.1 || Math.abs(player.lane) > 8.2)
    ) {
      this.effectClock = 0;
      const particle = this.particles[this.particleIndex++ % this.particles.length];
      particle.p.copy(this.cars[0].position).addScaledVector(a.t, -2);
      particle.p.y += 0.45;
      particle.life = 1.3;
      particle.size = 0.2 + Math.random() * 0.25;
      if (player.drift > 0.1) {
        for (const side of [-1, 1]) {
          const d = new T.Object3D();
          d.position.copy(this.cars[0].position).addScaledVector(a.r, side * 0.88);
          d.position.y += 0.07;
          d.rotation.set(-Math.PI / 2, 0, -Math.atan2(a.t.x, a.t.z));
          d.updateMatrix();
          this.skids.setMatrixAt(this.skidIndex++ % 400, d.matrix);
        }
        this.skids.instanceMatrix.needsUpdate = true;
      }
    }
    const puff = new T.Object3D();
    this.particles.forEach((p, i) => {
      p.life = Math.max(0, p.life - dt);
      p.p.y += dt * 0.7;
      puff.position.copy(p.p);
      const scale = p.life > 0 ? p.size + (1.3 - p.life) * 0.9 : 0;
      puff.scale.setScalar(scale);
      puff.updateMatrix();
      this.smoke.setMatrixAt(i, puff.matrix);
    });
    this.smoke.instanceMatrix.needsUpdate = true;
    this.sun.position
      .copy(a.p)
      .add(new T.Vector3(-130, this.circuit.data.id === 'coast' ? 62 : 140, 85));
    this.sun.target.position.copy(a.p);
    const renderStart = performance.now();
    this.renderer.render(this.scene, this.camera);
    if(this.photoPending){
      this.photoPending=false;
      const photo=document.createElement('canvas');photo.width=this.canvas.width;photo.height=this.canvas.height;
      const ctx=photo.getContext('2d')!;ctx.drawImage(this.canvas,0,0);
      const band=Math.max(70,photo.height*.09);ctx.fillStyle='#10151eee';ctx.fillRect(0,photo.height-band,photo.width,band);
      if(brandImage)ctx.drawImage(brandImage,band*.3,photo.height-band*.78,band*2.2,band*.53);
      ctx.fillStyle='#fff';ctx.font=`600 ${band*.24}px Barlow, sans-serif`;ctx.textAlign='right';ctx.fillText('MY BUILD / THREE-WHEEL TOUR',photo.width-band*.3,photo.height-band*.42);
      photo.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='SlingMods-My-Build.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);});
    }
    this.cpu.render = performance.now() - renderStart;
    this.cpu.frame = performance.now() - start;
  }
  repaint(color: string) {
    (this.cars[0].userData.paint as T.MeshStandardMaterial).color.set(color);
  }
}
