const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const ease=value=>{const t=clamp01(value);return t*t*(3-2*t);};

export const LANDING_TRANSITION_SECONDS=.45;

export function createCameraPresentation(){
 return {mode:'aerial',blend:0,elapsed:0,lastAir:'bus',roundToken:null};
}

export function cameraMode({lobby=false,air='landed',alive=true,spectating=false}={}){
 if(lobby)return 'lobby';
 if(!alive||spectating)return 'spectator';
 return air==='landed'?'firstPerson':'aerial';
}

export function stepCameraPresentation(prior,sample={},dt=.016){
 const state=prior||createCameraPresentation();
 const step=Math.max(0,Math.min(.25,Number(dt)||0));
 const nextRound=state.roundToken!==null&&sample.roundToken!==state.roundToken;
 if(nextRound){
  return {...createCameraPresentation(),mode:cameraMode(sample),roundToken:sample.roundToken,lastAir:sample.air||'bus'};
 }
 const direct=cameraMode(sample);
 const landed=sample.air==='landed';
 const justLanded=landed&&state.lastAir!=='landed'&&direct==='firstPerson';
 if(justLanded||state.mode==='transition'){
  const elapsed=justLanded?step:state.elapsed+step;
  const raw=clamp01(elapsed/LANDING_TRANSITION_SECONDS);
  return {mode:raw>=1?'firstPerson':'transition',blend:ease(raw),elapsed,lastAir:'landed',roundToken:sample.roundToken};
 }
 return {mode:direct,blend:direct==='firstPerson'?1:0,elapsed:0,lastAir:sample.air||'landed',roundToken:sample.roundToken};
}

export const canFireDuringPresentation=state=>state?.mode==='firstPerson'||(state?.mode==='transition'&&(state.blend||0)>=.45);

export function createCameraBlendOutput(){
 return {eye:[0,0,0],target:[0,0,-1]};
}

export function blendCameraViews(thirdEye,thirdTarget,firstEye,firstTarget,presentation,output=createCameraBlendOutput()){
 const blend=presentation?.mode==='firstPerson'?1:presentation?.mode==='transition'?clamp01(presentation.blend):0;
 for(let axis=0;axis<3;axis++){
  output.eye[axis]=thirdEye[axis]+(firstEye[axis]-thirdEye[axis])*blend;
  output.target[axis]=thirdTarget[axis]+(firstTarget[axis]-thirdTarget[axis])*blend;
 }
 return output;
}

export function shouldShowLocalAvatar(presentation,air='landed',alive=true){
 if(!alive)return false;
 if(air!=='landed')return true;
 if(['spectator','lobby','aerial'].includes(presentation?.mode))return true;
 return presentation?.mode==='transition'&&(presentation.blend||0)<.5;
}

export function shouldShowViewModel(presentation,alive=true,spectating=false,scoped=false){
 if(!alive||spectating||scoped)return false;
 return presentation?.mode==='firstPerson'||(presentation?.mode==='transition'&&(presentation.blend||0)>=.45);
}
