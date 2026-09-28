import test from 'node:test';
import assert from 'node:assert/strict';
import {AVATAR_MODEL_PARTS,AVATAR_GEAR,AVATAR_GEAR_FEATURES,estimateAvatarTriangles} from '../public/avatar-model.js';

test('soldier model has a clean modern infantry silhouette with restrained gear',()=>{
 const ids=new Set(AVATAR_MODEL_PARTS.map(part=>part.id));
 for(const id of ['uniform-torso','carrier-body','helmet-shell','helmet-brim','headset-cup','magazine-pouch','utility-belt','backpack'])assert.ok(ids.has(id),`missing ${id}`);
 for(const id of ['thighPanel','kneeGuard','boot','glove'])assert.ok(AVATAR_GEAR_FEATURES.includes(id),`missing ${id}`);
 for(const id of ['face-mask','visor-lens','chest-emblem','pack-light'])assert.ok(!ids.has(id),`unexpected decorative part ${id}`);
 assert.ok(AVATAR_MODEL_PARTS.length<=28,'the soldier kit stays deliberately simple');
 for(const part of AVATAR_MODEL_PARTS){
  assert.ok(['oval','tube'].includes(part.shape),`${part.id} uses a supported smooth shape`);
  assert.ok(part.position.every(Number.isFinite),`${part.id} has finite position`);
  assert.ok(part.size.every(value=>Number.isFinite(value)&&value>0),`${part.id} has positive dimensions`);
  if(part.shape==='tube')assert.ok(part.from.every(Number.isFinite)&&part.to.every(Number.isFinite));
  assert.ok(typeof part.material==='string');
 }
 assert.ok(AVATAR_GEAR.kneeGuard.mirror&&AVATAR_GEAR.boot.mirror&&AVATAR_GEAR.glove.mirror);
 assert.ok(estimateAvatarTriangles()>=5000,'the visible soldier silhouette retains enough mesh detail');
 assert.ok(estimateAvatarTriangles()<=18000,'the simpler soldier kit stays within a restrained mesh budget');
});

test('left and right gear details mirror around the torso centerline',()=>{
 const mirrored=new Set([...AVATAR_MODEL_PARTS.filter(part=>part.mirror).map(part=>part.id),...Object.entries(AVATAR_GEAR).filter(([,part])=>part.mirror).map(([id])=>id)]);
 for(const id of ['headset-cup','magazine-pouch','utility-pouch','thighPanel','kneeGuard','boot','glove'])assert.ok(mirrored.has(id));
});
