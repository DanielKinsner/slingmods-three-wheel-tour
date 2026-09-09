import * as T from 'three/webgpu';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Driver } from './core';
import type { TrackPoint } from './world';

/** Actual triangle mesh queries, with a three-sphere vehicle contact envelope.
 * The fixed-step arcade drivetrain remains independent of rendering. */
export class CollisionWorld {
  solids: T.BufferGeometry[] = [];
  bvh?: MeshBVH;
  road?: MeshBVH;
  ground: MeshBVH[] = [];
  geometry?: T.BufferGeometry;
  contacts = 0;
  add(object: T.Mesh) {
    object.updateWorldMatrix(true, false);
    const add = (matrix: T.Matrix4) => {
      const g = object.geometry.clone();
      for (const name of Object.keys(g.attributes))
        if (name !== 'position') g.deleteAttribute(name);
      const out = g.index ? g.toNonIndexed() : g;
      out.applyMatrix4(matrix);
      this.solids.push(out);
      if (out !== g) g.dispose();
    };
    if (object instanceof T.InstancedMesh) {
      const instance = new T.Matrix4();
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, instance);
        add(object.matrixWorld.clone().multiply(instance));
      }
    } else add(object.matrixWorld);
  }
  setRoad(mesh: T.Mesh) {
    this.road = new MeshBVH(mesh.geometry);
  }
  addGround(mesh:T.Mesh){this.ground.push(new MeshBVH(mesh.geometry));}
  groundHeight(x:number,z:number,y:number){
    const road=this.roadHeight(x,z,y);if(road!==undefined)return road;
    const ray=new T.Ray(new T.Vector3(x,y+3,z),new T.Vector3(0,-1,0));
    let height:number|undefined;
    for(const mesh of this.ground){const hit=mesh.raycastFirst(ray,T.DoubleSide,0,8);if(hit&&(height===undefined||hit.point.y>height))height=hit.point.y;}
    return height;
  }
  build() {
    if (!this.solids.length) return;
    this.geometry = mergeGeometries(this.solids)!;
    this.bvh = new MeshBVH(this.geometry);
    this.solids.forEach((g) => g.dispose());
    this.solids = [];
  }
  roadHeight(x: number, z: number, y: number) {
    const hit = this.road?.raycastFirst(
      new T.Ray(new T.Vector3(x, y + 3, z), new T.Vector3(0, -1, 0)),
      T.DoubleSide,
      0,
      8,
    );
    return hit?.point.y;
  }
  resolve(p: Driver, a: TrackPoint) {
    if (!this.bvh) return false;
    let touched = false;
    const closest = new T.Vector3(),
      center = new T.Vector3(),
      normal = new T.Vector3();
    for (const [forward, radius] of [
      [1.12, 0.96],
      [-0.3, 0.77],
      [-1.45, 0.35],
    ]) {
      center.copy(a.p).addScaledVector(a.r, p.lane).addScaledVector(a.t, forward);
      center.y += 0.44;
      const sphere = new T.Sphere(center, radius);
      this.bvh.shapecast({
        intersectsBounds: (box) => box.intersectsSphere(sphere),
        intersectsTriangle: (triangle) => {
          triangle.closestPointToPoint(center, closest);
          normal.copy(center).sub(closest);
          // Ignore contacts with top/bottom faces. Suspension follows the road mesh separately.
          const lateral = normal.dot(a.r),
            separation = normal.length();
          if (separation < radius && Math.abs(lateral) > separation * 0.55) {
            const correction = Math.sign(lateral) * (radius - separation + 0.003);
            p.lane += correction;
            center.addScaledVector(a.r, correction);
            if (p.velocity * lateral < 0) p.velocity *= -0.22;
            touched = true;
          }
          return false;
        },
      });
    }
    if (touched && p.hit <= 0) {
      p.speed *= 0.72;
      p.hit = 0.48;
      this.contacts++;
      return true;
    }
    return false;
  }
  resolveWorld(p:Driver){
    if(!this.bvh||!p.pose)return false;
    const pose=p.pose,normal=new T.Vector3(),closest=new T.Vector3();let touched=false;
    for(const [forward,radius] of [[1.12,.92],[-.3,.70],[-1.45,.34]]){
      const center=new T.Vector3(pose.x+Math.sin(pose.yaw)*forward,pose.y+.5,pose.z+Math.cos(pose.yaw)*forward);
      const sphere=new T.Sphere(center,radius);
      this.bvh.shapecast({intersectsBounds:b=>b.intersectsSphere(sphere),intersectsTriangle:triangle=>{
        triangle.closestPointToPoint(center,closest);normal.copy(center).sub(closest);
        const length=normal.length();if(length>=radius||length<.00001||Math.abs(normal.y)>length*.65)return false;
        normal.y=0;normal.normalize();const depth=radius-length+.004;
        pose.x+=normal.x*depth;pose.z+=normal.z*depth;center.addScaledVector(normal,depth);
        const incoming=(Math.sin(pose.yaw)*normal.x+Math.cos(pose.yaw)*normal.z)*p.speed;
        if(incoming<0&&p.hit<=0){p.speed*=.58;p.velocity*=.35;p.hit=.35;this.contacts++;touched=true;}
        return false;
      }});
    }return touched;
  }
  dispose() {
    this.geometry?.dispose();
    this.solids.forEach((g) => g.dispose());
    this.solids = [];
    this.bvh = undefined;
    this.road = undefined;
    this.ground = [];
  }
}
