import {triggerSurfaceContact,weaponPartTriangles} from './helpers/weapon-contacts.mjs';
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
   for(const side of ['right','left']){const hand=r.arms.bones.get(`mixamorig${side}hand`),fore=r.arms.bones.get(`mixamorig${side}forearm`),axis=hand.getWorldPosition(new THREE.Vector3()).sub(fore.getWorldPosition(new THREE.Vector3())).normalize(),fingers=new THREE.Vector3(0,1,0).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()));assert.ok(axis.angleTo(fingers)<95*Math.PI/180,`${id} frame ${frame} ${side} wrist folds backward`);}
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
  const item=r.firstPersonInstances.get(id),target=triggerSurfaceContact(item.model,item.root.getWorldQuaternion(new THREE.Quaternion()),item.c.scale),finger=r.arms.bones.get('mixamorigrighthandindex3');
  // The finger pad lies inside the distal mesh, 3.1 native units past its bone.
  const tip=new THREE.Vector3(0,3.1,0).applyMatrix4(finger.matrixWorld);assert.ok(tip.distanceTo(target)<.012,`${id}: fingertip misses trigger`);
 }
});

test('utility camera framing is independent of the previously aimed weapon',()=>{
 const state=createViewModelState();for(let n=0;n<180;n++)stepViewModel(state,{weapon:WEAPON_PROFILES.ar,aiming:true},1/60);
 r.renderFirstPersonWeapon('ar',WEAPON_PROFILES.ar,state,createWeaponPartState());assert.ok(r.firstPersonCamera.fov<51);
 for(const id of ['pickaxe','shield','health','shockwave']){r.renderFirstPersonItem(id,state,{moveSpeed:0});assert.equal(r.firstPersonCamera.fov,62);for(const [bone,position]of r.arms.restPositions)assert.ok(bone.position.distanceTo(position)<1e-6,'utility posing detached a native skin attachment');}
});

test('pickaxe index closes around the actual shaft rather than floating beside it',()=>{
 const state=createViewModelState();r.renderFirstPersonItem('pickaxe',state,{moveSpeed:0});const item=r.utilities.get('pickaxe'),finger=r.arms.bones.get('mixamorigrighthandindex3'),tip=item.worldToLocal(new THREE.Vector3(0,3.75,0).applyMatrix4(finger.matrixWorld));assert.ok(Math.hypot(tip.x,tip.z)<.065,`index is too far from the shaft ${tip.toArray()}`);assert.ok(tip.y>-.3&&tip.y<.25,'index missed the grip section');
});

for(const id of Object.keys(FIRST_PERSON_CALIBRATION))test(`${id}: native support palm faces into the weapon and fingers curl inward`,()=>{
 const state=createViewModelState();stepViewModel(state,{weapon:WEAPON_PROFILES[id]},1/60);r.renderFirstPersonWeapon(id,WEAPON_PROFILES[id],state,createWeaponPartState());
 const item=r.firstPersonInstances.get(id),hand=r.arms.bones.get('mixamoriglefthand');
 const inward=new THREE.Vector3(-1,0,0).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())),up=new THREE.Vector3(0,1,0).applyQuaternion(item.root.getWorldQuaternion(new THREE.Quaternion()));
 assert.ok(inward.dot(up)>.99,'support palm faces away from the underside');
 for(const name of ['index','middle','ring','pinky']){const base=r.arms.bones.get('mixamoriglefthand'+name+'1'),distal=r.arms.bones.get('mixamoriglefthand'+name+'3')||r.arms.bones.get('mixamoriglefthand'+name+'2'),tip=hand.worldToLocal(new THREE.Vector3(0,name==='pinky'?2.5:3.75,0).applyMatrix4(distal.matrixWorld)),origin=hand.worldToLocal(base.getWorldPosition(new THREE.Vector3()));assert.ok(tip.x<origin.x-1,`${name}: actual fingertip curls away from palm`);}
});

test('all gripping fingers contact the real weapon surface instead of closing in empty space',()=>{
 const tips={index:[0,3.4,0],middle:[0,3.35,0],ring:[0,3.1,0],pinky:[0,2.8,0]};
 for(const id of Object.keys(FIRST_PERSON_CALIBRATION)){
  const state=createViewModelState();for(let n=0;n<120;n++)stepViewModel(state,{weapon:WEAPON_PROFILES[id]},1/60);
  r.renderFirstPersonWeapon(id,WEAPON_PROFILES[id],state,createWeaponPartState());const item=r.firstPersonInstances.get(id),triangles=[];
  item.model.traverse(mesh=>{if(!mesh.isMesh)return;const index=mesh.geometry.index,position=mesh.geometry.attributes.position;
   for(let i=0;i<(index?.count||position.count);i+=3){const points=[];for(let k=0;k<3;k++)points.push(mesh.getVertexPosition(index?index.getX(i+k):i+k,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));triangles.push(new THREE.Triangle(...points));}
  });
  for(const side of ['right','left'])for(const finger of ['middle','ring','pinky','thumb']){
   const bone=r.arms.bones.get(`mixamorig${side}hand${finger}3`)||r.arms.bones.get(`mixamorig${side}hand${finger}2`);
   const offset=finger==='thumb'?(side==='right'?[-.9,2.6,1]:[-2.7,6,-2.7]):tips[finger],point=new THREE.Vector3(...offset).applyMatrix4(bone.matrixWorld),nearest=new THREE.Vector3();let distance=Infinity;
   for(const triangle of triangles)distance=Math.min(distance,triangle.closestPointToPoint(point,nearest).distanceTo(point));
   assert.ok(distance<.018,`${id} ${side} ${finger} floats ${(distance*1000).toFixed(1)} mm from the weapon`);
  }
 }
});

test('trigger fingers use a natural joint range rather than folding back through the hand',()=>{
 for(const id of Object.keys(FIRST_PERSON_CALIBRATION)){
  const state=createViewModelState();stepViewModel(state,{weapon:WEAPON_PROFILES[id]},1/60);r.renderFirstPersonWeapon(id,WEAPON_PROFILES[id],state,createWeaponPartState());
  for(const [joint,limit] of [[1,1.5],[2,1.65],[3,1.15]]){
   const bone=r.arms.bones.get('mixamorigrighthandindex'+joint),relative=r.arms.rest.get(bone).clone().invert().multiply(bone.quaternion);
   assert.ok(relative.angleTo(new THREE.Quaternion())<=limit,`${id} index joint ${joint} is over-folded`);
  }
 }
});

test('first-person forearms approach the hands without folding wrists backward',()=>{
 for(const id of Object.keys(FIRST_PERSON_CALIBRATION))for(const mode of ['hip','ads','reload']){
  const profile=WEAPON_PROFILES[id],state=createViewModelState(),parts=createWeaponPartState();
  for(let n=0;n<120;n++)stepViewModel(state,{weapon:profile,aiming:mode==='ads'},1/60);
  stepWeaponParts(parts,profile,mode==='reload'?profile.reloadDuration*.5:0);for(let n=0;n<30;n++)r.renderFirstPersonWeapon(id,profile,state,parts);
  for(const side of ['right','left']){
   const hand=r.arms.bones.get(`mixamorig${side}hand`),fore=r.arms.bones.get(`mixamorig${side}forearm`),direction=hand.getWorldPosition(new THREE.Vector3()).sub(fore.getWorldPosition(new THREE.Vector3())).normalize(),fingers=new THREE.Vector3(0,1,0).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())),angle=direction.angleTo(fingers)*180/Math.PI;
   assert.ok(angle<95,`${id} ${mode} ${side} wrist folds backward ${angle.toFixed(1)} degrees`);
  }
 }
});

test('pickaxe palm and every gripping finger wrap the shaft',()=>{
 r.renderFirstPersonItem('pickaxe',createViewModelState(),{moveSpeed:0});const item=r.utilities.get('pickaxe');
 for(const [finger,offset] of Object.entries({index:[0,3.4,0],middle:[0,3.35,0],ring:[0,3.1,0],pinky:[0,2.8,0],thumb:[-.9,2.6,1]})){
  const bone=r.arms.bones.get(`mixamorigrighthand${finger}3`)||r.arms.bones.get(`mixamorigrighthand${finger}2`),point=item.worldToLocal(new THREE.Vector3(...offset).applyMatrix4(bone.matrixWorld));
  assert.ok(Math.hypot(point.x,point.z)<.05,`${finger} does not wrap the actual pickaxe shaft`);assert.ok(point.y>-.3&&point.y<.2);
 }
 const hand=r.arms.bones.get('mixamorigrighthand'),point=item.worldToLocal(hand.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.09*r.modelScale,0).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()))));
 assert.ok(Math.hypot(point.x,point.z)<.08,'the palm must sit beside the shaft');
});


test('reload hands turn inward and close around the actual magazines',()=>{
 for(const id of ['ar','smg','sniper']){
  const profile=WEAPON_PROFILES[id],state=createViewModelState(),parts=createWeaponPartState();for(let n=0;n<120;n++)stepViewModel(state,{weapon:profile},1/60);
  stepWeaponParts(parts,profile,profile.reloadDuration*.7);for(let n=0;n<30;n++)r.renderFirstPersonWeapon(id,profile,state,parts);
  const item=r.firstPersonInstances.get(id),hand=r.arms.bones.get('mixamoriglefthand'),normal=new THREE.Vector3(-1,0,0).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())),inward=new THREE.Vector3(1,0,0).applyQuaternion(item.root.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(normal.dot(inward)>.99,`${id}: reload palm must face the magazine side`);
  const triangles=weaponPartTriangles(item.model,'magazine');assert.ok(triangles.length>0);
  for(const [finger,offset] of Object.entries({index:[0,3.1,0],middle:[0,3.35,0],ring:[0,3.1,0],pinky:[0,2.8,0],thumb:[-2.7,6,-2.7]})){
   const bone=r.arms.bones.get(`mixamoriglefthand${finger}3`)||r.arms.bones.get(`mixamoriglefthand${finger}2`),point=new THREE.Vector3(...offset).applyMatrix4(bone.matrixWorld),near=new THREE.Vector3();let distance=Infinity;
   for(const t of triangles)distance=Math.min(distance,t.closestPointToPoint(point,near).distanceTo(point));
   assert.ok(distance<.024,`${id} reload ${finger} floats ${(distance*1000).toFixed(1)} mm from its magazine`);
  }
 }
});
