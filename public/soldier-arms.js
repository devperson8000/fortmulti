import * as THREE from 'three';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
const normalized=name=>String(name).toLowerCase().replace(/[^a-z0-9]/g,'');
const armName=name=>/mixamorig(left|right)(shoulder|arm|forearm|hand)/.test(normalized(name));
// Preserve the original vertices, weights, inverse bind matrices and materials.
// Only triangle indices change; no procedural replacement arm geometry exists.
export function createSoldierArms(template,scale){const model=cloneSkinned(template),bones=new Map(),rest=new Map(),restPositions=new Map();model.traverse(o=>{if(o.isBone){bones.set(normalized(o.name),o);rest.set(o,o.quaternion.clone());restPositions.set(o,o.position.clone());}if(o.isMesh){if(!o.isSkinnedMesh){o.visible=false;return;}const geometry=o.geometry.clone(),indices=geometry.index,skin=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;if(!skin||!weights){o.visible=false;return;}const belongs=i=>{let total=0;for(let k=0;k<4;k++)if(armName(o.skeleton.bones[skin.getComponent(i,k)]?.name||''))total+=weights.getComponent(i,k);return total>.55;};const kept=[],count=indices?.count||geometry.attributes.position.count;for(let i=0;i<count;i+=3){const a=indices?indices.getX(i):i,b=indices?indices.getX(i+1):i+1,c=indices?indices.getX(i+2):i+2;if(belongs(a)&&belongs(b)&&belongs(c))kept.push(a,b,c);}geometry.setIndex(kept);o.geometry=geometry;o.frustumCulled=false;}});model.scale.setScalar(scale);model.updateMatrixWorld(true);return {model,bones,rest,restPositions};}
const v=()=>new THREE.Vector3();
// Rotate and reshape the support hand while it reaches for a reload part.
// Position, orientation and fingers use the same blend in both perspectives.
export function supportHandPose(c,reach=0){
 const t=Math.max(0,Math.min(1,reach)),normal={rotation:c.leftRotation,fingers:c.leftFingers,splay:c.leftSplay,thumbOpposition:c.leftThumbOpposition};
 if(!t||!c.reloadRotation)return normal;
 const reload={rotation:c.reloadRotation,fingers:c.reloadFingers,splay:c.reloadSplay,thumbOpposition:c.reloadThumbOpposition};if(t===1)return reload;
 const a=new THREE.Quaternion().setFromEuler(new THREE.Euler(...normal.rotation,'XYZ')),b=new THREE.Quaternion().setFromEuler(new THREE.Euler(...reload.rotation,'XYZ')),rotation=new THREE.Euler().setFromQuaternion(a.slerp(b,t),'XYZ'),fingers={},splay={};
 for(const finger of ['index','middle','ring','pinky','thumb']){
  fingers[finger]=normal.fingers[finger].map((v,k)=>v+(reload.fingers[finger][k]-v)*t);
  splay[finger]=[0,1,2].map(k=>(normal.splay?.[finger]?.[k]||0)+((reload.splay?.[finger]?.[k]||0)-(normal.splay?.[finger]?.[k]||0))*t);
 }
 return {rotation:[rotation.x,rotation.y,rotation.z],fingers,splay,thumbOpposition:normal.thumbOpposition+(reload.thumbOpposition-normal.thumbOpposition)*t};
}
function aimBone(bone,child,target){bone.updateWorldMatrix(true,true);const origin=bone.getWorldPosition(v()),direction=child.getWorldPosition(v()).sub(origin).normalize(),desired=target.clone().sub(origin).normalize(),delta=new THREE.Quaternion().setFromUnitVectors(direction,desired),world=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(delta),parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.copy(parent.multiply(world));bone.updateWorldMatrix(false,true);}
export function poseArmChain(model,bones,side,wrist,pole){const prefix=`mixamorig${side}`;poseLimbChain(model,bones.get(prefix+'arm'),bones.get(prefix+'forearm'),bones.get(prefix+'hand'),wrist,pole);}
export function poseLegChain(model,bones,side,foot,pole){const prefix=`mixamorig${side}`;poseLimbChain(model,bones.get(prefix+'upleg'),bones.get(prefix+'leg'),bones.get(prefix+'foot'),foot,pole);}
function poseLimbChain(model,arm,fore,hand,wrist,pole){if(!arm||!fore||!hand)return;model.updateMatrixWorld(true);const shoulder=arm.getWorldPosition(v()),elbow=fore.getWorldPosition(v()),end=hand.getWorldPosition(v()),a=shoulder.distanceTo(elbow),b=elbow.distanceTo(end),direction=wrist.clone().sub(shoulder),distance=Math.max(Math.abs(a-b)+.0001,Math.min(direction.length(),a+b-.0001));direction.normalize();const sideVector=pole.clone().sub(shoulder).addScaledVector(direction,-pole.clone().sub(shoulder).dot(direction)).normalize(),along=(a*a-b*b+distance*distance)/(2*distance),bend=Math.sqrt(Math.max(0,a*a-along*along)),joint=shoulder.clone().addScaledVector(direction,along).addScaledVector(sideVector,bend);aimBone(arm,fore,joint);aimBone(fore,hand,wrist);}
export function poseSoldierArms(rig,{right,left,origin=[0,0,0],rotation=[0,0,0],scale=1,utility=false,hands=null,ads=0}){
 for(const [bone,q] of rig.rest){bone.quaternion.copy(q);bone.position.copy(rig.restPositions.get(bone));}
 rig.model.position.set(hands?origin[0]-.05:0,hands?origin[1]-1.65:-1.45,hands?origin[2]-.11:0);rig.model.rotation.set(0,hands?0:Math.PI,0);rig.model.updateMatrixWorld(true);
 const itemRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation,'YXZ'));
 const transform=new THREE.Matrix4().compose(new THREE.Vector3(...origin),itemRotation,new THREE.Vector3(scale,scale,scale));
 {const wrists=['right','left'].map(side=>{if(!hands){const target=new THREE.Vector3(...(side==='right'?right:left)).applyMatrix4(transform);if(utility){const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.8,0,side==='right'?.2:-.2)).premultiply(itemRotation);target.sub(new THREE.Vector3(0,.09*rig.model.scale.x,0).applyQuaternion(q));}return target;}const spec=hands[side],q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...spec.rotation,'XYZ')).premultiply(itemRotation);return new THREE.Vector3(...spec.palm).applyMatrix4(transform).sub(new THREE.Vector3(0,.09*rig.model.scale.x,0).applyQuaternion(q));});const center=wrists[0].clone().add(wrists[1]).multiplyScalar(.5);rig.model.rotation.y=-.65;rig.model.position.set(center.x,center.y-1.65,center.z+(hands?.19:0));rig.model.updateMatrixWorld(true);
 // Move the whole shoulder frame into the reachable region of both wrists.
 // Long ADS fore-ends otherwise exceed horizontal reach before the vertical
 // adjustment can help. Preserve every native bone attachment and length.
 for(let pass=0;pass<3;pass++)for(const [index,side]of ['right','left'].entries()){
  const arm=rig.bones.get(`mixamorig${side}arm`),fore=rig.bones.get(`mixamorig${side}forearm`),hand=rig.bones.get(`mixamorig${side}hand`),shoulder=arm.getWorldPosition(v()),a=shoulder.distanceTo(fore.getWorldPosition(v())),b=fore.getWorldPosition(v()).distanceTo(hand.getWorldPosition(v())),dx=wrists[index].x-shoulder.x,dz=wrists[index].z-shoulder.z,horizontal=Math.hypot(dx,dz),excess=horizontal-(a+b-.018);
  if(excess>0){rig.model.position.x+=dx/horizontal*excess;rig.model.position.z+=dz/horizontal*excess;rig.model.updateMatrixWorld(true);}
 }
 let raise=0;for(const [index,side]of ['right','left'].entries()){const arm=rig.bones.get(`mixamorig${side}arm`),fore=rig.bones.get(`mixamorig${side}forearm`),hand=rig.bones.get(`mixamorig${side}hand`);const shoulder=arm.getWorldPosition(new THREE.Vector3()),a=shoulder.distanceTo(fore.getWorldPosition(new THREE.Vector3())),b=fore.getWorldPosition(new THREE.Vector3()).distanceTo(hand.getWorldPosition(new THREE.Vector3())),horizontal=Math.hypot(wrists[index].x-shoulder.x,wrists[index].z-shoulder.z),vertical=Math.sqrt(Math.max(0,(a+b-.001)**2-horizontal**2))*.995;raise=Math.max(raise,wrists[index].y-shoulder.y-vertical);}rig.model.position.y+=raise;rig.model.updateMatrixWorld(true);}
 for(const [side,target,sign] of [['right',right,1],['left',left,-1]]){
  const arm=rig.bones.get(`mixamorig${side}arm`),fore=rig.bones.get(`mixamorig${side}forearm`),hand=rig.bones.get(`mixamorig${side}hand`);
  if(!arm||!fore||!hand)continue;
  const spec=hands?.[side];
  const orientation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...(spec?.rotation||[utility?-.8:-Math.PI/2,0,sign*.2]),'XYZ')).premultiply(itemRotation);
  // The real Soldier palm lies along local Y, with finger fan across local Z.
  const palmOffset=new THREE.Vector3(0,9,0).multiplyScalar(.01*rig.model.scale.x).applyQuaternion(orientation);
  const wrist=spec?new THREE.Vector3(...spec.palm).applyMatrix4(transform).sub(palmOffset):new THREE.Vector3(...target).applyMatrix4(transform).sub(utility?palmOffset:new THREE.Vector3());
  // Elbows trail the held item. A fixed camera-space pole in front of the
  // wrist made the forearm approach backward, folding the wrist past 120°.
  const pole=wrist.clone().addScaledVector(new THREE.Vector3(0,1,0).applyQuaternion(orientation),-.45).add(new THREE.Vector3(sign*.08,-.12,0).applyQuaternion(itemRotation));
  poseArmChain(rig.model,rig.bones,side,wrist,pole);
  hand.quaternion.copy(hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  for(const [name,bone] of rig.bones){
   if(!name.startsWith(`mixamorig${side}hand`)||!/[123]$/.test(name))continue;
   const finger=['index','middle','ring','pinky','thumb'].find(f=>name.includes(f)),joint=Number(name.at(-1))-1;
   const angle=spec?.fingers?.[finger]?.[joint]??(finger==='index'&&!utility?.35:finger==='thumb'?-.55:.72);
   // Flex perpendicular to the palm plane, rather than sideways across the fan.
   bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),angle));
   const splay=spec?.splay?.[finger]?.[joint]||0;if(splay)bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),splay));
   if(finger==='thumb'&&joint===0&&spec)bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),spec.thumbOpposition??(side==='right'?-1.05:1.05)));
  }
 }
 rig.model.updateMatrixWorld(true);
}

// Solve against the weapon's world-space palm contact, then orient/curl the
// original hand bones. The weapon is independent of the hand hierarchy.
export function poseWeaponHand(model,bones,side,palm,orientation,spec,pole){
 const hand=bones.get(`mixamorig${side}hand`);if(!hand)return;
 const wrist=palm.clone().sub(new THREE.Vector3(0,.09*model.getWorldScale(new THREE.Vector3()).x,0).applyQuaternion(orientation));
 const natural=pole.clone().sub(wrist).normalize().multiplyScalar(.12),aligned=wrist.clone().addScaledVector(new THREE.Vector3(0,1,0).applyQuaternion(orientation),-.45).add(natural);
 poseArmChain(model,bones,side,wrist,aligned);
 hand.quaternion.copy(hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
 for(const [name,bone]of bones){if(!name.startsWith(`mixamorig${side}hand`)||!/[123]$/.test(name))continue;if(spec.rest?.has(bone))bone.quaternion.copy(spec.rest.get(bone));const finger=['index','middle','ring','pinky','thumb'].find(f=>name.includes(f)),joint=Number(name.at(-1))-1;
  bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),spec.fingers[finger][joint]));const splay=spec.splay?.[finger]?.[joint]||0;if(splay)bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),splay));if(finger==='thumb'&&joint===0)bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),spec.thumbOpposition??(side==='right'?-1.05:1.05)));
 }
 model.updateMatrixWorld(true);
}
