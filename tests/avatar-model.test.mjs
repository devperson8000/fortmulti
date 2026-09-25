import test from 'node:test';
import assert from 'node:assert/strict';
import {AVATAR_MODEL_PARTS,AVATAR_GEAR,AVATAR_GEAR_FEATURES,estimateAvatarTriangles} from '../public/avatar-model.js';

test('runner model has a layered silhouette with integrated outfit details',()=>{
 const ids=new Set(AVATAR_MODEL_PARTS.map(part=>part.id));
 for(const id of ['jacket-core','chest-rig','shoulder-pad','utility-belt','backpack'])assert.ok(ids.has(id),`missing ${id}`);
 for(const id of ['kneeGuard','boot','glove'])assert.ok(AVATAR_GEAR_FEATURES.includes(id),`missing ${id}`);
 assert.ok(AVATAR_MODEL_PARTS.length>=28);
 for(const part of AVATAR_MODEL_PARTS){
  assert.ok(['oval','tube'].includes(part.shape),`${part.id} uses a supported smooth shape`);
  assert.ok(part.position.every(Number.isFinite),`${part.id} has finite position`);
  assert.ok(part.size.every(value=>Number.isFinite(value)&&value>0),`${part.id} has positive dimensions`);
  if(part.shape==='tube')assert.ok(part.from.every(Number.isFinite)&&part.to.every(Number.isFinite));
  assert.ok(typeof part.material==='string');
 }
 assert.ok(AVATAR_GEAR.kneeGuard.mirror&&AVATAR_GEAR.boot.mirror&&AVATAR_GEAR.glove.mirror);
 assert.ok(estimateAvatarTriangles()>=5000,'the visible avatar detail has a healthy mesh budget');
});

test('left and right gear details mirror around the torso centerline',()=>{
 const mirrored=new Set([...AVATAR_MODEL_PARTS.filter(part=>part.mirror).map(part=>part.id),...Object.entries(AVATAR_GEAR).filter(([,part])=>part.mirror).map(([id])=>id)]);
 for(const id of ['shoulder-pad','utility-pouch','thighPanel','kneeGuard','boot','glove'])assert.ok(mirrored.has(id));
});
