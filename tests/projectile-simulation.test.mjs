import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,cameraAimOrigin} from '../public/simulation.js';
import {WEAPON_PROFILES} from '../public/weapon-system.js';

const world={height:()=>0,obstacles:[]};
const playing=()=>{
 const match=new Match(world,['a','b']);
 match.phase='playing';
 for(const player of match.players){player.air='landed';player.p[1]=0;}
 match.players[0].p=[0,0,0];
 match.players[1].p=[0,0,-20];
 return match;
};

function aimAtTarget(match){
 const player=match.players[0],target=match.players[1],profile=WEAPON_PROFILES.sniper;
 const input={slot:4,yaw:0,pitch:0,aimYaw:0,aimPitch:0,aim:true};
 for(let index=0;index<8;index++){
  const eye=cameraAimOrigin(player,input,profile),dx=target.p[0]-eye[0],dy=target.p[1]+1.25-eye[1],dz=target.p[2]-eye[2];
  input.yaw=input.aimYaw=Math.atan2(-dx,-dz);
  input.pitch=input.aimPitch=Math.atan2(dy,Math.hypot(dx,dz));
 }
 return input;
}

function equipSniper(match,input){
 match.input('a',input);
 for(let index=0;index<11;index++)match.tick(.05);
}

test('sniper damage occurs on projectile arrival instead of trigger time',()=>{
 const match=playing(),target=match.players[1],input=aimAtTarget(match);
 equipSniper(match,input);
 const before={hp:target.hp,shield:target.shield};
 match.input('a',{...input,fire:true});
 match.tick(.016);
 assert.deepEqual({hp:target.hp,shield:target.shield},before);
 assert.equal(match.projectiles.length,1);
 for(let index=0;index<40&&target.shield===before.shield;index++)match.tick(.025);
 assert.ok(target.shield<before.shield);
 assert.ok(match.events.some(event=>event.type==='projectile-impact'&&event.hit==='b'));
});

test('a wall stops the sniper projectile before player damage',()=>{
 const match=playing(),target=match.players[1],input=aimAtTarget(match);
 match.structures=[{x:0,z:-10,y:0,angle:0,type:2,hp:150}];
 equipSniper(match,input);
 match.input('a',{...input,fire:true});
 for(let index=0;index<30;index++)match.tick(.025);
 assert.equal(target.shield,100);
 assert.ok(match.structures[0].hp<150);
 assert.ok(match.events.some(event=>event.type==='projectile-impact'&&event.structure));
});

test('projectile snapshots are lightweight and a round reset clears flight state',()=>{
 const match=playing();
 match.players[1].p=[100,0,-100];
 const input=aimAtTarget(match);
 equipSniper(match,input);
 match.input('a',{...input,fire:true});
 match.tick(.016);
 const snapshot=match.snapshot();
 assert.equal(snapshot.projectiles.length,1);
 assert.deepEqual(Object.keys(snapshot.projectiles[0]).sort(),['id','owner','position','spawnTick','velocity'].sort());
 assert.ok(snapshot.projectiles[0].position.every(Number.isFinite));
 match.startRound(false);
 assert.equal(match.projectiles.length,0);
 assert.equal(match.snapshot().projectiles.length,0);
});
