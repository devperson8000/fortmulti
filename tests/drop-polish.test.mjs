import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../public/simulation.js';
import {acceptSnapshot} from '../public/network-tuning.js';
import {createProjectile,advanceProjectile,segmentSphereTime} from '../public/ballistics.js';
import {DEPLOYMENT_TIMELINE} from '../public/deployment-sequence.js';
import {SHIP_PODS} from '../public/deployment-ship.js';

const world={height:()=>0,obstacles:[]};
const tick=(match,seconds)=>{for(let time=0;time<seconds;time+=.05)match.tick(.05);};
function ready(match,id,index,destination){
 assert.equal(match.chooseLanding(id,destination),true);const pod=SHIP_PODS[index],player=match.players.find(value=>value.id===id);
 player.shipLocal=[pod.x,0,pod.z+2.2];player.p=match.shipWorld(player.shipLocal);assert.equal(match.enterPod(id),true);
}

test('two players launch independently to their chosen points after both pods are ready',()=>{
 const match=new Match(world,['a','b']);match.beginDeployment();ready(match,'a',0,{x:30,z:40});ready(match,'b',1,{x:-80,z:65});tick(match,1.2);
 assert.equal(match.deployment.stage,'both_ready');
 const impact=DEPLOYMENT_TIMELINE.readyBeat+DEPLOYMENT_TIMELINE.sealSeconds+DEPLOYMENT_TIMELINE.launchSeconds;
 while(match.deployment.elapsed<impact-.1)match.tick(Math.min(.02,impact-.1-match.deployment.elapsed));
 assert.equal(match.deployment.stage,'transition');assert.ok(match.players.every(player=>player.p[1]>0&&player.p[1]<10),'pods remain above ground until the musical impact');
 tick(match,1.2);assert.equal(match.deployment.stage,'pod_opening');assert.ok(Math.hypot(match.players[0].p[0]-30,match.players[0].p[2]-40)<2);assert.ok(Math.hypot(match.players[1].p[0]+80,match.players[1].p[2]-65)<2);
 tick(match,6);assert.equal(match.phase,'playing');assert.ok(match.players.every(player=>player.air==='landed'&&player.slot===0));
});

test('snapshot sequencing rejects late frames while allowing a newer match epoch',()=>{
 assert.equal(acceptSnapshot('m',12,'m',11,100,100),false);assert.equal(acceptSnapshot('m',12,'m',13,100,100),true);assert.equal(acceptSnapshot('m',12,'next',1,100,101),true);assert.equal(acceptSnapshot('next',3,'m',14,101,100),false);
});

test('projectile stops precisely at range and an inside-origin sweep hits immediately',()=>{
 const projectile=createProjectile({id:'r',origin:[0,0,0],direction:[0,0,-1],speed:200,range:3,damage:1});advanceProjectile(projectile,.05);assert.ok(Math.abs(projectile.position[2]+3)<1e-9);assert.equal(projectile.expired,true);assert.equal(segmentSphereTime([0,0,0],[0,0,-1],[0,0,0],.5),0);
});
