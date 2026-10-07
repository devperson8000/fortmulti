import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../public/simulation.js';
import { DEPLOYMENT_TIMELINE } from '../public/deployment-sequence.js';
import { DEPLOYMENT_CUES,MUSIC_START } from '../public/deployment-cinematic.js';
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
 const impact=DEPLOYMENT_TIMELINE.readyBeat+MUSIC_START+DEPLOYMENT_CUES.impact;
 while(match.deployment.elapsed<impact-.1)match.tick(Math.min(.02,impact-.1-match.deployment.elapsed));
 assert.equal(match.deployment.stage,'transition');
 assert.ok(match.players.every(p=>p.p[1]>0&&p.p[1]<10),'pods visibly approach ground before the musical impact');
 assert.equal(match.events.filter(e=>e.type==='deployment_landed').length,0);
 while(match.deployment.elapsed<impact+.001)match.tick(Math.min(.01,impact+.001-match.deployment.elapsed));
 assert.equal(match.deployment.stage,'landed');
 assert.ok(Math.hypot(match.players[0].p[0]-30,match.players[0].p[2]-40)<2);
 assert.ok(Math.hypot(match.players[1].p[0]+80,match.players[1].p[2]-65)<2);
 assert.equal(match.phase,'deployment');
 assert.equal(match.events.filter(e=>e.type==='deployment_landed').length,1);
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
 assert.equal(match.players[0].slot,0);assert.deepEqual(match.players[0].inventory,Array(5).fill(null));assert.equal(match.players[0].p[0],match.players[0].shipLocal[0]);
 tick(match,DEPLOYMENT_TIMELINE.enterSeconds+DEPLOYMENT_TIMELINE.readyBeat+DEPLOYMENT_TIMELINE.sealSeconds+DEPLOYMENT_TIMELINE.launchSeconds+DEPLOYMENT_TIMELINE.landedSeconds+DEPLOYMENT_TIMELINE.openingSeconds+DEPLOYMENT_TIMELINE.exitSeconds+1);
 assert.equal(match.phase,'playing');assert.equal(match.deployment.stage,'match_active');
 assert.ok(match.players.every(p=>p.air==='landed'&&p.slot===0));
});

test('pod exit eases from the landed position rather than jumping on its first frame',()=>{
 const match=new Match(world,['a','b']);match.beginDeployment();readyPlayer(match,'a',0,{x:12,z:18});readyPlayer(match,'b',1,{x:-22,z:28});
 let last=match.players[0].p.slice();
 for(let n=0;n<Math.ceil((DEPLOYMENT_TIMELINE.enterSeconds+DEPLOYMENT_TIMELINE.readyBeat+DEPLOYMENT_TIMELINE.sealSeconds+DEPLOYMENT_TIMELINE.launchSeconds+DEPLOYMENT_TIMELINE.landedSeconds+DEPLOYMENT_TIMELINE.openingSeconds+1)/.025);n++){
  last=match.players[0].p.slice();match.tick(.025);
  if(match.deployment.stage==='exiting'){
   assert.ok(Math.hypot(match.players[0].p[0]-last[0],match.players[0].p[2]-last[2])<.05,'exit should start at the pod');return;
  }
 }
 assert.fail('never reached pod exit');
});

test('scripted deployment catches up after a stalled host without skipping touchdown or enabling combat early',()=>{
 const match=new Match(world,['a','b']);match.beginDeployment();readyPlayer(match,'a',0,{x:30,z:40});readyPlayer(match,'b',1,{x:-80,z:65});tick(match,1.2);
 const impact=DEPLOYMENT_TIMELINE.readyBeat+MUSIC_START+DEPLOYMENT_CUES.impact;
 match.tick(impact-.04-match.deployment.elapsed);
 assert.equal(match.deployment.stage,'transition');assert.equal(match.phase,'deployment');
 assert.equal(match.events.filter(e=>e.type==='deployment_landed').length,0);
 match.tick(.7); // One delayed callback crosses the entire landed stage.
 assert.equal(match.deployment.stage,'pod_opening');assert.equal(match.phase,'deployment');
 assert.equal(match.events.filter(e=>e.type==='deployment_landed').length,1);
 assert.deepEqual(match.players[0].exitPosition,[30,0,40]);
 match.tick(5);
 assert.equal(match.phase,'playing');assert.equal(match.events.filter(e=>e.type==='deployment_landed').length,1);
});
