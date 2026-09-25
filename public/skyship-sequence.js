export const SKYSHIP_TIMELINE=Object.freeze({riseStart:2.8,hatchStart:5.4,hatchSeconds:2.8,controlsAt:8.2,autoLaunchAt:32,launchSeconds:1.15});
export const ARCADE_FLIGHT=Object.freeze({launchSpeed:8.2,gliderSpeed:10.8,launchFall:8,gliderFall:5.6,autoOpenClearance:39,foldBuffer:18,openSeconds:.8,foldSeconds:.46,maxSpeed:13.5});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};

export function skyshipSequenceAt(elapsed){
 const t=Number.isFinite(elapsed)?Math.max(0,elapsed):0,{riseStart,hatchStart,hatchSeconds,controlsAt,autoLaunchAt}=SKYSHIP_TIMELINE;
 const standBlend=smooth((t-riseStart)/Math.max(.01,hatchStart-riseStart));
 const hatchBlend=smooth((t-hatchStart)/Math.max(.01,hatchSeconds));
 const rearLookBlend=standBlend*(1-smooth((t-controlsAt)/1.05));
 const stage=t<riseStart?'seated':t<hatchStart?'rising':t<controlsAt?'hatch-opening':t<autoLaunchAt?'ready':'arcade-launch';
 return {stage,standBlend,hatchBlend,rearLookBlend,controls:t>=controlsAt,autoLaunch:t>=autoLaunchAt,remaining:Math.max(0,autoLaunchAt-t)};
}

export function canExitCabin(elapsed,localPosition){
 const sequence=skyshipSequenceAt(elapsed);
 return sequence.controls&&sequence.hatchBlend>=.999&&Array.isArray(localPosition)&&localPosition.length>=3&&Math.abs(localPosition[0])<=1.55&&localPosition[2]>=4.6;
}

export function shouldOpenGlider(clearance){return Number.isFinite(clearance)&&clearance<=ARCADE_FLIGHT.autoOpenClearance;}

export function stepArcadeGlide(velocity,input={},glider=0,dt=1/60){
 const step=clamp(Number.isFinite(dt)?dt:0,0,.05),yaw=Number.isFinite(input.yaw)?input.yaw:0,pitch=clamp(Number.isFinite(input.pitch)?input.pitch:0,-.8,.7);
 const x=clamp(Number.isFinite(input.x)?input.x:0,-1,1),z=clamp(Number.isFinite(input.z)?input.z:0,-1,1),length=Math.hypot(x,z),scale=1/Math.max(1,length);
 const dirX=length?(Math.cos(yaw)*x-Math.sin(yaw)*z)*scale:-Math.sin(yaw),dirZ=length?(-Math.sin(yaw)*x-Math.cos(yaw)*z)*scale:-Math.cos(yaw);
 const gliderBlend=typeof glider==='number'?clamp(glider,0,1):glider?1:0,ease=gliderBlend*gliderBlend*(3-2*gliderBlend),speed=Math.min(ARCADE_FLIGHT.maxSpeed,(ARCADE_FLIGHT.launchSpeed+(ARCADE_FLIGHT.gliderSpeed-ARCADE_FLIGHT.launchSpeed)*ease)*(input.sprint?1.08:1));
 const fall=ARCADE_FLIGHT.launchFall+(ARCADE_FLIGHT.gliderFall-ARCADE_FLIGHT.launchFall)*ease,pitchResponse=1.8+(3.1-1.8)*ease,target=[dirX*speed,clamp(-fall+pitch*pitchResponse,-9.5,1.15),dirZ*speed],rate=3.5+(4.8-3.5)*ease,blend=1-Math.exp(-rate*step);
 const current=Array.isArray(velocity)&&velocity.length===3?velocity:[0,0,0];
 return current.map((value,index)=>clamp(value+(target[index]-value)*blend,index===1?-9.8:-ARCADE_FLIGHT.maxSpeed,index===1?1.5:ARCADE_FLIGHT.maxSpeed));
}
