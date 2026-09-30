import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../public/simulation.js';
import { DEPLOYMENT_TIMELINE } from '../public/deployment-sequence.js';
import { SHIP_PODS } from '../public/deployment-ship.js';

const world={height:()=>0,obstacles:[]};
function readyPlayer(match,id,podIndex,landing){
 assert.equal(match.chooseLanding(id,landing),true);
 const player=match.players.find(p=>p.id===id),pod=SHIP_PODS[podIndex];
 player.shipLocal=[pod.x,0,pod.z+2.2];player.p=match.shipWorld(player.shipLocal);
 assert.equal(match.enterPod(id),true);
}
function tick(match,seconds){for(let time=0;time<seconds;time+=.05)match.tick(.05);}

test('players must select distinct destinations before reserving an available nearby pod',()=>{
 const match=new Match(world,['a','b']);match.beginDeployment();
 assert.equal(match.phase,'deployment');assert.equal(match.enterPod('a'),false);
 assert.equal(match.chooseLanding('a',{x:Infinity,z:4}),false);
 assert.equal(match.chooseLanding('a',{x:30,z:40}),true);
 const pod=SHIP_PODS[0];match.players[0].shipLocal=[pod.x,0,pod.z+2.2];match.players[0].p=match.shipWorld(match.players[0].shipLocal);
 assert.equal(match.enterPod('a'),true);assert.equal(match.enterPod('a'),true,'duplicate interaction is idempotent');
 assert.equal(match.players[0].pod,pod.id);assert.equal(match.players[0].slot,0);
 match.players[1].shipLocal=[pod.x,0,pod.z+2.2];match.players[1].p=match.shipWorld(match.players[1].shipLocal);
 assert.equal(match.enterPod('b'),false,'occupied pods are never double-reserved');
 assert.equal(match.chooseLanding('a',{x:-40,z:50}),false,'destination is locked once pod entry begins');
});

test('a player can walk diagonally out of the aisle and interact with a deployment pod',()=>{
 const match=new Match(world,['a','b']);match.beginDeployment();
 assert.equal(match.chooseLanding('a',{x:-40,z:50}),true);
 match.input('a',{yaw:0,x:-1,z:-.5});tick(match,.85);
 const player=match.players[0];
 assert.ok(player.shipLocal[0]<-4.5,'the player moves laterally out of the center aisle');
 assert.ok(player.shipLocal[2]>-2.4,'the player advances toward the pod');
 match.input('a',{yaw:0,interact:true});match.tick(.05);
 assert.equal(player.deploymentState,'entering_pod');
 assert.ok(player.pod,'an available pod is reserved');
});

test('both connected players auto-deploy to their own destinations only after both pods are ready',()=>{
 const match=new Match(world,['a','b']);match.beginDeployment();
 readyPlayer(match,'a',0,{x:30,z:40});readyPlayer(match,'b',1,{x:-80,z:65});
 tick(match,1.2);
 assert.equal(match.deployment.stage,'both_ready');
 assert.ok(match.players.every(p=>p.deploymentState==='both_ready'));
 tick(match,.75);assert.equal(match.deployment.stage,'pod_sealing');
 tick(match,DEPLOYMENT_TIMELINE.sealSeconds+DEPLOYMENT_TIMELINE.fadeAt-.7);
 assert.equal(match.deployment.stage,'launching');
 tick(match,.2);
 assert.equal(match.deployment.stage,'transition');
 assert.ok(match.players.every(p=>p.p[1]>100),'world reposition stays hidden above full-screen black');
 tick(match,.5);
 assert.equal(match.deployment.stage,'landed');
 assert.ok(Math.hypot(match.players[0].p[0]-30,match.players[0].p[2]-40)<2);
 assert.ok(Math.hypot(match.players[1].p[0]+80,match.players[1].p[2]-65)<2);
 assert.equal(match.phase,'deployment');
});

test('landing picks are reserved distinctly and an invalidated target reopens pods without deadlocking',()=>{
 const world={height:()=>0,obstacles:[]},match=new Match(world,['a','b']);match.beginDeployment();
 assert.equal(match.chooseLanding('a',{x:30,z:40}),true);assert.equal(match.chooseLanding('b',{x:30,z:40}),true);
 const a=match.players[0].destination,b=match.players[1].destination;assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=1.9);
 for(const [index,p] of match.players.entries()){const pod=SHIP_PODS[index];p.shipLocal=[pod.x,0,pod.z+2.2];p.p=match.shipWorld(p.shipLocal);assert.equal(match.enterPod(p.id),true);}
 world.height=()=>Infinity;tick(match,1.2);
 assert.equal(match.deployment.stage,'landing_selection');assert.ok(match.players.every(p=>!p.pod&&p.deploymentState==='pod_available'));
 assert.equal(match.podOwners.size,0);
});

test('disconnect releases an unused pod and does not block the remaining ready player',()=>{
 const match=new Match(world,['a','b','c']);match.beginDeployment();
 readyPlayer(match,'a',0,{x:20,z:30});readyPlayer(match,'b',1,{x:-30,z:45});
 assert.equal(match.disconnect('c'),true);
 assert.equal(match.enterPod('a'),true);
 tick(match,1.2);tick(match,.8);
 assert.equal(match.deployment.stage,'pod_sealing');
});

test('pre-match snapshots carry recovery data and combat stays locked until pod exit completes',()=>{
 const match=new Match(world,['a','b']);match.beginDeployment();readyPlayer(match,'a',0,{x:12,z:18});readyPlayer(match,'b',1,{x:-22,z:28});
 const initial=match.snapshot();assert.equal(initial.deployment.stage,'landing_selection');assert.equal(initial.players[0].destination.x,12);
 match.input('a',{slot:4,fire:true,reload:true,z:1});tick(match,.5);
 assert.equal(match.players[0].slot,0);assert.equal(match.players[0].weapons.sniper.ammo,4);assert.equal(match.players[0].p[0],match.players[0].shipLocal[0]);
 tick(match,12);
 assert.equal(match.phase,'playing');assert.equal(match.deployment.stage,'match_active');
 assert.ok(match.players.every(p=>p.air==='landed'&&p.slot===1));
});
