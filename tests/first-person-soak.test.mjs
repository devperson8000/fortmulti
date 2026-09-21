import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../public/simulation.js';

const world={height:()=>0,obstacles:[]};
const landAll=match=>{match.phase='playing';for(const player of match.players){player.air='landed';player.p[1]=0;player.vy=0;}};

test('two-player first-person combat remains bounded through a 45 second soak',()=>{
 const match=new Match(world,['alpha','bravo'],'build');landAll(match);match.players[0].p=[-40,0,30];match.players[1].p=[40,0,-30];
 for(let tick=0;tick<900;tick++){
  const phase=tick%160,yawA=Math.PI,yawB=0;
  const a={yaw:yawA,aimYaw:yawA,aimPitch:0,x:phase<40?1:phase<80?-1:0,z:phase>=80&&phase<120?1:0,sprint:phase<25,slot:1,aim:phase>=120,fire:phase<55};
  const b={yaw:yawB,aimYaw:yawB,aimPitch:0,x:phase<40?-1:phase<80?1:0,z:phase>=80&&phase<120?1:0,sprint:phase<25,slot:3,aim:phase>=120,fire:phase>=60&&phase<110};
  if(tick===120){a.slot=5;a.fire=true;}if(tick===121){a.slot=1;a.fire=false;}
  if(tick===220){a.slot=4;a.fire=false;}if(tick===232){a.slot=4;a.fire=true;}
  if(tick===320){a.slot=1;a.reload=true;a.fire=false;}
  match.input('alpha',a);match.input('bravo',b);match.tick(.05);
  if(tick===700){match.startRound(false);landAll(match);}
 }
 const snapshot=match.snapshot();
 assert.ok(snapshot.players.every(player=>player.p.every(Number.isFinite)));
 assert.ok(snapshot.players.every(player=>Number.isFinite(player.hp)&&Number.isFinite(player.ammo)));
 assert.ok(match.projectiles.length<=8);
 assert.ok(match.events.length<=256);
 assert.ok(match.structures.length<=32);
 assert.doesNotThrow(()=>structuredClone(snapshot));
});
