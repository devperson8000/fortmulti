const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const STATES=Object.freeze(['idle','walk','run','jump','fall','crouch','pod-enter','pod-exit']);

export function resolveCharacterAnimation({grounded=true,speed=0,velocity=0,sprinting=false,crouching=false,deploymentState='',aiming=false,reloading=false,weapon=1}={}){
 const moveSpeed=Math.max(0,Number.isFinite(speed)?speed:0),vertical=Number.isFinite(velocity)?velocity:0;
 let state='idle';
 if(deploymentState==='entering_pod'||deploymentState==='exiting')state=deploymentState==='entering_pod'?'pod-enter':'pod-exit';
 else if(!grounded)state=vertical>.5?'jump':'fall';
 else if(crouching)state='crouch';
 else if(moveSpeed>.18)state=sprinting||moveSpeed>4.1?'run':'walk';
 return {state,speed:moveSpeed,grounded:Boolean(grounded),aiming:Boolean(aiming),reloading:Boolean(reloading),armed:Number(weapon)>0};
}

export function createAnimationBlend(state='idle'){
 const weights=Object.fromEntries(STATES.map(name=>[name,name===state?1:0]));
 return {state,weights};
}

function supportedState(state,supported){
 const has=name=>supported instanceof Set?supported.has(name):Array.isArray(supported)?supported.includes(name):Boolean(supported?.[name]);
 if(has(state))return state;
 const fallback=['run','crouch','pod-enter','pod-exit'].includes(state)?'walk':'idle';
 return has(fallback)?fallback:'idle';
}

export function stepAnimationBlend(previous,request,dt=.016,duration=.18){
 const supported=request?.supported||new Set(STATES),state=supportedState(request?.state||previous?.state||'idle',supported),step=clamp(Number(dt)||0,0,.1),time=Math.max(.04,Number(duration)||.18);
 const weights=Object.fromEntries(STATES.map(name=>[name,Math.max(0,Number(previous?.weights?.[name])||0)]));
 const blend=1-Math.exp(-step/(time*.34));
 for(const name of STATES)weights[name]+=(Number(name===state)-weights[name])*blend;
 const total=Object.values(weights).reduce((sum,value)=>sum+value,0)||1;
 for(const name of STATES)weights[name]/=total;
 return {state,weights};
}

export function characterLocomotion(player={}){
 const state=player.locomotionState||player.animationState||'idle';
 const speed=Number.isFinite(player.moveSpeed)?player.moveSpeed:state==='run'?5.4:state==='walk'?2.2:0;
 const grounded=typeof player.grounded==='boolean'?player.grounded:!['jump','fall'].includes(state);
 return resolveCharacterAnimation({grounded,speed,velocity:player.vy||0,sprinting:player.sprinting||state==='run',crouching:player.crouching,deploymentState:state==='pod-enter'?'entering_pod':state==='pod-exit'?'exiting':'',weapon:player.slot,aiming:player.aim,reloading:player.reload>0});
}
export function characterActionPose(player={}){
 const remaining=Math.max(0,Number(player.actionTime)||0),duration=player.action==='harvest'?.42:.55,progress=clamp(1-remaining/duration,0,1);
 const pulse=remaining>0?Math.sin(Math.PI*progress):0;
 const use=player.use,elapsed=use?clamp(1-use.remaining/use.duration,0,1):0;
 const ease=x=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
 return {swing:player.action==='harvest'?pulse:0,throw:player.action==='throw'?pulse:0,consume:use?ease(elapsed/.18)*ease((1-elapsed)/.16):0};
}
