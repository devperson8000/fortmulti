import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../public/simulation.js';
import {cabinPoint} from '../public/skyship-camera.js';
import {acceptSnapshot} from '../public/network-tuning.js';
import {createProjectile,advanceProjectile,segmentSphereTime} from '../public/ballistics.js';

const world={height:()=>0,obstacles:[]};
test('a ready party starts directly in the aircraft and the drop timeline advances',()=>{
 const match=new Match(world,['a','b']);
 match.beginSkyshipJourney();
 assert.equal(match.phase,'ship');
 match.tick(.05);
 assert.ok(match.dropElapsed>0);
});

test('cabin coordinates stay attached to the same aircraft pose while it moves',()=>{
 const m=new Match(world,['a','b']);
 m.beginSkyshipJourney();
 for(let n=0;n<70;n++)m.tick(.05);
 const p=m.players[0],ship=m.skyship;
 assert.deepEqual(p.p,cabinPoint(p.shipLocal,[ship.x,ship.y,ship.z],ship.yaw));
});

test('snapshot sequence ignores delayed packets but accepts a new match',()=>{
 assert.equal(acceptSnapshot('m',12,'m',11,100,100),false);
 assert.equal(acceptSnapshot('m',12,'m',13,100,100),true);
 assert.equal(acceptSnapshot('m',12,'next',1,100,101),true);
 assert.equal(acceptSnapshot('next',3,'m',14,101,100),false);
});

test('projectile stops precisely at range and an inside-origin sweep hits immediately',()=>{
 const p=createProjectile({id:'r',origin:[0,0,0],direction:[0,0,-1],speed:200,range:3,damage:1});
 advanceProjectile(p,.05);
 assert.ok(Math.abs(p.position[2]+3)<1e-9);
 assert.equal(p.expired,true);
 assert.equal(segmentSphereTime([0,0,0],[0,0,-1],[0,0,0],.5),0);
});
