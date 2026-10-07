import {DEPLOYMENT_CUES} from './deployment-cues.js';
export {DEPLOYMENT_CUES};

// Door seal (1.12s) then a 420ms blackout. Cue times are in the edited MP3,
// which preserves every original musical onset after the opening word splice.
export const MUSIC_START=1.12+.42;
export const CINEMATIC_CAMERA_RADIUS=3.2;
export const POD_RELEASE=Object.freeze({hold:.24,open:1.18,exit:.9});
const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};

export function deploymentCinematic(sequenceTime){
 const musicTime=sequenceTime-MUSIC_START,c=DEPLOYMENT_CUES;
 const logo=ease((musicTime-c.uhYeahStart)/.32)*(1-ease((musicTime-c.lyricsStart)/.55));
 const orbit=ease((musicTime-c.lyricsStart-.15)/(c.businessStart-c.lyricsStart-.3));
 const black=ease((sequenceTime-(MUSIC_START-.42))/.42)*(1-ease((musicTime-c.lyricsStart-.65)/.85));
 const impact=musicTime>=c.impact?Math.exp(-(musicTime-c.impact)*11):0;
 const returnProgress=ease((musicTime-c.impact-POD_RELEASE.hold-POD_RELEASE.open)/POD_RELEASE.exit);
 return {musicTime,logo,black,orbit,impact,returnProgress,avatarOpacity:1-ease((returnProgress-.55)/.3),portrait:musicTime>=c.lyricsStart+.15,logoScale:1.04-.04*ease((musicTime-c.uhYeahStart)/1.2)};
}

export function cinematicPodPosition(landing,sequenceTime){
 const c=DEPLOYMENT_CUES,progress=clamp((sequenceTime-MUSIC_START-c.lyricsStart-.15)/(c.impact-c.lyricsStart-.15));
 return [landing.x,landing.y+72*(1-progress**1.7),landing.z];
}

export function cinematicFov(aspect=16/9){
 return Math.max(73*Math.PI/180,Math.min(86*Math.PI/180,2*Math.atan(1.2/(Math.max(.4,aspect)*(CINEMATIC_CAMERA_RADIUS-.95)))));
}

export function cinematicCamera(position,yaw,{orbit=0,impact=0,returnProgress=0}={}, {groundHeight,wallDistance}={}){
 const q=clamp(returnProgress),angle=Math.PI*(1-orbit)+Math.PI*q,radius=CINEMATIC_CAMERA_RADIUS*(1-q),x=Math.sin(angle)*radius,z=-Math.cos(angle)*radius;
 const eye=[position[0]+x*Math.cos(yaw)+z*Math.sin(yaw),position[1]+1.34+.38*q+impact*.055,position[2]-x*Math.sin(yaw)+z*Math.cos(yaw)];
 const targetBlend=ease((q-.65)/.35),target=[position[0]-Math.sin(yaw)*Math.cos(.04)*targetBlend,position[1]+1.14+(.58-Math.sin(.04))*targetBlend-impact*.035,position[2]-Math.cos(yaw)*Math.cos(.04)*targetBlend];
 if(wallDistance){const anchor=[position[0],position[1]+1.34,position[2]],delta=eye.map((v,k)=>v-anchor[k]),length=Math.hypot(...delta);if(length>.001){const direction=delta.map(v=>v/length),clearance=wallDistance(anchor,direction,length);if(clearance<length){const scale=Math.max(.35,clearance-.18)/length;for(let k=0;k<3;k++)eye[k]=anchor[k]+delta[k]*scale;}}}
 if(groundHeight)eye[1]=Math.max(eye[1],groundHeight(eye[0],eye[2])+.35);
 return {eye,target};
}
