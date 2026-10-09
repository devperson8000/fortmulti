// Offline fitting tool: measures actual Soldier pads against the shipped West meshes.
import {readFile,writeFile} from 'node:fs/promises';import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {MatchCharacterRenderer} from '../public/match-character-renderer.js';import {firstPersonCalibration} from '../public/first-person-calibration.js';import {WEAPON_PROFILES} from '../public/weapon-system.js';import {WEAPON_FILES} from '../public/weapon-assets.js';import {createViewModelState,stepViewModel,createWeaponPartState} from '../public/view-model.js';
const loader=new GLTFLoader().register(()=>({name:'Textures',loadTexture:()=>Promise.resolve(new THREE.Texture())}));async function load(file){const b=await readFile('public/models/'+file);return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}const r=Object.create(MatchCharacterRenderer.prototype);Object.assign(r,{scene:new THREE.Scene(),firstPersonScene:new THREE.Scene(),firstPersonCamera:new THREE.PerspectiveCamera(62,16/9,.15,820),clips:new Map(),weaponTemplates:new Map(),firstPersonInstances:new Map(),canvas:{width:1280,height:720},renderer:{setSize(){},resetState(){},render(){}},restoreRawState(){}});r._loaded(await load('Soldier.glb'));const result={};
for(const id of ['ar_sentinel','shotgun_breacher','smg_viper','sniper_longbow']){
 r.weaponTemplates.set(id,(await load('weapons/'+WEAPON_FILES[id])).scene);const c=structuredClone(firstPersonCalibration(id)),profile=WEAPON_PROFILES[id],state=createViewModelState(),parts=createWeaponPartState();for(let n=0;n<120;n++)stepViewModel(state,{weapon:profile},1/60);r.renderFirstPersonWeapon(id,profile,state,parts);const item=r.firstPersonInstances.get(id);item.c=c;
 const pose=()=>r.renderFirstPersonWeapon(id,profile,state,parts);pose();const triangles=[];item.model.traverse(mesh=>{if(!mesh.isMesh)return;const index=mesh.geometry.index;for(let i=0;i<index.count;i+=3)triangles.push(new THREE.Triangle(...[0,1,2].map(k=>mesh.getVertexPosition(index.getX(i+k),new THREE.Vector3()).applyMatrix4(mesh.matrixWorld))));});const closest=new THREE.Vector3();const distances={};
 for(const side of ['right','left'])for(const finger of ['middle','ring','pinky','thumb']){
  const bone=r.arms.bones.get(`mixamorig${side}hand${finger}3`)||r.arms.bones.get(`mixamorig${side}hand${finger}2`),offset=finger==='thumb'?(side==='right'?[-.9,2.6,1]:[-2.7,6,-2.7]):[0,{middle:3.35,ring:3.1,pinky:2.8}[finger],0],point=new THREE.Vector3();
  const distance=()=>{pose();point.fromArray(offset).applyMatrix4(bone.matrixWorld);let d=Infinity;for(const triangle of triangles)d=Math.min(d,triangle.closestPointToPoint(point,closest).distanceToSquared(point));return Math.sqrt(d);};
  const before=distance(),angles=c[side+'Fingers'][finger];let best=before;
  for(const step of [.15,.07,.025,.01])for(let pass=0;pass<3;pass++)for(let joint=0;joint<3;joint++){
   const saved=angles[joint];let chosen=saved;
   for(const sign of [-1,1]){const trial=Math.max(finger==='thumb'&&joint===0?-1.4:0,Math.min(joint===2?1.15:1.55,saved+sign*step));angles[joint]=trial;const value=distance();if(value<best){best=value;chosen=trial;}}angles[joint]=chosen;
  }
  distances[side+'-'+finger]={beforeMm:before*1000,afterMm:distance()*1000};
 }
 result[id]={calibration:c,distances};console.log(id,distances);
}
await writeFile(process.env.GRIP_FIT_OUTPUT||'/tmp/west-grip-fit.json',JSON.stringify(result,null,2));
