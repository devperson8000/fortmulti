import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MatchCharacterRenderer} from '../public/match-character-renderer.js';
import {FIRST_PERSON_CALIBRATION,adsGripPosition} from '../public/first-person-calibration.js';
import {WEAPON_PROFILES} from '../public/weapon-system.js';
import {createViewModelState,stepViewModel,createWeaponPartState,stepWeaponParts} from '../public/view-model.js';
const loader=new GLTFLoader().register(()=>({name:'Textures',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
async function load(file){const b=await readFile(new URL('../public/models/'+file,import.meta.url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const r=Object.create(MatchCharacterRenderer.prototype);
Object.assign(r,{scene:new THREE.Scene(),firstPersonScene:new THREE.Scene(),firstPersonCamera:new THREE.PerspectiveCamera(62,16/9,.15,820),clips:new Map(),weaponTemplates:new Map(),firstPersonInstances:new Map(),canvas:{width:1280,height:720},renderer:{setSize(){},resetState(){},render(){}},restoreRawState(){}});
r._loaded(await load('Soldier.glb'));
for(const [id,file] of Object.entries({ar:'Rifle_Assault_East',shotgun:'Shotgun_Pump_East',smg:'SMG_Compact_East',sniper:'Sniper_Rifle_East'}))r.weaponTemplates.set(id,(await load('weapons/'+file+'.glb')).scene);
const palm=side=>{const hand=r.arms.bones.get('mixamorig'+side+'hand');return hand.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.09*r.modelScale,0).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())));};
for(const id of Object.keys(FIRST_PERSON_CALIBRATION)){
 test(`${id}: real Soldier palms stay locked through movement, recoil, ADS and reload`,()=>{
  const profile=WEAPON_PROFILES[id],c=FIRST_PERSON_CALIBRATION[id],state=createViewModelState(),parts=createWeaponPartState();
  for(let frame=0;frame<600;frame++){
   const ads=frame>=180&&frame<280,remaining=frame>=360&&frame<540?profile.reloadDuration*(540-frame)/180:0;
   stepViewModel(state,{weapon:profile,aiming:ads,moving:frame>30&&frame<180?1:0,sprinting:frame>=90&&frame<150,strafe:frame<90?1:-1,mouseX:frame%60<10?18:0,mouseY:frame%80<10?-14:0,grounded:!(frame>=150&&frame<170),verticalVelocity:frame>=150&&frame<170?8:0,landing:frame===170?1:0,shotImpulse:frame>=280&&frame<350&&frame%7===0?1:0,reloading:remaining},1/60);
   stepWeaponParts(parts,profile,remaining);r.renderFirstPersonWeapon(id,profile,state,parts);
   const item=r.firstPersonInstances.get(id),expected=item.root.localToWorld(new THREE.Vector3(...c.rightPalm).sub(new THREE.Vector3(...c.grip)).multiplyScalar(c.scale));
   assert.ok(palm('right').distanceTo(expected)<.002,'shooting palm slipped');
   if(parts.stage==='idle'){
    const node=item.nodes.get(c.supportNode),local=node?item.root.worldToLocal(node.getWorldPosition(new THREE.Vector3())).addScaledVector(item.supportOffset,c.scale):new THREE.Vector3(...c.support).sub(new THREE.Vector3(...c.grip)).multiplyScalar(c.scale);
    assert.ok(palm('left').distanceTo(item.root.localToWorld(local))<.002,'support palm slipped');
   }
   for(const [name,bone] of r.arms.bones)assert.ok(bone.quaternion.toArray().every(Number.isFinite),name);
  }
 });
 test(`${id}: calibrated sight centres without changing scale or reversing the barrel`,()=>{
  const c=FIRST_PERSON_CALIBRATION[id],profile=WEAPON_PROFILES[id],state=createViewModelState();
  for(let n=0;n<180;n++)stepViewModel(state,{weapon:profile,aiming:true},1/60);
  r.renderFirstPersonWeapon(id,profile,state,createWeaponPartState());const item=r.firstPersonInstances.get(id);
  const sight=item.root.localToWorld(new THREE.Vector3(...c.sight).sub(new THREE.Vector3(...c.grip)).multiplyScalar(c.scale)).project(r.firstPersonCamera);
  assert.ok(Math.abs(sight.x)<.001&&Math.abs(sight.y)<.001,'ADS sight off crosshair');
  assert.equal(item.basis.scale.x,c.scale);assert.ok(c.muzzle[2]<c.grip[2]);
  const world=r.firstPersonMuzzleWorld([3,2,1],[0,0,-1],75*Math.PI/180,id),muzzle=item.flashGroup.getWorldPosition(new THREE.Vector3());
  const camera=new THREE.PerspectiveCamera(75,16/9,.15,820);camera.position.set(3,2,1);camera.lookAt(3,2,0);camera.updateMatrixWorld(true);
  const a=new THREE.Vector3(...world).project(camera),b=muzzle.project(r.firstPersonCamera);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-6,'world tracer outlet does not match the rendered muzzle');
 });
}
test('pump travel follows barrel Z, and reload completion returns exactly to the support anchor',()=>{
 const profile=WEAPON_PROFILES.shotgun,c=FIRST_PERSON_CALIBRATION.shotgun,state=createViewModelState();stepViewModel(state,{weapon:profile},1/60);
 const parts=createWeaponPartState();r.renderFirstPersonWeapon('shotgun',profile,state,parts);const item=r.firstPersonInstances.get('shotgun'),rest=item.root.worldToLocal(item.pump.getWorldPosition(new THREE.Vector3()));
 parts.action=1;r.renderFirstPersonWeapon('shotgun',profile,state,parts);const moved=item.root.worldToLocal(item.pump.getWorldPosition(new THREE.Vector3())).sub(rest);assert.ok(Math.abs(moved.y)<1e-6&&moved.z>.09*c.scale);
 stepWeaponParts(parts,profile,0);r.renderFirstPersonWeapon('shotgun',profile,state,parts);assert.ok(item.root.worldToLocal(item.pump.getWorldPosition(new THREE.Vector3())).distanceTo(rest)<1e-6);
});
test('recoil kicks backward, ADS suppresses inertia, and reload handoff does not snap',()=>{
 const profile=WEAPON_PROFILES.ar,idle=createViewModelState(),shot=createViewModelState(),ads=createViewModelState();
 for(let n=0;n<120;n++){stepViewModel(idle,{weapon:profile},1/60);stepViewModel(shot,{weapon:profile},1/60);stepViewModel(ads,{weapon:profile,aiming:true},1/60);}
 stepViewModel(shot,{weapon:profile,shotImpulse:1},1/60);assert.ok(shot.position[2]>idle.position[2]);
 stepViewModel(idle,{weapon:profile,mouseX:18},1/60);const before=ads.rotation[1];stepViewModel(ads,{weapon:profile,aiming:true,mouseX:18},1/60);assert.ok(Math.abs(ads.rotation[1]-before)<.001);
 for(const progress of [.16,.38,.7,.9]){const a=stepWeaponParts(createWeaponPartState(),profile,profile.reloadDuration*(1-progress+1e-6)),b=stepWeaponParts(createWeaponPartState(),profile,profile.reloadDuration*(1-progress-1e-6));assert.ok(Math.abs(a.rootTilt-b.rootTilt)<.004);}
});

test('weapon switches reuse meshes and keep a damped, finite grip-pivot trajectory',()=>{
 const state=createViewModelState(),parts=createWeaponPartState();let previous=null;
 for(const id of ['ar','smg','shotgun','sniper','ar'])for(let frame=0;frame<80;frame++){
  const profile=WEAPON_PROFILES[id];stepViewModel(state,{weapon:profile,equipRemaining:Math.max(0,profile.equipDuration-frame/60)},1/60);r.renderFirstPersonWeapon(id,profile,state,parts);
  if(previous)assert.ok(Math.hypot(...state.position.map((v,i)=>v-previous[i]))<.16);previous=state.position.slice();
  assert.ok(state.rotation.every(Number.isFinite));assert.equal([...r.firstPersonInstances.values()].filter(v=>v.root.visible).length,1);
 }assert.equal(r.firstPersonInstances.size,4);
});

test('first-person posing preserves upper-arm attachment translations to avoid torn sleeve skin',()=>{
 const profile=WEAPON_PROFILES.ar,state=createViewModelState();stepViewModel(state,{weapon:profile},1/60);
 const original=new Map();r.template.traverse(b=>{if(b.isBone&&/mixamorig(Right|Left)Arm$/.test(b.name))original.set(b.name,b.position.clone());});
 r.renderFirstPersonWeapon('ar',profile,state,createWeaponPartState());
 for(const [name,position]of original){const bone=[...r.arms.bones.values()].find(b=>b.name===name);assert.ok(bone.position.distanceTo(position)<1e-6,'skin attachment was translated independently');}
});
test('measured index fingertips contact each real GLB trigger instead of floating past it',()=>{
 for(const id of Object.keys(FIRST_PERSON_CALIBRATION)){
  const profile=WEAPON_PROFILES[id],state=createViewModelState();stepViewModel(state,{weapon:profile},1/60);r.renderFirstPersonWeapon(id,profile,state,createWeaponPartState());
  const item=r.firstPersonInstances.get(id),target=item.nodes.get('trigger').getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(.012*item.c.scale,0,0).applyQuaternion(item.root.getWorldQuaternion(new THREE.Quaternion()))),finger=r.arms.bones.get('mixamorigrighthandindex3');
  // The shipped Soldier mesh's distal index vertices extend 3.75 cm past this bone.
  const tip=new THREE.Vector3(0,3.75,0).applyMatrix4(finger.matrixWorld);assert.ok(tip.distanceTo(target)<(id==='shotgun'?.028:.012),`${id}: fingertip misses trigger`);
 }
});

test('utility camera framing is independent of the previously aimed weapon',()=>{
 const state=createViewModelState();for(let n=0;n<180;n++)stepViewModel(state,{weapon:WEAPON_PROFILES.ar,aiming:true},1/60);
 r.renderFirstPersonWeapon('ar',WEAPON_PROFILES.ar,state,createWeaponPartState());assert.ok(r.firstPersonCamera.fov<51);
 for(const id of ['pickaxe','shield','health','shockwave']){r.renderFirstPersonItem(id,state,{moveSpeed:0});assert.equal(r.firstPersonCamera.fov,62);for(const [bone,position]of r.arms.restPositions)assert.ok(bone.position.distanceTo(position)<1e-6,'utility posing detached a native skin attachment');}
});
