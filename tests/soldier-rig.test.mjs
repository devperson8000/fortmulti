import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createSoldierArms,poseSoldierArms} from '../public/soldier-arms.js';
import {WEAPON_PROFILES} from '../public/weapon-system.js';
import {createFirstPersonHandPose,createWeaponPartState,stepWeaponParts} from '../public/view-model.js';
// Texture decoding requires a browser; skeleton/vertex/animation data is loaded
// unchanged from the shipped binary while this test exercises pose geometry.
const loader=new GLTFLoader().register(()=>({name:'TestTextures',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
const bytes=await readFile(new URL('../public/models/Soldier.glb',import.meta.url));
const asset=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const scale=1.78/new THREE.Box3().setFromObject(asset.scene).getSize(new THREE.Vector3()).y;
test('actual Soldier wrists reach all weapon grips and reload targets without stretching',()=>{
 const rig=createSoldierArms(asset.scene,scale);
 for(const profile of Object.values(WEAPON_PROFILES))for(const remaining of [0,profile.reloadDuration*.7,profile.reloadDuration*.4]){
  const parts=stepWeaponParts(createWeaponPartState(),profile,remaining),hands=createFirstPersonHandPose(profile,parts),origin=profile.presentation.anchor,unit=profile.presentation.scale,rotation=[.15,-.1,.08];
  const transform=new THREE.Matrix4().compose(new THREE.Vector3(...origin),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation,'YXZ')),new THREE.Vector3(unit,unit,unit));
  poseSoldierArms(rig,{right:hands.shooting.wrist,left:hands.support.wrist,origin,rotation,scale:unit});
  for(const [side,input] of [['right',hands.shooting.wrist],['left',hands.support.wrist]]){
   const hand=rig.bones.get(`mixamorig${side}hand`),target=new THREE.Vector3(...input).applyMatrix4(transform);
   assert.ok(hand.getWorldPosition(new THREE.Vector3()).distanceTo(target)<.002,`${profile.id} ${side} lost grip`);
  }
 }
});
test('arm extraction keeps actual Soldier triangles and discards the body',()=>{
 const rig=createSoldierArms(asset.scene,scale);let triangles=0,original=0;
 asset.scene.traverse(o=>{if(o.isSkinnedMesh)original+=o.geometry.index.count;});
 rig.model.traverse(o=>{if(o.isSkinnedMesh){triangles+=o.geometry.index.count;assert.ok(o.geometry.attributes.skinWeight);}});
 assert.ok(triangles>3000&&triangles<original*.6);
});

test('real match mixer preserves running legs under actions and repeated poses do not accumulate',async()=>{
 const {MatchCharacterRenderer}=await import('../public/match-character-renderer.js');
 const renderer=Object.create(MatchCharacterRenderer.prototype);
 Object.assign(renderer,{scene:new THREE.Scene(),firstPersonScene:new THREE.Scene(),instances:new Map(),weaponTemplates:new Map(),clips:new Map()});renderer._loaded(asset);
 const p={id:'peer',p:[0,0,0],hp:100,slot:0,weapons:{},air:'landed',deploymentState:'match_active',animationState:'harvest',locomotionState:'run',grounded:true,moveSpeed:10.2,sprinting:true,action:'harvest',actionTime:.25};
 for(let n=0;n<60;n++)renderer.update([p],{dt:1/60});
 const instance=renderer.instances.get('peer');assert.ok(instance.blend.weights.run>.99);
 renderer.update([p],{dt:0});const pose=new Map([...instance.bones].map(([name,bone])=>[name,bone.quaternion.clone()]));
 for(let n=0;n<150;n++)renderer.update([p],{dt:0});
 for(const [name,bone] of instance.bones){assert.ok(1-Math.abs(bone.quaternion.dot(pose.get(name)))<1e-6,`${name} accumulates additive rotation`);assert.ok(bone.quaternion.toArray().every(Number.isFinite));}
});

test('switching held items reuses remote meshes and independent weapon skeletons',async()=>{
 const {MatchCharacterRenderer}=await import('../public/match-character-renderer.js');
 const renderer=Object.create(MatchCharacterRenderer.prototype);Object.assign(renderer,{scene:new THREE.Scene(),firstPersonScene:new THREE.Scene(),instances:new Map(),weaponTemplates:new Map(),clips:new Map()});renderer._loaded(asset);
 const data=await readFile(new URL('../public/models/weapons/Rifle_Assault_East.glb',import.meta.url));const gun=await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');renderer.weaponTemplates.set('ar',gun.scene);
 const p={id:'peer',p:[0,0,0],hp:100,slot:0,weapons:{ar:{ammo:30}},air:'landed',deploymentState:'match_active',animationState:'idle'};
 renderer.update([p]);const instance=renderer.instances.get('peer'),pickaxe=instance.utility;
 p.slot=1;renderer.update([p]);const firstGun=instance.weaponMount;
 p.slot=0;renderer.update([p]);assert.ok(instance.utility===pickaxe,'utility switches must not allocate new GPU resources');
 p.slot=1;renderer.update([p]);assert.ok(instance.weaponMount===firstGun,'weapon switches must reuse mounts');
 const sourceBones=new Set();gun.scene.traverse(o=>{if(o.isBone)sourceBones.add(o);});firstGun.traverse(o=>{if(o.isSkinnedMesh)assert.ok(o.skeleton.bones.every(b=>!sourceBones.has(b)),'weapon clone must not share source skeleton');});
});
