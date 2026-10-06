import {WEAPON_MODELS} from './weapon-model.js';

const damp=(from,to,speed,dt)=>from+(to-from)*(1-Math.exp(-speed*Math.min(.1,Math.max(0,dt))));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const mix=(from,to,t)=>from+(to-from)*t;

export function createViewModelState(){
 return {position:[0,0,0],rotation:[0,0,0],recoil:0,swayX:0,swayY:0,bobPhase:0,movement:0,sprint:0,ads:0,stage:'idle'};
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
 state.movement=damp(state.movement,clamp(input.moving||0,0,1),12,step);
 state.ads=damp(state.ads,input.aiming?1:0,14,step);state.sprint=damp(state.sprint,input.sprinting&&!input.aiming&&!input.reloading?1:0,10,step);
 state.bobPhase+=state.movement*step*(input.sprinting?12:9);
 state.stage=reloadStage(profile,input.reloading||0);
 const anchor=p.anchor.map((v,i)=>mix(v,p.adsAnchor[i],state.ads)),bob=Math.sin(state.bobPhase*2)*p.bob*state.movement*(1-state.ads*.85),sprint=state.sprint,equip=clamp((input.equipRemaining||0)/profile.equipDuration,0,1);
 state.position[0]=damp(state.position[0],anchor[0]+state.swayX*(1-state.ads*.8)+Math.cos(state.bobPhase)*p.bob*.5*state.movement*(1-state.ads)+p.sprint[0]*sprint,16,step);
 state.position[1]=damp(state.position[1],anchor[1]+bob+(input.landing||0)*-.045+p.sprint[1]*sprint-.48*equip,16,step);
 state.position[2]=damp(state.position[2],anchor[2]+p.recoil[0]*state.recoil+p.sprint[2]*sprint,18,step);
 state.rotation[0]=damp(state.rotation[0],p.recoil[1]*state.recoil+.45*sprint+.65*equip,18,step);
 state.rotation[1]=damp(state.rotation[1],state.swayX*.8,14,step);
 state.rotation[2]=damp(state.rotation[2],p.recoil[2]*state.recoil-state.swayY*.6+.35*sprint,14,step);
 return state;
}

export function createWeaponPartState(){
 return {stage:'idle',progress:1,magazine:[0,0,0],freshMagazine:[0,0,0],supportHand:[0,0,0],magazineRotation:0,freshMagazineRotation:0,magazineVisible:true,freshMagazineVisible:false,action:0,rootTilt:0};
}

const handMix=(a,b,t)=>a.map((value,index)=>value+(b[index]-value)*t);
const handEase=t=>{const x=clamp(t,0,1);return x*x*(3-2*x);};
const plus=(a,b)=>a.map((value,index)=>value+b[index]);

export function createFirstPersonHandPose(profile,parts){
 const weapon=WEAPON_MODELS[profile.id],pieces=weapon?.parts||[],part=id=>pieces.find(piece=>piece.id===id)?.position||[0,0,0];
 const grip=part('grip'),foreEnd=part(profile.id==='shotgun'?'fore-end':'handguard'),magazine=part('magazine');
 const shootingPalm=plus(grip,[.035,-.015,0]),supportRest=[foreEnd[0],foreEnd[1]-.075,foreEnd[2]],magazineReach=[magazine[0],magazine[1]-.1,magazine[2]];
 const progress=clamp(Number(parts?.progress??1),0,1);
 let reach=0;
 if(parts?.stage==='release')reach=handEase(progress/.16);
 else if(parts?.stage==='eject')reach=1;
 else if(parts?.stage==='insert')reach=1-handEase((progress-.58)/.12);
 else if(parts?.stage==='action')reach=1-handEase((progress-.7)/.2);
 else if(parts?.stage==='settle')reach=0;
 const supportPalm=handMix(supportRest,magazineReach,reach);
 const shootingWrist=plus(shootingPalm,[0,.015,.16]),supportWrist=plus(supportPalm,[0,.015,.16]);
 const shootingDigits=[
  {from:[grip[0]+.092,grip[1]+.005,grip[2]-.045],to:[grip[0]+.078,grip[1]-.065,grip[2]+.045],radius:.022},
  {from:[grip[0]+.108,grip[1]-.075,grip[2]-.045],to:[grip[0]+.09,grip[1]-.155,grip[2]+.025],radius:.026},
  {from:[grip[0]+.105,grip[1]-.145,grip[2]-.04],to:[grip[0]+.085,grip[1]-.22,grip[2]+.025],radius:.027},
  {from:[grip[0]+.09,grip[1]-.21,grip[2]-.035],to:[grip[0]+.07,grip[1]-.27,grip[2]+.025],radius:.025},
  {from:[grip[0]-.065,grip[1]+.025,grip[2]+.005],to:[grip[0]-.105,grip[1]-.045,grip[2]+.075],radius:.03}
 ];
 const supportDigits=Array.from({length:4},(_,index)=>{
  const z=foreEnd[2]-.105+index*.07;
  return {from:[foreEnd[0]+.105,foreEnd[1]-.09,z],to:[foreEnd[0]+.075,foreEnd[1]-.018,z],radius:.025};
 });
 supportDigits.push({from:[foreEnd[0]-.105,foreEnd[1]-.015,foreEnd[2]+.045],to:[foreEnd[0]-.085,foreEnd[1]-.08,foreEnd[2]-.035],radius:.03});
 const supportDelta=supportPalm.map((value,index)=>value-supportRest[index]);
 return {
  shooting:{shoulder:[.62,-.58,.4],elbow:[.4,-.4,.3],wrist:shootingWrist,palm:shootingPalm,cuff:handMix(shootingWrist,shootingPalm,.32),digits:shootingDigits},
  support:{shoulder:[-.62,-.58,.4],elbow:handMix([-.42,-.4,.1],supportPalm,.46),wrist:supportWrist,palm:supportPalm,cuff:handMix(supportWrist,supportPalm,.32),digits:supportDigits.map(digit=>({from:plus(digit.from,supportDelta),to:plus(digit.to,supportDelta),radius:digit.radius}))}
 };
}

// The licensed GLBs are mounted at their trigger bone, so the existing glove
// pose stays attached to the weapon instead of being replaced by the avatar's
// third-person arms. assetLength is the GLB's measured longest dimension.
export function createFirstPersonAssetPose(profile,state,parts,assetLength=1){
 const hand=createFirstPersonHandPose(profile,parts),trigger=hand.shooting.digits[0].to;
 return {
  position:state.position.slice(),
  rotation:[state.rotation[0]+(parts?.rootTilt||0),state.rotation[1],state.rotation[2]],
  scale:(1.35*profile.presentation.scale)/Math.max(.001,assetLength),
  trigger:trigger.slice()
 };
}

export function stepWeaponParts(state,profile,remaining){
 const stage=reloadStage(profile,remaining),progress=remaining>0?clamp(1-remaining/profile.reloadDuration,0,1):1;
 state.stage=stage;state.progress=progress;state.magazine.fill(0);state.freshMagazine.fill(0);state.supportHand.fill(0);state.magazineRotation=0;state.freshMagazineRotation=0;state.magazineVisible=stage==='idle'||stage==='release'||stage==='eject';state.freshMagazineVisible=stage==='insert'||stage==='action'||stage==='settle';state.action=0;state.rootTilt=0;
 if(stage==='release'){
  const t=clamp(progress/.16,0,1);state.rootTilt=-.42*t;state.supportHand[0]=-.08*t;state.supportHand[1]=-.16*t;state.supportHand[2]=.1*t;
 }
 else if(stage==='eject'){
  const t=clamp((progress-.16)/.22,0,1),ease=t*t*(3-2*t);state.rootTilt=-.42;state.magazine[1]=-.64*ease;state.magazine[2]=.13*ease;state.magazineRotation=.18*ease;state.supportHand[0]=mix(-.08,-.23,ease);state.supportHand[1]=mix(-.16,-.32,ease);state.supportHand[2]=mix(.1,.16,ease);
 }else if(stage==='insert'){
  const t=clamp((progress-.38)/.32,0,1),ease=t*t*(3-2*t),handEase=1-(1-t)**3;state.rootTilt=-.42*(1-t*.72);state.freshMagazine[0]=mix(-.23,0,ease);state.freshMagazine[1]=mix(-.56,0,ease);state.freshMagazine[2]=mix(.16,0,ease);state.freshMagazineRotation=.24*(1-ease);state.supportHand[0]=mix(-.23,-.04,handEase);state.supportHand[1]=mix(-.32,-.06,handEase);state.supportHand[2]=mix(.16,-.25,handEase);
 }else if(stage==='action'){
  const t=clamp((progress-.7)/.2,0,1);state.rootTilt=-.12*(1-t);state.action=Math.sin(t*Math.PI);state.supportHand[0]=mix(-.04,0,t);state.supportHand[1]=mix(-.06,0,t);state.supportHand[2]=mix(-.25,-.3,t);
 }else if(stage==='settle'){
  const t=clamp((progress-.9)/.1,0,1);state.rootTilt=-.12*(1-t);state.supportHand[2]=-.3*(1-t);
 }
 return state;
}

// Bone attachments inherit every ancestor's scale, including Soldier's centimeter root.
export function handAttachmentScale(inheritedScale,worldLength=1,sourceLength=1){return worldLength/(Math.max(1e-8,Math.abs(inheritedScale))*Math.max(1e-8,sourceLength));}
