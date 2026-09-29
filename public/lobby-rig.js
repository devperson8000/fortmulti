// GLTFLoader sanitizes the source name "mixamorig:RightArm" by removing the
// reserved colon, so Object3D names are "mixamorigRightArm" at runtime.
const runtimeBoneName=name=>`mixamorig${name}`;

export const SALUTE_FINGER_CURLS=Object.freeze([
 {name:'mixamorigRightHandThumb1',axis:[0,1,0],angle:-.8},
 {name:'mixamorigRightHandThumb2',axis:[1,0,0],angle:-.85},
 {name:'mixamorigRightHandThumb3',axis:[1,0,0],angle:-.85},
 {name:'mixamorigRightHandThumb4',axis:[1,0,0],angle:-.65},
 ...['Ring','Pinky'].flatMap(digit=>[1,2,3,4].map(joint=>({
  name:`mixamorigRightHand${digit}${joint}`,axis:[1,0,0],angle:.72
 })))
].map(curl=>Object.freeze({...curl,axis:Object.freeze(curl.axis)})));

export function buildForeheadSaluteProbes(headPosition,shoulderPosition,cameraPosition,modelScale=1.78){
 const scale=Math.max(.1,modelScale)/1.78;
 const horizontalDirection=(from,to,fallback)=>{
  let x=to[0]-from[0],z=to[2]-from[2];
  const length=Math.hypot(x,z);
  if(length<1e-8)return fallback;
  return [x/length,0,z/length];
 };
 const side=horizontalDirection(headPosition,shoulderPosition,[-1,0,0]);
 const direction=horizontalDirection(headPosition,cameraPosition,[0,0,1]);
 const center=[
  headPosition[0]+side[0]*.08*scale,
  headPosition[1]+.14*scale,
  headPosition[2]+side[2]*.08*scale
 ];
 const spread=.024*scale;
 return {
  center,
  direction,
  side,
  probes:[
   [center[0]+side[0]*spread,center[1],center[2]+side[2]*spread],
   [center[0]-side[0]*spread,center[1],center[2]-side[2]*spread]
  ]
 };
}

export function resolveLobbyRig(model){
 const bone=name=>model.getObjectByName(runtimeBoneName(name))||null;
 const rig={
  hips:bone('Hips'),spine:bone('Spine'),spine1:bone('Spine1'),spine2:bone('Spine2'),neck:bone('Neck'),head:bone('Head'),
  rightShoulder:bone('RightShoulder'),rightArm:bone('RightArm'),rightForeArm:bone('RightForeArm'),rightHand:bone('RightHand'),
  leftFoot:bone('LeftFoot'),rightFoot:bone('RightFoot'),leftToe:bone('LeftToeBase'),rightToe:bone('RightToeBase')
 };
 for(const digit of ['Thumb','Index','Middle','Ring','Pinky']){
  for(let joint=1;joint<=4;joint++)rig[`right${digit}${joint}`]=bone(`RightHand${digit}${joint}`);
 }
 return rig;
}

export function selectSaluteFingerTracks(clip){
 return clip.tracks.filter(track=>
  track.name.startsWith('mixamorigRightHandIndex')||track.name.startsWith('mixamorigRightHandMiddle')
 );
}

export function sampleSaluteFingerPose(clip,time){
 return selectSaluteFingerTracks(clip)
  .filter(track=>track.name.endsWith('.quaternion'))
  .map(track=>({
   name:track.name.slice(0,track.name.lastIndexOf('.')),
   quaternion:Array.from(track.createInterpolant().evaluate(time))
  }));
}

const RIGHT_FINGER_QUATERNION_TRACK=/^mixamorigRightHand(?:Thumb|Index|Middle|Ring|Pinky)[1-4]\.quaternion$/;

export function selectRightHandFingerTracks(clip){
 return clip.tracks.filter(track=>RIGHT_FINGER_QUATERNION_TRACK.test(track.name));
}

export function sampleRightHandFingerPose(clip,time){
 return selectRightHandFingerTracks(clip).map(track=>({
  name:track.name.slice(0,track.name.lastIndexOf('.')),
  quaternion:Array.from(track.createInterpolant().evaluate(time))
 }));
}
