import test from 'node:test';
import assert from 'node:assert/strict';
import {cadenceForPlayers,inputTransition,aimChanged,shouldForwardInput,smoothPoint,isStaleSnapshotGap} from '../public/multiplayer-runtime.js';

test('runtime cadence delegates to the event-budgeted party tuning',()=>{const c=cadenceForPlayers(3);assert.ok(c.inputMs>=100);assert.ok(c.snapshotMs>=100);assert.equal(c.heartbeatMs,c.helloMs);});
test('larger parties automatically back off network cadence',()=>{assert.ok(cadenceForPlayers(8).inputMs>cadenceForPlayers(3).inputMs);assert.ok(cadenceForPlayers(8).snapshotMs>cadenceForPlayers(3).snapshotMs);});
test('movement and inventory transitions are recognized immediately',()=>{const prev={x:0,z:0,slot:1,jump:false,sprint:false,aim:false,fire:false,reload:false,rotation:0,yaw:0,pitch:0,aimYaw:0,aimPitch:0};assert.equal(inputTransition(prev,{...prev,x:1}),true);assert.equal(inputTransition(prev,{...prev,slot:5}),true);assert.equal(shouldForwardInput(prev,{...prev,slot:2},0,cadenceForPlayers(3)),true);});
test('steady controls can be heartbeated without per-frame sends',()=>{const input={x:1,z:0,slot:1,jump:false,sprint:false,aim:false,fire:false,reload:false,rotation:0,yaw:0,pitch:0,aimYaw:0,aimPitch:0},c=cadenceForPlayers(3);assert.equal(shouldForwardInput(input,{...input},50,c),false);assert.equal(shouldForwardInput(input,{...input},c.heartbeatMs,c),true);});
test('camera helpers and smoothing stay finite',()=>{const a={yaw:0,pitch:0,aimYaw:0,aimPitch:0},b={...a,yaw:.2};assert.equal(aimChanged(a,b),true);const p=smoothPoint([0,0,0],[10,5,-2],14,.016);assert.ok(p.every(Number.isFinite));assert.ok(p[0]>0&&p[0]<10);assert.equal(isStaleSnapshotGap(.74),false);assert.equal(isStaleSnapshotGap(.76),true);});
