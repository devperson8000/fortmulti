export const SKYSHIP_TIMELINE=Object.freeze({riseStart:3.2,riftStart:5.4,controlsAt:8.6,autoLaunchAt:32,launchSeconds:1.15});
export const AETHER_FLIGHT=Object.freeze({riftSpeed:8.2,wingSpeed:10.8,riftFall:8,wingFall:5.6,autoUnfurlClearance:39,foldBuffer:18,unfurlSeconds:.8,foldSeconds:.46,maxSpeed:13.5});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};

export function skyshipSequenceAt(elapsed){
 const t=Number.isFinite(elapsed)?Math.max(0,elapsed):0,{riseStart,riftStart,controlsAt,autoLaunchAt}=SKYSHIP_TIMELINE;
 const standBlend=smooth((t-riseStart)/Math.max(.01,riftStart-riseStart));
 const riftBlend=smooth((t-riftStart)/Math.max(.01,controlsAt-riftStart));
 const stage=t<riseStart?'seated':t<riftStart?'rising':t<controlsAt?'rift-opening':t<autoLaunchAt?'ready':'auto-launch';
 return {stage,standBlend,riftBlend,controls:t>=controlsAt,autoLaunch:t>=autoLaunchAt,remaining:Math.max(0,autoLaunchAt-t)};
}

export function canEnterRift(elapsed,localPosition){
 const sequence=skyshipSequenceAt(elapsed);
 return sequence.controls&&sequence.riftBlend>=.98&&Array.isArray(localPosition)&&localPosition.length>=3&&Math.abs(localPosition[0])<=1.75&&localPosition[2]<=-2.65;
}

export function shouldAutoUnfurl(clearance){return Number.isFinite(clearance)&&clearance<=AETHER_FLIGHT.autoUnfurlClearance;}

export function stepAetherFlight(velocity,input={},winged=false,dt=1/60){
 const step=clamp(Number.isFinite(dt)?dt:0,0,.05),yaw=Number.isFinite(input.yaw)?input.yaw:0,pitch=clamp(Number.isFinite(input.pitch)?input.pitch:0,-.8,.7);
 const x=clamp(Number.isFinite(input.x)?input.x:0,-1,1),z=clamp(Number.isFinite(input.z)?input.z:0,-1,1),length=Math.hypot(x,z),scale=1/Math.max(1,length);
 const dirX=length?(Math.cos(yaw)*x-Math.sin(yaw)*z)*scale:-Math.sin(yaw),dirZ=length?(-Math.sin(yaw)*x-Math.cos(yaw)*z)*scale:-Math.cos(yaw);
 const wingBlend=typeof winged==='number'?clamp(winged,0,1):winged?1:0,wingEase=wingBlend*wingBlend*(3-2*wingBlend),speed=Math.min(AETHER_FLIGHT.maxSpeed,(AETHER_FLIGHT.riftSpeed+(AETHER_FLIGHT.wingSpeed-AETHER_FLIGHT.riftSpeed)*wingEase)*(input.sprint?1.08:1));
 const fall=AETHER_FLIGHT.riftFall+(AETHER_FLIGHT.wingFall-AETHER_FLIGHT.riftFall)*wingEase,pitchResponse=1.8+(3.1-1.8)*wingEase,target=[dirX*speed,clamp(-fall+pitch*pitchResponse,-9.5,1.15),dirZ*speed],rate=3.5+(4.8-3.5)*wingEase,blend=1-Math.exp(-rate*step);
 const current=Array.isArray(velocity)&&velocity.length===3?velocity:[0,0,0];
 return current.map((value,index)=>clamp(value+(target[index]-value)*blend,index===1?-9.8:-AETHER_FLIGHT.maxSpeed,index===1?1.5:AETHER_FLIGHT.maxSpeed));
}
