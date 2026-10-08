import {deploymentCinematic,cinematicPodPosition,podExitPosition,podExitYaw} from './deployment-cinematic.js';
import {createInventory,createWeaponItem,inventoryWeapon,cloneInventory,applyInventoryMove,movedSelection} from './weapon-inventory.js';
import {moveHorizontal,upwardLimit,canStandAt} from './movement-collision.js';
import {gridPlacement,gridBounds,gridValid,rampHeight,rayRamp} from './build-grid.js';
import {MATERIALS,ITEMS,ITEM_SLOTS,LIMITS,validSlot,beginUse,advanceUse} from './items.js';
import {createEntityGrid,nearby,aimedEntity} from './resource-system.js';
import {chestLoot} from './loot-system.js';
import {SHOCKWAVE,shockwaveImpulse,resolveLanding,throwGrenade} from './shockwave.js';
import {WEAPON_ORDER,createLoadout,weaponForSlot,weaponIdForSlot,isWeaponSlot,isBuildSlot,buildTypeForSlot,currentAmmo,shotSpread,spreadDirection} from './weapon-system.js';
import {createProjectile,advanceProjectile,segmentSphereTime,segmentAabbTime} from './ballistics.js';
import {DEPLOYMENT_TIMELINE,deploymentStageAt,safeLandingPoint} from './deployment-sequence.js';
import {DEPLOYMENT_SHIP,SHIP_PODS,SHIP_COLLIDERS,clampShipPosition,moveInShip,shipWorld,podBoardingPose,podShipLaunch} from './deployment-ship.js';

export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mix=(a,b,t)=>a+(b-a)*t;
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const normalize=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
export function cameraAimOrigin(p,input,profile){if(p?.air==='landed')return [p.p[0],p.p[1]+1.72,p.p[2]];const yaw=Number.isFinite(input.aimYaw)?input.aimYaw:input.yaw,pitch=Number.isFinite(input.aimPitch)?input.aimPitch:input.pitch,forward=[-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)],right=[Math.cos(yaw),0,-Math.sin(yaw)],anchor=[p.p[0],p.p[1]+2.15,p.p[2]],distance=input.aim?(profile.scope ? .16 : 3.15):6.8,shoulder=input.aim?(profile.scope?0:.56):1.05;return anchor.map((v,k)=>v-forward[k]*distance+right[k]*shoulder);}
export const placement=gridPlacement,bounds=gridBounds,validBuild=gridValid;
function overlap(a,b){return a.min.every((v,i)=>v<b.max[i]&&a.max[i]>b.min[i]);}
const EMPTY_OBSTACLES=[];
const groundCellKey=(x,z,size)=>Math.floor(x/size)*65536+Math.floor(z/size);
export function createGroundGrid(obstacles=[],cellSize=24){
 const cells=new Map(),size=clamp(Number(cellSize)||24,8,64);
 for(const box of obstacles){const minX=Math.floor(box.min[0]/size),maxX=Math.floor(box.max[0]/size),minZ=Math.floor(box.min[2]/size),maxZ=Math.floor(box.max[2]/size);for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const key=x*65536+z;let bucket=cells.get(key);if(!bucket)cells.set(key,bucket=[]);bucket.push(box);}}
 return {cellSize:size,cells};
}
export function ground(x,z,foot,structures,world,grid=null,rampStep=.55){let h=world.height(x,z);const candidates=grid?grid.cells.get(groundCellKey(x,z,grid.cellSize))||EMPTY_OBSTACLES:world.obstacles||EMPTY_OBSTACLES;for(const b of candidates){if(x>b.min[0]-.001&&x<b.max[0]+.001&&z>b.min[2]-.001&&z<b.max[2]+.001&&b.max[1]<=foot+.55)h=Math.max(h,b.max[1]);}for(const s of structures){if(s.type!==3)continue;const v=rampHeight(s,x,z);if(v!==null&&v<=foot+rampStep)h=Math.max(h,v);}return h;}
export function rayBox(o,d,b){let lo=0,hi=500;for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-7){if(o[i]<b.min[i]||o[i]>b.max[i])return Infinity;continue;}let a=(b.min[i]-o[i])/d[i],c=(b.max[i]-o[i])/d[i];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo)return Infinity;}return lo;}
export function sanitize(i={}){const num=(v,a,b)=>clamp(Number.isFinite(v)?v:0,a,b),yaw=num(i.yaw,-10000,10000),pitch=num(i.pitch,-.9,.7),landing=Array.isArray(i.landing)?{x:Number(i.landing[0]),z:Number(i.landing[1]??i.landing[2])}:i.landing&&typeof i.landing==='object'?{x:Number(i.landing.x),z:Number(i.landing.z)}:null;return {x:num(i.x,-1,1),z:num(i.z,-1,1),yaw,pitch,aimYaw:Number.isFinite(i.aimYaw)?num(i.aimYaw,-10000,10000):yaw,aimPitch:Number.isFinite(i.aimPitch)?num(i.aimPitch,-.9,.7):pitch,rotation:num(i.rotation,-10000,10000),material:i.material==='stone'?'stone':'wood',drop:!!i.drop,inventoryRevision:Number.isSafeInteger(i.inventoryRevision)&&i.inventoryRevision>=0?i.inventoryRevision:undefined,slot:validSlot(i.slot)?i.slot:0,jump:!!i.jump,interact:!!i.interact,crouchRevision:Number.isSafeInteger(i.crouchRevision)&&i.crouchRevision>=0?i.crouchRevision:undefined,crouchPress:i.crouchPress&&Number.isSafeInteger(i.crouchPress.revision)&&i.crouchPress.revision>=0&&i.crouchPress.revision===i.crouchRevision?{revision:i.crouchPress.revision,x:num(i.crouchPress.x,-1,1),z:num(i.crouchPress.z,-1,1),yaw:num(i.crouchPress.yaw,-10000,10000),sprint:!!i.crouchPress.sprint}:null,reloadRevision:Number.isSafeInteger(i.reloadRevision)&&i.reloadRevision>=0?i.reloadRevision:undefined,crouch:!!i.crouch,sprint:!!i.sprint,aim:!!i.aim,fire:!!i.fire,firePulse:!!i.firePulse,reload:!!i.reload,landing:landing&&Number.isFinite(landing.x)&&Number.isFinite(landing.z)?{x:clamp(landing.x,-ISLAND_LIMIT,ISLAND_LIMIT),z:clamp(landing.z,-ISLAND_LIMIT,ISLAND_LIMIT)}:null};}

export const ISLAND_LIMIT=292,DEPLOYMENT_ALTITUDE=DEPLOYMENT_SHIP.origin[1];
export const INPUT_STALE_SECONDS=1.6;
const seatOffset=i=>{const row=Math.floor(i/2),side=i%2?1:-1;return [side*1.2,0,(row%4-1.5)*2.8];};
const samePoint=(a,b)=>!!a&&!!b&&Math.hypot(a.x-b.x,a.z-b.z)<.05;
const damp=(from,to,rate,dt)=>from+(to-from)*(1-Math.exp(-rate*dt));
const dampAngle=(from,to,rate,dt)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*(1-Math.exp(-rate*dt));
export class Match{
 constructor(world,ids,mode='build'){
  this.world=world;this.groundGrid=createGroundGrid(world.obstacles||[]);this.collisionGrid=createEntityGrid((world.obstacles||[]).flatMap(box=>{const entries=[];for(let x=Math.floor(box.min[0]/16);x<=Math.floor(box.max[0]/16);x++)for(let z=Math.floor(box.min[2]/16);z<=Math.floor(box.max[2]/16);z++)entries.push({...box,x:x*16+8,z:z*16+8});return entries;}));this.ids=[...new Set(ids)].slice(0,8);this.mode=mode;this.scores=this.ids.map(()=>0);this.disconnected=new Set();this.targetScore=5;this.round=0;this.events=[];this.eventId=0;this.projectiles=[];this.projectileSequence=0;this.startRound(true);
 }
 startRound(waiting=false){
  if(this.disconnected.size){const scoreById=new Map(this.ids.map((id,i)=>[id,this.scores[i]||0]));this.ids=this.ids.filter(id=>!this.disconnected.has(id));this.scores=this.ids.map(id=>scoreById.get(id)||0);this.disconnected.clear();}
  this.round++;this.phase=waiting?'waiting':'deployment';this.timer=0;this.elapsed=0;this.deployment={stage:waiting?'ship_waiting':'landing_selection',elapsed:0,sequenceElapsed:0,sequenceId:`${this.round}:1`,teleported:false,stageElapsed:0};this.deploymentSequence=0;this.podOwners=new Map();this.structures=[];this.projectiles.length=0;this.winner=undefined;
  this.pickups=[];this.openedChests=new Set();this.resourceHP=new Map();this.resources=this.world.resources||[];this.resourceGrid=createEntityGrid(this.resources);this.chests=this.world.chests||[];this.chestGrid=createEntityGrid(this.chests);this.grenades=[];this.lootSequence=0;
  this.players=this.ids.map((id,i)=>{const local=clampShipPosition(seatOffset(i));return {id,p:shipWorld(local),shipLocal:local,yaw:0,vy:0,hp:100,shield:0,inventory:createInventory(),inventoryRevision:0,inventoryAcks:[],chestHold:null,items:{shield:0,health:0,shockwave:0},materials:{wood:0,stone:0},selectedMaterial:'wood',use:null,impulse:[0,0],shockwaveImmune:false,actionTime:0,slot:0,weapon:null,ammo:0,material:0,reload:0,equip:0,cool:0,sustained:0,walk:0,aim:false,sprinting:false,crouching:false,sliding:false,slideSpeed:0,slideTime:0,slideDir:[0,-1],crouchRequested:false,crouchLatch:false,lastCrouchRevision:0,lastReloadRevision:0,animationState:'idle',input:sanitize(),lastInput:0,air:'ship',dropState:'ship_waiting',deploymentState:waiting?'ship_waiting':'landing_selection',destination:null,pod:null,podProgress:0,saluteProgress:0,podYaw:null,entryStart:null,landingPosition:null,exitPosition:null,launchProgress:0,jumpLatch:false,interactLatch:false,fireLatch:false,reloadLatch:false,eliminated:false};});
  this.events=[];
 }
 beginDeployment(){if(this.phase!=='waiting')return false;this.phase='deployment';this.timer=0;this.deployment={stage:'landing_selection',elapsed:0,sequenceElapsed:0,sequenceId:`${this.round}:${++this.deploymentSequence}`,teleported:false,stageElapsed:0};for(const player of this.players){player.air='ship';player.deploymentState='landing_selection';player.dropState=player.deploymentState;player.slot=0;player.input=sanitize();}this.event({type:'deployment_start'});return true;}
 shipWorld(local){return shipWorld(local);}
 chooseLanding(id,destination){const p=this.players.find(player=>player.id===id);if(!p||p.hp<=0||this.phase!=='deployment'||!['landing_selection','pod_available'].includes(p.deploymentState))return false;const reserved=this.players.filter(other=>other!==p&&other.hp>0&&other.destination).map(other=>({x:other.destination.x,z:other.destination.z})),safe=safeLandingPoint(destination,this.world,reserved);if(!safe)return false;if(samePoint(p.destination,safe))return true;p.destination=safe;p.deploymentState='pod_available';p.dropState='pod_available';this.event({type:'landing_selected',by:id,x:safe.x,z:safe.z});return true;}
 enterPod(id){const p=this.players.find(player=>player.id===id);if(!p||p.hp<=0||this.phase!=='deployment'||!p.destination)return false;if(p.pod&&['entering_pod','pod_ready','both_ready'].includes(p.deploymentState))return true;if(p.deploymentState!=='pod_available')return false;const pos=p.shipLocal||[0,0,0],nearby=SHIP_PODS.map(pod=>({pod,distance:Math.hypot(pos[0]-pod.x,pos[2]-(pod.z+pod.entryOffset))})).filter(({pod,distance})=>distance<=2.9&&!this.podOwners.has(pod.id)).sort((a,b)=>a.distance-b.distance)[0];if(!nearby)return false;this.podOwners.set(nearby.pod.id,id);p.pod=nearby.pod.id;p.entryStart=pos.slice();p.podProgress=0;p.deploymentState='entering_pod';p.dropState='entering_pod';p.crouching=false;p.crouchRequested=false;p.sliding=false;p.slideSpeed=0;p.sprinting=false;p.yaw=podBoardingPose(nearby.pod,p.entryStart,0).yaw;p.vy=0;p.grounded=true;p.input=sanitize();this.event({type:'pod_reserved',by:id,pod:p.pod});return true;}
 input(id,input){const p=this.players.find(p=>p.id===id);if(p){p.input=sanitize(input);if(this.phase!=='playing'||p.air!=='landed'){p.lastCrouchRevision=p.input.crouchRevision??p.lastCrouchRevision;p.lastReloadRevision=p.input.reloadRevision??p.lastReloadRevision;}p.lastInput=0;}}
 disconnect(id){const p=this.players.find(p=>p.id===id);if(!p||this.disconnected.has(id))return false;this.disconnected.add(id);p.hp=0;p.eliminated=true;if(p.pod&&this.deployment?.stage!=='launching'&&this.deployment?.stage!=='transition')this.podOwners.delete(p.pod);p.air='landed';this.event({type:'elimination',by:null,hit:id,reason:'disconnect'});if(this.phase==='waiting'){const scoreById=new Map(this.ids.map((pid,i)=>[pid,this.scores[i]||0]));this.ids=this.ids.filter(pid=>pid!==id);this.scores=this.ids.map(pid=>scoreById.get(pid)||0);this.players=this.players.filter(v=>v.id!==id);this.disconnected.delete(id);return true;}if(['playing','countdown','roundover'].includes(this.phase))this.checkRoundEnd();return true;}
 event(e){this.events.push({...e,id:++this.eventId});if(this.events.length>36)this.events.splice(0,this.events.length-36);}
 hit(p,n){if(p.hp<=0)return;let shield=Math.min(p.shield,n);p.shield-=shield;p.hp=Math.max(0,p.hp-(n-shield));}
 tickDeployment(dt){
  const alive=this.players.filter(player=>player.hp>0&&!this.disconnected.has(player.id));
  if(!alive.length)return;
  const launchStarted=this.deployment.stage==='both_ready'||['pod_sealing','launching','transition','landed','pod_opening','exiting','saluting'].includes(this.deployment.stage);
  if(!launchStarted){
   for(const p of alive){p.lastInput+=dt;const i=p.lastInput>INPUT_STALE_SECONDS?sanitize():p.input;const edgeInteract=i.interact&&!p.interactLatch;p.interactLatch=i.interact;if(!p.pod)p.yaw=dampAngle(p.yaw||0,i.yaw,8,dt);if(i.landing&&!p.pod&&['landing_selection','pod_available'].includes(p.deploymentState))this.chooseLanding(p.id,i.landing);
    if(['landing_selection','pod_available'].includes(p.deploymentState)){const inputLength=Math.hypot(i.x,i.z),len=Math.max(1,inputLength),speed=(i.sprint?7.2:5.4)*dt/len,dx=(Math.cos(i.yaw)*i.x-Math.sin(i.yaw)*i.z)*speed,dz=(-Math.sin(i.yaw)*i.x-Math.cos(i.yaw)*i.z)*speed,previous=p.shipLocal||seatOffset(this.players.indexOf(p));p.shipLocal=moveInShip(previous,[dx,0,dz]);p.p=shipWorld(p.shipLocal);const moved=Math.hypot(p.shipLocal[0]-previous[0],p.shipLocal[2]-previous[2]);p.walk+=moved*1.4;p.sprinting=Boolean(i.sprint&&moved>.008);p.crouching=Boolean(i.crouch);p.animationState=moved>.008?(p.sprinting?'run':'walk'):(p.crouching?'crouch':'idle');if(edgeInteract)this.enterPod(p.id);}
    else if(p.deploymentState==='entering_pod'){
     const pod=SHIP_PODS.find(value=>value.id===p.pod),previous=p.shipLocal;
     p.podProgress=Math.min(1,p.podProgress+dt/DEPLOYMENT_TIMELINE.enterSeconds);
     const pose=podBoardingPose(pod,p.entryStart||p.shipLocal,p.podProgress);
     p.shipLocal=pose.position;p.p=shipWorld(p.shipLocal);p.yaw=pose.yaw;
     p.animationState=p.locomotionState=pose.animationState;p.moveSpeed=pose.moveSpeed;
     p.walk+=Math.hypot(p.shipLocal[0]-previous[0],p.shipLocal[2]-previous[2])*1.4;
     if(p.podProgress>=1){p.deploymentState='pod_ready';p.dropState='pod_ready';this.event({type:'pod_ready',by:p.id,pod:p.pod});}
    }
   }
   if(alive.every(p=>p.destination&&p.pod&&p.deploymentState==='pod_ready')){this.deployment.stage='both_ready';this.deployment.elapsed=0;this.deployment.sequenceElapsed=0;this.deployment.teleported=false;this.deployment.landings=[];for(const p of alive){const landing=safeLandingPoint(p.destination,this.world,this.deployment.landings);if(!landing){this.deployment.stage='landing_selection';this.podOwners.clear();for(const player of alive){const pod=SHIP_PODS.find(value=>value.id===player.pod);player.pod=null;player.landingPosition=null;player.podProgress=0;player.entryStart=null;player.shipLocal=pod?[pod.x,0,pod.z+pod.entryOffset]:player.shipLocal;player.p=shipWorld(player.shipLocal);player.deploymentState='pod_available';player.dropState='pod_available';player.animationState='idle';}this.event({type:'landing_rejected',sequence:this.deployment.sequenceId});return;}this.deployment.landings.push(landing);p.landingPosition=landing;p.destination={x:landing.x,z:landing.z,y:landing.y};p.podYaw=p.yaw;p.deploymentState='both_ready';}this.event({type:'both_pods_ready',sequence:this.deployment.sequenceId});}
   return;
  }
  // Ship inputs must not leave a walking/airborne pose under the cinematic.
  for(const p of alive){p.moveSpeed=0;p.locomotionState='idle';p.grounded=true;p.vy=0;}
  const previousStage=this.deployment.stage;this.deployment.elapsed+=dt;this.deployment.sequenceElapsed=Math.max(0,this.deployment.elapsed-DEPLOYMENT_TIMELINE.readyBeat);this.deployment.stage=this.deployment.elapsed<DEPLOYMENT_TIMELINE.readyBeat?'both_ready':deploymentStageAt(this.deployment.sequenceElapsed);this.deployment.stageElapsed=this.deployment.elapsed;
  if(this.deployment.stage!==previousStage&&['pod_sealing','launching','transition','pod_opening','exiting','saluting'].includes(this.deployment.stage))this.event({type:'deployment_stage',stage:this.deployment.stage,sequence:this.deployment.sequenceId});
  if(!deploymentCinematic(this.deployment.sequenceElapsed).portrait){
   const {drop}=podShipLaunch(this.deployment.sequenceElapsed);
   for(const p of alive){const pod=SHIP_PODS.find(value=>value.id===p.pod);if(pod){p.p=shipWorld([pod.x,-drop,pod.z]);p.air=drop>0?'pod':'ship';}}
  }
  if(!this.deployment.teleported&&deploymentCinematic(this.deployment.sequenceElapsed).portrait){for(const p of alive){if(p.landingPosition){p.p=cinematicPodPosition(p.landingPosition,this.deployment.sequenceElapsed);p.air='pod';p.animationState='idle';}}}
  if(this.deployment.stage==='transition'){for(const p of alive){p.deploymentState='transition';p.dropState='transition';p.animationState='idle';}}
  if(this.deployment.sequenceElapsed>=DEPLOYMENT_TIMELINE.sealSeconds+DEPLOYMENT_TIMELINE.launchSeconds&&!this.deployment.teleported){this.deployment.teleported=true;for(const p of alive){const target=p.landingPosition;if(!target)continue;p.p=[target.x,target.y,target.z];p.exitPosition=[target.x,target.y,target.z];p.air='pod';p.deploymentState='landed';p.dropState='landed';p.animationState='idle';}this.event({type:'deployment_landed',sequence:this.deployment.sequenceId});}
  else if(this.deployment.stage==='landed'){for(const p of alive){p.deploymentState='landed';p.dropState='landed';p.air='pod';p.animationState='idle';}}
  if(this.deployment.stage==='pod_opening'){
   const elapsed=this.deployment.sequenceElapsed-DEPLOYMENT_TIMELINE.sealSeconds-DEPLOYMENT_TIMELINE.launchSeconds-DEPLOYMENT_TIMELINE.landedSeconds;
   const opening=clamp(elapsed/DEPLOYMENT_TIMELINE.openingSeconds,0,1);
   for(const p of alive){p.deploymentState='pod_opening';p.dropState='pod_opening';p.air='pod';p.animationState='idle';p.yaw=podExitYaw(p.podYaw??p.yaw,opening);}
  }
  if(this.deployment.stage==='exiting'){
   const exitElapsed=this.deployment.sequenceElapsed-DEPLOYMENT_TIMELINE.sealSeconds-DEPLOYMENT_TIMELINE.launchSeconds-DEPLOYMENT_TIMELINE.landedSeconds-DEPLOYMENT_TIMELINE.openingSeconds;
   const q=clamp(exitElapsed/DEPLOYMENT_TIMELINE.exitSeconds,0,1),ease=q*q*(3-2*q);
   for(const p of alive){
    p.deploymentState='exiting';p.dropState='exiting';p.animationState=p.locomotionState='pod-exit';p.moveSpeed=6*q*(1-q)*Math.hypot(.32,2.35)/DEPLOYMENT_TIMELINE.exitSeconds;p.air='pod';
    const start=p.exitPosition||p.p,pod=SHIP_PODS.find(value=>value.id===p.pod),offset=pod?.side||1;
    p.p=podExitPosition({x:start[0],y:start[1],z:start[2]},p.podYaw??0,offset,q,this.world.height);
    p.yaw=podExitYaw(p.podYaw??0);
    p.walk+=dt*3.6;p.saluteProgress=0;
   }
  }
  if(this.deployment.stage==='saluting'){
   const saluteElapsed=this.deployment.sequenceElapsed-DEPLOYMENT_TIMELINE.sealSeconds-DEPLOYMENT_TIMELINE.launchSeconds-DEPLOYMENT_TIMELINE.landedSeconds-DEPLOYMENT_TIMELINE.openingSeconds-DEPLOYMENT_TIMELINE.exitSeconds;
   const q=clamp(saluteElapsed/DEPLOYMENT_TIMELINE.saluteSeconds,0,1),up=clamp(q/.23,0,1),down=clamp((1-q)/.23,0,1);
   const amount=Math.min(up*up*(3-2*up),down*down*(3-2*down));
   for(const p of alive){
    p.deploymentState='saluting';p.dropState='saluting';p.animationState='idle';p.air='pod';
    const pod=SHIP_PODS.find(value=>value.id===p.pod),start=p.exitPosition||p.p,offset=pod?.side||1;
    p.p=podExitPosition({x:start[0],y:start[1],z:start[2]},p.podYaw??0,offset,1,this.world.height);
    p.yaw=podExitYaw(p.podYaw??0);p.saluteProgress=amount;
   }
  }
  if(this.deployment.stage==='match_active'){for(const p of alive){if(p.pod)this.podOwners.delete(p.pod);if(p.exitPosition){const pod=SHIP_PODS.find(value=>value.id===p.pod),offset=pod?.side||1;p.p=podExitPosition({x:p.exitPosition[0],y:p.exitPosition[1],z:p.exitPosition[2]},p.podYaw??0,offset,1,this.world.height);p.yaw=podExitYaw(p.podYaw??0);}p.p[1]=this.world.height(p.p[0],p.p[2]);p.air='landed';p.deploymentState='match_active';p.dropState='match_active';p.animationState='idle';p.slot=0;p.weapon=null;p.ammo=0;p.equip=.32;p.reload=0;p.aim=false;p.sliding=false;p.slideSpeed=0;p.slideTime=0;p.crouching=false;p.crouchRequested=false;p.saluteProgress=0;p.pod=null;}this.phase='playing';this.elapsed=0;this.timer=0;this.event({type:'match_active',sequence:this.deployment.sequenceId});}
 }
 checkRoundEnd(){
  if(!['playing','countdown'].includes(this.phase))return false;
  const alive=this.players.filter(p=>p.hp>0);if(alive.length>1)return false;
  this.winner=alive.length===1?this.players.indexOf(alive[0]):-1;if(this.winner>=0)this.scores[this.winner]++;
  this.phase=this.scores.some(n=>n>=this.targetScore)?'done':'roundover';this.timer=4;this.event({type:'round_end',winner:this.winner});return true;
 }
 reloadWeapon(p){
  if(!isWeaponSlot(p.slot)||p.reload>0||p.equip>0)return false;
  const profile=weaponForSlot(p.slot,p.inventory),state=inventoryWeapon(p.inventory,p.slot);
  if(!state||state.ammo>=profile.magazineCapacity)return false;
  p.reload=profile.reloadDuration;p.reloadWeapon=profile.id;p.reloadItem=state.id;p.cool=Math.max(p.cool,.12);
  this.event({type:'reload',by:p.id,weapon:profile.id,duration:profile.reloadDuration});return true;
 }
 cameraOrigin(p,i,profile){
  const desired=cameraAimOrigin(p,i,profile),anchor=[p.p[0],p.p[1]+2.15,p.p[2]],delta=desired.map((v,k)=>v-anchor[k]),distance=Math.hypot(...delta),direction=normalize(delta);let nearest=distance;
  for(const b of this.world.obstacles)nearest=Math.min(nearest,rayBox(anchor,direction,b));
  for(const structure of this.structures)nearest=Math.min(nearest,structure.type===2?rayBox(anchor,direction,bounds(structure)):rayRamp(anchor,direction,structure));
  for(let t=.4;t<nearest;t+=.5)if(anchor[1]+direction[1]*t<this.world.height(anchor[0]+direction[0]*t,anchor[2]+direction[2]*t)){nearest=t;break;}
  const eye=nearest<distance?anchor.map((v,k)=>v+direction[k]*Math.max(.16,nearest-.3)):desired;eye[1]=Math.max(eye[1],this.world.height(eye[0],eye[2])+.55);return eye;
 }
 traceShot(p,d,range,origin){
  const o=origin||[p.p[0],p.p[1]+1.7,p.p[2]];let nearest=range,target=null,structure=null;
  for(const b of this.world.obstacles){const t=rayBox(o,d,b);if(t<nearest)nearest=t;}
  for(let t=.5;t<nearest;t+=.5){if(o[1]+d[1]*t<this.world.height(o[0]+d[0]*t,o[2]+d[2]*t)){nearest=t;break;}}
  for(const b of this.structures){const t=b.type===2?rayBox(o,d,bounds(b)):rayRamp(o,d,b);if(t<nearest){nearest=t;structure=b;target=null;}}
  for(const other of this.players){
   if(other===p||other.hp<=0)continue;
   const t=rayBox(o,d,{min:[other.p[0]-.43,other.p[1],other.p[2]-.43],max:[other.p[0]+.43,other.p[1]+2.5,other.p[2]+.43]});
   if(t<nearest){nearest=t;target=other;structure=null;}
  }
  const end=o.map((v,k)=>v+d[k]*nearest);
  return {o,end,target,structure,critical:Boolean(target&&end[1]>target.p[1]+1.86)};
 }
 fireWeapon(p,i,moving){
  if(!isWeaponSlot(p.slot)||!inventoryWeapon(p.inventory,p.slot))return;
  const profile=weaponForSlot(p.slot,p.inventory),state=inventoryWeapon(p.inventory,p.slot);
  if(!state?.ammo){this.reloadWeapon(p);return;}
  state.ammo--;p.ammo=state.ammo;p.cool+=profile.fireInterval;p.sustained=Math.min(5,p.sustained+1);
  const spread=shotSpread(profile,{aim:i.aim,moving,sustained:p.sustained}),traces=[],traceHits=[],hitTotals=new Map(),structureHits=new Map(),camera=this.cameraOrigin(p,i,profile),muzzleZ=profile.id==='sniper'?-1.95:profile.id==='shotgun'?-1.72:-1.48,muzzle=[p.p[0]+.24*Math.cos(i.yaw)+muzzleZ*Math.sin(i.yaw),p.p[1]+1.59,p.p[2]-.24*Math.sin(i.yaw)+muzzleZ*Math.cos(i.yaw)];
  if(profile.projectile){
   const viewDirection=spreadDirection(i.aimYaw,i.aimPitch,spread),crosshairTrace=this.traceShot(p,viewDirection,profile.range,camera),toAim=crosshairTrace.end.map((v,k)=>v-muzzle[k]),muzzleDirection=normalize(toAim),projectileId=`${p.id}:${++this.projectileSequence}`;
   this.projectiles.push(createProjectile({id:projectileId,owner:p.id,origin:muzzle,direction:muzzleDirection,speed:profile.projectile.speed,gravity:profile.projectile.gravity,range:profile.range,damage:profile.damage,spawnTick:this.elapsed,maxAge:profile.projectile.maxAge}));
   this.event({type:'shot',by:p.id,weapon:profile.id,a:muzzle,b:crosshairTrace.end,traces:[crosshairTrace.end],hits:[],hit:null,damage:0,projectileId});
   return;
  }
  for(let pellet=0;pellet<profile.pellets;pellet++){
   const viewDirection=spreadDirection(i.aimYaw,i.aimPitch,spread),crosshairTrace=this.traceShot(p,viewDirection,profile.range,camera),toAim=crosshairTrace.end.map((v,k)=>v-muzzle[k]),aimDistance=Math.hypot(...toAim),muzzleDirection=normalize(toAim),trace=this.traceShot(p,muzzleDirection,Math.min(profile.range,aimDistance+.35),muzzle);traces.push(trace.end);traceHits.push(trace.target?.id||null);
   if(trace.target){const multiplier=trace.critical?1.65:1,damage=Math.round(profile.damage*multiplier),prior=hitTotals.get(trace.target)||{damage:0,critical:false};prior.damage+=damage;prior.critical||=trace.critical;hitTotals.set(trace.target,prior);}
   if(trace.structure)structureHits.set(trace.structure,(structureHits.get(trace.structure)||0)+profile.damage);
  }
  for(const [target,hit] of hitTotals){this.hit(target,hit.damage);if(target.hp<=0&&!target.eliminated){target.eliminated=true;this.event({type:'elimination',by:p.id,hit:target.id,weapon:profile.id});}}
  for(const [structure,damage] of structureHits){structure.hp-=damage;if(structure.hp<=0)this.structures=this.structures.filter(s=>s!==structure);}
  const hits=[...hitTotals].map(([target,hit])=>({id:target.id,...hit}));
  this.event({type:'shot',by:p.id,weapon:profile.id,a:muzzle,b:traces[0],traces,traceHits,hits,hit:hits[0]?.id||null,damage:hits.reduce((n,h)=>n+h.damage,0)});
 }
 tickProjectiles(dt){
  for(let index=this.projectiles.length-1;index>=0;index--){
   const projectile=advanceProjectile(this.projectiles[index],dt),from=projectile.previous,to=projectile.position;
   let nearest=Infinity,target=null,structure=null,terrain=false;
   for(const obstacle of this.world.obstacles||[]){const t=segmentAabbTime(from,to,obstacle.min,obstacle.max);if(t!==null&&t<nearest){nearest=t;target=null;structure=null;terrain=false;}}
   for(const candidate of this.structures){const box=candidate.type===2?bounds(candidate):{min:[candidate.x-2.5,candidate.y,candidate.z-2.5],max:[candidate.x+2.5,candidate.y+3.6,candidate.z+2.5]},t=candidate.type===2?segmentAabbTime(from,to,box.min,box.max):rayRamp(from,to.map((v,k)=>v-from[k]),candidate);if(t!==null&&t>=0&&t<=1&&t<nearest){nearest=t;target=null;structure=candidate;terrain=false;}}
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
 beginUse(p){return beginUse(p);}
 advanceUse(p,dt){return advanceUse(p,dt);}
 harvest(p,i){if(p.hp<=0||p.slot!==0||p.cool>0)return false;p.cool=LIMITS.harvestInterval;p.action='harvest';p.actionTime=.42;this.event({type:'harvest_swing',by:p.id});const node=aimedEntity(p,i,nearby(this.resourceGrid,p.p[0],p.p[2],LIMITS.harvest).filter(n=>(this.resourceHP.get(n.id)??n.hp??100)>0),LIMITS.harvest);if(!node||!this.visibleInteraction(p,node))return false;const hp=Math.max(0,(this.resourceHP.get(node.id)??node.hp??100)-LIMITS.harvestDamage);this.resourceHP.set(node.id,hp);p.materials[node.kind]=Math.min(LIMITS.material,p.materials[node.kind]+MATERIALS[node.kind].yield);this.event({type:'harvest',by:p.id,node:node.id,kind:node.kind,hp,point:[node.x,node.y+1,node.z]});return true;}
 visibleInteraction(p,e){const from=[p.p[0],p.p[1]+1.4,p.p[2]],target=[e.x,(e.y||0)+.9,e.z],delta=target.map((v,k)=>v-from[k]),distance=Math.hypot(...delta),direction=normalize(delta);return !(this.world.obstacles||[]).some(b=>rayBox(from,direction,b)<distance-.25)&&!this.structures.some(s=>(s.type===2?rayBox(from,direction,bounds(s)):rayRamp(from,direction,s))<distance-.25);}
 interact(p,i){if(p.hp<=0||p.air!=='landed')return false;const loot=aimedEntity(p,i,this.pickups,LIMITS.interaction);if(loot&&this.visibleInteraction(p,loot))return this.collect(p,loot.id);return false;}
 advanceChestInteraction(p,i,dt){if(!i.interact||p.hp<=0||p.air!=='landed'){p.chestHold=null;return;}const chest=aimedEntity(p,i,nearby(this.chestGrid,p.p[0],p.p[2],LIMITS.interaction).filter(c=>!this.openedChests.has(c.id)),LIMITS.interaction);if(!chest||!this.visibleInteraction(p,chest)||this.pickups.length>LIMITS.loot-3){p.chestHold=null;return;}if(p.chestHold?.id!==chest.id)p.chestHold={id:chest.id,elapsed:0,duration:3.5};p.chestHold.elapsed=Math.min(3.5,p.chestHold.elapsed+dt);if(p.chestHold.elapsed>=3.5-1e-7){this.openedChests.add(chest.id);this.pickups.push(...chestLoot(chest,this.round));this.event({type:'chest',by:p.id,chest:chest.id});p.chestHold=null;}}
 collect(p,id){const index=this.pickups.findIndex(e=>e.id===id);if(index<0||p.hp<=0)return false;const item=this.pickups[index];if(Math.hypot(item.x-p.p[0],item.z-p.p[2])>LIMITS.interaction||Math.abs((item.y||0)-p.p[1])>2.1||!this.visibleInteraction(p,item))return false;if(WEAPON_ORDER.includes(item.type)){const slot=p.inventory.indexOf(null);if(slot<0){this.event({type:'inventory_full',by:p.id});return false;}p.inventory[slot]=createWeaponItem(item.weaponId||`weapon:${this.round}:${++this.lootSequence}`,item.type,item.ammo??weaponForSlot(WEAPON_ORDER.indexOf(item.type)+1).magazineCapacity);p.inventoryRevision++;}else{const config=ITEMS[item.type];if(!config||p.items[item.type]+item.count>config.max)return false;p.items[item.type]+=item.count;}this.pickups.splice(index,1);this.event({type:'pickup',by:p.id,item:item.type});return true;}
 dropItem(p){if(this.pickups.length>=LIMITS.loot)return false;const weapon=inventoryWeapon(p.inventory,p.slot),id=weapon?.type||ITEM_SLOTS[p.slot],count=weapon?1:p.items[id];if(!id||!count)return false;this.pickups.push({id:`drop:${this.round}:${++this.lootSequence}`,weaponId:weapon?.id,type:id,count,ammo:weapon?.ammo,x:p.p[0]-Math.sin(p.yaw)*1.4,y:p.p[1],z:p.p[2]-Math.cos(p.yaw)*1.4});if(weapon){p.inventory[p.slot-1]=null;p.inventoryRevision++;}else p.items[id]=0;p.slot=0;p.weapon=null;p.reload=0;p.reloadItem=null;p.use=null;return true;}
 moveInventory(playerId,op){const p=this.players.find(p=>p.id===playerId),rejected={id:op?.id,accepted:false,revision:p?.inventoryRevision,inventory:p?cloneInventory(p.inventory):[],slot:p?.slot};if(!p||p.hp<=0||this.phase!=='playing'||typeof op?.id!=='string'||op.id.length>100||!Number.isSafeInteger(op.revision)||op.revision<0)return rejected;const known=p.inventoryAcks.find(a=>a.id===op.id);if(known)return {...known,revision:p.inventoryRevision,inventory:cloneInventory(p.inventory),slot:p.slot};const result=applyInventoryMove(p.inventory,op);const accepted=result.accepted&&op.revision===p.inventoryRevision;if(accepted){p.slot=movedSelection(p.inventory,result.inventory,p.slot);p.inventory=result.inventory;p.inventoryRevision++;p.input.slot=p.slot;p.weapon=weaponIdForSlot(p.slot,p.inventory);}const ack={id:op.id,accepted,revision:p.inventoryRevision};p.inventoryAcks.push(ack);if(p.inventoryAcks.length>64)p.inventoryAcks.shift();return {...ack,inventory:cloneInventory(p.inventory),slot:p.slot};}
 throwShockwave(p,i){if(!p.items.shockwave||this.grenades.length>=LIMITS.grenades)return false;p.items.shockwave--;p.action='throw';p.actionTime=.55;p.cool=.65;this.grenades.push(throwGrenade(p,i,`grenade:${this.round}:${++this.lootSequence}`));this.event({type:'throw',by:p.id});return true;}
 tickGrenades(dt){for(let k=this.grenades.length-1;k>=0;k--){const g=this.grenades[k];g.age+=dt;if(!g.landed){const before=g.position.slice();g.velocity[1]-=SHOCKWAVE.gravity*dt;const after=g.position.map((v,a)=>v+g.velocity[a]*dt);let hit=1;for(const box of this.world.obstacles||[]){const t=segmentAabbTime(before,after,box.min,box.max);if(t!==null)hit=Math.min(hit,t);}for(const s of this.structures){if(s.type===2){const b=bounds(s),t=segmentAabbTime(before,after,b.min,b.max);if(t!==null)hit=Math.min(hit,t);}else{const delta=after.map((v,a)=>v-before[a]),t=rayRamp(before,delta,s);if(t<=1)hit=Math.min(hit,t);}}g.position=before.map((v,a)=>v+(after[a]-v)*hit);const floor=this.world.height(g.position[0],g.position[2]);if(hit<1||g.position[1]<=floor+.1){g.position[1]=Math.max(g.position[1],floor+.1);g.landed=true;}}else g.trigger-=dt;if(g.trigger<=0||g.age>=SHOCKWAVE.maxAge){for(const p of this.players){if(p.hp<=0||p.air!=='landed'){p.chestHold=null;continue;}const impulse=shockwaveImpulse(g.position,p.p);if(!impulse.some(Boolean))continue;p.impulse=[impulse[0],impulse[2]];p.vy=impulse[1];p.shockwaveImmune=true;p.p[1]+=.12;}this.event({type:'shockwave',by:g.owner,point:g.position.slice()});this.grenades.splice(k,1);}}}
 tickGroundedPlayers(dt,advanceInput=true){
  if(!this.players.some(p=>p.hp>0&&p.air==='landed'))return;
  const buildWalls=this.structures.filter(s=>s.type===2).map(bounds);
  for(const p of this.players){
   if(p.hp<=0||p.air!=='landed'){p.chestHold=null;continue;}
   if(advanceInput)p.lastInput+=dt;const i=p.lastInput>INPUT_STALE_SECONDS?sanitize():p.input,edgeFire=i.fire&&!p.fireLatch,edgeReload=i.reloadRevision===undefined?i.reload&&!p.reloadLatch:i.reloadRevision>p.lastReloadRevision,edgeCrouch=i.crouchRevision===undefined?i.crouch&&!p.crouchLatch:i.crouchRevision>p.lastCrouchRevision&&(i.crouchRevision-p.lastCrouchRevision)%2===1;p.crouchLatch=i.crouch;if(i.reloadRevision!==undefined)p.lastReloadRevision=Math.max(p.lastReloadRevision,i.reloadRevision);if(i.crouchRevision!==undefined)p.lastCrouchRevision=Math.max(p.lastCrouchRevision,i.crouchRevision);
   const edgeInteract=i.interact&&!p.interactLatch,edgeDrop=i.drop&&!p.dropLatch;p.interactLatch=i.interact;p.dropLatch=i.drop;p.selectedMaterial=i.material;p.fireLatch=i.fire;p.reloadLatch=i.reload;p.actionTime=Math.max(0,p.actionTime-dt);p.cool=Math.max(-.05,p.cool-dt);p.equip=Math.max(0,p.equip-dt);p.sustained=Math.max(0,p.sustained-dt*3.4);
   if(i.slot!==p.slot&&(i.inventoryRevision===undefined||i.inventoryRevision===p.inventoryRevision)&&validSlot(i.slot)&&(!isWeaponSlot(i.slot)||inventoryWeapon(p.inventory,i.slot))){
    p.slot=i.slot;p.weapon=isWeaponSlot(i.slot)?weaponIdForSlot(i.slot,p.inventory):null;p.building=isBuildSlot(i.slot);p.reload=0;p.reloadWeapon=null;p.equip=isWeaponSlot(i.slot)?weaponForSlot(i.slot,p.inventory).equipDuration:.22;if(isWeaponSlot(i.slot))p.cool=Math.max(p.cool,p.equip*.45);this.event({type:'switch',by:p.id,slot:p.slot,weapon:p.weapon,building:p.building});
   }
   if(p.reload>0){p.reload=Math.max(0,p.reload-dt);if(!p.reload&&p.reloadWeapon){const state=p.inventory.find(w=>w?.id===p.reloadItem);if(state)state.ammo=weaponForSlot(p.inventory.indexOf(state)+1,p.inventory).magazineCapacity;p.reloadWeapon=null;p.reloadItem=null;}}
   if(edgeInteract)this.interact(p,i);this.advanceChestInteraction(p,i,dt);if(edgeDrop)this.dropItem(p);advanceUse(p,dt);
   if(edgeReload)this.reloadWeapon(p);p.yaw=i.yaw;p.pitch=i.pitch;p.aim=Boolean(i.aim&&isWeaponSlot(p.slot)&&!p.reload);
   const inputLength=Math.hypot(i.x,i.z),len=Math.max(1,inputLength),moveX=(Math.cos(i.yaw)*i.x-Math.sin(i.yaw)*i.z)/len,moveZ=(-Math.sin(i.yaw)*i.x-Math.cos(i.yaw)*i.z)/len,currentFloor=ground(p.p[0],p.p[2],p.p[1],this.structures,this.world,this.groundGrid),groundedNow=p.p[1]<=currentFloor+.08,ramps=this.structures.filter(s=>s.type===3).map(s=>rampHeight(s,p.p[0],p.p[2])),nearWalls=nearby(this.collisionGrid,p.p[0],p.p[2],1).concat(buildWalls);
   // Ctrl owns the slide; preserve its direction/run state even when releases share a network sample.
   const slideInput=i.crouchPress||i,slideLength=Math.hypot(slideInput.x,slideInput.z),slideNorm=Math.max(1,slideLength);
   if(!p.sliding&&slideLength>.05&&groundedNow&&edgeCrouch&&slideInput.sprint&&(p.sprinting||p.moveSpeed>7.5)){p.sliding=true;p.slideSpeed=Math.max(10.2,p.moveSpeed||0);p.slideTime=0;p.slideDir=[(Math.cos(slideInput.yaw)*slideInput.x-Math.sin(slideInput.yaw)*slideInput.z)/slideNorm,(-Math.sin(slideInput.yaw)*slideInput.x-Math.cos(slideInput.yaw)*slideInput.z)/slideNorm];p.crouching=true;p.crouchRequested=false;}if(!p.sliding&&edgeCrouch)p.crouchRequested=!p.crouchRequested;p.crouching=p.sliding||p.crouchRequested||(p.crouching&&!canStandAt(p.p,nearWalls,ramps));p.sprinting=Boolean(!p.sliding&&!p.crouching&&i.sprint&&inputLength>.05);
   const speed=(p.sliding?p.slideSpeed:p.crouching?3.5:i.sprint?10.2:6.8)*(p.aim?.58:1),dx=(p.sliding?p.slideDir[0]:moveX)*speed*dt+(p.impulse?.[0]||0)*dt,dz=(p.sliding?p.slideDir[1]:moveZ)*speed*dt+(p.impulse?.[1]||0)*dt;
   const walls=nearby(this.collisionGrid,p.p[0],p.p[2],3+Math.max(Math.abs(dx),Math.abs(dz))).concat(buildWalls),startX=p.p[0],startZ=p.p[2];moveHorizontal(p.p,dx,dz,walls,{crouching:p.crouching});p.p[0]=clamp(p.p[0],-ISLAND_LIMIT,ISLAND_LIMIT);p.p[2]=clamp(p.p[2],-ISLAND_LIMIT,ISLAND_LIMIT);
   // Include the ramp rise over this actual horizontal step, so a supported raised bottom remains climbable.
   const floor=ground(p.p[0],p.p[2],p.p[1],this.structures,this.world,this.groundGrid,.55+(groundedNow&&p.vy<=0&&!i.jump?Math.min(.4,Math.hypot(p.p[0]-startX,p.p[2]-startZ)*.72):0));if(i.jump&&!p.jumpLatch&&p.p[1]<=floor+.05){if(p.sliding){p.sliding=false;p.slideSpeed=0;p.crouching=false;p.crouchRequested=false;}p.vy=8.5;}p.jumpLatch=i.jump;p.vy-=22*dt;const nextY=p.p[1]+p.vy*dt,limitedY=upwardLimit(p.p,nextY,walls,{crouching:p.crouching,rampCeilings:this.structures.filter(s=>s.type===3).map(s=>rampHeight(s,p.p[0],p.p[2]))});if(limitedY<nextY)p.vy=0;p.p[1]=limitedY;if(p.p[1]<floor){const damage=resolveLanding(p,p.vy);if(damage)this.event({type:'fall_damage',by:p.id,damage});p.p[1]=floor;p.vy=0;}if(p.impulse){const decay=Math.exp(-dt*(p.p[1]<=floor+.05?9:1.4));p.impulse[0]*=decay;p.impulse[1]*=decay;}const moved=Math.hypot(p.p[0]-startX,p.p[2]-startZ);p.walk+=moved*1.4;p.moveSpeed=dt>0?moved/dt:0;p.grounded=p.p[1]<=floor+.08;if(p.sliding){p.slideTime+=dt;p.slideSpeed=Math.max(0,p.slideSpeed-5.2*dt);if(p.slideSpeed<=2.8||p.slideTime>=1.55){p.sliding=false;p.slideSpeed=0;p.crouching=!canStandAt(p.p,walls,this.structures.filter(s=>s.type===3).map(s=>rampHeight(s,p.p[0],p.p[2])));p.crouchRequested=false;}}p.locomotionState=p.animationState=p.p[1]>floor+.08?(p.vy>.45?'jump':'fall'):p.sliding?'slide':p.crouching?'crouch':moved>.008?p.sprinting?'run':'walk':'idle';
   if(i.fire&&p.cool<=0&&(isBuildSlot(p.slot)||p.equip<=0)){
    if(isBuildSlot(p.slot)){p.cool=.22;const b=placement(p,{...i,slot:p.slot},this.world,this.structures),material=MATERIALS[b.material];if(p.materials[b.material]>=material.cost&&validBuild(b,this.structures,this.players,this.world)){b.id=`build:${this.round}:${++this.lootSequence}`;this.structures.push(b);p.materials[b.material]-=material.cost;this.event({type:'build',by:p.id,structure:b});}}
    else if(p.slot===0)this.harvest(p,i);
    else if(p.slot===9&&edgeFire)this.throwShockwave(p,i);
    else if(ITEM_SLOTS[p.slot]&&edgeFire)beginUse(p);
    else if(isWeaponSlot(p.slot)){const profile=weaponForSlot(p.slot,p.inventory);if(!p.reload&&(profile.automatic||edgeFire))this.fireWeapon(p,i,Math.min(1,inputLength));}

   }
   if(i.firePulse){p.input.fire=false;p.input.firePulse=false;}
   p.weapon=isWeaponSlot(p.slot)&&inventoryWeapon(p.inventory,p.slot)?weaponIdForSlot(p.slot,p.inventory):null;p.material=p.materials.wood;if(p.actionTime>0)p.animationState=p.action||'harvest';else if(p.use)p.animationState='consume';p.building=isBuildSlot(p.slot);p.ammo=currentAmmo(p.inventory,p.slot);
  }
 }
 finishCombatTick(dt){
  this.tickProjectiles(dt);this.tickGrenades(dt);
  if(this.mode==='town'){
   const radius=Math.max(18,255-this.elapsed*.58);
   for(const p of this.players){
    if(p.hp<=0)continue;if(Math.hypot(p.p[0],p.p[2])>radius)this.hit(p,7*dt);if(p.air!=='landed')continue;

   }
  }
  for(const p of this.players)if(p.hp<=0&&!p.eliminated){p.eliminated=true;this.event({type:'elimination',by:null,hit:p.id,reason:'storm'});}this.checkRoundEnd();
 }
 tick(dt,{deploymentElapsed=null}={}){
  const wallStep=Number.isFinite(dt)?Math.max(0,dt):0;dt=clamp(wallStep,0,.05);if(this.phase==='done'||this.phase==='paused'||this.phase==='waiting')return;
  // Music and the sealed-pod script follow elapsed wall time even if a host
  // misses a timer callback. Walking, combat and physics retain the 50ms cap.
  if(this.phase==='deployment'){const scripted=['both_ready','pod_sealing','launching','transition','landed','pod_opening','exiting','saluting'].includes(this.deployment.stage);const step=scripted&&Number.isFinite(deploymentElapsed)?Math.max(0,deploymentElapsed-this.deployment.elapsed):scripted?wallStep:dt;this.tickDeployment(step);return;}
  if(this.phase==='countdown'||this.phase==='roundover'){this.timer-=dt;if(this.timer<=0){if(this.phase==='countdown')this.phase='playing';else this.startRound(false);}return;}
  this.elapsed+=dt;this.tickGroundedPlayers(dt);this.finishCombatTick(dt);
 }
 snapshot(){return {phase:this.phase,timer:this.timer,elapsed:this.elapsed,round:this.round,mode:this.mode,targetScore:this.targetScore,scores:this.scores,winner:this.winner,deployment:{...this.deployment,landings:this.deployment.landings?.map(point=>({...point}))||[]},ship:{...DEPLOYMENT_SHIP,origin:DEPLOYMENT_SHIP.origin.slice()},players:this.players.map(({input,lastInput,jumpLatch,interactLatch,crouchLatch,crouchRequested,lastCrouchRevision,lastReloadRevision,...p})=>({...p,inventory:cloneInventory(p.inventory),inventoryAcks:p.inventoryAcks.slice(-8).map(a=>({...a}))})),structures:this.structures,pickups:this.pickups,openedChests:[...this.openedChests],resourceHP:[...this.resourceHP],grenades:this.grenades.map(g=>({id:g.id,position:g.position.slice(),velocity:g.velocity.slice()})),projectiles:this.projectiles.map(({id,owner,position,velocity,spawnTick})=>({id,owner,position:position.slice(),velocity:velocity.slice(),spawnTick})),events:this.events};}
}
