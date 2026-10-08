import {DEPLOYMENT_CUES} from './deployment-cues.js';
import {DEPLOYMENT_LAUNCH} from './deployment-ship.js';
export {DEPLOYMENT_CUES};

// All song cues are relative to the edited track. The visuals and the host
// deployment stages use the same audible AudioContext timing.
export const MUSIC_START=DEPLOYMENT_LAUNCH.fadeStart+DEPLOYMENT_LAUNCH.fadeSeconds;
export const CINEMATIC_CAMERA_RADIUS=5.4;
// The complete exit and a clearly held two-finger salute fit the uninterrupted
// last seconds of the supplied 30-second song.
export const POD_RELEASE=Object.freeze({hold:.48,open:.66,exit:1.35,salute:1.85});
export const POD_TOUCHDOWN=MUSIC_START+DEPLOYMENT_CUES.impact;
export const DEPLOYMENT_MUSIC_END=DEPLOYMENT_CUES.impact+Object.values(POD_RELEASE).reduce((a,b)=>a+b,0);
// Let the complete salute read on camera at full volume. The last half-second
// blends back to gameplay as the gesture finishes, without changing the beat.
export const CINEMATIC_RETURN_SECONDS=.5;
export const DEPLOYMENT_AUDIO_FADE_SECONDS=.38;
const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};

export function deploymentCinematic(sequenceTime){
 const musicTime=sequenceTime-MUSIC_START,c=DEPLOYMENT_CUES;
 // The mark hits at the first "uh, yeah", remains for the full ad-lib and
 // dissolves more gradually as the pod exterior returns to view.
 const logo=ease((musicTime-c.uhYeahStart)/.36)*(1-ease((musicTime-(c.lyricsStart-.16))/.84));
 const orbit=ease((musicTime-c.lyricsStart-.12)/(c.businessStart-c.lyricsStart-.25));
 const black=ease((sequenceTime-DEPLOYMENT_LAUNCH.fadeStart)/DEPLOYMENT_LAUNCH.fadeSeconds)*(1-ease((musicTime-c.lyricsStart-.25)/.85));
 const impact=musicTime>=c.impact?Math.exp(-(musicTime-c.impact)*3.8):0;
 const hatchOpen=clamp((musicTime-c.impact-POD_RELEASE.hold)/POD_RELEASE.open);
 const returnProgress=ease((musicTime-(DEPLOYMENT_MUSIC_END-CINEMATIC_RETURN_SECONDS))/CINEMATIC_RETURN_SECONDS);
 const avatarOpacity=1-ease((returnProgress-.68)/.27);
 return {
  musicTime,logo,black,orbit,impact,returnProgress,
  avatarOpacity,hatchOpen,operatorOpacity:ease((hatchOpen-.08)/.22)*avatarOpacity,
  portrait:musicTime>=c.lyricsStart+.12,
  logoScale:1.045-.045*ease((musicTime-c.uhYeahStart)/.7)+.012*Math.sin((musicTime-c.uhYeahStart)*Math.PI*1.9)*logo
 };
}

export function cinematicPodPosition(landing,sequenceTime){
 const c=DEPLOYMENT_CUES;
 const progress=clamp((sequenceTime-MUSIC_START-c.lyricsStart-.12)/(c.impact-c.lyricsStart-.12));
 // Speed increases sharply during the final metres for a heavy beat-drop hit.
 return [landing.x,landing.y+80*(1-progress**3),landing.z];
}

export function cinematicFov(aspect=16/9){
 return Math.max(73*Math.PI/180,Math.min(86*Math.PI/180,2*Math.atan(2.25/(Math.max(.4,aspect)*(CINEMATIC_CAMERA_RADIUS-.95)))));
}

export function cinematicCamera(position,yaw,{orbit=0,impact=0,returnProgress=0,musicTime=-1}={}, {groundHeight,wallDistance,reducedMotion=false,subjectPosition=null,returnYaw=null}={}){
 const q=clamp(returnProgress),angle=-1.0+orbit*1.28,radius=CINEMATIC_CAMERA_RADIUS*(1-q);
 const actor=subjectPosition||position,heading=Number.isFinite(returnYaw)?returnYaw:yaw;
 const x=Math.sin(angle)*radius,z=Math.cos(angle)*radius;
 const preImpact=musicTime<DEPLOYMENT_CUES.impact?Math.pow(clamp(1-(DEPLOYMENT_CUES.impact-musicTime)/1.2),2)*.065:0;
 const age=Math.max(0,musicTime-DEPLOYMENT_CUES.impact),hit=musicTime>=DEPLOYMENT_CUES.impact&&age<1&&!reducedMotion?Math.exp(-age*5.5):0;
 const rumble=reducedMotion?0:preImpact;
 // A downward punch on the exact hit, then phase-anchored vibration. Using
 // the song's absolute phase made the first impact frame arbitrarily jump up.
 const jitter=[Math.sin(age*77)*hit*.23+Math.sin(musicTime*87)*rumble,
  hit*(-.26*Math.exp(-age*9)+Math.sin(age*95)*.16)+Math.sin(musicTime*107)*rumble*.65,
  Math.sin(age*83)*hit*.16+Math.cos(musicTime*93)*rumble*.7];
 // Keep the tripod anchored in front of the capsule while the Soldier walks
 // out. Pan to the Soldier, then blend into their own first-person eye.
 const follow=ease((musicTime-(DEPLOYMENT_CUES.impact+POD_RELEASE.hold+POD_RELEASE.open)-.12)/(POD_RELEASE.exit*.75));
 const gaze=Math.max(q,follow*.98),delta=[actor[0]-position[0],actor[1]-position[1],actor[2]-position[2]];
 const eye=[position[0]+x*Math.cos(yaw)+z*Math.sin(yaw)+delta[0]*q+jitter[0],position[1]+2.25-.53*q+delta[1]*q+jitter[1],position[2]-x*Math.sin(yaw)+z*Math.cos(yaw)+delta[2]*q+jitter[2]];
 const targetBlend=ease((q-.35)/.65);
 const focusHeight=1.84-.8*follow;
 const target=[position[0]+delta[0]*gaze-Math.sin(heading)*targetBlend*2,position[1]+focusHeight+delta[1]*gaze+(1.72-focusHeight-Math.tan(.04)*2)*targetBlend,position[2]+delta[2]*gaze-Math.cos(heading)*targetBlend*2];
 if(wallDistance){
  const anchor=[position[0],position[1]+1.34,position[2]],delta=eye.map((v,k)=>v-anchor[k]),length=Math.hypot(...delta);
  if(length>.001){const direction=delta.map(v=>v/length),clearance=wallDistance(anchor,direction,length);
   if(clearance<length){const scale=Math.max(.35,clearance-.18)/length;for(let k=0;k<3;k++)eye[k]=anchor[k]+delta[k]*scale;}}
 }
 if(groundHeight)eye[1]=Math.max(eye[1],groundHeight(eye[0],eye[2])+.45);
 return {eye,target};
}

/** One finite, quality-budgeted burst; chunks are retained even on low. */
export function podLandingBurst(point,budget=80,random=Math.random){
 if(!point)return [];
 const count=Math.max(0,Math.min(144,Math.floor(Number(budget)||0))),chunks=Math.min(count,Math.max(8,Math.round(count*.2))),effects=[];
 for(let n=0;n<count;n++){
  const debris=n<chunks,angle=n*2.399963+random()*.15,spread=.9+random()*.5,radial=debris?5+random()*8:4+random()*10;
  const life=debris?1.45+random()*.65:1.5+random()*.8;
  effects.push({kind:debris?'pod-debris':'pod-dust',p:[point.x+Math.cos(angle)*spread,point.y+.12+random()*.18,point.z+Math.sin(angle)*spread],
   v:[Math.cos(angle)*radial,debris?8+random()*8:1.7+random()*4.3,Math.sin(angle)*radial],life,maxLife:life,
   col:debris?[.47,.39,.28]:[.69,.64,.49],radius:debris?.08+random()*.13:.16+random()*.2,gravity:debris?24:1.8});
 }
 return effects;
}

export function stepPodLandingParticle(effect,dt,groundHeight){
 const drag=Math.exp(-dt*(effect.kind==='pod-debris'?.65:2.15));
 effect.v[0]*=drag;effect.v[2]*=drag;effect.v[1]-=dt*effect.gravity;
 for(let k=0;k<3;k++)effect.p[k]+=effect.v[k]*dt;
 const floor=groundHeight(effect.p[0],effect.p[2])+.025;
 if(effect.p[1]<floor){effect.p[1]=floor;effect.v[1]=effect.kind==='pod-debris'&&effect.v[1]<-1?-effect.v[1]*.22:0;effect.v[0]*=.5;effect.v[2]*=.5;}
}

export function podLandingParticleSize(effect){
 const remaining=clamp(effect.life/effect.maxLife),age=1-remaining;
 return effect.radius*(effect.kind==='pod-dust'?1+1.5*ease(age/.32):1)*ease(remaining/.42);
}

/** Short landing-gear compression; fully settled before opening the hatch. */
export function podImpactOffset(age){
 if(age<0||age>=POD_RELEASE.hold)return 0;
 return Math.exp(-age*8)*(-.18*Math.sin(Math.min(1,age/.055)*Math.PI/2)+.1*Math.sin(age*21));
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
