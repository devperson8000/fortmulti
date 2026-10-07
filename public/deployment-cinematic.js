import {DEPLOYMENT_CUES} from './deployment-cues.js';
export {DEPLOYMENT_CUES};

// Door seal (1.12s) then a 420ms blackout. Cue times are in the edited MP3,
// which preserves every original musical onset after the opening word splice.
export const MUSIC_START=1.12+.42;
const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};

export function deploymentCinematic(sequenceTime){
 const musicTime=sequenceTime-MUSIC_START,c=DEPLOYMENT_CUES;
 const logo=ease((musicTime-c.uhYeahStart)/.32)*(1-ease((musicTime-c.lyricsStart)/.55));
 const orbit=ease((musicTime-c.lyricsStart-.15)/(c.businessStart-c.lyricsStart-.3));
 const black=ease((sequenceTime-(MUSIC_START-.42))/.42)*(1-ease((musicTime-c.lyricsStart-.65)/.85));
 const impact=musicTime>=c.impact?Math.exp(-(musicTime-c.impact)*11):0;
 return {musicTime,logo,black,orbit,impact,portrait:musicTime>=c.lyricsStart+.15,logoScale:1.04-.04*ease((musicTime-c.uhYeahStart)/1.2)};
}

export function cinematicPodPosition(landing,sequenceTime){
 const c=DEPLOYMENT_CUES,progress=clamp((sequenceTime-MUSIC_START-c.lyricsStart-.15)/(c.impact-c.lyricsStart-.15));
 return [landing.x,landing.y+72*(1-progress**1.7),landing.z];
}

export function cinematicCamera(position,yaw,{orbit=0,impact=0}={}){
 const angle=Math.PI*(1-orbit),radius=2.55,x=Math.sin(angle)*radius,z=-Math.cos(angle)*radius;
 return {eye:[position[0]+x*Math.cos(yaw)+z*Math.sin(yaw),position[1]+1.34+impact*.055,position[2]-x*Math.sin(yaw)+z*Math.cos(yaw)],target:[position[0],position[1]+1.14-impact*.035,position[2]]};
}
