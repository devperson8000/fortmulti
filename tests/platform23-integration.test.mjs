import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,ground} from '../public/simulation.js';
import {gridPlacement,gridValid,supported,gridBaseY} from '../public/build-grid.js';
import {chestLoot} from '../public/loot-system.js';
import {loadPlatformMap,platformLayout,platformSupportHeight,platformHeight,isPlatformLandingAllowed} from '../public/platform23-map.js';
await loadPlatformMap();
const world={...platformLayout(),height:platformHeight,supportHeight:platformSupportHeight};

test('Platform 23 landing pads remain on native support through the real deployment authority',()=>{
 assert.ok(world.pois.length>=2);
 for(const pad of world.pois){
  const match=new Match(world,['host','guest']);match.beginDeployment();
  assert.equal(isPlatformLandingAllowed(pad.x,pad.z),true,pad.name);
  assert.equal(match.chooseLanding('host',{x:pad.x,z:pad.z}),true,pad.name);
  const destination=match.players[0].destination;
  assert.equal(isPlatformLandingAllowed(destination.x,destination.z),true);
  assert.ok(Math.abs(destination.y-platformSupportHeight(destination.x,destination.z,destination.y,.01))<.05);
 }
});

test('Platform 23 chest loot stays supported and collectible from its native floor',()=>{
 assert.ok(world.chests.length>0);
 for(const chest of world.chests)for(let round=1;round<=3;round++)for(const item of chestLoot(chest,round,world)){
  assert.ok(Math.abs(item.y-platformSupportHeight(item.x,item.z,item.y,.01))<.05,`${item.id} must remain on real support`);
  assert.ok(Math.hypot(item.x-chest.x,item.z-chest.z)<=3.2);
  assert.equal(Match.prototype.visibleInteraction.call({world,structures:[]},{p:[chest.x,chest.y,chest.z]},item),true,`${item.id} must remain reachable`);
 }
});

test('Native Platform 23 supports ordinary authoritative movement and floor builds',()=>{
 let fixture;
 for(const pad of world.pois)for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const p={p:[pad.x,pad.y,pad.z],hp:100,air:'landed'};
  const wall=gridPlacement(p,{yaw,slot:6,material:'wood'},world),ramp=gridPlacement(p,{yaw,slot:10,material:'wood'},world);
  if(gridValid(wall,[],[p],world)&&gridValid(ramp,[],[p],world)){fixture={p,yaw,wall,ramp};break;}
 }
 assert.ok(fixture,'a native pad must permit normal wall and ramp building');
 assert.equal(supported(fixture.wall,[],world),true);assert.equal(supported(fixture.ramp,[],world),true);
 assert.ok(Math.abs(gridBaseY(fixture.wall)-ground(fixture.wall.x,fixture.wall.z,gridBaseY(fixture.wall),[],world))<.05);
 const match=new Match(world,['host','guest']);match.phase='playing';const p=match.players[0];p.p=fixture.p.p.slice();p.air='landed';p.deploymentState='match_active';p.vy=0;
 const start=p.p.slice();for(let i=0;i<20;i++){match.input('host',{z:1,yaw:fixture.yaw,slot:0});match.tick(.05);}
 assert.ok(Math.hypot(p.p[0]-start[0],p.p[2]-start[2])>1,'actual authority moves along native pad');assert.equal(p.hp,100);
 assert.ok(Math.abs(p.p[1]-ground(p.p[0],p.p[2],p.p[1],[],world))<.1);
});

test('Opening a native Platform 23 chest uses the unchanged hold and collection rules',()=>{
 const chest=world.chests[0],match=new Match(world,['host','guest']);assert.ok(chest);match.phase='playing';const p=match.players[0];p.air='landed';p.p=[chest.x,chest.y,chest.z];
 for(let i=0;i<69;i++)match.advanceChestInteraction(p,{interact:true,yaw:0,pitch:0},.05);
 assert.equal(match.openedChests.has(chest.id),false,'a chest still requires the full 3.5 second hold');
 match.advanceChestInteraction(p,{interact:true,yaw:0,pitch:0},.05);assert.equal(match.openedChests.has(chest.id),true);
 assert.deepEqual(match.pickups,chestLoot(chest,match.round,world));
 const weapon=match.pickups.find(item=>['ar','shotgun','smg','sniper'].includes(item.type));assert.ok(weapon);assert.equal(match.collect(p,weapon.id),true);assert.equal(p.inventory[0].type,weapon.type);
});

test('Eight operators can reserve clear pods and walk their full exit path without floor gaps',async()=>{
 const {safeLandingPoint}=await import('../public/deployment-sequence.js');
 const {podExitPosition}=await import('../public/deployment-cinematic.js');
 const {canStandAt}=await import('../public/movement-collision.js');
 const reserved=[];
 for(let i=0;i<8;i++){
  const point=safeLandingPoint(world.pois[0],world,reserved);assert.ok(point,`operator ${i+1} gets a safe fallback`);
  assert.equal(world.isLandingClear(point.x,point.z,point.y),true);reserved.push(point);
  for(const yaw of [-Math.PI/2,Math.PI/2])for(const side of [-1,1])for(let frame=0;frame<=20;frame++){
   const position=podExitPosition(point,yaw,side,frame/20,world.height);
   assert.ok(Math.abs(world.supportHeight(position[0],position[2],point.y,.05)-point.y)<.05,'exit stays on the native floor');
   assert.equal(canStandAt(position,world.obstacles),true,'operator has native head clearance');
  }
 }
 for(let i=0;i<reserved.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(reserved[i].x-reserved[j].x,reserved[i].z-reserved[j].z)>=world.cinematicRadius*2+1.2);
});
