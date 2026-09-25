import {WEAPON_ORDER,createLoadout,weaponForSlot,weaponIdForSlot,isWeaponSlot,isBuildSlot,buildTypeForSlot,currentAmmo,shotSpread,spreadDirection} from './weapon-system.js';
import {createProjectile,advanceProjectile,segmentSphereTime,segmentAabbTime} from './ballistics.js';
import {SKYSHIP_TIMELINE,AETHER_FLIGHT,skyshipSequenceAt,canEnterRift,shouldAutoUnfurl,stepAetherFlight} from './skyship-sequence.js';

export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mix=(a,b,t)=>a+(b-a)*t;
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const normalize=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
export function cameraAimOrigin(p,input,profile){if(p?.air==='landed')return [p.p[0],p.p[1]+1.72,p.p[2]];const yaw=Number.isFinite(input.aimYaw)?input.aimYaw:input.yaw,pitch=Number.isFinite(input.aimPitch)?input.aimPitch:input.pitch,forward=[-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)],right=[Math.cos(yaw),0,-Math.sin(yaw)],anchor=[p.p[0],p.p[1]+2.15,p.p[2]],distance=input.aim?(profile.scope ? .16 : 3.15):6.8,shoulder=input.aim?(profile.scope?0:.56):1.05;return anchor.map((v,k)=>v-forward[k]*distance+right[k]*shoulder);}
export function placement(p,input,world){const angle=Math.round(input.yaw/(Math.PI/2))*Math.PI/2+(input.rotation||0),dx=-Math.sin(angle),dz=-Math.cos(angle),x=Math.round((p.p[0]+dx*5)/5)*5,z=Math.round((p.p[2]+dz*5)/5)*5;return {x,z,y:Math.max(world.height(x,z),Math.floor((p.p[1]+.25)/3.6)*3.6),angle,type:buildTypeForSlot(input.slot),hp:150};}
export function bounds(s){const r=Math.abs(Math.sin(s.angle))>.5;return {min:[s.x-(r?.22:2.5),s.y,s.z-(r?2.5:.22)],max:[s.x+(r?.22:2.5),s.y+3.6,s.z+(r?2.5:.22)]};}
function overlap(a,b){return a.min.every((v,i)=>v<b.max[i]&&a.max[i]>b.min[i]);}
export function validBuild(s,structures,players,world){if(structures.length>=260||s.y>42)return false;if(structures.some(v=>Math.abs(v.x-s.x)<.1&&Math.abs(v.z-s.z)<.1&&Math.abs(v.y-s.y)<.2&&v.type===s.type&&(s.type!==2||Math.abs(Math.sin(v.angle-s.angle))<.1)))return false;const b=s.type===2?bounds(s):{min:[s.x-2.4,s.y+.15,s.z-2.4],max:[s.x+2.4,s.y+3.5,s.z+2.4]};if(world.obstacles.some(v=>overlap(b,v)))return false;if(s.type===2&&players.some(p=>p.hp>0&&p.air==='landed'&&overlap(b,{min:[p.p[0]-.38,p.p[1],p.p[2]-.38],max:[p.p[0]+.38,p.p[1]+2.3,p.p[2]+.38]})))return false;const floor=world.height(s.x,s.z);return s.y<=floor+.5||structures.some(v=>Math.hypot(v.x-s.x,v.z-s.z)<=5.1&&Math.abs(v.y+3.6-s.y)<.3);}
const EMPTY_OBSTACLES=[];
const groundCellKey=(x,z,size)=>Math.floor(x/size)*65536+Math.floor(z/size);
export function createGroundGrid(obstacles=[],cellSize=24){
 const cells=new Map(),size=clamp(Number(cellSize)||24,8,64);
 for(const box of obstacles){const minX=Math.floor(box.min[0]/size),maxX=Math.floor(box.max[0]/size),minZ=Math.floor(box.min[2]/size),maxZ=Math.floor(box.max[2]/size);for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const key=x*65536+z;let bucket=cells.get(key);if(!bucket)cells.set(key,bucket=[]);bucket.push(box);}}
 return {cellSize:size,cells};
}
export function ground(x,z,foot,structures,world,grid=null){let h=world.height(x,z);const candidates=grid?grid.cells.get(groundCellKey(x,z,grid.cellSize))||EMPTY_OBSTACLES:world.obstacles||EMPTY_OBSTACLES;for(const b of candidates){if(x>b.min[0]+.08&&x<b.max[0]-.08&&z>b.min[2]+.08&&z<b.max[2]-.08&&b.max[1]<=foot+.55)h=Math.max(h,b.max[1]);}for(const s of structures){if(s.type!==3)continue;const dx=x-s.x,dz=z-s.z,localX=dx*Math.cos(s.angle)-dz*Math.sin(s.angle),localZ=dx*Math.sin(s.angle)+dz*Math.cos(s.angle);if(Math.abs(localX)<=2.48&&Math.abs(localZ)<=2.5){let v=s.y+(2.5-localZ)*.72;if(v<=foot+.48)h=Math.max(h,v);}}return h;}
export function rayBox(o,d,b){let lo=0,hi=500;for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-7){if(o[i]<b.min[i]||o[i]>b.max[i])return Infinity;continue;}let a=(b.min[i]-o[i])/d[i],c=(b.max[i]-o[i])/d[i];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo)return Infinity;}return lo;}
export function sanitize(i={}){const num=(v,a,b)=>clamp(Number.isFinite(v)?v:0,a,b),yaw=num(i.yaw,-10000,10000),pitch=num(i.pitch,-.9,.7);return {x:num(i.x,-1,1),z:num(i.z,-1,1),yaw,pitch,aimYaw:Number.isFinite(i.aimYaw)?num(i.aimYaw,-10000,10000):yaw,aimPitch:Number.isFinite(i.aimPitch)?num(i.aimPitch,-.9,.7):pitch,rotation:num(i.rotation,-10000,10000),slot:[1,2,3,4,5,6].includes(i.slot)?i.slot:1,jump:!!i.jump,sprint:!!i.sprint,aim:!!i.aim,fire:!!i.fire,firePulse:!!i.firePulse,reload:!!i.reload};}

// A long cross-island route gives the party time to choose between distant POIs.
export const ISLAND_LIMIT=292,SKYSHIP_SECONDS=SKYSHIP_TIMELINE.autoLaunchAt,SKYSHIP_ALTITUDE=240;
export const INPUT_STALE_SECONDS=1.6;
const SKYSHIP_START=[-312,188],SKYSHIP_END=[312,-188];
const seatOffset=i=>{const row=Math.floor(i/2),side=i%2?1:-1;return [side*1.15,0,3.2-row*2.05];};
const damp=(from,to,rate,dt)=>from+(to-from)*(1-Math.exp(-rate*dt));
const dampAngle=(from,to,rate,dt)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*(1-Math.exp(-rate*dt));
export class Match{
 constructor(world,ids,mode='build'){
  this.world=world;this.groundGrid=createGroundGrid(world.obstacles||[]);this.ids=[...new Set(ids)].slice(0,8);this.mode=mode;this.scores=this.ids.map(()=>0);this.disconnected=new Set();this.targetScore=5;this.round=0;this.events=[];this.eventId=0;this.projectiles=[];this.projectileSequence=0;this.startRound(true);
 }
 skyshipAt(t){const q=clamp(t/SKYSHIP_SECONDS,0,1),ease=q*q*(3-2*q),x=SKYSHIP_START[0]+(SKYSHIP_END[0]-SKYSHIP_START[0])*ease,z=SKYSHIP_START[1]+(SKYSHIP_END[1]-SKYSHIP_START[1])*ease,y=SKYSHIP_ALTITUDE+Math.sin(q*Math.PI)*5+Math.sin(t*.34)*.25,yaw=Math.atan2(-(SKYSHIP_END[0]-SKYSHIP_START[0]),-(SKYSHIP_END[1]-SKYSHIP_START[1]));return {x,y,z,yaw,progress:q,active:q<1,bank:Math.sin(t*.23)*.018,bob:Math.sin(t*.34)*.25,speed:Math.hypot(SKYSHIP_END[0]-SKYSHIP_START[0],SKYSHIP_END[1]-SKYSHIP_START[1])*(6*q*(1-q))/SKYSHIP_SECONDS};}
 shipWorld(local){const c=Math.cos(this.skyship.yaw),s=Math.sin(this.skyship.yaw);return [this.skyship.x+local[0]*c+local[2]*s,this.skyship.y+local[1],this.skyship.z-local[0]*s+local[2]*c];}
 beginRift(p,forced=false){p.air='riftTransit';p.dropState='rift-transit';p.launchProgress=0;p.launchStart=p.p.slice();p.wingsActive=false;p.deploy=0;p.airVelocity=[0,0,0];this.event({type:forced?'rift_auto':'rift_launch',by:p.id,forced});}
 startRound(waiting=false){
  if(this.disconnected.size){const scoreById=new Map(this.ids.map((id,i)=>[id,this.scores[i]||0]));this.ids=this.ids.filter(id=>!this.disconnected.has(id));this.scores=this.ids.map(id=>scoreById.get(id)||0);this.disconnected.clear();}
  this.round++;this.phase=waiting?'waiting':'ship';this.timer=waiting?0:SKYSHIP_SECONDS;this.elapsed=0;this.dropElapsed=0;this.sequence=skyshipSequenceAt(0);this.structures=[];this.projectiles.length=0;this.winner=undefined;
  this.pickups=this.mode==='town'?[{x:0,z:8,type:'shield'},{x:-22,z:20,type:'wood'},{x:25,z:8,type:'health'},{x:36,z:-18,type:'wood'},{x:-38,z:-9,type:'shield'},{x:8,z:38,type:'health'},{x:-205,z:72,type:'shield'},{x:-188,z:91,type:'wood'},{x:176,z:94,type:'health'},{x:198,z:67,type:'wood'},{x:128,z:-188,type:'shield'},{x:-92,z:-178,type:'health'}]:[];
  this.skyship=this.skyshipAt(0);
  this.players=this.ids.map((id,i)=>{const local=seatOffset(i);return {id,p:this.shipWorld(local),shipLocal:local,yaw:this.skyship.yaw,vy:0,hp:100,shield:100,weapons:createLoadout(),slot:1,weapon:'ar',ammo:30,material:150,reload:0,equip:0,cool:0,sustained:0,walk:0,aim:false,input:sanitize(),lastInput:0,air:'ship',dropState:'seated',airVelocity:[0,0,0],airPitch:0,airRoll:0,diveBlend:0,airSpeed:0,clearance:0,wingsActive:false,deploy:0,launchProgress:0,jumpLatch:false,fireLatch:false,reloadLatch:false,eliminated:false};});
  this.events=[];
 }
 beginSkyshipJourney(){if(this.phase!=='waiting')return;this.phase='ship';this.timer=SKYSHIP_SECONDS;this.dropElapsed=0;this.sequence=skyshipSequenceAt(0);this.skyship=this.skyshipAt(0);this.event({type:'journey_start'});}
 input(id,input){const p=this.players.find(p=>p.id===id);if(p){p.input=sanitize(input);p.lastInput=0;}}
 disconnect(id){const p=this.players.find(p=>p.id===id);if(!p||this.disconnected.has(id))return;this.disconnected.add(id);p.hp=0;p.eliminated=true;p.air='landed';this.event({type:'elimination',by:null,hit:id,reason:'disconnect'});if(this.phase==='waiting'){const scoreById=new Map(this.ids.map((pid,i)=>[pid,this.scores[i]||0]));this.ids=this.ids.filter(pid=>pid!==id);this.scores=this.ids.map(pid=>scoreById.get(pid)||0);this.players=this.players.filter(v=>v.id!==id);this.disconnected.delete(id);return;}if(['playing','countdown','ship','flight'].includes(this.phase))this.checkRoundEnd();}
 event(e){this.events.push({...e,id:++this.eventId});if(this.events.length>36)this.events.splice(0,this.events.length-36);}
 hit(p,n){if(p.hp<=0)return;let shield=Math.min(p.shield,n);p.shield-=shield;p.hp=Math.max(0,p.hp-(n-shield));}
 updateAetherJourney(dt){
  this.dropElapsed+=dt;this.skyship=this.skyshipAt(this.dropElapsed);this.timer=Math.max(0,SKYSHIP_SECONDS-this.dropElapsed);this.sequence=skyshipSequenceAt(this.dropElapsed);
  let anyLaunched=false;
  for(let index=0;index<this.players.length;index++){
   const p=this.players[index];if(p.hp<=0)continue;p.lastInput+=dt;const i=p.lastInput>INPUT_STALE_SECONDS?sanitize():p.input;const edgeJump=i.jump&&!p.jumpLatch;p.jumpLatch=i.jump;
   if(p.air==='ship'){
    const local=p.shipLocal||seatOffset(index);p.shipLocal=local;p.yaw=dampAngle(p.yaw||this.skyship.yaw,i.yaw,7,dt);p.sequence=this.sequence.stage;p.riftBlend=this.sequence.riftBlend;
    if(this.sequence.controls){local[0]=clamp(local[0]+i.x*5.4*dt,-2,2);local[2]=clamp(local[2]-i.z*5.4*dt,-4.25,3.45);}
    local[1]=this.sequence.standBlend*.48;p.p=this.shipWorld(local);
    if(this.sequence.autoLaunch){this.beginRift(p,true);continue;}
    if(edgeJump&&canEnterRift(this.dropElapsed,local)){this.beginRift(p,false);continue;}
    continue;
   }
   if(p.air==='riftTransit'){
    anyLaunched=true;p.launchProgress=clamp((p.launchProgress||0)+dt/SKYSHIP_TIMELINE.launchSeconds,0,1);const q=p.launchProgress,ease=q*q*(3-2*q),target=this.shipWorld([(p.shipLocal?.[0]||0)*.7,.25,-8.7]),start=p.launchStart||p.p;p.p=[start[0]+(target[0]-start[0])*ease,start[1]+(target[1]-start[1])*ease+Math.sin(q*Math.PI)*2.6,start[2]+(target[2]-start[2])*ease];p.airVelocity=[(target[0]-start[0])/SKYSHIP_TIMELINE.launchSeconds,0,(target[2]-start[2])/SKYSHIP_TIMELINE.launchSeconds];
    if(q>=1){p.air='rift';p.dropState='aether-current';p.p=target;p.airVelocity=[0,-AETHER_FLIGHT.riftFall,0];p.launchProgress=1;this.event({type:'rift_arrival',by:p.id});}
    continue;
   }
   if(['rift','wingOpening','winged','wingFolding'].includes(p.air)){
    anyLaunched=true;p.yaw=dampAngle(p.yaw||0,i.yaw,p.air==='winged'?3.7:5.5,dt);const floor=ground(p.p[0],p.p[2],p.p[1],this.structures,this.world,this.groundGrid);p.clearance=Math.max(0,p.p[1]-floor);
    if(p.air==='rift'&&(edgeJump||shouldAutoUnfurl(p.clearance))){const forced=shouldAutoUnfurl(p.clearance);p.air='wingOpening';p.dropState='wings-opening';p.wingsActive=true;p.deploy=0;this.event({type:'wings_open',by:p.id,forced});}
    else if(p.air==='winged'&&edgeJump){if(p.clearance>AETHER_FLIGHT.autoUnfurlClearance+AETHER_FLIGHT.foldBuffer){p.air='wingFolding';p.dropState='wings-folding';this.event({type:'wings_fold',by:p.id});}else this.event({type:'wings_fold_blocked',by:p.id});}
    if(p.air==='wingOpening'){p.deploy=clamp((p.deploy||0)+dt/AETHER_FLIGHT.unfurlSeconds,0,1);if(p.deploy>=1){p.air='winged';p.dropState='winged';p.deploy=1;}}
    else if(p.air==='winged'){p.deploy=1;p.wingsActive=true;p.dropState='winged';}
    else if(p.air==='wingFolding'){p.deploy=clamp((p.deploy||1)-dt/AETHER_FLIGHT.foldSeconds,0,1);if(p.deploy<=0){p.air='rift';p.wingsActive=false;p.dropState='aether-current';p.deploy=0;this.event({type:'rift_resume',by:p.id});}}
    const velocity=stepAetherFlight(p.airVelocity,i,p.deploy,dt);p.airVelocity=velocity;p.vy=velocity[1];p.airSpeed=Math.hypot(...velocity);p.airPitch=damp(p.airPitch||0,i.pitch*.48,4,dt);p.airRoll=damp(p.airRoll||0,-i.x*.27,4.4,dt);
    p.p[0]=clamp(p.p[0]+velocity[0]*dt,-ISLAND_LIMIT,ISLAND_LIMIT);p.p[2]=clamp(p.p[2]+velocity[2]*dt,-ISLAND_LIMIT,ISLAND_LIMIT);p.p[1]+=velocity[1]*dt;
    const landingFloor=ground(p.p[0],p.p[2],p.p[1],this.structures,this.world,this.groundGrid);if(p.p[1]<=landingFloor){p.p[1]=landingFloor;p.vy=0;p.airVelocity=[0,0,0];p.airSpeed=0;p.clearance=0;p.air='landed';p.dropState='landed';p.wingsActive=false;p.deploy=0;p.airPitch=0;p.airRoll=0;this.event({type:'land',by:p.id});}
   }
  }
  if(anyLaunched&&this.phase==='ship')this.phase='flight';
  const alive=this.players.filter(p=>p.hp>0);
  if(alive.some(p=>p.air==='landed')){
   if(this.phase!=='playing'){this.phase='playing';this.elapsed=0;this.event({type:'first_landing'});}
   if(alive.every(p=>p.air==='landed'))this.skyship.active=false;
  }
 }
 checkRoundEnd(){
  if(!['playing','countdown','ship','flight'].includes(this.phase))return false;
  const alive=this.players.filter(p=>p.hp>0);if(alive.length>1)return false;
  this.winner=alive.length===1?this.players.indexOf(alive[0]):-1;if(this.winner>=0)this.scores[this.winner]++;
  this.phase=this.scores.some(n=>n>=this.targetScore)?'done':'roundover';this.timer=4;this.event({type:'round_end',winner:this.winner});return true;
 }
 reloadWeapon(p){
  if(!isWeaponSlot(p.slot)||p.reload>0||p.equip>0)return false;
  const profile=weaponForSlot(p.slot),state=p.weapons[profile.id];
  if(!state||state.ammo>=profile.magazineCapacity)return false;
  p.reload=profile.reloadDuration;p.reloadWeapon=profile.id;p.cool=Math.max(p.cool,.12);
  this.event({type:'reload',by:p.id,weapon:profile.id,duration:profile.reloadDuration});return true;
 }
 cameraOrigin(p,i,profile){
  const desired=cameraAimOrigin(p,i,profile),anchor=[p.p[0],p.p[1]+2.15,p.p[2]],delta=desired.map((v,k)=>v-anchor[k]),distance=Math.hypot(...delta),direction=normalize(delta);let nearest=distance;
  for(const b of this.world.obstacles)nearest=Math.min(nearest,rayBox(anchor,direction,b));
  for(const structure of this.structures){const b=structure.type===2?bounds(structure):{min:[structure.x-2.5,structure.y,structure.z-2.5],max:[structure.x+2.5,structure.y+3.6,structure.z+2.5]};nearest=Math.min(nearest,rayBox(anchor,direction,b));}
  for(let t=.4;t<nearest;t+=.5)if(anchor[1]+direction[1]*t<this.world.height(anchor[0]+direction[0]*t,anchor[2]+direction[2]*t)){nearest=t;break;}
  const eye=nearest<distance?anchor.map((v,k)=>v+direction[k]*Math.max(.16,nearest-.3)):desired;eye[1]=Math.max(eye[1],this.world.height(eye[0],eye[2])+.55);return eye;
 }
 traceShot(p,d,range,origin){
  const o=origin||[p.p[0],p.p[1]+1.7,p.p[2]];let nearest=range,target=null,structure=null;
  for(const b of this.world.obstacles){const t=rayBox(o,d,b);if(t<nearest)nearest=t;}
  for(let t=.5;t<nearest;t+=.5){if(o[1]+d[1]*t<this.world.height(o[0]+d[0]*t,o[2]+d[2]*t)){nearest=t;break;}}
  for(const b of this.structures){const bb=b.type===2?bounds(b):{min:[b.x-2.5,b.y,b.z-2.5],max:[b.x+2.5,b.y+3.6,b.z+2.5]},t=rayBox(o,d,bb);if(t<nearest){nearest=t;structure=b;target=null;}}
  for(const other of this.players){
   if(other===p||other.hp<=0)continue;
   const t=rayBox(o,d,{min:[other.p[0]-.43,other.p[1],other.p[2]-.43],max:[other.p[0]+.43,other.p[1]+2.5,other.p[2]+.43]});
   if(t<nearest){nearest=t;target=other;structure=null;}
  }
  const end=o.map((v,k)=>v+d[k]*nearest);
  return {o,end,target,structure,critical:Boolean(target&&end[1]>target.p[1]+1.86)};
 }
 fireWeapon(p,i,moving){
  const profile=weaponForSlot(p.slot),state=p.weapons[profile.id];
  if(!state?.ammo){this.reloadWeapon(p);return;}
  state.ammo--;p.ammo=state.ammo;p.cool+=profile.fireInterval;p.sustained=Math.min(5,p.sustained+1);
  const spread=shotSpread(profile,{aim:i.aim,moving,sustained:p.sustained}),traces=[],hitTotals=new Map(),structureHits=new Map(),camera=this.cameraOrigin(p,i,profile),muzzleZ=profile.id==='sniper'?-1.95:profile.id==='shotgun'?-1.72:-1.48,muzzle=[p.p[0]+.24*Math.cos(i.yaw)+muzzleZ*Math.sin(i.yaw),p.p[1]+1.59,p.p[2]-.24*Math.sin(i.yaw)+muzzleZ*Math.cos(i.yaw)];
  if(profile.projectile){
   const viewDirection=spreadDirection(i.aimYaw,i.aimPitch,spread),crosshairTrace=this.traceShot(p,viewDirection,profile.range,camera),toAim=crosshairTrace.end.map((v,k)=>v-muzzle[k]),muzzleDirection=normalize(toAim),projectileId=`${p.id}:${++this.projectileSequence}`;
   this.projectiles.push(createProjectile({id:projectileId,owner:p.id,origin:muzzle,direction:muzzleDirection,speed:profile.projectile.speed,gravity:profile.projectile.gravity,range:profile.range,damage:profile.damage,spawnTick:this.elapsed,maxAge:profile.projectile.maxAge}));
   this.event({type:'shot',by:p.id,weapon:profile.id,a:muzzle,b:crosshairTrace.end,traces:[crosshairTrace.end],hits:[],hit:null,damage:0,projectileId});
   return;
  }
  for(let pellet=0;pellet<profile.pellets;pellet++){
   const viewDirection=spreadDirection(i.aimYaw,i.aimPitch,spread),crosshairTrace=this.traceShot(p,viewDirection,profile.range,camera),toAim=crosshairTrace.end.map((v,k)=>v-muzzle[k]),aimDistance=Math.hypot(...toAim),muzzleDirection=normalize(toAim),trace=this.traceShot(p,muzzleDirection,Math.min(profile.range,aimDistance+.35),muzzle);traces.push(trace.end);
   if(trace.target){const multiplier=trace.critical?1.65:1,damage=Math.round(profile.damage*multiplier),prior=hitTotals.get(trace.target)||{damage:0,critical:false};prior.damage+=damage;prior.critical||=trace.critical;hitTotals.set(trace.target,prior);}
   if(trace.structure)structureHits.set(trace.structure,(structureHits.get(trace.structure)||0)+profile.damage);
  }
  for(const [target,hit] of hitTotals){this.hit(target,hit.damage);if(target.hp<=0&&!target.eliminated){target.eliminated=true;this.event({type:'elimination',by:p.id,hit:target.id,weapon:profile.id});}}
  for(const [structure,damage] of structureHits){structure.hp-=damage;if(structure.hp<=0)this.structures=this.structures.filter(s=>s!==structure);}
  const hits=[...hitTotals].map(([target,hit])=>({id:target.id,...hit}));
  this.event({type:'shot',by:p.id,weapon:profile.id,a:muzzle,b:traces[0],traces,hits,hit:hits[0]?.id||null,damage:hits.reduce((n,h)=>n+h.damage,0)});
 }
 tickProjectiles(dt){
  for(let index=this.projectiles.length-1;index>=0;index--){
   const projectile=advanceProjectile(this.projectiles[index],dt),from=projectile.previous,to=projectile.position;
   let nearest=Infinity,target=null,structure=null,terrain=false;
   for(const obstacle of this.world.obstacles||[]){const t=segmentAabbTime(from,to,obstacle.min,obstacle.max);if(t!==null&&t<nearest){nearest=t;target=null;structure=null;terrain=false;}}
   for(const candidate of this.structures){const box=candidate.type===2?bounds(candidate):{min:[candidate.x-2.5,candidate.y,candidate.z-2.5],max:[candidate.x+2.5,candidate.y+3.6,candidate.z+2.5]},t=segmentAabbTime(from,to,box.min,box.max);if(t!==null&&t<nearest){nearest=t;target=null;structure=candidate;terrain=false;}}
   for(const candidate of this.players){
    if(candidate.id===projectile.owner||candidate.hp<=0)continue;
    const t=segmentSphereTime(from,to,[candidate.p[0],candidate.p[1]+1.25,candidate.p[2]],.72);
    if(t!==null&&t<nearest){nearest=t;target=candidate;structure=null;terrain=false;}
   }
   const segmentDistance=Math.hypot(to[0]-from[0],to[1]-from[1],to[2]-from[2]),samples=Math.max(1,Math.ceil(segmentDistance/.5));
   for(let step=1;step<=samples;step++){
    const t=step/samples;if(t>=nearest)break;
    const x=mix(from[0],to[0],t),y=mix(from[1],to[1],t),z=mix(from[2],to[2],t);
    if(y<=this.world.height(x,z)){nearest=t;target=null;structure=null;terrain=true;break;}
   }
   if(nearest!==Infinity){
    const point=[mix(from[0],to[0],nearest),mix(from[1],to[1],nearest),mix(from[2],to[2],nearest)];let damage=0,critical=false;
    if(target){critical=point[1]>target.p[1]+1.86;damage=Math.round(projectile.damage*(critical?1.65:1));this.hit(target,damage);if(target.hp<=0&&!target.eliminated){target.eliminated=true;this.event({type:'elimination',by:projectile.owner,hit:target.id,weapon:'sniper'});}}
    if(structure){damage=projectile.damage;structure.hp-=damage;if(structure.hp<=0)this.structures=this.structures.filter(item=>item!==structure);}
    this.event({type:'projectile-impact',projectileId:projectile.id,by:projectile.owner,weapon:'sniper',point,hit:target?.id||null,damage,critical,structure:Boolean(structure),terrain});
    this.projectiles[index]=this.projectiles.at(-1);this.projectiles.pop();continue;
   }
   if(projectile.expired){this.event({type:'projectile-expire',projectileId:projectile.id,by:projectile.owner});this.projectiles[index]=this.projectiles.at(-1);this.projectiles.pop();}
  }
 }
 tickGroundedPlayers(dt,advanceInput=true){
  if(!this.players.some(p=>p.hp>0&&p.air==='landed'))return;
  const walls=this.world.obstacles.concat(this.structures.filter(s=>s.type===2).map(bounds));
  for(const p of this.players){
   if(p.hp<=0||p.air!=='landed')continue;
   if(advanceInput)p.lastInput+=dt;const i=p.lastInput>INPUT_STALE_SECONDS?sanitize():p.input,edgeFire=i.fire&&!p.fireLatch,edgeReload=i.reload&&!p.reloadLatch;
   p.fireLatch=i.fire;p.reloadLatch=i.reload;p.cool=Math.max(-.05,p.cool-dt);p.equip=Math.max(0,p.equip-dt);p.sustained=Math.max(0,p.sustained-dt*3.4);
   if(i.slot!==p.slot&&(isWeaponSlot(i.slot)||isBuildSlot(i.slot))){
    p.slot=i.slot;if(isWeaponSlot(i.slot))p.weapon=weaponIdForSlot(i.slot);p.building=isBuildSlot(i.slot);p.reload=0;p.reloadWeapon=null;p.equip=isWeaponSlot(i.slot)?weaponForSlot(i.slot).equipDuration:.22;if(isWeaponSlot(i.slot))p.cool=Math.max(p.cool,p.equip*.45);this.event({type:'switch',by:p.id,slot:p.slot,weapon:p.weapon,building:p.building});
   }
   if(p.reload>0){p.reload=Math.max(0,p.reload-dt);if(!p.reload&&p.reloadWeapon){const profile=weaponForSlot(WEAPON_ORDER.indexOf(p.reloadWeapon)+1);p.weapons[p.reloadWeapon].ammo=profile.magazineCapacity;p.reloadWeapon=null;}}
   if(edgeReload)this.reloadWeapon(p);p.yaw=i.yaw;p.aim=Boolean(i.aim&&isWeaponSlot(p.slot)&&!p.reload);
   const inputLength=Math.hypot(i.x,i.z),speed=(i.sprint?9:6)*(p.aim?.58:1),len=Math.max(1,inputLength),dx=(Math.cos(i.yaw)*i.x-Math.sin(i.yaw)*i.z)/len*speed*dt,dz=(-Math.sin(i.yaw)*i.x-Math.cos(i.yaw)*i.z)/len*speed*dt;
   const blocked=q=>walls.some(b=>overlap({min:[q[0]-.36,q[1]+.12,q[2]-.36],max:[q[0]+.36,q[1]+2.3,q[2]+.36]},b));let q=[p.p[0]+dx,p.p[1],p.p[2]];if(!blocked(q))p.p[0]=clamp(q[0],-ISLAND_LIMIT,ISLAND_LIMIT);q=[p.p[0],p.p[1],p.p[2]+dz];if(!blocked(q))p.p[2]=clamp(q[2],-ISLAND_LIMIT,ISLAND_LIMIT);
   const floor=ground(p.p[0],p.p[2],p.p[1],this.structures,this.world,this.groundGrid);if(i.jump&&p.p[1]<=floor+.05)p.vy=8;p.vy-=22*dt;p.p[1]+=p.vy*dt;if(p.p[1]<floor){p.p[1]=floor;p.vy=0;}p.walk+=Math.hypot(dx,dz)*1.4;
   if(i.fire&&p.cool<=0&&(isBuildSlot(p.slot)||p.equip<=0)){
    if(isBuildSlot(p.slot)){p.cool=.22;const b=placement(p,{...i,slot:p.slot},this.world);if((this.mode==='build'||p.material>=10)&&validBuild(b,this.structures,this.players,this.world)){this.structures.push(b);if(this.mode!=='build')p.material-=10;this.event({type:'build',by:p.id,structure:b});}}
    else{const profile=weaponForSlot(p.slot);if(!p.reload&&(profile.automatic||edgeFire))this.fireWeapon(p,i,Math.min(1,inputLength));}
   }
   if(i.firePulse){p.input.fire=false;p.input.firePulse=false;}
   if(isWeaponSlot(p.slot))p.weapon=weaponIdForSlot(p.slot);p.building=isBuildSlot(p.slot);p.ammo=currentAmmo(p.weapons,p.slot);
  }
 }
 finishCombatTick(dt){
  this.tickProjectiles(dt);
  if(this.mode==='town'){
   const radius=Math.max(18,255-this.elapsed*.58);
   for(const p of this.players){
    if(p.hp<=0)continue;if(Math.hypot(p.p[0],p.p[2])>radius)this.hit(p,7*dt);if(p.air!=='landed')continue;
    for(let index=this.pickups.length-1;index>=0;index--){const item=this.pickups[index];if(Math.hypot(item.x-p.p[0],item.z-p.p[2])>=2)continue;
     if(item.type==='shield'&&p.shield<100)p.shield=Math.min(100,p.shield+40);else if(item.type==='health'&&p.hp<100)p.hp=Math.min(100,p.hp+40);else if(item.type==='wood')p.material+=50;else continue;this.pickups.splice(index,1);
    }
   }
  }
  for(const p of this.players)if(p.hp<=0&&!p.eliminated){p.eliminated=true;this.event({type:'elimination',by:null,hit:p.id,reason:'storm'});}this.checkRoundEnd();
 }
 tick(dt){
  dt=clamp(dt,0,.05);if(this.phase==='done'||this.phase==='paused'||this.phase==='waiting')return;
  const aerial=this.players.some(p=>p.hp>0&&p.air!=='landed');
  if(this.phase==='ship'||this.phase==='flight'||(this.phase==='playing'&&aerial)){
   this.updateAetherJourney(dt);if(this.phase==='playing'){this.elapsed+=dt;this.tickGroundedPlayers(dt,false);this.finishCombatTick(dt);}return;
  }
  if(this.phase==='countdown'||this.phase==='roundover'){this.timer-=dt;if(this.timer<=0){if(this.phase==='countdown')this.phase='playing';else this.startRound(false);}return;}
  this.elapsed+=dt;this.tickGroundedPlayers(dt);this.finishCombatTick(dt);
 }
 snapshot(){return {phase:this.phase,timer:this.timer,elapsed:this.elapsed,round:this.round,mode:this.mode,targetScore:this.targetScore,scores:this.scores,winner:this.winner,sequence:this.sequence,skyship:this.skyship,players:this.players.map(({input,lastInput,jumpLatch,...p})=>p),structures:this.structures,pickups:this.pickups,projectiles:this.projectiles.map(({id,owner,position,velocity,spawnTick})=>({id,owner,position:position.slice(),velocity:velocity.slice(),spawnTick})),events:this.events};}
}
