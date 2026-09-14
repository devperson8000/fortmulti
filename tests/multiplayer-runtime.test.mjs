import test from 'node:test';
import assert from 'node:assert/strict';
import * as runtime from '../public/multiplayer-runtime.js';

const {cadenceForPlayers,inputTransition,aimChanged,shouldForwardInput,smoothPoint}=runtime;

test('three-player cadence stays below the previous high-frequency input flood',()=>{
 const c=cadenceForPlayers(3);assert.ok(c.inputMs>=100);assert.ok(c.snapshotMs>=120);assert.ok(c.heartbeatMs<1000);
});

test('larger parties automatically back off network cadence',()=>{
 assert.ok(cadenceForPlayers(8).inputMs>cadenceForPlayers(3).inputMs);assert.ok(cadenceForPlayers(8).snapshotMs>cadenceForPlayers(3).snapshotMs);
});

test('host stale-input window always exceeds the party heartbeat with safety margin',()=>{
 assert.equal(typeof runtime.staleInputGraceSeconds,'function');
 for(let n=2;n<=8;n++){
  const heartbeat=cadenceForPlayers(n).heartbeatMs,timeout=600+runtime.staleInputGraceSeconds(n)*1000;
  assert.ok(timeout>=heartbeat+100,`party size ${n}: timeout ${timeout} heartbeat ${heartbeat}`);
  assert.ok(timeout<=1200,`party size ${n}: stale input kept too long`);
 }
});

test('large parties never drop authoritative snapshots below four hertz',()=>{
 for(let n=2;n<=8;n++)assert.ok(cadenceForPlayers(n).snapshotMs<=250,`party size ${n}`);
});

test('movement, action and inventory transitions are forwarded immediately',()=>{
 const prev={x:0,z:0,slot:1,jump:false,sprint:false,aim:false,fire:false,reload:false,rotation:0,yaw:0,pitch:0,aimYaw:0,aimPitch:0};
 assert.equal(inputTransition(prev,{...prev,x:1}),true);assert.equal(inputTransition(prev,{...prev,slot:5}),true);assert.equal(inputTransition(prev,{...prev,fire:true}),true);
 assert.equal(shouldForwardInput(prev,{...prev,slot:2},0,cadenceForPlayers(3)),true);
});

test('steady controls are heartbeated instead of sent every frame',()=>{
 const input={x:1,z:0,slot:1,jump:false,sprint:false,aim:false,fire:false,reload:false,rotation:0,yaw:0,pitch:0,aimYaw:0,aimPitch:0},c=cadenceForPlayers(3);
 assert.equal(shouldForwardInput(input,{...input},50,c),false);assert.equal(shouldForwardInput(input,{...input},c.heartbeatMs,c),true);
});

test('camera changes use cadence and smoothing remains finite',()=>{
 const a={yaw:0,pitch:0,aimYaw:0,aimPitch:0},b={...a,yaw:.2};assert.equal(aimChanged(a,b),true);
 const p=smoothPoint([0,0,0],[10,5,-2],14,.016);assert.ok(p.every(Number.isFinite));assert.ok(p[0]>0&&p[0]<10);
});
