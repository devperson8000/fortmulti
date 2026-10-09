import * as THREE from 'three';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {firstPersonCalibration} from './first-person-calibration.js';
export const WEAPON_FILES=Object.freeze({ar:'Rifle_Assault_East.glb',shotgun:'Shotgun_Pump_East.glb',smg:'SMG_Compact_East.glb',sniper:'Sniper_Rifle_East.glb',ar_sentinel:'Rifle_Assault_West.glb',shotgun_breacher:'Shotgun_Auto_West.glb',smg_viper:'SMG_Full_West.glb',sniper_longbow:'Sniper_Rifle_West.glb'});
export function createGroundWeapon(template,type){const model=cloneSkinned(template),group=new THREE.Group();model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3());model.position.x-=center.x;model.position.y-=bounds.min.y;model.position.z-=center.z;group.add(model);group.scale.setScalar(firstPersonCalibration(type).scale);group.userData.weaponType=type;return group;}
export {groundWeaponPose} from './pickup-targeting.js';
export function disposeWeaponSkeletons(root){const skeletons=new Set();root.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);});for(const skeleton of skeletons)skeleton.dispose();}
