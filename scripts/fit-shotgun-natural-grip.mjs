// Offline fitting against native trigger and stock surfaces; writes review data only.
import {WEAPON_FILES} from '../public/weapon-assets.js';
import {triggerSurfaceContact,weaponPartTriangles} from '../tests/helpers/weapon-contacts.mjs';
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
for(const [id,file] of Object.entries(WEAPON_FILES))r.weaponTemplates.set(id,(await load('weapons/'+file)).scene);
const palm=side=>{const hand=r.arms.bones.get('mixamorig'+side+'hand');return hand.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.09*r.modelScale,0).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())));};

import {pathToFileURL} from 'node:url';
const source=await readFile('public/soldier-arms.js','utf8');


const id='shotgun',state=createViewModelState(),parts=createWeaponPartState(),profile=WEAPON_PROFILES[id];for(let n=0;n<180;n++)stepViewModel(state,{weapon:profile},1/60);r.renderFirstPersonWeapon(id,profile,state,parts);const item=r.firstPersonInstances.get(id),c=structuredClone(item.c);item.c=c;
const pose=()=>r.renderFirstPersonWeapon(id,profile,state,parts),trigger=triggerSurfaceContact(item.model,item.root.getWorldQuaternion(new THREE.Quaternion()),c.scale),all=weaponPartTriangles(item.model,'body');
const local=p=>item.root.worldToLocal(p.clone()).divideScalar(c.scale).add(new THREE.Vector3(...c.grip));
const stock=all.filter(t=>[t.a,t.b,t.c].every(p=>local(p).z>.14));
const near=new THREE.Vector3(),distance=(p,ts)=>{let d=Infinity;for(const t of ts)d=Math.min(d,t.closestPointToPoint(p,near).distanceToSquared(p));return d;};
const pad=(finger,offset)=>new THREE.Vector3(...offset).applyMatrix4((r.arms.bones.get('mixamorigrighthand'+finger+'3')||r.arms.bones.get('mixamorigrighthand'+finger+'2')).matrixWorld);
const cost=()=>{pose();const index=pad('index',[0,3.1,0]),palm=item.root.localToWorld(new THREE.Vector3(...c.rightPalm).sub(new THREE.Vector3(...c.grip)).multiplyScalar(c.scale));let score=index.distanceToSquared(trigger)*18+distance(palm,stock)*3;
 for(const [f,o]of Object.entries({middle:[0,3.35,0],ring:[0,3.1,0],pinky:[0,2.8,0],thumb:[-.9,2.6,1]}))score+=distance(pad(f,o),stock)*2;
 return score;};
console.log('stockTriangles',stock.length,'original',cost());
c.rightRotation[0]=-1.4;c.rightPalm[1]=-.04;
const params=[[c.rightPalm,0,.012,.032,.003],[c.rightPalm,1,-.07,-.02,.005],[c.rightPalm,2,.16,.27,.008],...['index','middle','ring','pinky','thumb'].flatMap(f=>[0,1,2].map(j=>[c.rightFingers[f],j,f==='thumb'&&j===0?-1.4:0,j===2?1.15:1.55,.12])),[c.rightSplay.index,0,-.6,.3,.07],[c.rightSplay.thumb,0,-1.5,.5,.1],[c,'rightThumbOpposition',-.8,.8,.08]];
let best=cost();
for(const multiplier of [1,.5,.2,.08])for(let pass=0;pass<10;pass++){
 let improved=false;for(const [object,key,min,max,step]of params){const saved=object[key];let selected=saved;
 for(const sign of [-1,1]){object[key]=Math.max(min,Math.min(max,saved+sign*step*multiplier));const value=cost();if(value<best){best=value;selected=object[key];improved=true;}}
 object[key]=selected;}
 if(!improved)break;
}
pose();console.log('final',best,'indexMm',pad('index',[0,3.1,0]).distanceTo(trigger)*1000,'palm',c.rightPalm,'rotation',c.rightRotation);
for(const [f,o]of Object.entries({middle:[0,3.35,0],ring:[0,3.1,0],pinky:[0,2.8,0],thumb:[-.9,2.6,1]}))console.log(f,Math.sqrt(distance(pad(f,o),stock))*1000);
await import('node:fs/promises').then(fs=>fs.writeFile('/tmp/shotgun-natural-fit.json',JSON.stringify(c,null,2)));
