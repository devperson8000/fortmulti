import * as THREE from 'three';
import {poseWeaponHand,supportHandPose} from './soldier-arms.js';
export function poseLobbyRifle(instance){
  const mount=instance.rifleMount;if(!mount)return;
  const c=mount.userData.calibration;
  instance.holder.updateMatrixWorld(true);
  const shoulders=['right','left'].map(side=>instance.holder.worldToLocal(instance.bones.get(`mixamorig${side}arm`).getWorldPosition(new THREE.Vector3()))),center=shoulders[0].add(shoulders[1]).multiplyScalar(.5);
  mount.position.set(center.x+.10,center.y-.16,center.z-.12);mount.rotation.set(-.35,1.0,.08,'YXZ');instance.holder.updateMatrixWorld(true);
  const grip=new THREE.Vector3(...c.grip),point=value=>mount.localToWorld(new THREE.Vector3(...value).sub(grip).multiplyScalar(c.scale));
  const right=point(c.rightPalm),node=mount.userData.nodes.get(c.supportNode);
  let left=node?node.getWorldPosition(new THREE.Vector3()).add(mount.userData.supportOffset.clone().multiplyScalar(c.scale).applyQuaternion(mount.getWorldQuaternion(new THREE.Quaternion()))):point(c.support);
  const rotation=mount.getWorldQuaternion(new THREE.Quaternion()),rest=instance.fingerRest;
  for(const [side,palm,spec,sign] of [
   ['right',right,{rotation:c.rightRotation,fingers:c.rightFingers,splay:c.rightSplay,thumbOpposition:c.rightThumbOpposition},1],
   ['left',left,supportHandPose(c),-1]
  ]){
   const orientation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...spec.rotation,'XYZ')).premultiply(rotation),pole=instance.holder.localToWorld(new THREE.Vector3(sign*.32,1.10,.12));
   poseWeaponHand(instance.model,instance.bones,side,palm,orientation,{...spec,rest},pole);
  }
 }
