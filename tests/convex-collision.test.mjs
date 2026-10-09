import test from 'node:test';
import assert from 'node:assert/strict';
import {rayCollider,segmentColliderTime,boundsIntersectCollider,nativeSupportHeight,sweepBoundsCollider} from '../public/collision-shapes.js';
import {moveHorizontal,upwardLimit,canStandAt} from '../public/movement-collision.js';
import {gridValid} from '../public/build-grid.js';
const wedge={min:[0,0,0],max:[4,4,4],planes:[[-1,0,0,0],[0,-1,0,0],[0,0,-1,0],[1,0,1,4],[0,1,0,4]],supportOnlyNative:true};
const ramp={min:[0,-1,0],max:[4,2,4],planes:[[-1,0,0,0],[1,0,0,4],[0,0,-1,0],[0,0,1,4],[0,-1,0,1],[-.5,1,0,0]],supportOnlyNative:true};
test('convex ray and segment ignore empty bounding-box corners',()=>{
 assert.equal(rayCollider([3,2,3],[0,1,0],wedge),Infinity);
 assert.equal(segmentColliderTime([3,2,3],[3,3,3],wedge),null);
 assert.equal(rayCollider([-2,2,1],[1,0,0],wedge),2);
 assert.equal(segmentColliderTime([-2,2,1],[2,2,1],wedge),.5);
 assert.equal(rayCollider([1,2,1],[1,0,0],wedge),0);
});
test('narrow phase and movement reject angled wall AABB shadows',()=>{
 const box={min:[2.7,0,2.7],max:[3.3,1.78,3.3]};
 assert.equal(boundsIntersectCollider(box,wedge),false);
 const p=[3,0,3];moveHorizontal(p,.5,0,[wedge]);assert.equal(p[0],3.5);
});
test('fast horizontal sweep stops on a thin diagonal brush',()=>{
 const thin={min:[-4,0,-4],max:[4,4,4],planes:[[1,0,1,.02],[-1,0,-1,.02],[0,-1,0,0],[0,1,0,4]],supportOnlyNative:true};
 const p=[-3,0,0];moveHorizontal(p,8,0,[thin]);assert.ok(Math.abs(p[0]+.74)<1e-8);
});
test('sloped native support follows walkable tops within stepping reach',()=>{
 assert.equal(nativeSupportHeight(ramp,2,2,.9,.38),1);
 assert.equal(nativeSupportHeight(ramp,2,2,0,.38),null);
 const p=[.2,.1,2];moveHorizontal(p,.2,0,[ramp]);assert.equal(p[0],.4);
 assert.equal(nativeSupportHeight(ramp,p[0],p[2],p[1],.38),.2);
});
test('convex head clearance distinguishes empty corners from actual ceilings',()=>{
 const ceiling={...wedge,min:[0,1.5,0],max:[4,4,4],planes:wedge.planes.map(p=>p[1]===-1?[0,-1,0,-1.5]:p)};
 assert.equal(canStandAt([3,0,3],[ceiling]),true);
 assert.equal(upwardLimit([3,0,3],1,[ceiling]),1);
 assert.equal(canStandAt([1,0,1],[ceiling]),false);
 assert.ok(Math.abs(upwardLimit([1,-.5,1],0,[ceiling])+.28)<1e-8);
 assert.equal(upwardLimit([1,0,1],.1,[ceiling],{crouching:true}),.1);
});
test('building in the shadow of an angled native wall is valid',()=>{
 const s={x:4,z:3,y:0,angle:0,type:2};
 assert.equal(gridValid(s,[],[],{height:()=>0,obstacles:[wedge]}),true);
 assert.equal(gridValid({...s,x:0,z:1},[],[],{height:()=>0,obstacles:[wedge]}),false);
});

test('edge axes reject convex corners that every individual face test accepts',()=>{
 const tetra={min:[0,0,0],max:[4,4,4],planes:[[13,13,13,65],[-16,-1,4,0],[4,-16,-1,0],[-1,4,-16,0]]};
 const box={min:[.1,.1,1.7],max:[.4,.4,2]};
 assert.ok(tetra.planes.every(p=>p.slice(0,3).reduce((v,n,i)=>v+n*(n<0?box.max[i]:box.min[i]),0)<p[3]));
 assert.equal(boundsIntersectCollider(box,tetra),false);
 assert.equal(sweepBoundsCollider(box,[0,0,.2],tetra),null);
});
test('wall contact permits sliding and moving away, and native ceilings cannot become floors',()=>{
 const p=[-.36,0,1];moveHorizontal(p,-1,1,[wedge]);assert.deepEqual(p,[-1.3599999999999999,0,2]);
 assert.equal(nativeSupportHeight(wedge,1,1,0,.38),null);
 assert.equal(segmentColliderTime([3,2,3],[3,2,3],wedge),null);
 assert.equal(segmentColliderTime([1,2,1],[1,2,1],wedge),0);
});

test('Curved patch triangles block rays, head motion and builds without blocking their bounding-box corners',async()=>{
 const {patchColliders}=await import('../public/collision-shapes.js');
 const shapes=patchColliders([{source:1,positions:[0,3,0, 4,3,0, 0,3,4]}]);assert.equal(shapes.length,1);
 const b=shapes[0];assert.ok(rayCollider([1,2,1],[0,1,0],b)<1.01);
 assert.ok(segmentColliderTime([1,2,1],[1,4,1],b)!==null);
 assert.equal(rayCollider([3,2,3],[0,1,0],b),Infinity);
 assert.equal(boundsIntersectCollider({min:[.9,2.9,.9],max:[1.1,3.1,1.1]},b),true);
 assert.equal(boundsIntersectCollider({min:[2.9,2.9,2.9],max:[3.1,3.1,3.1]},b),false);
 assert.ok(upwardLimit([1,.4,1],1.5,[b])<1.5);
});
