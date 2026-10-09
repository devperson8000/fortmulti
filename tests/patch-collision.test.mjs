import test from 'node:test';
import assert from 'node:assert/strict';
import {patchColliders,rayCollider,segmentColliderTime,boundsIntersectCollider,nativeSupportHeight} from '../public/collision-shapes.js';
import {moveHorizontal,upwardLimit,canStandAt} from '../public/movement-collision.js';
import {PLATFORM_COLLISION} from '../public/maps/platform23/collision-data.js';
const floorPatch={source:1,flags:['metal'],positions:[0,0,0,4,0,0,0,0,4]};
const [floor]=patchColliders([floorPatch]);

test('patch collision uses the actual triangle, including two-sided shots and build bounds',()=>{
 assert.ok(Math.abs(rayCollider([1,1,1],[0,-1,0],floor)-.995)<1e-9);
 assert.ok(Math.abs(rayCollider([1,-1,1],[0,1,0],floor)-.995)<1e-9);
 assert.equal(segmentColliderTime([3,1,3],[3,-1,3],floor),null,'empty triangle corner stays clear');
 assert.equal(boundsIntersectCollider({min:[2.8,-.1,2.8],max:[3.2,.1,3.2]},floor),false);
 assert.equal(boundsIntersectCollider({min:[.8,-.1,.8],max:[1.2,.1,1.2]},floor),true);
 assert.ok(Math.abs(nativeSupportHeight(floor,1,1,0,.1)-.005)<1e-9);
});

test('patch ceilings stop upward bodies and preserve native head clearance',()=>{
 const [ceiling]=patchColliders([{...floorPatch,positions:floorPatch.positions.map((v,i)=>i%3===1?v+1.5:v)}]);
 assert.equal(canStandAt([1,0,1],[ceiling]),false);
 assert.equal(canStandAt([3,0,3],[ceiling]),true);
 assert.ok(Math.abs(upwardLimit([1,-.5,1],0,[ceiling])+.285)<1e-9);
 assert.equal(upwardLimit([1,0,1],.1,[ceiling],{crouching:true}),.1);
});

test('vertical patch triangles stop high speed movement without blocking empty corners',()=>{
 const [wall]=patchColliders([{positions:[0,0,0,0,4,0,0,0,4]}]);
 const p=[-3,0,1];moveHorizontal(p,8,0,[wall]);assert.ok(Math.abs(p[0]+.365)<1e-9);
 const clear=[-3,3,3];moveHorizontal(clear,8,0,[wall]);assert.equal(clear[0],5);
});

test('actual Platform 23 curved ceiling blocks previously missed shot and camera segments',()=>{
 const patch=PLATFORM_COLLISION.patches.find(p=>p.source===1),colliders=patchColliders([patch]);
 const from=[13.833333333333334,4.109550623364643,45.46933518290492],to=[13.833333333333334,4.390449376635357,45.36399815042841];
 assert.equal(PLATFORM_COLLISION.brushes.some(b=>segmentColliderTime(from,to,b)!==null),false,'fixture is uncovered by brushes');
 assert.ok(colliders.some(b=>segmentColliderTime(from,to,b)!==null),'curved ceiling blocks the crossing');
 const direction=to.map((v,i)=>v-from[i]);assert.ok(colliders.some(b=>rayCollider(from,direction,b)<1),'camera ray uses the same exact surface');
});

test('degenerate and explicitly nonsolid patch data create no runtime colliders',()=>{
 assert.deepEqual(patchColliders([{positions:[0,0,0,0,0,0,1,1,1]}, {...floorPatch,type:'nonsolid'}, {...floorPatch,blocksShots:false}]),[]);
});
