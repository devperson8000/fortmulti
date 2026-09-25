import test from 'node:test';
import assert from 'node:assert/strict';
import {WEAPON_MODELS,weaponModelStats} from '../public/weapon-model.js';
import {WEAPON_ORDER} from '../public/weapon-system.js';

test('each weapon has a detailed original silhouette and animated magazine parts',()=>{
 for(const id of WEAPON_ORDER){
  const model=WEAPON_MODELS[id],ids=new Set(model.parts.map(part=>part.id));
  assert.ok(model.parts.length>=24,`${id} needs layered exterior details`);
  assert.ok(ids.has('receiver')&&ids.has('barrel')&&ids.has('muzzle')&&ids.has('grip'),`${id} has a readable core silhouette`);
  assert.ok(model.parts.some(part=>part.motion==='magazine'));
  assert.ok(weaponModelStats(id).triangles>=1100,`${id} has a higher-detail mesh`);
  for(const part of model.parts){
   assert.ok(['box','oval','tube'].includes(part.shape));
   assert.ok(part.position.every(Number.isFinite));
   assert.ok(part.size.every(value=>Number.isFinite(value)&&value>0));
   assert.ok(typeof part.material==='string');
  }
 }
});

test('weapon silhouettes remain distinct across all four slots',()=>{
 const signatures=WEAPON_ORDER.map(id=>WEAPON_MODELS[id].parts.map(part=>part.id).join('|'));
 assert.equal(new Set(signatures).size,WEAPON_ORDER.length);
 assert.ok(WEAPON_MODELS.sniper.parts.some(part=>part.id==='optic-glass'));
 assert.ok(WEAPON_MODELS.shotgun.parts.some(part=>part.id==='pump-grip'));
});
