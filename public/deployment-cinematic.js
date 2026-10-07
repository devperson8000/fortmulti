import {DEPLOYMENT_CUES} from './deployment-cues.js';
export {DEPLOYMENT_CUES};

// All song cues are relative to the edited track. The visuals and the host
// deployment stages use the same audible AudioContext timing.
export const MUSIC_START=1.12+.42;
export const CINEMATIC_CAMERA_RADIUS=4.1;
export const POD_RELEASE=Object.freeze({hold:.9,open:1.45,exit:2.15,salute:1.75});
export const POD_TOUCHDOWN=MUSIC_START+DEPLOYMENT_CUES.impact;
export const DEPLOYMENT_MUSIC_END=DEPLOYMENT_CUES.impact+Object.values(POD_RELEASE).reduce((a,b)=>a+b,0);
const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};

export function deploymentCinematic(sequenceTime){
 const musicTime=sequenceTime-MUSIC_START,c=DEPLOYMENT_CUES;
 // The mark hits at the first "uh, yeah", remains for the full ad-lib and
 // dissolves more gradually as the pod exterior returns to view.
 const logo=ease((musicTime-(c.uhYeahStart-.06))/.18)*(1-ease((musicTime-(c.lyricsStart+.35))/1.2));
 const orbit=ease((musicTime-c.lyricsStart-.12)/(c.businessStart-c.lyricsStart-.25));
 const black=ease((sequenceTime-(MUSIC_START-.42))/.42)*(1-ease((musicTime-c.lyricsStart-.6)/1));
 const impact=musicTime>=c.impact?Math.exp(-(musicTime-c.impact)*3.8):0;
 const returnProgress=ease((musicTime-(DEPLOYMENT_MUSIC_END-.52))/.52);
 return {
  musicTime,logo,black,orbit,impact,returnProgress,
  avatarOpacity:1-ease((returnProgress-.68)/.27),
  portrait:musicTime>=c.lyricsStart+.12,
  logoScale:1.045-.045*ease((musicTime-c.uhYeahStart)/.7)+.012*Math.sin((musicTime-c.uhYeahStart)*Math.PI*1.9)*logo
 };
}

export function cinematicPodPosition(landing,sequenceTime){
 const c=DEPLOYMENT_CUES;
 const progress=clamp((sequenceTime-MUSIC_START-c.lyricsStart-.12)/(c.impact-c.lyricsStart-.12));
 // Speed increases sharply during the final metres for a heavy beat-drop hit.
 return [landing.x,landing.y+80*Math.pow(1-progress,.58),landing.z];
}

export function cinematicFov(aspect=16/9){
 return Math.max(73*Math.PI/180,Math.min(86*Math.PI/180,2*Math.atan(1.52/(Math.max(.4,aspect)*(CINEMATIC_CAMERA_RADIUS-.95)))));
}

export function cinematicCamera(position,yaw,{orbit=0,impact=0,returnProgress=0,musicTime=-1}={}, {groundHeight,wallDistance,reducedMotion=false,subjectPosition=null,returnYaw=null}={}){
 const q=clamp(returnProgress),angle=-1.0+orbit*1.28,radius=CINEMATIC_CAMERA_RADIUS*(1-q);
 const actor=subjectPosition||position,heading=Number.isFinite(returnYaw)?returnYaw:yaw;
 const x=Math.sin(angle)*radius,z=Math.cos(angle)*radius;
 const preImpact=musicTime<DEPLOYMENT_CUES.impact?Math.pow(clamp(1-(DEPLOYMENT_CUES.impact-musicTime)/1.2),2)*.065:0;
 const rumble=reducedMotion?0:(impact*.23+preImpact);
 const jitter=[Math.sin(musicTime*87)*rumble,Math.sin(musicTime*107)*rumble*.65,Math.cos(musicTime*93)*rumble*.7];
 // Keep the tripod anchored in front of the capsule while the Soldier walks
 // out. Pan to the Soldier, then blend into their own first-person eye.
 const follow=ease((musicTime-(DEPLOYMENT_CUES.impact+POD_RELEASE.hold+POD_RELEASE.open)-.12)/(POD_RELEASE.exit*.75));
 const gaze=Math.max(q,follow*.98),delta=[actor[0]-position[0],actor[1]-position[1],actor[2]-position[2]];
 const eye=[position[0]+x*Math.cos(yaw)+z*Math.sin(yaw)+delta[0]*q+jitter[0],position[1]+1.95-.23*q+delta[1]*q+jitter[1],position[2]-x*Math.sin(yaw)+z*Math.cos(yaw)+delta[2]*q+jitter[2]];
 const targetBlend=ease((q-.35)/.65);
 const target=[position[0]+delta[0]*gaze-Math.sin(heading)*targetBlend*2,position[1]+1.34+delta[1]*gaze+(.38-Math.tan(.04)*2)*targetBlend,position[2]+delta[2]*gaze-Math.cos(heading)*targetBlend*2];
 if(wallDistance){
  const anchor=[position[0],position[1]+1.34,position[2]],delta=eye.map((v,k)=>v-anchor[k]),length=Math.hypot(...delta);
  if(length>.001){const direction=delta.map(v=>v/length),clearance=wallDistance(anchor,direction,length);
   if(clearance<length){const scale=Math.max(.35,clearance-.18)/length;for(let k=0;k<3;k++)eye[k]=anchor[k]+delta[k]*scale;}}
 }
 if(groundHeight)eye[1]=Math.max(eye[1],groundHeight(eye[0],eye[2])+.45);
 return {eye,target};
}

/** Terrain-aware path through the capsule's +Z hatch, rotated with the pod. */
export function podExitPosition(landing,podYaw=0,side=1,progress=0,groundHeight=()=>landing.y){
 const t=ease(progress),lateral=(side<0?-.32:.32)*t,forward=2.35*t;
 const x=landing.x+lateral*Math.cos(podYaw)+forward*Math.sin(podYaw);
 const z=landing.z-lateral*Math.sin(podYaw)+forward*Math.cos(podYaw);
 const h=Number(groundHeight(x,z)),y=Number.isFinite(h)?h:landing.y;
 return [x,y+.075*Math.sin(Math.PI*clamp(progress)),z];
}

/** Face the hatch during the hydraulic opening, not mid-stride. */
export function podExitYaw(podYaw=0,openingProgress=1){
 return podYaw+Math.PI*ease(openingProgress);
}
