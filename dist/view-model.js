const damp=(from,to,speed,dt)=>from+(to-from)*(1-Math.exp(-speed*Math.min(.1,Math.max(0,dt))));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function createViewModelState(){
 return {position:[0,0,0],rotation:[0,0,0],recoil:0,swayX:0,swayY:0,bobPhase:0,stage:'idle'};
}

export function reloadStage(profile,remaining){
 if(!(remaining>0))return 'idle';
 const progress=1-remaining/profile.reloadDuration;
 if(progress<.16)return 'release';
 if(progress<.38)return 'eject';
 if(progress<.7)return 'insert';
 if(progress<.9)return 'action';
 return 'settle';
}

export function stepViewModel(state,input,dt){
 const profile=input.weapon,p=profile.presentation,step=Math.min(.1,Math.max(0,Number(dt)||0));
 state.recoil=clamp(state.recoil+Math.max(0,input.shotImpulse||0),0,1);
 state.recoil=damp(state.recoil,0,11,step);
 state.swayX=damp(state.swayX,clamp(input.mouseX||0,-24,24)*p.sway*.01,10,step);
 state.swayY=damp(state.swayY,clamp(input.mouseY||0,-24,24)*p.sway*.01,10,step);
 state.bobPhase+=(input.moving||0)*step*9;
 state.stage=reloadStage(profile,input.reloading||0);
 const anchor=input.aiming?p.adsAnchor:p.anchor,bob=Math.sin(state.bobPhase)*p.bob*(input.moving||0),sprint=input.sprinting?1:0,equip=clamp((input.equipRemaining||0)/profile.equipDuration,0,1);
 state.position[0]=damp(state.position[0],anchor[0]+state.swayX+p.sprint[0]*sprint,16,step);
 state.position[1]=damp(state.position[1],anchor[1]+bob+p.sprint[1]*sprint-.48*equip,16,step);
 state.position[2]=damp(state.position[2],anchor[2]+p.recoil[0]*state.recoil+p.sprint[2]*sprint,18,step);
 state.rotation[0]=damp(state.rotation[0],p.recoil[1]*state.recoil+.45*sprint+.65*equip,18,step);
 state.rotation[1]=damp(state.rotation[1],state.swayX*.8,14,step);
 state.rotation[2]=damp(state.rotation[2],p.recoil[2]*state.recoil-state.swayY*.6+.35*sprint,14,step);
 return state;
}

export function createWeaponPartState(){
 return {stage:'idle',magazine:[0,0,0],action:0,rootTilt:0};
}

export function stepWeaponParts(state,profile,remaining){
 const stage=reloadStage(profile,remaining),progress=remaining>0?clamp(1-remaining/profile.reloadDuration,0,1):1;
 state.stage=stage;state.magazine[0]=0;state.magazine[1]=0;state.magazine[2]=0;state.action=0;state.rootTilt=0;
 if(stage==='release')state.rootTilt=-.34*(progress/.16);
 else if(stage==='eject'){
  const t=clamp((progress-.16)/.22,0,1);state.rootTilt=-.34;state.magazine[1]=-.55*t;state.magazine[2]=.08*t;
 }else if(stage==='insert'){
  const t=clamp((progress-.38)/.32,0,1);state.rootTilt=-.34*(1-t*.35);state.magazine[1]=-.55*(1-t);state.magazine[2]=.08*(1-t);
 }else if(stage==='action'){
  state.rootTilt=-.2*(1-(progress-.7)/.2);state.action=Math.sin(clamp((progress-.7)/.2,0,1)*Math.PI);
 }else if(stage==='settle')state.rootTilt=-.08*(1-clamp((progress-.9)/.1,0,1));
 return state;
}
