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
