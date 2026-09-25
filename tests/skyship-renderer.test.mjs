import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {skyshipFirstPersonView,cabinPoint} from '../public/skyship-camera.js';

test('the cabin camera rises smoothly while keeping mouse look in first person',()=>{
 const seated=skyshipFirstPersonView([12,240,-8],.1,-.12,0),standing=skyshipFirstPersonView([12,240,-8],1.2,.42,1);
 assert.ok(seated.height<standing.height);assert.ok(seated.height>1&&standing.height<1.8);
 assert.ok(Math.hypot(...seated.forward)>.999&&Math.hypot(...standing.forward)<1.001);
 assert.ok(Math.hypot(seated.eye[0]-standing.eye[0],seated.eye[2]-standing.eye[2])<.001);
 const front=cabinPoint([0,0,-4],standing.eye,1.2);assert.ok(Math.hypot(front[0]-standing.eye[0],front[2]-standing.eye[2])>3.9);
});

test('the renderer and lobby use the staged Aether Ark sequence and first-person wing visuals',async()=>{
 const engine=await readFile(new URL('../public/engine.js',import.meta.url),'utf8'),app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(engine,/skyshipFirstPersonView\(player\.p,yaw\+recoilYaw,pitch\+recoilPitch/);
 assert.match(engine,/skyshipInterior\(eye,yaw\+recoilYaw,skyshipPresentation/);
 assert.match(engine,/energyWings\(b\.p/);assert.match(engine,/firstPersonWings\(eye/);
 assert.match(engine,/watchedVelocity=\['riftTransit','rift','wingOpening','winged','wingFolding'\]/);
 assert.match(app,/me\?\.air==='ship'/);assert.match(app,/ENERGY WINGS UNFURLING/);
});
