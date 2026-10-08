import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../public/simulation.js';
import {shockwaveImpulse} from '../public/shockwave.js';
function setup(obstacles=[]){const m=new Match({height:()=>0,obstacles},['a','b']);m.phase='playing';for(const [i,p] of m.players.entries()){p.p=[i*30,0,0];p.air='landed';p.deploymentState='match_active';}return m;}
test('shockwave sprint cannot tunnel across a thin wall',()=>{
 const m=setup([{min:[.45,0,-5],max:[.67,8,5]}]),p=m.players[0];p.p[1]=1;p.impulse=[18,0];m.input('a',{x:1,sprint:true,slot:0});m.tick(.05);
 assert.ok(p.p[0]<=.09+.001,`crossed wall: ${p.p[0]}`);
});
test('upward launches stop at ceilings and preserve landing immunity',()=>{
 const m=setup([{min:[-5,3,-5],max:[5,3.25,5]}]),p=m.players[0];p.vy=23;p.shockwaveImmune=true;
 for(let i=0;i<5;i++)m.tick(.05);
 assert.ok(p.p[1]<1.3,`crossed roof: ${p.p[1]}`);assert.ok(p.vy<=0);assert.equal(p.hp,100);
});
test('built cover obstructs chests, loot and harvesting',()=>{
 const m=new Match({height:()=>0,obstacles:[],chests:[{id:'c',x:0,y:0,z:-2}],resources:[{id:'r',kind:'wood',x:0,y:0,z:-2,hp:100}]},['a','b']);const p=m.players[0];p.p=[0,0,0];p.air='landed';p.slot=0;
 m.structures=[{type:2,x:0,y:0,z:-1,angle:0}];
 assert.equal(m.interact(p,{yaw:0}),false);assert.equal(m.harvest(p,{yaw:0}),false);assert.equal(p.materials.wood,0);
 m.pickups=[{id:'l',x:0,y:0,z:-2,type:'shield',count:3}];assert.equal(m.collect(p,'l'),false);
});
test('harvesting preserves authoritative running locomotion for animation blending',()=>{
 const m=setup(),p=m.players[0];m.input('a',{slot:0,z:1,sprint:true,fire:true});m.tick(.05);
 assert.equal(p.action,'harvest');assert.equal(p.locomotionState,'run');assert.ok(p.moveSpeed>10);assert.equal(p.grounded,true);
});

test('a crouching player cannot stand through a low ceiling',()=>{
 const m=setup([{min:[-3,1.5,-3],max:[3,1.7,3]}]),p=m.players[0];p.crouching=true;m.input('a',{slot:0,crouch:false});m.tick(.05);assert.equal(p.crouching,true);
});

test('a crouching player keeps headroom beneath a built ramp',()=>{
 const m=setup(),p=m.players[0];m.structures=[{type:3,x:0,y:0,z:0,angle:0}];p.p=[0,0,.28];p.crouching=true;m.input('a',{slot:0,crouch:false});m.tick(.05);assert.equal(p.crouching,true);
});

test('a shockwave-boosted slide cannot snap through an overhead ramp or clear its landing immunity',()=>{
 const m=setup(),p=m.players[0];m.structures=[{type:3,x:0,y:0,z:0,angle:0}];p.p=[-3,0,5/9];p.sprinting=true;p.moveSpeed=10.2;
 const impulse=shockwaveImpulse([-4.5,0,5/9],p.p);p.impulse=[impulse[0],impulse[2]];p.vy=impulse[1];p.shockwaveImmune=true;
 m.input('a',{slot:0,x:1,sprint:true,crouchRevision:1});m.tick(.05);
 assert.ok(p.p[1]<=.05+1e-6,'upward ceiling collision must not be bypassed by floor snapping');
 assert.equal(p.shockwaveImmune,true,'the actor has not landed on top of the ramp');
});
