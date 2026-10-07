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
 const p={id:'peer',p:[0,0,0],hp:100,slot:0,inventory:[{id:'ar',type:'ar',ammo:30},null,null,null,null],air:'landed',deploymentState:'match_active',animationState:'idle'};
 renderer.update([p]);const instance=renderer.instances.get('peer'),pickaxe=instance.utility;
 p.slot=1;renderer.update([p]);const firstGun=instance.weaponMount;
 p.slot=0;renderer.update([p]);assert.ok(instance.utility===pickaxe,'utility switches must not allocate new GPU resources');
 p.slot=1;renderer.update([p]);assert.ok(instance.weaponMount===firstGun,'weapon switches must reuse mounts');
 const sourceBones=new Set();gun.scene.traverse(o=>{if(o.isBone)sourceBones.add(o);});firstGun.traverse(o=>{if(o.isSkinnedMesh)assert.ok(o.skeleton.bones.every(b=>!sourceBones.has(b)),'weapon clone must not share source skeleton');});
});

test('match contact shadows follow ground and presentation motion settles after landing',async()=>{
 const {MatchCharacterRenderer}=await import('../public/match-character-renderer.js');
 const renderer=Object.create(MatchCharacterRenderer.prototype);Object.assign(renderer,{scene:new THREE.Scene(),firstPersonScene:new THREE.Scene(),instances:new Map(),weaponTemplates:new Map(),clips:new Map()});renderer._loaded(asset);
 const p={id:'peer',p:[0,3,0],hp:100,slot:0,weapons:{},air:'landed',deploymentState:'match_active',grounded:false,groundY:0,vy:-15,moveSpeed:5,yaw:0};
 renderer.update([p]);const instance=renderer.instances.get('peer');assert.ok(instance.contactShadow.visible);assert.equal(instance.contactShadow.position.y,.025);assert.ok(instance.contactShadow.material.opacity<.4);
 p.p[1]=0;p.vy=0;p.grounded=true;p.moveSpeed=0;renderer.update([p]);assert.ok(instance.model.position.y<0);
 for(let n=0;n<180;n++)renderer.update([p]);assert.ok(Math.abs(instance.model.position.y)<.001);assert.ok(Math.abs(instance.model.rotation.x)<.001);
 renderer.update([]);assert.equal(renderer.instances.size,0);assert.ok(!renderer.scene.children.includes(instance.contactShadow));
});
test('remote rendering resolves arbitrary slot five from the instance inventory',async()=>{
 const {MatchCharacterRenderer}=await import('../public/match-character-renderer.js');const r=Object.create(MatchCharacterRenderer.prototype);Object.assign(r,{scene:new THREE.Scene(),firstPersonScene:new THREE.Scene(),instances:new Map(),weaponTemplates:new Map(),clips:new Map()});r._loaded(asset);
 const bytes=await readFile(new URL('../public/models/weapons/Rifle_Assault_East.glb',import.meta.url));r.weaponTemplates.set('ar',(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene);
 r.update([{id:'remote',p:[0,0,0],hp:100,slot:5,inventory:[null,null,null,null,{id:'a',type:'ar',ammo:7}],weapon:'ar',air:'landed',deploymentState:'match_active'}]);assert.equal(r.instances.get('remote').weaponId,'ar');assert.ok(r.instances.get('remote').weaponMount);
});

test('remote firearms face forward and both real palms follow model contacts through animation',async()=>{
 const {MatchCharacterRenderer}=await import('../public/match-character-renderer.js');const {firstPersonCalibration}=await import('../public/first-person-calibration.js');
 const r=Object.create(MatchCharacterRenderer.prototype);Object.assign(r,{scene:new THREE.Scene(),firstPersonScene:new THREE.Scene(),instances:new Map(),weaponTemplates:new Map(),clips:new Map()});r._loaded(asset);
 const files={ar:'Rifle_Assault_East',shotgun:'Shotgun_Pump_East',smg:'SMG_Compact_East',sniper:'Sniper_Rifle_East'};
 for(const [type,file]of Object.entries(files)){const b=await readFile(new URL('../public/models/weapons/'+file+'.glb',import.meta.url));r.weaponTemplates.set(type,(await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene);}
 for(const type of Object.keys(files))for(const mode of ['idle','run','aim','crouch','reload','up','down','slide','jump','fall']){
  const p={id:'peer',p:[3,0,2],yaw:.4,pitch:mode==='down'?-.8:mode==='up'?.6:0,hp:100,slot:1,inventory:[{id:'w',type,ammo:5},null,null,null,null],air:'landed',deploymentState:'match_active',grounded:!['jump','fall'].includes(mode),vy:mode==='jump'?8:mode==='fall'?-8:0,sliding:mode==='slide',moveSpeed:mode==='slide'?10.2:mode==='run'?6:0,aim:mode==='aim',crouching:mode==='crouch'||mode==='slide',reload:mode==='reload'?1:0};
  for(let n=0;n<30;n++)r.update([p],{dt:1/60});const instance=r.instances.get('peer'),mount=instance.weaponMount,c=firstPersonCalibration(type);
  assert.equal(mount.parent,instance.holder,'weapon must not inherit hand rotation');
  const shoulderCenter=['left','right'].map(side=>instance.holder.worldToLocal(instance.bones.get('mixamorig'+side+'arm').getWorldPosition(new THREE.Vector3()))).reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(.5);assert.ok(mount.position.z<shoulderCenter.z-.12,'weapon grip is behind the torso');assert.ok(mount.position.y<shoulderCenter.y-.09,'receiver is at head height');assert.ok(mount.position.x>=shoulderCenter.x+.14,'stock is centred through the chest');
  const head=instance.holder.worldToLocal(instance.bones.get('mixamorighead').getWorldPosition(new THREE.Vector3())),receiver=instance.holder.worldToLocal(mount.userData.nodes.get('trigger').getWorldPosition(new THREE.Vector3()));assert.ok(receiver.z<head.z-.08,'actual receiver intersects the head');
  const direction=new THREE.Vector3(0,0,-1).applyQuaternion(mount.getWorldQuaternion(new THREE.Quaternion()));assert.ok(direction.dot(new THREE.Vector3(-Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),-Math.cos(p.yaw)*Math.cos(p.pitch)))>.9,'barrel is upright or reversed');
  for(const side of ['right','left']){const hand=instance.bones.get('mixamorig'+side+'hand'),palm=hand.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.09*r.modelScale,0).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())));const target=mount.userData.contacts?.[side];assert.ok(target&&palm.distanceTo(target)<.003,`${type} ${mode} ${side} palm lost contact ${target&&palm.distanceTo(target)}`);}
  const model=mount.children[0],hand=instance.bones.get('mixamorigrighthand'),palm=hand.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.09*r.modelScale,0).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())));assert.ok(palm.distanceTo(model.localToWorld(new THREE.Vector3(...c.rightPalm)))<.003,'shooting palm does not meet the actual GLB grip');
  const trigger=mount.userData.nodes.get('trigger').getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(.012*c.scale,0,0).applyQuaternion(mount.getWorldQuaternion(new THREE.Quaternion()))),tip=new THREE.Vector3(0,3.75,0).applyMatrix4(instance.bones.get('mixamorigrighthandindex3').matrixWorld);assert.ok(tip.distanceTo(trigger)<(type==='shotgun'?.028:.012),'actual trigger fingertip misses');
  assert.equal(mount.userData.calibration,c);
 }
});
