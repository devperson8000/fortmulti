import {DEPLOYMENT_CUES,MUSIC_START,POD_RELEASE,CINEMATIC_CAMERA_RADIUS,deploymentCinematic,podExitPosition,podExitYaw} from './deployment-cinematic.js';
import {DEPLOYMENT_LAUNCH} from './deployment-ship.js';
export const DEPLOYMENT_STATES=Object.freeze([
 'ship_waiting','landing_selection','pod_available','entering_pod','pod_ready',
 'both_ready','pod_sealing','launching','transition','landed','pod_opening','exiting','saluting','match_active'
]);

export const DEPLOYMENT_TIMELINE=Object.freeze({
 enterSeconds:.92,
 sealSeconds:DEPLOYMENT_LAUNCH.seal,
 launchSeconds:MUSIC_START+DEPLOYMENT_CUES.impact-DEPLOYMENT_LAUNCH.seal,
 fadeAt:DEPLOYMENT_LAUNCH.fadeStart-DEPLOYMENT_LAUNCH.seal,
 fadeSeconds:DEPLOYMENT_LAUNCH.fadeSeconds,
 landedSeconds:POD_RELEASE.hold,
 openingSeconds:POD_RELEASE.open,
 exitSeconds:POD_RELEASE.exit,
 saluteSeconds:POD_RELEASE.salute,
 readyBeat:.42
});

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};

export function createDeploymentClock(){return {sequenceId:'',serverElapsed:0,elapsed:0};}
export function stepDeploymentClock(previous,{sequenceId='',serverElapsed=0,active=false}={},dt=.016){
 const state=previous||createDeploymentClock(),server=Number.isFinite(serverElapsed)?Math.max(0,serverElapsed):0,step=clamp(Number(dt)||0,0,.1);
 if(sequenceId&&sequenceId!==state.sequenceId)return {sequenceId,serverElapsed:server,elapsed:server+(active?step:0)};
 state.sequenceId=sequenceId||state.sequenceId;state.elapsed=Math.max(state.elapsed,server)+(active?step:0);state.serverElapsed=server;return state;
}

export function deploymentStageAt(elapsed){
 const t=Math.max(0,Number.isFinite(elapsed)?elapsed:0),time=DEPLOYMENT_TIMELINE;
 if(t<time.sealSeconds)return 'pod_sealing';
 if(t<time.sealSeconds+time.fadeAt)return 'launching';
 if(t<time.sealSeconds+time.launchSeconds)return 'transition';
 if(t<time.sealSeconds+time.launchSeconds+time.landedSeconds)return 'landed';
 if(t<time.sealSeconds+time.launchSeconds+time.landedSeconds+time.openingSeconds)return 'pod_opening';
 if(t<time.sealSeconds+time.launchSeconds+time.landedSeconds+time.openingSeconds+time.exitSeconds)return 'exiting';
 if(t<time.sealSeconds+time.launchSeconds+time.landedSeconds+time.openingSeconds+time.exitSeconds+time.saluteSeconds)return 'saluting';
 return 'match_active';
}

// Drives all clients' cinematic avatars from one monotonic song-relative
// timestamp, rather than stepping the exit forward only when a snapshot lands.
// The authoritative Match uses the same geometry and heading helpers.
export function deploymentActorPose(landing,podYaw=0,side=1,sequenceElapsed=0,groundHeight=()=>landing.y){
 if(!landing||!Number.isFinite(landing.x)||!Number.isFinite(landing.y)||!Number.isFinite(landing.z))return null;
 const time=DEPLOYMENT_TIMELINE,t=Math.max(0,Number(sequenceElapsed)||0);
 const openingAt=time.sealSeconds+time.launchSeconds+time.landedSeconds;
 const exitingAt=openingAt+time.openingSeconds;
 const salutingAt=exitingAt+time.exitSeconds;
 const combatAt=salutingAt+time.saluteSeconds;
 if(t<openingAt||t>=combatAt)return null;
 const opening=clamp((t-openingAt)/time.openingSeconds,0,1);
 const progress=clamp((t-exitingAt)/time.exitSeconds,0,1);
 const salute=(t-salutingAt)/time.saluteSeconds;
 const raised=smooth(salute/.23),lowered=smooth((1-salute)/.23);
 const animationState=t<exitingAt?'idle':t<salutingAt?'pod-exit':'idle';
 return {
  position:podExitPosition(landing,podYaw,side,progress,groundHeight),
  yaw:podExitYaw(podYaw,opening),
  animationState,locomotionState:animationState,grounded:true,vy:0,
  moveSpeed:t>=exitingAt&&t<salutingAt?6*progress*(1-progress)*Math.hypot(.32,2.35)/time.exitSeconds:0,
  saluteProgress:t<salutingAt?0:Math.min(raised,lowered),
  exitProgress:progress
 };
}

export function deploymentPresentation(stage,elapsed){
 const time=DEPLOYMENT_TIMELINE,t=Math.max(0,Number(elapsed)||0);
 const launchStart=time.sealSeconds;
 const fade=['pod_sealing','launching','transition','landed','pod_opening','exiting','saluting'].includes(stage)?deploymentCinematic(t).black:0;
 const launchProgress=clamp((t-launchStart)/time.launchSeconds,0,1);
 return {fade,launchProgress,stage,insidePod:['entering_pod','pod_ready','both_ready','pod_sealing','launching','transition','landed','pod_opening'].includes(stage)};
}

const pointFrom=value=>{
 if(!value)return null;
 const x=Array.isArray(value)?Number(value[0]):Number(value.x),z=Array.isArray(value)?Number(value[1]??value[2]):Number(value.z);
 if(!Number.isFinite(x)||!Number.isFinite(z))return null;
 return {x:clamp(x,-292,292),z:clamp(z,-292,292)};
};

export function safeLandingPoint(destination,world,reserved=[]){
 const requested=pointFrom(destination);if(!requested||!world||typeof world.height!=='function')return null;
 const obstacles=Array.isArray(world.obstacles)?world.obstacles:[];
 const candidates=[[0,0]];
 for(let ring=1;ring<=12;ring++){const radius=ring*2.2,steps=Math.max(12,ring*8);for(let i=0;i<steps;i++){const angle=i/steps*Math.PI*2+.31;candidates.push([Math.cos(angle)*radius,Math.sin(angle)*radius]);}}
 for(const [dx,dz] of candidates){const x=requested.x+dx,z=requested.z+dz;if(Math.hypot(x,z)>292)continue;
  const y=Number(world.height(x,z));if(!Number.isFinite(y))continue;
  // Reserve the full portrait orbit at selection time. A .75m body clearance
  // lets a nearby car or wall force the camera inside the capsule on landing.
  const blocked=obstacles.some(box=>Math.hypot(Math.max(box.min[0]-x,0,x-box.max[0]),Math.max(box.min[2]-z,0,z-box.max[2]))<CINEMATIC_CAMERA_RADIUS+.45&&box.max[1]>y-.15);
  // A landing reserves a full capsule AND its exterior camera orbit.
  // Two operators choosing the same spot must not spawn intersecting pods
  // or place one capsule inside the other player's cinematic camera.
  const minimumSpacing=CINEMATIC_CAMERA_RADIUS*2+1.2;
  if(blocked||reserved.some(other=>other&&Math.hypot(x-other.x,z-other.z)<minimumSpacing))continue;
  // A 3.8m high rigid capsule sinks into steep terrain unless its entire
  // footprint is near the landing height; an exit hatch needs firm ground.
  const footprint=[y];
  for(let i=0;i<8;i++){const angle=i*Math.PI/4,groundY=Number(world.height(x+Math.cos(angle)*1.22,z+Math.sin(angle)*1.22));footprint.push(groundY);}
  if(!footprint.every(Number.isFinite)||Math.max(...footprint)-Math.min(...footprint)>.78)continue;
  return {x,z,y};
 }
 return null;
}
