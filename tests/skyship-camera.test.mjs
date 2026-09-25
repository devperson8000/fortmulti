import test from 'node:test';
import assert from 'node:assert/strict';
import { CABIN_LIMITS, clampCabinPosition, clampCabinWorldPosition, skyshipFirstPersonView, cabinPoint } from '../public/skyship-camera.js';

test('the cabin sequence stays first person while the eye smoothly rises from seated to standing height',()=>{
 const seated=skyshipFirstPersonView([10,240,-4],.2,0,0),standing=skyshipFirstPersonView([10,240,-4],.2,0,1);
 assert.ok(seated.height<standing.height);
 assert.ok(seated.height>1&&standing.height<1.8);
 assert.ok(Math.hypot(...seated.forward)>.999&&Math.hypot(...standing.forward)<1.001);
});

test('first-person mouse look does not move the eye or rotate the cabin around it',()=>{
 const position=[10,100,-4],origin=[0,100,0],shipYaw=Math.PI/2;
 const left=skyshipFirstPersonView(position,-.7,.15,1),right=skyshipFirstPersonView(position,.8,-.12,1);
 assert.deepEqual(left.eye,right.eye);
 assert.notDeepEqual(left.forward,right.forward);
 const rearHatch=cabinPoint([0,0,6],origin,shipYaw);
 assert.ok(Math.abs(rearHatch[0]-6)<.001);
 assert.ok(Math.abs(rearHatch[2])<.001);
});

test('the first-person camera position is confined to the physical cabin footprint',()=>{
 const outside=clampCabinPosition([99,0,-99]);
 assert.ok(outside[0]<=CABIN_LIMITS.maxX&&outside[0]>=CABIN_LIMITS.minX);
 assert.ok(outside[2]<=CABIN_LIMITS.maxZ&&outside[2]>=CABIN_LIMITS.minZ);
 assert.equal(outside[1],0);
 const inside=clampCabinPosition([.4,.2,1.7]);
 assert.deepEqual(inside,[.4,.2,1.7]);
});

test('render prediction cannot carry the camera outside the cabin bounds',()=>{
 const origin=[80,240,-14],yaw=Math.PI/2,position=clampCabinWorldPosition([140,243,130],origin,yaw),dx=position[0]-origin[0],dz=position[2]-origin[2],c=Math.cos(yaw),s=Math.sin(yaw),localX=dx*c-dz*s,localZ=dx*s+dz*c;
 assert.ok(localX>=CABIN_LIMITS.minX&&localX<=CABIN_LIMITS.maxX);
 assert.ok(localZ>=CABIN_LIMITS.minZ&&localZ<=CABIN_LIMITS.maxZ);
 assert.ok(position.every(Number.isFinite));
});
