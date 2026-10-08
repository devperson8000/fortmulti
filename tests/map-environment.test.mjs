import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {ENVIRONMENT_MODELS,ENVIRONMENT_MODEL_FILES,environmentPlacement,environmentPlacements} from '../public/map-environment.js';

test('all Kenney nature models have real local GLB assets',async()=>{
 assert.equal(ENVIRONMENT_MODEL_FILES.length,7);
 for(const file of ENVIRONMENT_MODEL_FILES){
  assert.ok(!file.includes('..'));
  const path=new URL('../public/models/environment/'+file,import.meta.url);
  await access(path);
  const buffer=await readFile(path);
  assert.equal(buffer.subarray(0,4).toString(),'glTF',file+' is a real glTF binary');
  assert.ok(buffer.length>1500&&buffer.length<100000,'keep the scenery game-ready and lightweight');
 }
});
test('environment placement uses stable actual resource IDs and terrain coordinates',()=>{
 const items=[{id:'tree:25',kind:'wood',x:-90,y:11,z:35},{id:'tree:122',kind:'wood',x:230,y:1,z:-16},{id:'rock:4',kind:'stone',x:65,y:8,z:77}];
 const a=environmentPlacements(items),b=environmentPlacements(items);
 assert.deepEqual(a,b,'multiplayer clients must see the same models');
 assert.equal(a.length,3);
 for(let i=0;i<a.length;i++){
  const item=a[i],original=items[i];
  assert.ok(ENVIRONMENT_MODELS[item.kind].includes(item.name));
  assert.deepEqual([item.x,item.y,item.z],[original.x,original.y,original.z]);
  assert.ok(item.height>1&&item.height<12);
  assert.ok(item.rotation>=0&&item.rotation<Math.PI*2);
 }
 assert.equal(environmentPlacement({id:'test',kind:'invalid',x:0,y:0,z:0}),null);
 assert.equal(environmentPlacement({id:'tree:1',kind:'wood',x:Infinity,y:0,z:0}),null);
});
test('Kenney instancing follows resource depletion and restores procedural fallback on failure',async()=>{
 const engine=await readFile(new URL('../public/engine.js',import.meta.url),'utf8');
 const renderer=await readFile(new URL('../public/map-environment-renderer.js',import.meta.url),'utf8');
 assert.match(engine,/matchCharacterRenderer\?\.setMapResources\(resources\)/);
 assert.match(engine,/!matchCharacterRenderer\?\.mapModelReady\(range.kind\)/);
 assert.match(renderer,/resourceHP\?\.get\(batch.places\[i\].id\)/);
 assert.match(renderer,/mesh\.instanceMatrix\.needsUpdate=true/);
 assert.match(renderer,/names\.every\(name=>this.models.has\(name\)\)/);
});
