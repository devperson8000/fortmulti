import {PICKUP_WEAPON_BOUNDS} from './pickup-bounds.js';
import {rayCollider} from './collision-shapes.js';
import {gridBounds,rayRamp} from './build-grid.js';
export const PICKUP_RANGE=3.2,PICKUP_HISTORY_SECONDS=2;
const phase=id=>{let h=2166136261;for(const c of String(id))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h/4294967296*Math.PI*2;};
export function groundWeaponPose(item,time){const offset=phase(item.id);return {rotation:offset+time*Math.PI*2/30,height:(item.y||0)+.18+Math.sin(time*Math.PI/2+offset)*.05};}
export function pickupPose(item,time){return PICKUP_WEAPON_BOUNDS[item.type]?groundWeaponPose(item,time):{rotation:time*.25,height:(item.y||0)+.45+Math.sin(time*2+item.x)*.08};}
export function pickupBounds(item){return PICKUP_WEAPON_BOUNDS[item.type]||{min:[-.18,-.22,-.18],max:[.18,.22,.18]};}
export function pickupLocalPoint(item,point,time){const pose=pickupPose(item,time),x=point[0]-item.x,z=point[2]-item.z,c=Math.cos(pose.rotation),s=Math.sin(pose.rotation);return [x*c-z*s,point[1]-pose.height,x*s+z*c];}
export function pickupPointInside(item,point,time,tolerance=.12){const local=pickupLocalPoint(item,point,time),bounds=pickupBounds(item);return local.every((v,k)=>v>=bounds.min[k]-tolerance&&v<=bounds.max[k]+tolerance);}
export function pickupLineOfSight(origin,point,world={},structures=[]){
 const delta=point.map((v,k)=>v-origin[k]),distance=Math.hypot(...delta);if(distance<.001)return false;const direction=delta.map(v=>v/distance);
 for(const b of world.obstacles||[])if(b.blocksShots!==false&&rayCollider(origin,direction,b)<distance-.035)return false;
 for(const s of structures)if((s.type===2?rayCollider(origin,direction,gridBounds(s)):rayRamp(origin,direction,s))<distance-.035)return false;
 const terrain=world.terrainHeight||world.height;if(terrain)for(let t=.2;t<distance-.05;t+=.2)if(origin[1]+direction[1]*t<terrain(origin[0]+direction[0]*t,origin[2]+direction[2]*t)-.025)return false;
 return true;
}
export function sanitizePickupRequest(request){const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)&&v.every(n=>Math.abs(n)<20000);if(!request||!Number.isSafeInteger(request.round)||request.round<1||!Number.isFinite(request.time)||request.time<0||!Number.isSafeInteger(request.revision)||request.revision<1||typeof request.id!=='string'||!request.id||request.id.length>120||!vector(request.origin)||!vector(request.point))return null;return {round:request.round,time:request.time,revision:request.revision,id:request.id,origin:request.origin.slice(),point:request.point.slice()};}
const pickupEye=player=>[player.p[0],player.p[1]+1.72-(player.crouching?.62:0),player.p[2]];
// Rendering trails snapshots. Keep only two seconds of real poses, never client positions.
export function recordPickupEye(player,time){
 const history=player.pickupEyeHistory??=([]),entry={time:Math.max(0,time),origin:pickupEye(player)};
 if(history.at(-1)?.time===entry.time)history[history.length-1]=entry;else history.push(entry);
 while(history.length>80||history[0]?.time<entry.time-PICKUP_HISTORY_SECONDS)history.shift();
}
export function validatePickupRequest(player,item,request,time,world,structures){
 if(!request||request.id!==item.id||request.time<time-PICKUP_HISTORY_SECONDS||request.time>time+.25||!pickupPointInside(item,request.point,request.time))return false;
 const expected=pickupEye(player),gap=origin=>Math.hypot(...request.origin.map((v,k)=>v-origin[k])),current=gap(expected)<=.7;
 const historical=!current&&(player.pickupEyeHistory||[]).some(entry=>entry.time>=time-PICKUP_HISTORY_SECONDS&&gap(entry.origin)<=.7);
 if(!(current||historical)||Math.hypot(item.x-player.p[0],item.z-player.p[2])>PICKUP_RANGE||Math.abs((item.y||0)-player.p[1])>2.1||Math.hypot(item.x-request.origin[0],item.z-request.origin[2])>PICKUP_RANGE)return false;
 // Compensation never reaches through cover the player has moved behind.
 return pickupLineOfSight(request.origin,request.point,world,structures)&&(current||pickupLineOfSight(expected,request.point,world,structures));
}

export function rayPickup(item,origin,direction,time){const local=pickupLocalPoint(item,origin,time),pose=pickupPose(item,time),c=Math.cos(pose.rotation),s=Math.sin(pose.rotation),d=[direction[0]*c-direction[2]*s,direction[1],direction[0]*s+direction[2]*c],distance=rayCollider(local,d,pickupBounds(item));return Number.isFinite(distance)?{distance,point:origin.map((v,k)=>v+direction[k]*distance)}:null;}
