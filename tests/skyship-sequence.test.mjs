import test from 'node:test';
import assert from 'node:assert/strict';
import { SKYSHIP_TIMELINE, ARCADE_FLIGHT, skyshipSequenceAt, canExitCabin, shouldOpenGlider, stepArcadeGlide } from '../public/skyship-sequence.js';

test('the player stands and watches the rear hatch lower before controls unlock',()=>{
 assert.equal(skyshipSequenceAt(0).stage,'seated');
 assert.ok(skyshipSequenceAt(SKYSHIP_TIMELINE.riseStart+.4).standBlend>0);
 assert.equal(skyshipSequenceAt(SKYSHIP_TIMELINE.hatchStart).hatchBlend,0);
 assert.ok(skyshipSequenceAt(SKYSHIP_TIMELINE.hatchStart+.5).hatchBlend>0);
 assert.ok(skyshipSequenceAt(SKYSHIP_TIMELINE.hatchStart+.5).rearLookBlend>.98);
 assert.equal(skyshipSequenceAt(SKYSHIP_TIMELINE.controlsAt-.1).controls,false);
 assert.equal(skyshipSequenceAt(SKYSHIP_TIMELINE.controlsAt).controls,true);
 assert.equal(skyshipSequenceAt(SKYSHIP_TIMELINE.controlsAt).hatchBlend,1);
 assert.ok(skyshipSequenceAt(SKYSHIP_TIMELINE.controlsAt+1.1).rearLookBlend<.01);
});

test('the rear exit is reachable only from the aisle after the hatch is fully lowered',()=>{
 assert.equal(canExitCabin(SKYSHIP_TIMELINE.controlsAt,[0,0,0]),false);
 assert.equal(canExitCabin(SKYSHIP_TIMELINE.controlsAt,[0,0,4.9]),true);
 assert.equal(canExitCabin(SKYSHIP_TIMELINE.controlsAt,[1.9,0,4.9]),false);
 assert.equal(canExitCabin(SKYSHIP_TIMELINE.controlsAt-.1,[0,0,4.9]),false);
 assert.equal(skyshipSequenceAt(SKYSHIP_TIMELINE.autoLaunchAt).autoLaunch,true);
});

test('sequence curves remain clamped and finite for stale or invalid clocks',()=>{
 for(const value of[-20,0,2,7,40,Infinity,NaN]){
  const state=skyshipSequenceAt(value);
  assert.ok(Number.isFinite(state.standBlend)&&state.standBlend>=0&&state.standBlend<=1);
  assert.ok(Number.isFinite(state.hatchBlend)&&state.hatchBlend>=0&&state.hatchBlend<=1);
 }
});

test('arcade glider transition follows the world-height limit and flight stays smooth and bounded',()=>{
 assert.equal(shouldOpenGlider(ARCADE_FLIGHT.autoOpenClearance+1),false);
 assert.equal(shouldOpenGlider(ARCADE_FLIGHT.autoOpenClearance),true);
 let velocity=[0,0,0];
 for(let i=0;i<60;i++)velocity=stepArcadeGlide(velocity,{yaw:.7,pitch:-.3,x:.4,z:1,sprint:true},false,.016);
 assert.ok(velocity.every(Number.isFinite));
 assert.ok(Math.hypot(...velocity)<=ARCADE_FLIGHT.maxSpeed);
 const opened=stepArcadeGlide(velocity,{yaw:.7,pitch:.2,x:1,z:0},true,.016);
 assert.ok(opened.every(Number.isFinite));
 assert.ok(Math.hypot(...opened)<=ARCADE_FLIGHT.maxSpeed);
});

test('arcade glider physics ease with the visible opening progress instead of switching instantly',()=>{
 let velocity=[0,-8,0],largestChange=0;for(let i=1;i<=16;i++){const next=stepArcadeGlide(velocity,{yaw:0,pitch:0,z:0},i/16,.05);largestChange=Math.max(largestChange,Math.hypot(...next.map((value,index)=>value-velocity[index])));velocity=next;}assert.ok(largestChange<1.5);assert.ok(velocity[1]>-7);
});

test('bank steering keeps forward carry while arcade boost and pull-up remain bounded',()=>{
 let banked=[0,-5.6,-10.8];
 for(let i=0;i<80;i++)banked=stepArcadeGlide(banked,{yaw:0,pitch:0,x:1,z:0,sprint:true},true,.05);
 assert.ok(banked[0]>3,'right input should arc the glide to the right');
 assert.ok(banked[2]<-8,'banking should preserve strong forward carry');
 assert.ok(Math.hypot(...banked)<=ARCADE_FLIGHT.maxSpeed,'boosted glide must stay inside the speed cap');
 let level=[0,-5.6,-10.8],pullUp=[0,-5.6,-10.8];
 for(let i=0;i<60;i++){
  level=stepArcadeGlide(level,{yaw:0,pitch:0,z:1},true,.05);
  pullUp=stepArcadeGlide(pullUp,{yaw:0,pitch:.7,z:1},true,.05);
 }
 assert.ok(pullUp[1]>-.5,'looking up with the energy wings should flatten descent into a tiny arcade lift');
 assert.ok(pullUp[1]<=ARCADE_FLIGHT.maxRise,'arcade lift must have a hard ceiling');
 assert.ok(level[1]<pullUp[1],'pitch should visibly affect the flight arc');
 const overshoot=stepArcadeGlide([0,1.5,0],{yaw:0,pitch:.7,z:1},true,.05);
 assert.ok(overshoot[1]<=ARCADE_FLIGHT.maxRise,'stale upward velocity must be clamped to the same lift ceiling');
});
