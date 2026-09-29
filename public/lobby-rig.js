// GLTFLoader sanitizes the source name "mixamorig:RightArm" by removing the
// reserved colon, so Object3D names are "mixamorigRightArm" at runtime.
const runtimeBoneName=name=>`mixamorig${name}`;

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
