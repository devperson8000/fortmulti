import {DEPLOYMENT_CUES,MUSIC_START,POD_RELEASE,CINEMATIC_CAMERA_RADIUS,deploymentCinematic} from './deployment-cinematic.js';
export const DEPLOYMENT_STATES=Object.freeze([
 'ship_waiting','landing_selection','pod_available','entering_pod','pod_ready',
 'both_ready','pod_sealing','launching','transition','landed','pod_opening','exiting','match_active'
]);

export const DEPLOYMENT_TIMELINE=Object.freeze({
 enterSeconds:.92,
 sealSeconds:1.12,
 launchSeconds:MUSIC_START+DEPLOYMENT_CUES.impact-1.12,
 fadeAt:MUSIC_START+DEPLOYMENT_CUES.impact-1.12-.14,
 fadeSeconds:.42,
 landedSeconds:POD_RELEASE.hold,
 openingSeconds:POD_RELEASE.open,
 exitSeconds:POD_RELEASE.exit,
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
 return 'match_active';
}

export function deploymentPresentation(stage,elapsed){
 const time=DEPLOYMENT_TIMELINE,t=Math.max(0,Number(elapsed)||0);
 const launchStart=time.sealSeconds;
 const fade=['pod_sealing','launching','transition','landed','pod_opening','exiting'].includes(stage)?deploymentCinematic(t).black:0;
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
 for(let ring=1;ring<=9;ring++){const radius=ring*2.2,steps=Math.max(12,ring*8);for(let i=0;i<steps;i++){const angle=i/steps*Math.PI*2+.31;candidates.push([Math.cos(angle)*radius,Math.sin(angle)*radius]);}}
 for(const [dx,dz] of candidates){const x=requested.x+dx,z=requested.z+dz;if(Math.hypot(x,z)>292)continue;
  const y=Number(world.height(x,z));if(!Number.isFinite(y))continue;
  // Reserve the full portrait orbit at selection time. A .75m body clearance
  // lets a nearby car or wall force the camera inside the capsule on landing.
  const blocked=obstacles.some(box=>Math.hypot(Math.max(box.min[0]-x,0,x-box.max[0]),Math.max(box.min[2]-z,0,z-box.max[2]))<CINEMATIC_CAMERA_RADIUS+.25&&box.max[1]>y-.15);
  if(blocked||reserved.some(other=>other&&Math.hypot(x-other.x,z-other.z)<1.9))continue;
  return {x,z,y};
 }
 return null;
}
