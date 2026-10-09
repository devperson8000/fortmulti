import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolveCharacterAnimation,createAnimationBlend,stepAnimationBlend} from '../public/character-animation.js';

const glbJson=async path=>{const data=await readFile(new URL(path,import.meta.url));assert.equal(data.toString('ascii',0,4),'glTF');assert.equal(data.readUInt32LE(4),2);let offset=12;while(offset<data.length){const length=data.readUInt32LE(offset),type=data.readUInt32LE(offset+4);offset+=8;if(type===0x4e4f534a)return JSON.parse(data.toString('utf8',offset,offset+length).replace(/[\u0000\s]+$/g,''));offset+=length;}throw new Error(`No JSON chunk in ${path}`);};

test('the match uses the bundled Soldier skeleton with real Idle, Walk and Run clips',async()=>{
 const gltf=await glbJson('../public/models/Soldier.glb'),names=gltf.animations.map(animation=>animation.name);for(const name of['Idle','Walk','Run'])assert.ok(names.includes(name),name);
 const renderer=await readFile(new URL('../public/match-character-renderer.js',import.meta.url),'utf8');assert.match(renderer,/GLTFLoader/);assert.match(renderer,/SkeletonUtils\.js/);assert.match(renderer,/\/models\/Soldier\.glb/);assert.match(renderer,/stepAnimationBlend/);
});

test('all match weapon variants are local GLB assets covered by the CC0 notice',async()=>{
 const [rifle,shotgun,smg,sniper,notice]=await Promise.all([
  glbJson('../public/models/weapons/Rifle_Assault_East.glb'),glbJson('../public/models/weapons/Shotgun_Pump_East.glb'),glbJson('../public/models/weapons/SMG_Compact_East.glb'),glbJson('../public/models/weapons/Sniper_Rifle_East.glb'),readFile(new URL('../public/models/ASSET-LICENSES.md',import.meta.url),'utf8')
 ]);assert.ok([rifle,shotgun,smg,sniper].every(asset=>asset.meshes?.length>0));assert.match(notice,/CC0/);assert.match(notice,/opengameart\.org/);
});

test('locomotion blends instead of snapping and unsupported poses fall back cleanly',()=>{
 let blend=createAnimationBlend('idle');for(let frame=0;frame<5;frame++)blend=stepAnimationBlend(blend,{state:resolveCharacterAnimation({speed:5,sprinting:true}).state,supported:new Set(['idle','walk','run'])},.016);
 assert.ok(blend.weights.idle>0&&blend.weights.run>0);assert.ok(Math.abs(Object.values(blend.weights).reduce((sum,value)=>sum+value,0)-1)<1e-8);
 for(let frame=0;frame<40;frame++)blend=stepAnimationBlend(blend,{state:'fall',supported:new Set(['idle','walk','run'])},.016);assert.equal(blend.state,'idle');assert.ok(blend.weights.idle>.98);
});

test('the raw WebGL game keeps local first-person guns and renders animated GLB peers',async()=>{
 const engine=await readFile(new URL('../public/engine.js',import.meta.url),'utf8'),renderer=await readFile(new URL('../public/match-character-renderer.js',import.meta.url),'utf8');
 assert.match(engine,/getContext\('webgl2'/);assert.match(engine,/drawFirstPersonViewModel\(profile(?:,|\))/);assert.match(engine,/matchCharacterRenderer\.update\(entities/);assert.match(engine,/matchCharacterRenderer\.render\(/);assert.match(renderer,/WEAPON_FILES/);assert.match(renderer,/instance\.mixer\.update/);
});

test('first-person rendering can draw a cached GLB after the raw arm viewmodel pass',async()=>{
 const engine=await readFile(new URL('../public/engine.js',import.meta.url),'utf8'),renderer=await readFile(new URL('../public/match-character-renderer.js',import.meta.url),'utf8');
 const hands=engine.indexOf('drawFirstPersonViewModel(profile,'),weapon=engine.indexOf('matchCharacterRenderer.renderFirstPersonWeapon(');
 assert.ok(hands>=0,'the first-person arm pass should remain in the game renderer');
 assert.ok(weapon>hands,'the cached Three.js weapon must share the first-person depth pass after the arms');
 assert.match(engine,/hasFirstPersonWeapon\(profile\.id\)/,'the procedural weapon must remain as an asset-loading fallback');
 assert.match(renderer,/firstPersonInstances/,'first-person GLBs should be cloned and cached per weapon');
 assert.match(renderer,/weaponTemplates\.get\(weaponId\)/,'first-person views must use the bundled licensed weapon files');
});


test('remote crouch and slide presentation uses smooth pose blends and alternating crouch steps',async()=>{
 const renderer=await readFile(new URL('../public/match-character-renderer.js',import.meta.url),'utf8');
 assert.match(renderer,/slideBlend/);assert.match(renderer,/crouchBlend/);assert.match(renderer,/crouchStep/);assert.match(renderer,/poseLegChain/);
});
