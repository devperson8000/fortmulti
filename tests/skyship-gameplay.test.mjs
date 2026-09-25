import test from 'node:test';
import assert from 'node:assert/strict';
import { Match, SKYSHIP_SECONDS, SKYSHIP_ALTITUDE } from '../public/simulation.js';

const world={height:()=>0,obstacles:[]};
const stepUntil=(match,seconds,input={})=>{for(let i=0;i<Math.ceil(seconds/.05);i++){match.input('a',input);match.tick(.05);}};

test('the match begins inside the Cloudliner and locks movement until the rear hatch is open',()=>{
 const match=new Match(world,['a','b']);match.beginSkyshipJourney();
 assert.equal(match.players[0].air,'ship');assert.equal(match.skyship.y,SKYSHIP_ALTITUDE);
 match.input('a',{jump:true,yaw:match.skyship.yaw});match.tick(.05);assert.equal(match.players[0].air,'ship');
 match.input('a',{jump:false,yaw:match.skyship.yaw});stepUntil(match,8.3,{yaw:match.skyship.yaw});
 assert.equal(match.sequence.controls,true);assert.equal(match.sequence.hatchBlend,1);assert.equal(match.players[0].sequence,'ready');
});

test('cabin walking follows first-person look direction relative to the skyship',()=>{
 const match=new Match(world,['a','b']);match.beginSkyshipJourney();stepUntil(match,8.7,{yaw:match.skyship.yaw});
 const player=match.players[0],before=player.shipLocal.slice();
 match.input('a',{z:1,yaw:match.skyship.yaw+Math.PI/2});match.tick(.05);
 assert.ok(player.shipLocal[0]<before[0]-.1);
 assert.ok(Math.abs(player.shipLocal[2]-before[2])<.01);
});

test('diagonal cabin walking keeps the same total speed as straight walking',()=>{
 const travel=(x,z)=>{
  const match=new Match(world,['a','b']);match.beginSkyshipJourney();stepUntil(match,8.7,{yaw:match.skyship.yaw});
  const before=match.players[0].shipLocal.slice();match.input('a',{x,z,yaw:match.skyship.yaw});match.tick(.05);
  return Math.hypot(match.players[0].shipLocal[0]-before[0],match.players[0].shipLocal[2]-before[2]);
 };
 assert.ok(Math.abs(travel(1,1)-travel(1,0))<.001);
});

test('sprint accelerates the player along the cabin aisle',()=>{
 const travel=sprint=>{
  const match=new Match(world,['a','b']);match.beginSkyshipJourney();stepUntil(match,8.7,{yaw:match.skyship.yaw});
  const before=match.players[0].shipLocal.slice();match.input('a',{z:1,yaw:match.skyship.yaw,sprint});match.tick(.05);
  return Math.hypot(match.players[0].shipLocal[0]-before[0],match.players[0].shipLocal[2]-before[2]);
 };
 assert.ok(Math.abs(travel(true)/travel(false)-4/3)<.01);
});

test('the rear hatch can be exited from the aisle and the timeout uses an arcade launch',()=>{
 const match=new Match(world,['a','b']);match.beginSkyshipJourney();stepUntil(match,8.4,{yaw:match.skyship.yaw});
 match.input('a',{z:-1,yaw:match.skyship.yaw});for(let i=0;i<30;i++)match.tick(.05);
 assert.ok(match.players[0].shipLocal[2]>=4.6);
 match.input('a',{jump:true,yaw:match.skyship.yaw});match.tick(.05);assert.equal(match.players[0].air,'launchTransit');
 assert.ok(match.events.some(event=>event.type==='cabin_exit'&&event.by==='a'));
 const late=new Match(world,['x','y']);late.beginSkyshipJourney();stepUntil(late,SKYSHIP_SECONDS,{yaw:late.skyship.yaw});
 assert.equal(late.players[0].air,'launchTransit');assert.ok(late.events.some(event=>event.type==='cabin_autolaunch'&&event.by==='x'));
});

test('the arcade glider opens smoothly by input or the height boundary and folds above it',()=>{
 const match=new Match(world,['a','b']);match.phase='flight';const p=match.players[0];p.air='skyDrift';p.p=[0,100,0];p.airVelocity=[0,-6,0];
 match.input('a',{jump:true,yaw:0});match.tick(.05);assert.equal(p.air,'gliderOpening');assert.ok(p.deploy>0&&p.deploy<1);
 match.input('a',{jump:false,yaw:0});for(let i=0;i<18;i++)match.tick(.05);assert.equal(p.air,'gliding');
 match.input('a',{jump:true,yaw:0});match.tick(.05);assert.equal(p.air,'gliderFolding');
 const low=new Match(world,['a','b']);low.phase='flight';const q=low.players[0];q.air='skyDrift';q.p=[0,38,0];q.airVelocity=[0,-7,0];low.input('a',{yaw:0});low.tick(.05);assert.equal(q.air,'gliderOpening');
});
