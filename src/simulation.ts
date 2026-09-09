import { Vector3 } from 'three/webgpu';
import { clamp, type Driver, type Input, type Save } from './core';
import { POWERTRAIN, stepPowertrain } from './drivetrain';
import type { Circuit } from './world';
import type { CollisionWorld } from './collision';
import { DIFFICULTIES, type Difficulty } from './difficulty';
export const SIM_STEP=1/60;
export const angleDifference=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const positionOf=(p:Driver)=>new Vector3(p.pose!.x,p.pose!.y,p.pose!.z);
export function spawnVehicle(p:Driver,circuit:Circuit,distance=0,lane=0){
 const a=circuit.at(distance),v=a.p.clone().addScaledVector(a.r,lane);
 p.distance=distance;p.lane=lane;p.speed=0;p.velocity=0;
 p.pose={x:v.x,y:v.y,z:v.z,yaw:Math.atan2(a.t.x,a.t.z),yawRate:0};
 p.previousPose={...p.pose};
 p.telemetry.steeringAngle=0;
}
export function steeringLimit(speed:number){return .49/(1+Math.abs(speed)*.055);}
export function steeringForTarget(p:Driver,target:Vector3){
 const pose=p.pose!;const dx=target.x-pose.x,dz=target.z-pose.z;
 const error=angleDifference(Math.atan2(dx,dz),pose.yaw);
 const desired=Math.atan2(2*POWERTRAIN.wheelbase*Math.sin(error),Math.max(4,Math.hypot(dx,dz)));
 return clamp(desired/steeringLimit(p.speed),-1,1);
}
/** Planar three-contact simcade: independent X/Z/yaw; the spline is queried, never followed forcibly.
 * No full rigid-body rollover/jump claim. Suspension contacts query real road triangles. */
export function simulateVehicle(p:Driver,input:Input,circuit:Circuit,upgrades:Save['upgrades'],dt:number,mode:Difficulty,automatic=true,collision?:CollisionWorld){
 if(!p.pose)spawnVehicle(p,circuit,p.distance,p.lane);
 p.previousPose={...p.pose!};
 const pose=p.pose!,t=p.telemetry;
 const road=circuit.at(p.distance);
 let steer=input.steer;
 if(mode==='easy'&&Math.abs(steer)<.02&&p.speed>=0){
   steer=steeringForTarget(p,circuit.at(p.distance+Math.max(12,p.speed*.65)).p);
 }
 t.steeringAngle+=(steer*steeringLimit(p.speed)-t.steeringAngle)*(1-Math.exp(-dt*9));
 t.surface=Math.abs(p.lane)<=8.4?'road':'shoulder';
 const mu=(t.surface==='road'?1.08:.58)*(1+upgrades.grip*.07);
 const accelerating=t.acceleration;
 const rearLoad=POWERTRAIN.mass*9.81*.43+POWERTRAIN.mass*accelerating*.34/POWERTRAIN.wheelbase;
 const transfer=POWERTRAIN.mass*p.speed*pose.yawRate*.34/POWERTRAIN.frontTrack;
 t.normalLoads=[clamp((POWERTRAIN.mass*9.81-rearLoad)/2-transfer,350,6500),clamp((POWERTRAIN.mass*9.81-rearLoad)/2+transfer,350,6500),clamp(rearLoad,1000,6500)];
 const onRoad=t.surface==='road';
 p.boosting=input.boost&&p.boost>1&&p.speed>10&&onRoad;
 const gripDemand=Math.abs(p.speed*pose.yawRate)/(9.81*mu);
 const bend=Math.max(...[15,35,60].map(d=>Math.abs(circuit.at(p.distance+d).curve)));
 const assistBrake=mode==='easy'&&p.speed>Math.sqrt(7/Math.max(.002,bend))*1.04;
 p.speed=stepPowertrain(t,p.speed,input.throttle&&!assistBrake,input.brake||assistBrake,dt,upgrades.power,automatic,p.boosting,mu*Math.sqrt(Math.max(.1,1-Math.min(.95,gripDemand)**2)));
 if(!onRoad)p.speed*=Math.exp(-dt*.5);
 const desiredYaw=p.speed/POWERTRAIN.wheelbase*Math.tan(t.steeringAngle);
 const maxYaw=mu*9.81/Math.max(3,Math.abs(p.speed));
 // Combined braking/cornering limit, with a recoverable rear-slip response.
 const brakeGrip=input.brake?.76:1;
 const drift=input.drift&&Math.abs(p.speed)>12&&Math.abs(steer)>.2;
 const targetYaw=clamp(desiredYaw,-maxYaw*brakeGrip,maxYaw*brakeGrip)*(drift?1.12:1);
 pose.yawRate+=(targetYaw-pose.yawRate)*(1-Math.exp(-dt*(drift?4:9)));
 const lateralTarget=drift?steer*Math.min(4,Math.abs(p.speed)*.075):t.slipRatio*steer*.7;
 p.velocity+=(lateralTarget-p.velocity)*(1-Math.exp(-dt*(drift?3:7)));
 pose.yaw+=pose.yawRate*dt;
 const steps=Math.max(1,Math.ceil(Math.abs(p.speed)*dt/.45));
 for(let i=0;i<steps;i++){
   pose.x+=(Math.sin(pose.yaw)*p.speed+Math.cos(pose.yaw)*p.velocity)*dt/steps;
   pose.z+=(Math.cos(pose.yaw)*p.speed-Math.sin(pose.yaw)*p.velocity)*dt/steps;
   collision?.resolveWorld(p);
 }
 const projected=circuit.project(new Vector3(pose.x,pose.y,pose.z),p.distance);
 p.distance=projected.distance;p.lane=projected.lane;
 const samples=[[-.8775,1.197],[.8775,1.197],[0,-1.47]];
 const heights=samples.map(([x,z],i)=>{
   const wx=pose.x+Math.cos(pose.yaw)*x+Math.sin(pose.yaw)*z,wz=pose.z-Math.sin(pose.yaw)*x+Math.cos(pose.yaw)*z;
   const h=collision?.groundHeight(wx,wz,pose.y);
   t.grounded[i]=h!==undefined||!collision;
   const ground=h??(collision?circuit.terrainAt(wx,wz).height:projected.point.p.y);
   const travel=clamp(ground-pose.y,-.09,.09);
   t.suspension[i]+=(travel-t.suspension[i])*(1-Math.exp(-dt*14));return ground;
 });
 pose.y+=(heights.reduce((a,b)=>a+b,0)/3-pose.y)*(1-Math.exp(-dt*20));
 p.hit=Math.max(0,p.hit-dt);
 p.drift=drift&&onRoad?p.drift+dt:0;
 if(p.drift>0)p.style+=dt*35;
 const rules=DIFFICULTIES[mode];
 p.boost=clamp(p.boost+dt*(p.boosting?-rules.boostDrain:rules.boostRegen*(4+upgrades.boost)),0,100+upgrades.boost*24);
 return road;
}
export function aiInput(p:Driver,circuit:Circuit,others:Driver[],skill:number,mode:Difficulty,ordinal:number):Input{
 const look=Math.max(12,Math.abs(p.speed)*.75);
 let lane=(ordinal%2? -1.7:1.7);
 const ahead=others.find(o=>o!==p&&o.distance-p.distance>0&&o.distance-p.distance<24&&Math.abs(o.lane-p.lane)<2);
 if(ahead)lane=ahead.lane>0?-3.5:3.5;
 const target=circuit.at(p.distance+look);target.p.addScaledVector(target.r,lane);
 const curve=Math.max(...[12,28,48,70].map(d=>Math.abs(circuit.at(p.distance+d).curve)));
 const cornerSpeed=Math.sqrt((mode==='hard'?8.9:7.4)/Math.max(.002,curve));
 const desired=Math.min(mode==='hard'?53:44,cornerSpeed)*( .89+skill*.11);
 return {steer:steeringForTarget(p,target.p),throttle:p.speed<desired,brake:p.speed>desired+1.4,drift:false,boost:mode==='hard'&&curve<.0025&&p.speed>35&&p.boost>55};
}
export class FixedClock{
 accumulated=0; steps=0; pausedForStall=false;
 advance(dt:number,step:(dt:number)=>void){
  this.pausedForStall=dt>.25;
  if(this.pausedForStall){this.accumulated=0;return 0;}
  this.accumulated+=Math.max(0,dt);let count=0;
  while(this.accumulated+1e-10>=SIM_STEP&&count<15){step(SIM_STEP);this.accumulated-=SIM_STEP;count++;this.steps++;}
  return this.accumulated/SIM_STEP;
 }
 reset(){this.accumulated=0;this.pausedForStall=false;}
}
