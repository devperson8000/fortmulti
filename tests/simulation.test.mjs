import {createLoadout} from '../public/weapon-system.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,placement,validBuild,sanitize,ground,createGroundGrid,ISLAND_LIMIT,INPUT_STALE_SECONDS} from '../public/simulation.js';
import {DEPLOYMENT_SHIP,SHIP_PODS} from '../public/deployment-ship.js';

const world={height:()=>0,obstacles:[]};
const landAll=match=>{match.phase='playing';for(const p of match.players){p.p[1]=0;p.air='landed';p.vy=0;p.deploymentState='match_active';p.slot=1;p.inventory=[...Object.entries(createLoadout()).map(([type,state])=>({id:type,type,...state})),null];p.shield=100;p.ammo=30;p.materials={wood:150,stone:0};p.material=150;p.animationState='idle';}};
const tick=(match,seconds)=>{for(let i=0;i<Math.ceil(seconds/.05);i++)match.tick(.05);};

test('build follows facing in four directions and allows upper-level chains',()=>{
 const p={p:[0,0,0]};for(const[yaw,x,z]of[[0,0,-5],[Math.PI/2,-5,0],[Math.PI,0,5],[-Math.PI/2,5,0]]){const structure=placement(p,{yaw,slot:10},world);assert.ok(Math.abs(structure.x-x)<.001&&Math.abs(structure.z-z)<.001);assert.equal(validBuild(structure,[],[p],world),true);}
 const ramp={x:0,z:0,y:0,angle:0,type:3};assert.equal(ground(0,2.4,0,[ramp],world)>.05,true);assert.equal(validBuild({x:0,z:-5,y:3.6,type:3,angle:0},[ramp],[],world),true);
});

test('ground queries use local obstacle buckets without changing rooftop height',()=>{
 const obstacles=Array.from({length:1200},(_,i)=>({min:[900+i*30,0,900],max:[904+i*30,4,904]}));obstacles.push({min:[-3,0,-3],max:[3,8,3]});const terrain={height:()=>1,obstacles},grid=createGroundGrid(obstacles);
 assert.equal(ground(0,0,20,[],terrain),8);assert.equal(ground(0,0,20,[],terrain,grid),8);assert.equal(grid.cells.get(0).length,1);
});

test('a new match starts aboard a fixed ship with combat disabled',()=>{
 const match=new Match(world,['a','b']);assert.equal(match.phase,'waiting');assert.ok(match.players.every(p=>p.air==='ship'&&p.slot===0));assert.ok(match.players.every(p=>p.p[1]===DEPLOYMENT_SHIP.origin[1]));
 assert.equal(match.snapshot().ship.origin[1],DEPLOYMENT_SHIP.origin[1]);assert.equal(match.beginDeployment(),true);match.input('a',{z:1,yaw:0,slot:4,fire:true,reload:true});tick(match,.4);
 assert.equal(match.phase,'deployment');assert.ok(match.players[0].shipLocal[2]<-4.2);assert.equal(match.players[0].slot,0);assert.deepEqual(match.players[0].inventory,Array(5).fill(null));assert.ok(match.players.every(p=>p.p[1]===DEPLOYMENT_SHIP.origin[1]));
});

test('ship walking respects the available deck bounds and sprint scaling',()=>{
 const travel=sprint=>{const match=new Match(world,['a','b']);match.beginDeployment();const p=match.players[0],before=p.shipLocal.slice();match.input('a',{yaw:0,z:1,sprint});tick(match,.05);return Math.hypot(p.shipLocal[0]-before[0],p.shipLocal[2]-before[2]);};
 assert.ok(Math.abs(travel(true)/travel(false)-4/3)<.01);
 const match=new Match(world,['a','b']);match.beginDeployment();const p=match.players[0];p.shipLocal=[7.9,0,12];match.input('a',{yaw:0,x:1,z:-1});tick(match,.5);assert.ok(p.shipLocal[0]<=8&&p.shipLocal[2]<=14&&p.shipLocal.every(Number.isFinite));
});

test('ship character animation is idle at rest and only walks or runs while moving',()=>{
 const match=new Match(world,['a','b']);match.beginDeployment();const player=match.players[0];
 match.input('a',{yaw:0});match.tick(.05);assert.equal(player.animationState,'idle');
 match.input('a',{yaw:0,sprint:true});match.tick(.05);assert.equal(player.animationState,'idle');
 match.input('a',{yaw:0,z:1});match.tick(.05);assert.equal(player.animationState,'walk');
 match.input('a',{yaw:0,z:1,sprint:true});match.tick(.05);assert.equal(player.animationState,'run');
 match.input('a',{yaw:0});match.tick(.05);assert.equal(player.animationState,'idle');
});

test('deployment readiness survives a peer disconnect and releases reserved pods safely',()=>{
 const match=new Match(world,['a','b','c']);match.beginDeployment();match.chooseLanding('a',{x:25,z:30});match.chooseLanding('b',{x:-25,z:35});
 for(const[id,index]of[['a',0],['b',1]]){const pod=SHIP_PODS[index],p=match.players.find(v=>v.id===id);p.shipLocal=[pod.x,0,pod.z+2.2];p.p=match.shipWorld(p.shipLocal);assert.equal(match.enterPod(id),true);}
 assert.equal(match.disconnect('c'),true);tick(match,1.4);assert.ok(['both_ready','pod_sealing'].includes(match.deployment.stage));assert.equal(match.players.find(p=>p.id==='c').hp,0);
});

test('multiplayer rounds end only when one connected player remains',()=>{
 const match=new Match(world,['a','b','c','d']);landAll(match);match.disconnect('b');assert.equal(match.phase,'playing');match.disconnect('c');assert.equal(match.phase,'playing');match.disconnect('d');assert.equal(match.phase,'roundover');assert.equal(match.winner,0);assert.equal(match.scores[0],1);
});

test('host simulates hits and ammo during multiplayer combat',()=>{
 const match=new Match(world,['a','b','c']);landAll(match);match.players[0].p=[0,0,0];match.players[1].p=[0,0,-10];match.players[2].p=[20,0,20];const before=match.players[0].ammo;
 for(let i=0;i<20&&match.players[1].hp>0;i++){match.input('a',{slot:1,yaw:0,aim:true,fire:true});match.tick(.16);}assert.equal(match.players[1].hp,0);assert.ok(match.players[0].ammo<before);assert.equal(match.phase,'playing');
});

test('a wall blocks bullets and loses durability',()=>{
 const match=new Match(world,['a','b']);landAll(match);match.players[0].p=[0,0,0];match.players[1].p=[0,0,-10];match.structures=[{x:0,z:-5,y:0,angle:0,type:2,hp:150}];match.input('a',{slot:1,yaw:0,fire:true});match.tick(.03);assert.equal(match.players[1].shield,100);assert.equal(match.structures[0].hp,119);
});

test('the same held fire input places one wall and charges material once',()=>{
 const match=new Match(world,['a','b'],'town');landAll(match);match.players[0].p=[0,0,0];match.input('a',{yaw:0,slot:6,fire:true});match.tick(.03);assert.equal(match.structures.length,1);assert.equal(match.players[0].material,140);
 for(let i=0;i<20;i++){match.input('a',{yaw:0,slot:6,fire:true});match.tick(.03);}assert.equal(match.structures.length,1);assert.equal(match.players[0].material,140);
});

test('crouch, walk, run, jump and fall animation states are synchronized in snapshots',()=>{
 const match=new Match(world,['a','b']);landAll(match);const p=match.players[0];match.input('a',{z:1,crouch:true});match.tick(.05);assert.equal(p.animationState,'crouch');assert.equal(match.snapshot().players[0].crouching,true);
 match.input('a',{z:1,crouch:false,sprint:true});match.tick(.05);assert.equal(p.animationState,'run');match.input('a',{jump:true});match.tick(.05);assert.equal(p.animationState,'jump');
 for(let i=0;i<15;i++){match.input('a',{jump:false});match.tick(.05);}assert.ok(['fall','idle'].includes(p.animationState));
});

test('invalid inputs cannot introduce NaN or unbounded movement',()=>{const input=sanitize({x:Infinity,yaw:NaN,z:500,slot:888,landing:[Infinity,0]});assert.equal(input.x,0);assert.equal(input.yaw,0);assert.equal(input.z,1);assert.equal(input.slot,0);assert.equal(input.landing,null);assert.ok(ISLAND_LIMIT>280);});

test('large-party input stays active between adaptive network updates',()=>{
 assert.ok(INPUT_STALE_SECONDS>=1.3);const match=new Match(world,['a','b']);landAll(match);match.input('a',{yaw:0,z:1});for(let i=0;i<14;i++)match.tick(.05);const midway=match.players[0].p[2];for(let i=0;i<10;i++)match.tick(.05);assert.ok(match.players[0].p[2]<midway-.5);
});

test('a buffered fire tap produces one automatic shot instead of a sustained burst',()=>{
 const match=new Match(world,['a','b']);landAll(match);match.players[1].p=[50,0,50];match.input('a',{slot:1,yaw:0,fire:true,firePulse:true});match.tick(.05);const ammo=match.players[0].ammo;for(let i=0;i<20;i++)match.tick(.05);assert.equal(match.players[0].ammo,ammo);
});

test('waiting phase prevents early movement, firing and building',()=>{
 const match=new Match(world,['a','b']),before=structuredClone(match.snapshot());match.input('a',{z:1,fire:true,slot:2});tick(match,3);assert.deepEqual(match.snapshot(),before);assert.equal(match.beginDeployment(),true);assert.equal(match.phase,'deployment');
});

test('first player to five round wins completes the match',()=>{
 const match=new Match(world,['a','b','c']);for(let round=0;round<5;round++){landAll(match);match.players[1].hp=0;match.players[1].eliminated=true;match.players[2].hp=0;match.players[2].eliminated=true;match.checkRoundEnd();assert.equal(match.scores[0],round+1);if(round<4)match.startRound(false);}assert.equal(match.phase,'done');
});

test('disconnected players leave the next round and never return as ghosts',()=>{
 const match=new Match(world,['a','b','c']);landAll(match);match.disconnect('c');assert.equal(match.players.find(p=>p.id==='c').hp,0);match.startRound(false);assert.deepEqual(match.ids,['a','b']);assert.equal(match.players.some(p=>p.id==='c'),false);
});

test('a disconnect while still in the lobby shrinks the required roster',()=>{const match=new Match(world,['a','b','c']);assert.equal(match.phase,'waiting');match.disconnect('c');assert.deepEqual(match.ids,['a','b']);assert.equal(match.players.length,2);});

// Remote weapon pitch must survive the authoritative snapshot, with input bounds intact.
test('snapshots carry sanitized vertical weapon aim for other players',()=>{
 const match=new Match(world,['a','b']);landAll(match);
 for(const [pitch,expected] of [[.4,.4],[10,.7],[-10,-.9],[NaN,0]]){
  match.input('a',{slot:1,pitch});match.tick(.016);
  assert.equal(match.snapshot().players.find(p=>p.id==='a').pitch,expected);
 }
});
