import test from 'node:test';
import assert from 'node:assert/strict';
import {WEAPON_ORDER,WEAPON_PROFILES,createLoadout,currentAmmo,shotSpread} from '../public/weapon-system.js';
import {Match,cameraAimOrigin} from '../public/simulation.js';

const world={height:()=>0,obstacles:[]};
const playing=()=>{const match=new Match(world,['a','b']);match.phase='playing';for(const p of match.players){p.air='landed';p.p[1]=0;}match.players[0].p=[0,0,0];match.players[1].p=[0,0,-20];return match;};

test('four weapon profiles expose complete combat tuning',()=>{
 assert.deepEqual(WEAPON_ORDER,['ar','shotgun','smg','sniper']);
 for(const id of WEAPON_ORDER){const w=WEAPON_PROFILES[id];assert.ok(w.damage>0&&w.fireInterval>0&&w.reloadDuration>0&&w.magazineCapacity>0&&w.range>0);assert.equal(w.recoil.length,2);assert.ok(w.spread.ads<=w.spread.hip);}
 assert.equal(WEAPON_PROFILES.sniper.scope,true);assert.equal(WEAPON_PROFILES.sniper.adsFov,15);
});

test('switching weapons preserves independent magazines and syncs public ammo',()=>{
 const m=playing(),p=m.players[0];m.input('a',{slot:3,yaw:0});for(let i=0;i<8;i++)m.tick(.05);m.input('a',{slot:3,yaw:0,fire:true});m.tick(.05);assert.equal(currentAmmo(p.weapons,3),31);assert.equal(p.weapon,'smg');assert.equal(p.ammo,31);assert.equal(currentAmmo(p.weapons,1),30);
});

test('reload uses the selected weapon duration and refills only that magazine',()=>{
 const m=playing(),p=m.players[0];p.weapons.sniper.ammo=1;m.input('a',{slot:4,yaw:0});for(let i=0;i<10;i++)m.tick(.05);m.input('a',{slot:4,yaw:0,reload:true});m.tick(.05);assert.ok(p.reload>2.6);assert.equal(p.reloadWeapon,'sniper');assert.equal(m.events.at(-1).type,'reload');assert.equal(m.events.at(-1).duration,WEAPON_PROFILES.sniper.reloadDuration);for(let i=0;i<60;i++){m.input('a',{slot:4,yaw:0});m.tick(.05);}assert.equal(p.reload,0);assert.equal(p.weapons.sniper.ammo,4);assert.equal(p.weapons.ar.ammo,30);
});

test('semi-automatic shotgun requires a fresh trigger while SMG can sustain fire',()=>{
 const shotgun=playing(),a=shotgun.players[0];shotgun.input('a',{slot:2,yaw:0});for(let i=0;i<10;i++)shotgun.tick(.05);shotgun.input('a',{slot:2,yaw:0,fire:true});for(let i=0;i<40;i++)shotgun.tick(.05);assert.equal(a.weapons.shotgun.ammo,5);
 const smg=playing(),b=smg.players[0];smg.input('a',{slot:3,yaw:0});for(let i=0;i<10;i++)smg.tick(.05);smg.input('a',{slot:3,yaw:0,fire:true});for(let i=0;i<20;i++)smg.tick(.05);assert.ok(b.weapons.smg.ammo<27);
});

test('movement and sustained fire widen the simulated crosshair spread',()=>{
 const profile=WEAPON_PROFILES.ar,rest=shotSpread(profile,{aim:true}),moving=shotSpread(profile,{aim:true,moving:1,sustained:3});assert.ok(moving>rest);assert.ok(moving<=profile.spread.max);assert.deepEqual(Object.keys(createLoadout()),WEAPON_ORDER);
});

test('landed authoritative aim begins at the first-person eye anchor',()=>{
 const player={p:[4,3,-2],air:'landed'};
 assert.deepEqual(cameraAimOrigin(player,{yaw:1,pitch:.2,aim:true},WEAPON_PROFILES.ar),[4,4.72,-2]);
 assert.deepEqual(cameraAimOrigin(player,{yaw:-2,pitch:-.3,aim:true},WEAPON_PROFILES.sniper),[4,4.72,-2]);
});

test('snapshots expose ADS, weapon animation state and versioned shot payloads',()=>{
 const m=playing(),p=m.players[0];m.input('a',{slot:4,yaw:0});for(let i=0;i<11;i++)m.tick(.05);m.input('a',{slot:4,yaw:0,pitch:0,aim:true,fire:true});m.tick(.05);const snap=m.snapshot(),me=snap.players[0],shot=snap.events.findLast(e=>e.type==='shot');assert.equal(me.weapon,'sniper');assert.equal(me.aim,true);assert.equal(me.slot,4);assert.equal(me.weapons.sniper.ammo,3);assert.equal(shot.weapon,'sniper');assert.equal(shot.traces.length,1);assert.ok(Array.isArray(shot.hits));assert.ok(Number.isFinite(shot.damage));
});

test('the authoritative shot ray converges on the first-person crosshair',()=>{
 const m=playing(),p=m.players[0],target=m.players[1],profile=WEAPON_PROFILES.ar;target.p=[0,0,-20];let aim={slot:1,yaw:0,pitch:0,aimYaw:0,aimPitch:0,aim:true};
 for(let n=0;n<12;n++){const eye=cameraAimOrigin(p,aim,profile),dx=target.p[0]-eye[0],dy=target.p[1]+1.25-eye[1],dz=target.p[2]-eye[2];aim.yaw=aim.aimYaw=Math.atan2(-dx,-dz);aim.pitch=aim.aimPitch=Math.atan2(dy,Math.hypot(dx,dz));}
 m.input('a',aim);m.tick(.05);m.input('a',{...aim,fire:true});m.tick(.05);const shot=m.events.findLast(e=>e.type==='shot');assert.equal(shot.hit,'b');assert.ok(shot.damage>=profile.damage);assert.ok(target.shield<100);
});
