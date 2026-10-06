import test from 'node:test';
import assert from 'node:assert/strict';
const visuals=await import('../public/visual-presentation.js').catch(()=>({}));
test('landing response is bounded, recovers and cannot repeat while standing',()=>{
 assert.equal(typeof visuals.createMotionPresentation,'function');
 const s=visuals.createMotionPresentation(),p={p:[0,2,0],yaw:0,grounded:false,vy:-15,moveSpeed:0};
 visuals.stepMotionPresentation(s,p,1/60);p.grounded=true;p.p[1]=0;p.vy=0;visuals.stepMotionPresentation(s,p,1/60);
 assert.ok(s.landing>.3&&s.landing<=1);assert.ok(s.cameraY<0&&s.cameraY>=-.1);
 for(let n=0;n<180;n++)visuals.stepMotionPresentation(s,p,1/60);
 assert.ok(s.landing<.001);assert.ok(Math.abs(s.cameraY)<.001);
});
test('presentation smooths acceleration and turn wrap without inventing movement on teleports',()=>{
 assert.equal(typeof visuals.createMotionPresentation,'function');
 const s=visuals.createMotionPresentation(),p={p:[0,0,0],yaw:Math.PI-.01,grounded:true,moveSpeed:10,sprinting:true};
 visuals.stepMotionPresentation(s,p,1/60);p.yaw=-Math.PI+.01;p.p[2]=-.15;visuals.stepMotionPresentation(s,p,1/60);
 assert.ok(s.speed>0&&s.speed<10);assert.ok(Math.abs(s.turn)<.05);
 p.p=[200,0,200];p.moveSpeed=0;visuals.stepMotionPresentation(s,p,1/60);assert.ok(Math.abs(s.strafe)<.05);
});
test('terrain colours are continuous at former biome thresholds',()=>{
 assert.equal(typeof visuals.terrainColor,'function');
 for(const radius of [245,282]){const a=visuals.terrainColor(radius-.001,0),b=visuals.terrainColor(radius+.001,0);assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<.002);}
});
test('construction reveal settles and damage tint tracks health',()=>{
 assert.equal(typeof visuals.buildPresentation,'function');
 const start=visuals.buildPresentation(0,100,100),settled=visuals.buildPresentation(1,100,100),hurt=visuals.buildPresentation(1,20,100);
 assert.ok(start.scale>=.9&&start.scale<1);assert.equal(settled.scale,1);assert.ok(hurt.damage>settled.damage);
});

test('ramp surface effects follow the slope and ignore its empty volume',()=>{
 assert.equal(typeof visuals.surfaceAtPoint,'function');const ramp={type:3,x:0,y:0,z:0,angle:0,material:'wood'};
 assert.equal(visuals.surfaceAtPoint([0,3.24,-2],[ramp],[],()=>0),'wood');
 assert.equal(visuals.surfaceAtPoint([0,1,-2],[ramp],[],()=>0),null);
});

test('shot feedback identifies the player hit by each individual pellet',async()=>{
 const {Match}=await import('../public/simulation.js');const {createLoadout}=await import('../public/weapon-system.js');
 const m=new Match({height:()=>0,obstacles:[]},['a','b']);m.phase='playing';const p=m.players[0],other=m.players[1];p.p=[0,0,0];p.air='landed';p.deploymentState='match_active';p.inventory=[...Object.entries(createLoadout()).map(([type,state])=>({id:type,type,...state})),null];p.inventory[1]={id:'shotgun',type:'shotgun',ammo:8};p.slot=2;other.p=[0,0,-3];other.hp=1000;
 m.fireWeapon(p,{yaw:0,pitch:0,aimYaw:0,aimPitch:0,aim:false},false);
 const event=m.events.find(e=>e.type==='shot');assert.ok(Array.isArray(event.traceHits));assert.equal(event.traceHits.length,event.traces.length);assert.ok(event.traceHits.every(id=>id===null||id==='b'));
});
