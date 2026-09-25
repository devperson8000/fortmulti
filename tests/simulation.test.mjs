import test from 'node:test';import assert from 'node:assert/strict';import {Match,placement,validBuild,sanitize,ground,createGroundGrid,SKYSHIP_SECONDS,SKYSHIP_ALTITUDE,ISLAND_LIMIT,INPUT_STALE_SECONDS} from '../public/simulation.js';
import {ARCADE_FLIGHT,SKYSHIP_TIMELINE,stepArcadeGlide} from '../public/skyship-sequence.js';
const world={height:()=>0,obstacles:[]};
const landAll=m=>{for(const p of m.players){p.p[1]=0;p.air='landed';p.vy=0;}m.phase='playing';};
test('build follows facing in four directions and allows upper-level chains',()=>{const p={p:[0,0,0]};for(const [yaw,x,z] of [[0,0,-5],[Math.PI/2,-5,0],[Math.PI,0,5],[-Math.PI/2,5,0]]){let s=placement(p,{yaw,slot:6},world);assert.ok(Math.abs(s.x-x)<.001&&Math.abs(s.z-z)<.001);assert.equal(validBuild(s,[],[p],world),true);}const ramp={x:0,z:0,y:0,angle:0,type:3};assert.equal(ground(0,2.4,0,[ramp],world)>.05,true);assert.equal(validBuild({x:0,z:-5,y:3.6,type:3,angle:0},[ramp],[],world),true);});
test('ground queries use a local obstacle bucket without changing rooftop height',()=>{const obstacles=Array.from({length:1200},(_,i)=>({min:[900+i*30,0,900],max:[904+i*30,4,904]}));obstacles.push({min:[-3,0,-3],max:[3,8,3]});const terrain={height:()=>1,obstacles},grid=createGroundGrid(obstacles);assert.equal(ground(0,0,20,[],terrain),8);assert.equal(ground(0,0,20,[],terrain,grid),8);const bucket=grid.cells.get(Math.floor(0/grid.cellSize)*65536+Math.floor(0/grid.cellSize));assert.equal(bucket.length,1);});
test('four-player match starts aboard the Cloudliner and auto-launches into a smooth glider landing',()=>{
 const m=new Match(world,['a','b','c','d']);assert.equal(SKYSHIP_SECONDS,32);assert.ok(ISLAND_LIMIT>280);assert.equal(m.phase,'waiting');m.beginSkyshipJourney();
 const start=m.skyshipAt(0),middle=m.skyshipAt(SKYSHIP_SECONDS/2);assert.ok(Math.hypot(middle.x-start.x,middle.z-start.z)>250);assert.equal(m.players[0].air,'ship');
 for(let i=0;i<1800&&!m.players.every(p=>p.hp<=0||p.air==='landed');i++)m.tick(.05);
 assert.ok(m.players.every(p=>p.hp<=0||p.air==='landed'));assert.ok(m.events.some(e=>e.type==='cabin_autolaunch'));assert.ok(m.events.some(e=>e.type==='glider_open'&&e.forced));assert.equal(m.phase,'playing');
});
test('the Cloudliner intro stays above the terrain and a late exit uses the arcade transition',()=>{
 const m=new Match(world,['a','b']);m.beginSkyshipJourney();assert.equal(m.skyship.y,SKYSHIP_ALTITUDE);assert.ok(SKYSHIP_ALTITUDE>200);
 for(let i=0;i<SKYSHIP_SECONDS/.05;i++)m.tick(.05);assert.equal(m.players[0].air,'launchTransit');assert.equal(m.players[0].launchProgress,0);assert.ok(m.events.some(e=>e.type==='cabin_autolaunch'&&e.by==='a'));
});
test('the glider opens automatically at the clearance boundary and keeps descent controllable',()=>{
 const m=new Match(world,['a','b']);m.phase='flight';const p=m.players[0];p.air='skyDrift';p.p=[0,45,0];p.airVelocity=[0,-8,0];
 for(let i=0;i<30&&p.air==='skyDrift';i++)m.tick(.05);assert.equal(p.air,'gliderOpening');assert.ok(p.deploy>0&&p.deploy<1);assert.ok(m.events.some(e=>e.type==='glider_open'&&e.forced));
 for(let i=0;i<30&&p.air!=='gliding';i++)m.tick(.05);assert.equal(p.air,'gliding');assert.ok(p.airVelocity[1]<0&&p.airVelocity[1]>-7);
});
test('arcade flight speed and vertical motion stay bounded',()=>{
 assert.ok(ARCADE_FLIGHT.gliderFall>5&&ARCADE_FLIGHT.gliderFall<7);
 let velocity=[0,0,0];for(let i=0;i<120;i++)velocity=stepArcadeGlide(velocity,{yaw:.2,pitch:.1,x:.4,z:1,sprint:true},true,.05);assert.ok(velocity.every(Number.isFinite));assert.ok(Math.hypot(...velocity)<=ARCADE_FLIGHT.maxSpeed);assert.ok(velocity[1]<0);
});
test('multiplayer round ends only when one of four players remains',()=>{const m=new Match(world,['a','b','c','d']);landAll(m);m.disconnect('b');assert.equal(m.phase,'playing');m.disconnect('c');assert.equal(m.phase,'playing');m.disconnect('d');assert.equal(m.phase,'roundover');assert.equal(m.winner,0);assert.equal(m.scores[0],1);});
test('host simulates hits and ammo in multiplayer combat',()=>{const m=new Match(world,['a','b','c']);landAll(m);m.players[0].p=[0,0,0];m.players[1].p=[0,0,-10];m.players[2].p=[20,0,20];const before=m.players[0].ammo;for(let i=0;i<20&&m.players[1].hp>0;i++){m.input('a',{yaw:0,aim:true,fire:true});m.tick(.16);}assert.equal(m.players[1].hp,0);assert.ok(m.players[0].ammo<before);assert.equal(m.phase,'playing');});
test('wall blocks bullets and loses durability',()=>{const m=new Match(world,['a','b']);landAll(m);m.players[0].p=[0,0,0];m.players[1].p=[0,0,-10];m.structures=[{x:0,z:-5,y:0,angle:0,type:2,hp:150}];m.input('a',{yaw:0,fire:true});m.tick(.03);assert.equal(m.players[1].shield,100);assert.equal(m.structures[0].hp,119);});
test('same fire input places a wall and duplicates cost nothing',()=>{const m=new Match(world,['a','b'],'town');landAll(m);m.players[0].p=[0,0,0];m.input('a',{yaw:0,slot:5,fire:true});m.tick(.03);assert.equal(m.structures.length,1);assert.equal(m.players[0].material,140);for(let i=0;i<20;i++){m.input('a',{yaw:0,slot:5,fire:true});m.tick(.03);}assert.equal(m.structures.length,1);assert.equal(m.players[0].material,140);});
test('invalid inputs cannot introduce NaN or unbounded movement',()=>{const i=sanitize({x:Infinity,yaw:NaN,z:500,slot:888});assert.equal(i.x,0);assert.equal(i.yaw,0);assert.equal(i.z,1);assert.equal(i.slot,1);});
test('large-party input remains active between adaptive network updates',()=>{assert.ok(INPUT_STALE_SECONDS>=1.3);const m=new Match(world,['a','b']);landAll(m);m.input('a',{yaw:0,z:1});for(let i=0;i<14;i++)m.tick(.05);const midway=m.players[0].p[2];for(let i=0;i<10;i++)m.tick(.05);assert.ok(m.players[0].p[2]<midway-.5);});
test('a buffered fire tap produces one automatic shot instead of a sustained burst',()=>{const m=new Match(world,['a','b']);landAll(m);m.players[1].p=[50,0,50];m.input('a',{yaw:0,fire:true,firePulse:true});m.tick(.05);const ammo=m.players[0].ammo;for(let i=0;i<20;i++)m.tick(.05);assert.equal(m.players[0].ammo,ammo);});
test('waiting phase prevents early movement, firing, and builds',()=>{const m=new Match(world,['a','b']);const before=structuredClone(m.snapshot());m.input('a',{z:1,fire:true,slot:2});for(let i=0;i<100;i++)m.tick(.03);assert.deepEqual(m.snapshot(),before);m.beginSkyshipJourney();assert.equal(m.phase,'ship');});
test('first player to five round wins completes the match',()=>{const m=new Match(world,['a','b','c']);for(let r=0;r<5;r++){landAll(m);m.players[1].hp=0;m.players[1].eliminated=true;m.players[2].hp=0;m.players[2].eliminated=true;m.checkRoundEnd();assert.equal(m.scores[0],r+1);if(r<4)m.startRound(false);}assert.equal(m.phase,'done');});

test('disconnected players are removed before the next round and never respawn as ghosts',()=>{const m=new Match(world,['a','b','c']);landAll(m);m.disconnect('c');assert.equal(m.players.find(p=>p.id==='c').hp,0);m.startRound(false);assert.deepEqual(m.ids,['a','b']);assert.equal(m.players.some(p=>p.id==='c'),false);});
test('a disconnect during pre-drop waiting shrinks the required participant roster',()=>{const m=new Match(world,['a','b','c']);assert.equal(m.phase,'waiting');m.disconnect('c');assert.deepEqual(m.ids,['a','b']);assert.equal(m.players.length,2);});

test('arcade glide uses eased vectors and landing does not alter ground movement physics',()=>{
 const m=new Match(world,['a','b']);m.phase='flight';const p=m.players[0];p.air='skyDrift';p.p=[0,120,0];p.airVelocity=[0,0,0];
 m.input('a',{yaw:0,pitch:.2,z:1});m.tick(.05);const first=p.airVelocity.slice();assert.ok(first.every(Number.isFinite));assert.ok(first[2]<0);assert.ok(p.airSpeed<=ARCADE_FLIGHT.maxSpeed);
 for(let i=0;i<30;i++){m.input('a',{yaw:.8,pitch:-.2,x:1,z:0});m.tick(.05);}assert.ok(p.airVelocity.every(Number.isFinite));assert.ok(p.airSpeed<=ARCADE_FLIGHT.maxSpeed);
});
test('terrain clearance automatically opens the glider and locks folding near the ground',()=>{
 const elevated={height:()=>0,obstacles:[{min:[-5,0,-5],max:[5,20,5]}]},m=new Match(elevated,['a','b']);m.phase='flight';const p=m.players[0];p.air='skyDrift';p.p=[0,48,0];p.airVelocity=[0,-8,0];m.tick(.05);
 assert.equal(p.air,'gliderOpening');assert.equal(p.wingsActive,true);assert.ok(m.events.some(e=>e.type==='glider_open'&&e.by==='a'&&e.forced));
 for(let i=0;i<20;i++)m.tick(.05);assert.equal(p.air,'gliding');m.input('a',{jump:true,yaw:0});m.tick(.05);assert.equal(p.air,'gliding');assert.ok(m.events.some(e=>e.type==='glider_fold_blocked'&&e.by==='a'));
});
test('glide panels can fold above the safe-height band',()=>{
 const m=new Match(world,['a','b']);m.phase='flight';const p=m.players[0];p.air='gliding';p.wingsActive=true;p.deploy=1;p.p=[0,120,0];p.airVelocity=[0,-5.6,0];
 m.input('a',{jump:true,yaw:0});m.tick(.05);assert.equal(p.air,'gliderFolding');m.input('a',{jump:false,yaw:0});for(let i=0;i<12;i++)m.tick(.05);assert.equal(p.air,'skyDrift');assert.equal(p.wingsActive,false);assert.ok(m.events.some(e=>e.type==='glider_retract'&&e.by==='a'));
});
test('a player can move and shoot as soon as they land while another player is airborne',()=>{
 const m=new Match(world,['a','b']);m.beginSkyshipJourney();m.phase='flight';const [landed,airborne]=m.players;landed.air='landed';landed.p=[0,0,0];landed.vy=0;airborne.air='skyDrift';airborne.p=[0,120,-11];airborne.vy=-4;airborne.airVelocity=[0,-4,0];airborne.airPitch=0;m.input('a',{yaw:0,pitch:.13,z:1,fire:true});m.tick(.1);assert.equal(m.phase,'playing');assert.equal(landed.air,'landed');assert.ok(landed.p[2]<-.3,'grounded player should move immediately');assert.ok(landed.weapons.ar.ammo<30,'grounded player should be able to shoot immediately');assert.ok(m.events.some(e=>e.type==='shot'&&e.by==='a'));assert.equal(airborne.air,'skyDrift');m.tick(.1);assert.ok(m.elapsed>=.09,'round time should continue while other players remain airborne');assert.equal(airborne.air,'skyDrift');
});

test('mouse look works inside the Cloudliner while fire cannot trigger the hatch exit',()=>{
 const m=new Match(world,['a','b']);m.beginSkyshipJourney();const before=m.players[0].yaw;m.input('a',{yaw:1.1,fire:true});m.tick(.05);assert.equal(m.players[0].air,'ship');assert.notEqual(m.players[0].yaw,before);assert.equal(m.events.some(e=>e.type==='cabin_exit'),false);
});
test('skyship snapshots contain finite lightweight sequence and flight state',()=>{
 const m=new Match(world,['a','b']);m.beginSkyshipJourney();for(let i=0;i<SKYSHIP_TIMELINE.controlsAt/.05+2;i++)m.tick(.05);const state=m.snapshot(),p=state.players[0];
 assert.equal(state.sequence.stage,'ready');assert.equal(state.sequence.hatchBlend,1);assert.ok(state.skyship&&Number.isFinite(state.skyship.y));assert.ok(['ship','launchTransit'].includes(p.air));assert.equal(p.hatchBlend,1);assert.equal(p.sequence,'ready');assert.ok(p.airVelocity.length===3&&p.airVelocity.every(Number.isFinite));assert.ok(p.shipLocal.every(Number.isFinite));
 for(const key of['airPitch','airRoll','diveBlend','airSpeed','clearance','launchProgress'])assert.ok(Number.isFinite(p[key]),key);
});
