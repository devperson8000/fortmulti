import test from 'node:test';
import assert from 'node:assert/strict';
import { SKYSHIP_TIMELINE, AETHER_FLIGHT, skyshipSequenceAt, canEnterRift, shouldAutoUnfurl, stepAetherFlight } from '../public/skyship-sequence.js';

test('the opening sequence seats the player, raises them, then opens the rift before controls unlock',()=>{
 assert.equal(skyshipSequenceAt(0).stage,'seated');
 assert.ok(skyshipSequenceAt(SKYSHIP_TIMELINE.riseStart+.4).standBlend>0);
 assert.ok(skyshipSequenceAt(SKYSHIP_TIMELINE.riftStart+.5).riftBlend>0);
 assert.equal(skyshipSequenceAt(SKYSHIP_TIMELINE.controlsAt-.1).controls,false);
 assert.equal(skyshipSequenceAt(SKYSHIP_TIMELINE.controlsAt).controls,true);
});

test('the player can only enter the open rift from the aisle and timeout triggers an automatic launch',()=>{
 assert.equal(canEnterRift(SKYSHIP_TIMELINE.controlsAt,[0,0,0]),false);
 assert.equal(canEnterRift(SKYSHIP_TIMELINE.controlsAt,[0,0,-3]),true);
 assert.equal(skyshipSequenceAt(SKYSHIP_TIMELINE.autoLaunchAt).autoLaunch,true);
});

test('sequence curves remain clamped and finite for stale or invalid clocks',()=>{
 for(const value of[-20,0,2,7,40,Infinity,NaN]){
  const state=skyshipSequenceAt(value);
  assert.ok(Number.isFinite(state.standBlend)&&state.standBlend>=0&&state.standBlend<=1);
  assert.ok(Number.isFinite(state.riftBlend)&&state.riftBlend>=0&&state.riftBlend<=1);
 }
});

test('aether wing transition follows the safe world-height limit and flight stays smooth and bounded',()=>{
 assert.equal(shouldAutoUnfurl(AETHER_FLIGHT.autoUnfurlClearance+1),false);
 assert.equal(shouldAutoUnfurl(AETHER_FLIGHT.autoUnfurlClearance),true);
 let velocity=[0,0,0];
 for(let i=0;i<60;i++)velocity=stepAetherFlight(velocity,{yaw:.7,pitch:-.3,x:.4,z:1,sprint:true},false,.016);
 assert.ok(velocity.every(Number.isFinite));
 assert.ok(Math.hypot(...velocity)<=AETHER_FLIGHT.maxSpeed);
 const opened=stepAetherFlight(velocity,{yaw:.7,pitch:.2,x:1,z:0},true,.016);
 assert.ok(opened.every(Number.isFinite));
 assert.ok(Math.hypot(...opened)<=AETHER_FLIGHT.maxSpeed);
});

test('energy-wing physics ease with the visible unfurl progress instead of switching instantly',()=>{
 let velocity=[0,-8,0],largestChange=0;for(let i=1;i<=16;i++){const next=stepAetherFlight(velocity,{yaw:0,pitch:0,z:0},i/16,.05);largestChange=Math.max(largestChange,Math.hypot(...next.map((value,index)=>value-velocity[index])));velocity=next;}assert.ok(largestChange<1.5);assert.ok(velocity[1]>-7);
});
