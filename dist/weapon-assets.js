import * as THREE from 'three';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {firstPersonCalibration} from './first-person-calibration.js';
export const WEAPON_FILES=Object.freeze({ar:'Rifle_Assault_East.glb',shotgun:'Shotgun_Pump_East.glb',smg:'SMG_Compact_East.glb',sniper:'Sniper_Rifle_East.glb',ar_sentinel:'Rifle_Assault_West.glb',shotgun_breacher:'Shotgun_Auto_West.glb',smg_viper:'SMG_Full_West.glb',sniper_longbow:'Sniper_Rifle_West.glb'});
export function createGroundWeapon(template,type){const model=cloneSkinned(template),group=new THREE.Group();model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3());model.position.x-=center.x;model.position.y-=bounds.min.y;model.position.z-=center.z;group.add(model);group.scale.setScalar(firstPersonCalibration(type).scale);group.userData.weaponType=type;return group;}
const phase=id=>{let h=2166136261;for(const c of String(id))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h/4294967296*Math.PI*2;};
export function groundWeaponPose(item,time){const offset=phase(item.id);return {rotation:offset+time*Math.PI*2/30,height:(item.y||0)+.18+Math.sin(time*Math.PI/2+offset)*.05};}
