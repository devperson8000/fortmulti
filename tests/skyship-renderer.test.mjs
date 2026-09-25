import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {skyshipFirstPersonView,cabinPoint} from '../public/skyship-camera.js';

test('the first-person eye rises smoothly while remaining at the same cabin position',()=>{
 const position=[12,240,-8],seated=skyshipFirstPersonView(position,.1,-.12,0),standing=skyshipFirstPersonView(position,1.2,.42,1);
 assert.ok(seated.height<standing.height);assert.ok(seated.height>1&&standing.height<1.8);
 assert.ok(Math.hypot(...seated.forward)>.999&&Math.hypot(...standing.forward)<1.001);
 assert.deepEqual(seated.eye.map((v,i)=>i===1?0:v),standing.eye.map((v,i)=>i===1?0:v));
});

test('cabin landmarks stay fixed to the Cloudliner while the camera turns',()=>{
 const origin=[80,240,-14],shipYaw=Math.PI/2;
 const rear=cabinPoint([0,0,6],origin,shipYaw),left=cabinPoint([-2,0,0],origin,shipYaw);
 assert.ok(Math.abs(rear[0]-86)<.001&&Math.abs(rear[2]+14)<.001);
 assert.ok(Math.abs(left[0]-80)<.001&&Math.abs(left[2]-(-12))<.001);
});

test('the renderer uses fixed cabin geometry, an animated rear hatch and first-person arcade glide visuals',async()=>{
 const engine=await readFile(new URL('../public/engine.js',import.meta.url),'utf8'),app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(engine,/clampCabinWorldPosition\(player\.p,\[skyshipData\.x,skyshipData\.y,skyshipData\.z\],skyshipData\.yaw\)/);
 assert.match(engine,/skyshipFirstPersonView\(cabinPosition,shipLookYaw,pitch\+recoilPitch/);
 assert.match(engine,/skyshipInterior\(skyshipData,eye,shipLookYaw,skyshipPresentation/);
 assert.match(engine,/skyshipMotion=advanceMotionTrack\(skyshipMotion/);
 assert.match(engine,/cabinPoint\(v,origin,shipYaw\)/);
 assert.match(engine,/hatchBlend\*Math\.PI\*\.49/);
 assert.match(engine,/gliderCanopy\(b\.p/);assert.match(engine,/firstPersonGlider\(eye/);
 assert.match(engine,/firstPersonGlider\(eye,yaw\+recoilYaw,player\.air==='gliding'\?1:player\.deploy\|\|0,player\.airRoll\|\|0,player\.airSpeed\|\|0\)/);
 assert.match(engine,/function firstPersonGlider\(eye,yaw,amount=1,bank=0,speed=0\)/);
 assert.match(engine,/watchedVelocity=\['launchTransit','skyDrift','gliderOpening','gliding','gliderFolding'\]/);
 assert.match(engine,/skyshipPresentation\.rearLookBlend/);
 assert.match(app,/me\?\.air==='ship'/);assert.match(app,/REAR HATCH LOWERING/);assert.match(app,/SPACE TO GLIDE/);
 assert.doesNotMatch(engine,/Aether|aether|portal/i);assert.doesNotMatch(app,/Aether|aether|portal/i);
});
