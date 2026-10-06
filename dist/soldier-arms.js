import * as THREE from 'three';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
const normalized=name=>String(name).toLowerCase().replace(/[^a-z0-9]/g,'');
const armName=name=>/mixamorig(left|right)(arm|forearm|hand)/.test(normalized(name));
// Preserve the original vertices, weights, inverse bind matrices and materials.
// Only triangle indices change; no procedural replacement arm geometry exists.
export function createSoldierArms(template,scale){const model=cloneSkinned(template),bones=new Map(),rest=new Map();model.traverse(o=>{if(o.isBone){bones.set(normalized(o.name),o);rest.set(o,o.quaternion.clone());}if(o.isMesh){if(!o.isSkinnedMesh){o.visible=false;return;}const geometry=o.geometry.clone(),indices=geometry.index,skin=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;if(!skin||!weights){o.visible=false;return;}const belongs=i=>{let total=0;for(let k=0;k<4;k++)if(armName(o.skeleton.bones[skin.getComponent(i,k)]?.name||''))total+=weights.getComponent(i,k);return total>.55;};const kept=[],count=indices?.count||geometry.attributes.position.count;for(let i=0;i<count;i+=3){const a=indices?indices.getX(i):i,b=indices?indices.getX(i+1):i+1,c=indices?indices.getX(i+2):i+2;if(belongs(a)&&belongs(b)&&belongs(c))kept.push(a,b,c);}geometry.setIndex(kept);o.geometry=geometry;o.frustumCulled=false;}});model.scale.setScalar(scale);model.updateMatrixWorld(true);return {model,bones,rest};}
const v=()=>new THREE.Vector3();
function aimBone(bone,child,target){bone.updateWorldMatrix(true,true);const origin=bone.getWorldPosition(v()),direction=child.getWorldPosition(v()).sub(origin).normalize(),desired=target.clone().sub(origin).normalize(),delta=new THREE.Quaternion().setFromUnitVectors(direction,desired),world=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(delta),parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.copy(parent.multiply(world));bone.updateWorldMatrix(false,true);}
export function poseArmChain(model,bones,side,wrist,pole){const prefix=`mixamorig${side}`,arm=bones.get(prefix+'arm'),fore=bones.get(prefix+'forearm'),hand=bones.get(prefix+'hand');if(!arm||!fore||!hand)return;model.updateMatrixWorld(true);const shoulder=arm.getWorldPosition(v()),elbow=fore.getWorldPosition(v()),end=hand.getWorldPosition(v()),a=shoulder.distanceTo(elbow),b=elbow.distanceTo(end),direction=wrist.clone().sub(shoulder),distance=Math.max(Math.abs(a-b)+.0001,Math.min(direction.length(),a+b-.0001));direction.normalize();const sideVector=pole.clone().sub(shoulder).addScaledVector(direction,-pole.clone().sub(shoulder).dot(direction)).normalize(),along=(a*a-b*b+distance*distance)/(2*distance),bend=Math.sqrt(Math.max(0,a*a-along*along)),joint=shoulder.clone().addScaledVector(direction,along).addScaledVector(sideVector,bend);aimBone(arm,fore,joint);aimBone(fore,hand,wrist);}
export function poseSoldierArms(rig,{right,left,origin=[0,0,0],rotation=[0,0,0],scale=1,utility=false,hands=null}){
 for(const [bone,q] of rig.rest)bone.quaternion.copy(q);
 rig.model.position.set(0,-1.45,0);rig.model.rotation.set(0,Math.PI,0);rig.model.updateMatrixWorld(true);
 const itemRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation,'YXZ'));
 const transform=new THREE.Matrix4().compose(new THREE.Vector3(...origin),itemRotation,new THREE.Vector3(scale,scale,scale));
 for(const [side,target,sign] of [['right',right,1],['left',left,-1]]){
  const arm=rig.bones.get(`mixamorig${side}arm`),fore=rig.bones.get(`mixamorig${side}forearm`),hand=rig.bones.get(`mixamorig${side}hand`);
  if(!arm||!fore||!hand)continue;
  const spec=hands?.[side];
  const orientation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...(spec?.rotation||[utility?-.8:-Math.PI/2,0,sign*.2]),'XYZ')).premultiply(itemRotation);
  // The real Soldier palm lies along local Y, with finger fan across local Z.
  const palmOffset=new THREE.Vector3(0,9,0).multiplyScalar(.01*rig.model.scale.x).applyQuaternion(orientation);
  const wrist=spec?new THREE.Vector3(...spec.palm).applyMatrix4(transform).sub(palmOffset):new THREE.Vector3(...target).applyMatrix4(transform);
  const a=arm.getWorldPosition(v()).distanceTo(fore.getWorldPosition(v())),b=fore.getWorldPosition(v()).distanceTo(hand.getWorldPosition(v()));
  // The arm-only view has no torso. Keep its cropped shoulder at the lower
  // screen edge, but inside the actual bone reach instead of stretching skin
  // or leaving the hand short of the weapon's grip.
  const preferred=new THREE.Vector3(sign*.38,-.62,-.5),offset=preferred.sub(wrist);
  offset.setLength(Math.min(offset.length(),(a+b)*.92));
  const shoulder=wrist.clone().add(offset);
  arm.position.copy(arm.parent.worldToLocal(shoulder));rig.model.updateMatrixWorld(true);
  poseArmChain(rig.model,rig.bones,side,wrist,new THREE.Vector3(sign*.55,-.9,-.5));
  hand.quaternion.copy(hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  for(const [name,bone] of rig.bones){
   if(!name.startsWith(`mixamorig${side}hand`)||!/[123]$/.test(name))continue;
   const finger=['index','middle','ring','pinky','thumb'].find(f=>name.includes(f)),joint=Number(name.at(-1))-1;
   const angle=spec?.fingers?.[finger]?.[joint]??(finger==='index'&&!utility?.35:finger==='thumb'?-.55:.72);
   // Flex perpendicular to the palm plane, rather than sideways across the fan.
   bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),angle));
   const splay=spec?.splay?.[finger]?.[joint]||0;if(splay)bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),splay));
   if(finger==='thumb'&&joint===0&&spec)bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),side==='right'?-1.05:1.05));
  }
 }
 rig.model.updateMatrixWorld(true);
}
