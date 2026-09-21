import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createProjectile,
 advanceProjectile,
 segmentSphereTime,
 segmentAabbTime
} from '../public/ballistics.js';

test('sniper projectile travels forward and gains mild downward velocity',()=>{
 const projectile=createProjectile({id:'p1',owner:'a',origin:[0,2,0],direction:[0,0,-1],speed:180,gravity:18,range:360,damage:116,spawnTick:1});
 const result=advanceProjectile(projectile,.05);
 assert.equal(result,projectile);
 assert.ok(projectile.position[2]<-8.9);
 assert.ok(projectile.velocity[1]<0);
 assert.equal(projectile.expired,false);
});

test('large frame deltas are bounded instead of skipping through the world',()=>{
 const projectile=createProjectile({id:'p2',owner:'a',origin:[0,0,0],direction:[0,0,-1],speed:100,gravity:0,range:360,damage:1,spawnTick:1});
 advanceProjectile(projectile,.5);
 assert.ok(projectile.distance>=4.99&&projectile.distance<=5.01);
});

test('swept collision catches targets and walls between ticks',()=>{
 const sphere=segmentSphereTime([0,1,0],[0,1,-20],[0,1,-10],.7);
 const wall=segmentAabbTime([0,1,0],[0,1,-20],[-1,0,-11],[1,3,-9]);
 assert.ok(sphere!==null&&sphere>.4&&sphere<.5);
 assert.ok(wall!==null&&wall>.4&&wall<.6);
 assert.equal(segmentSphereTime([0,1,0],[0,1,-20],[5,1,-10],.7),null);
});

test('projectiles expire at bounded range without allocating replacement vectors',()=>{
 const projectile=createProjectile({id:'p3',owner:'a',origin:[0,0,0],direction:[0,0,-1],speed:200,gravity:0,range:30,damage:1,spawnTick:1});
 const position=projectile.position,previous=projectile.previous;
 for(let i=0;i<4&&!projectile.expired;i++)advanceProjectile(projectile,.05);
 assert.equal(projectile.expired,true);
 assert.equal(projectile.position,position);
 assert.equal(projectile.previous,previous);
});
