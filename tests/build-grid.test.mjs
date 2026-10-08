import test from 'node:test';import assert from 'node:assert/strict';
import {gridPlacement,rampEndpoints,gridValid,rampHeight,rayRamp} from '../public/build-grid.js';import {placement,Match} from '../public/simulation.js';import {shockwaveImpulse,resolveLanding} from '../public/shockwave.js';

test('walking and running climb a valid ramp whose bottom sits slightly above sloping ground',()=>{
 for(const yaw of[0,Math.PI/2,Math.PI,-Math.PI/2])for(const dt of[.016,.05])for(const sprint of[false,true]){
  const terrain={height:(x,z)=>-.18*(Math.sin(yaw)*x+Math.cos(yaw)*z),obstacles:[]},match=new Match(terrain,['a','b']);match.phase='playing';
  const x=Math.sin(yaw)*3,z=Math.cos(yaw)*3;
  for(const [n,p]of match.players.entries()){p.air='landed';p.p=n?[50,terrain.height(50,50),50]:[x,terrain.height(x,z),z];p.vy=0;p.materials={wood:100,stone:0};}
  const p=match.players[0];match.input('a',{yaw,slot:10,fire:true});match.tick(dt);
  assert.equal(match.structures.length,1);const ramp=match.structures[0];assert.ok(Math.abs(ramp.y)<1e-6);
  let high=p.p[1];
  for(let n=0;n<Math.ceil(1.5/dt);n++){
   match.input('a',{yaw,slot:10,z:1,sprint});match.tick(dt);high=Math.max(high,p.p[1]);
   const surface=rampHeight(ramp,p.p[0],p.p[2]);
   if(surface!==null)assert.ok(Math.abs(p.p[1]-surface)<1e-6,'feet must follow the ramp rather than passing underneath');
  }
  assert.ok(high>3.2,'player reaches the top while '+(sprint?'running':'walking')+' at dt '+dt);
 }
});
const world={height:()=>0,obstacles:[]};
test('preview and authority share placement; ramps chain exactly at all rotations',()=>{for(let turn=0;turn<4;turn++){let p={p:[0,0,0]},input={yaw:turn*Math.PI/2,slot:10},structures=[];for(let n=0;n<8;n++){const s=gridPlacement(p,input,world,structures);assert.deepEqual(s,placement(p,input,world,structures));assert.equal(gridValid(s,structures,[],world),true);const {bottom,top}=rampEndpoints(s);assert.ok(Math.abs(Math.hypot(top[0]-bottom[0],top[2]-bottom[2])-5)<1e-6);assert.ok(Math.abs(top[1]-bottom[1]-3.6)<1e-6);if(n){const prior=rampEndpoints(structures.at(-1)).top;for(let k=0;k<3;k++)assert.ok(Math.abs(bottom[k]-prior[k])<1e-5);}structures.push(s);p.p=top;}}});
test('unsupported floating pieces are rejected and ramp rays ignore empty volume',()=>{const s={x:0,z:0,y:0,type:3,angle:0};assert.equal(gridValid({...s,y:20},[],[],world),false);assert.equal(rampHeight(s,0,2.5),0);assert.equal(rampHeight(s,0,-2.5),3.6);assert.equal(rayRamp([0,3,3],[0,0,-1],s),4.666666666666667);});
test('both materials deduct costs and stone has greater HP',()=>{const hp=[];for(const material of ['wood','stone']){const m=new Match(world,['a','b']);m.phase='playing';const p=m.players[0];p.air='landed';p.p=[0,0,0];p.materials[material]=20;p.slot=10;m.input('a',{slot:10,fire:true,material});m.tick(.05);assert.equal(m.structures.length,1);assert.equal(p.materials[material],10);hp.push(m.structures[0].hp);}assert.ok(hp[1]>hp[0]);});
test('shockwave launches away without damage; immunity clears on landing',()=>{assert.ok(shockwaveImpulse([0,0,0],[0,0,-2])[2]<0);const v=shockwaveImpulse([0,0,0],[0,2,0]);assert.equal(v[0],0);assert.equal(v[2],0);assert.ok(v[1]>0);const p={hp:100,shield:30,shockwaveImmune:true};assert.equal(resolveLanding(p,-30),0);assert.equal(p.hp,100);assert.equal(p.shield,30);assert.equal(p.shockwaveImmune,false);assert.ok(resolveLanding(p,-20)>0);});

test('camera collision uses the ramp surface rather than its empty volume',()=>{
 const m=new Match({height:()=>0,obstacles:[]},['a','b']);
 const p=m.players[0];p.p=[0,0,2];const input={yaw:0,pitch:0,aim:false};
 const unobstructed=m.cameraOrigin(p,input,{});
 m.structures=[{x:0,y:0,z:5,angle:Math.PI,type:3}];
 const delta=unobstructed.map((v,k)=>v-[0,2.15,2][k]),length=Math.hypot(...delta),direction=delta.map(v=>v/length);
 const distance=rayRamp([0,2.15,2],direction,m.structures[0]);
 const expected=[0,2.15,2].map((v,k)=>v+direction[k]*(distance-.3));
 assert.deepEqual(m.cameraOrigin(p,input,{}),expected);
});

test('wall bounds match the rendered grid thickness in both orientations',async()=>{
 const {GRID,gridBounds}=await import('../public/build-grid.js');
 for(const angle of [0,Math.PI/2]){
  const box=gridBounds({x:0,y:0,z:0,type:2,angle}),axis=angle===0?2:0;
  assert.ok(Math.abs(box.max[axis]-box.min[axis]-GRID.thickness)<1e-9);
 }
});

test('initial builds remain terrain-supported at nonzero grid heights',()=>{
 for(const elevation of [-2,.1,2,3.5,4,7])for(const slot of [6,10]){
  const terrain={height:()=>elevation,obstacles:[]};
  const s=gridPlacement({p:[0,elevation,0]},{slot,yaw:0},terrain,[]);
  assert.equal(gridValid(s,[],[],terrain),true,`height ${elevation}, slot ${slot}`);
  assert.ok(s.y<=elevation,'foundation must not float above ground');
  assert.ok(elevation-s.y<3.6);
 }
});
