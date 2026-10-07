import {MATERIALS,LIMITS} from './items.js';
export const GRID=Object.freeze({cell:5,level:3.6,thickness:.22,maxHeight:72});
const snap=n=>Math.round(n/GRID.cell)*GRID.cell;
const parallel=(a,b)=>Math.abs(Math.sin(a-b))<.01;
const sameForward=(a,b)=>Math.cos(a-b)>.9;
export const gridAngle=n=>Math.round(n/(Math.PI/2))*(Math.PI/2);
export function rampEndpoints(s){const dx=-Math.sin(s.angle)*2.5,dz=-Math.cos(s.angle)*2.5;return {bottom:[s.x-dx,s.y,s.z-dz],top:[s.x+dx,s.y+GRID.level,s.z+dz]};}
export function rampHeight(s,x,z){const dx=x-s.x,dz=z-s.z,lx=dx*Math.cos(s.angle)-dz*Math.sin(s.angle),lz=dx*Math.sin(s.angle)+dz*Math.cos(s.angle);return Math.abs(lx)<=2.5+1e-6&&Math.abs(lz)<=2.5+1e-6?s.y+(2.5-lz)*GRID.level/GRID.cell:null;}

function terrainSamples(s){
 const side=[Math.cos(s.angle),-Math.sin(s.angle)],normal=[Math.sin(s.angle),Math.cos(s.angle)],samples=[];
 if(s.type===2){
  for(const lateral of[-2.5,-1.25,0,1.25,2.5])for(const depth of[-GRID.thickness/2,GRID.thickness/2])samples.push({x:s.x+side[0]*lateral+normal[0]*depth,z:s.z+side[1]*lateral+normal[1]*depth,relative:0});
 }else{
  for(const lateral of[-2.45,0,2.45])for(const longitudinal of[-2.5,-1.25,0,1.25,2.5])samples.push({x:s.x+side[0]*lateral+normal[0]*longitudinal,z:s.z+side[1]*lateral+normal[1]*longitudinal,relative:(2.5-longitudinal)*GRID.level/GRID.cell});
 }
 return samples;
}
export function terrainFoundation(s,world){
 let base=-Infinity;
 for(const point of terrainSamples(s))base=Math.max(base,world.height(point.x,point.z)-point.relative);
 return Number.isFinite(base)?base:world.height(s.x,s.z);
}
function structureSnap(p,desired,structures){
 const candidates=[],angle=desired.angle,type=desired.type,dx=-Math.sin(angle),dz=-Math.cos(angle);
 for(const s of structures){
  if(s.type===3){
   const {bottom,top}=rampEndpoints(s);
   if(type===3&&sameForward(s.angle,angle)&&Math.hypot(top[0]-p.p[0],top[2]-p.p[2])<=3.75&&Math.abs(top[1]-p.p[1])<=2.2)candidates.push({x:top[0]+dx*2.5,z:top[2]+dz*2.5,y:top[1],kind:'ramp-chain'});
   if(type===2&&parallel(s.angle,angle)){candidates.push({x:bottom[0],z:bottom[2],y:bottom[1],kind:'ramp-bottom'});candidates.push({x:top[0],z:top[2],y:top[1],kind:'ramp-top'});}
  }else if(s.type===2&&type===2&&parallel(s.angle,angle))candidates.push({x:s.x,z:s.z,y:s.y+GRID.level,kind:'wall-stack'});
 }
 return candidates.map(candidate=>({...candidate,horizontal:Math.hypot(candidate.x-desired.x,candidate.z-desired.z),playerDistance:Math.hypot(candidate.x-p.p[0],candidate.z-p.p[2]),vertical:Math.abs(candidate.y-p.p[1])})).filter(candidate=>candidate.horizontal<=5.15&&candidate.playerDistance<=8.25&&candidate.vertical<=4.5).sort((a,b)=>(a.horizontal*.8+a.playerDistance*.2+a.vertical*.55)-(b.horizontal*.8+b.playerDistance*.2+b.vertical*.55))[0]||null;
}
export function gridPlacement(p,input,world,structures=[]){
 const angle=gridAngle(input.yaw+(input.rotation||0)),dx=-Math.sin(angle),dz=-Math.cos(angle),type=input.slot===10?3:2,material=input.material==='stone'?'stone':'wood';
 let x=snap(p.p[0]+dx*3),z=snap(p.p[2]+dz*3);if(type===2){x+=dx*2.5;z+=dz*2.5;}
 const foundation={x,z,y:0,angle,type},terrainY=terrainFoundation(foundation,world),desired={x,z,y:terrainY,angle,type},snapTarget=structureSnap(p,desired,structures);
 let y=terrainY;
 if(snapTarget){x=snapTarget.x;z=snapTarget.z;y=snapTarget.y;}
 else if(p.p[1]>terrainY+2)y=Math.max(terrainY,Math.round(p.p[1]/GRID.level)*GRID.level);
 return {x,z,y,angle,type,material,hp:MATERIALS[material].hp};
}
export function gridBounds(s){const rotated=Math.abs(Math.sin(s.angle))>.5;return {min:[s.x-(rotated?GRID.thickness/2:2.5),s.y,s.z-(rotated?2.5:GRID.thickness/2)],max:[s.x+(rotated?GRID.thickness/2:2.5),s.y+GRID.level,s.z+(rotated?2.5:GRID.thickness/2)]};}
const overlap=(a,b)=>a.min.every((v,i)=>v<b.max[i]&&a.max[i]>b.min[i]);
export function supported(s,structures,world){
 const foundation=terrainFoundation(s,world);if(Math.abs(s.y-foundation)<=.55)return true;
 const bottom=s.type===3?rampEndpoints(s).bottom:[s.x,s.y,s.z];
 return structures.some(v=>{const top=v.type===3?rampEndpoints(v).top:[v.x,v.y+GRID.level,v.z];return Math.abs(top[1]-s.y)<1e-5&&Math.hypot(top[0]-bottom[0],top[2]-bottom[2])<=(s.type===3?.01:2.51)||Math.abs(v.y-s.y)<1e-5&&Math.hypot(v.x-s.x,v.z-s.z)<=5.01;});
}
export function gridValid(s,structures,players,world){if(![s.x,s.y,s.z,s.angle].every(Number.isFinite)||structures.length>=LIMITS.structures||s.y>GRID.maxHeight||![2,3].includes(s.type))return false;if(structures.some(v=>Math.hypot(v.x-s.x,v.z-s.z)<.01&&Math.abs(v.y-s.y)<.01&&v.type===s.type&&(s.type===3?Math.cos(v.angle-s.angle)>.99:Math.abs(Math.sin(v.angle-s.angle))<.01)))return false;const box=s.type===2?gridBounds(s):{min:[s.x-2.48,s.y+.2,s.z-2.48],max:[s.x+2.48,s.y+3.4,s.z+2.48]};if((world.obstacles||[]).some(v=>overlap(box,v)))return false;if(s.type===2&&players.some(p=>p.hp>0&&p.air==='landed'&&overlap(box,{min:[p.p[0]-.36,p.p[1]+.1,p.p[2]-.36],max:[p.p[0]+.36,p.p[1]+1.78,p.p[2]+.36]})))return false;return supported(s,structures,world);}
// Intersect the ramp plane, rather than its entire empty bounding volume.
export function rayRamp(origin,direction,s){const c=Math.cos(s.angle),n=Math.sin(s.angle),lz=(origin[0]-s.x)*n+(origin[2]-s.z)*c,dz=direction[0]*n+direction[2]*c,denom=direction[1]+dz*.72;if(Math.abs(denom)<1e-8)return Infinity;const t=(s.y+1.8-lz*.72-origin[1])/denom;if(t<0)return Infinity;return rampHeight(s,origin[0]+direction[0]*t,origin[2]+direction[2]*t)===null?Infinity:t;}
