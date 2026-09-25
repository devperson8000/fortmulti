import test from 'node:test';
import assert from 'node:assert/strict';
import { skyshipFirstPersonView, cabinPoint } from '../public/skyship-camera.js';

test('the cabin sequence stays first person while the eye smoothly rises from seated to standing height',()=>{
 const seated=skyshipFirstPersonView([10,240,-4],.2,0,0),standing=skyshipFirstPersonView([10,240,-4],.2,0,1);
 assert.ok(seated.height<standing.height);
 assert.ok(seated.height>1&&standing.height<1.8);
 assert.ok(Math.hypot(...seated.forward)>.999&&Math.hypot(...standing.forward)<1.001);
});

test('cabin panels follow mouse yaw in first-person camera space',()=>{
 const view=skyshipFirstPersonView([0,100,0],Math.PI/2,0,1),front=cabinPoint([0,0,-4],view.eye,Math.PI/2);
 assert.ok(Math.abs(front[0]-4)<.001);
 assert.ok(Math.abs(front[2])<.001);
});
