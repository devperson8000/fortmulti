import test from 'node:test';import assert from 'node:assert/strict';
import {ground} from '../public/simulation.js';import {gridPlacement,supported} from '../public/build-grid.js';
const world={height:()=>6.8,obstacles:[],supportHeight:(x,z,foot)=>foot<0?-12:6.8};
test('lower facility floor does not teleport a player up to the entry floor',()=>assert.equal(ground(0,0,-12,[],world),-12));
test('builds on lower facility floor use that level and receive native support',()=>{
 const p={p:[0,-12,0]},s=gridPlacement(p,{yaw:0,slot:10,material:'wood'},world,[]);assert.equal(s.y,-12);assert.equal(supported(s,[],world),true);
});
test('walls on native platforms use their actual base rather than their quantized grid height',()=>{
 const world={height:()=>6.8,obstacles:[],supportHeight:(x,z,foot,rise=.38)=>6.8<=foot+rise?6.8:-50};
 const s=gridPlacement({p:[146,6.8,0]},{yaw:0,slot:6,material:'wood'},world,[]);
 assert.equal(s.y+s.groundOffset,6.8);assert.equal(supported(s,[],world),true);
});
