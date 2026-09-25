import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {busOrbitCamera} from '../public/drop-camera.js';

test('battle-bus camera orbits around the bus as the player looks with the mouse',()=>{
 const bus={x:12,y:240,z:-8,bob:.2},level=busOrbitCamera(bus,.1,-.12),turned=busOrbitCamera(bus,1.2,-.12),pitched=busOrbitCamera(bus,.1,.42);
 assert.deepEqual(level.target,[12,242.6,-8]);
 assert.ok(Math.hypot(level.eye[0]-turned.eye[0],level.eye[2]-turned.eye[2])>10,'horizontal look changes the orbit');
 assert.ok(Math.abs(level.eye[1]-pitched.eye[1])>8,'vertical look changes the orbit');
 assert.ok(Math.hypot(level.eye[0]-level.target[0],level.eye[1]-level.target[1],level.eye[2]-level.target[2])>18);
});

test('the renderer and lobby wire the bus orbit and aerial state transitions',async()=>{
 const engine=await readFile(new URL('../public/engine.js',import.meta.url),'utf8'),app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(engine,/busOrbitCamera\(dropBus,yaw\+recoilYaw,pitch\+recoilPitch/);
 assert.match(engine,/air==='cutting'\)parachute/);
 assert.match(engine,/watchedVelocity=\['freefall','deploying','glider','cutting'\]/);
 assert.match(app,/localPlayer\.air!=='landed'/);
 assert.match(app,/s\.phase==='playing'&&me\?\.air!=='landed'/);
});
