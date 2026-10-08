import assert from 'node:assert/strict';

export async function checkBuilding(host,guest,guestId,artifacts,checks){
 // Set up open terrain only; real keyboard/mouse inputs perform every placement.
 const buildOrigin=await host.evaluate(async id=>{
  const m=window.__testMatch,p=m.players.find(p=>p.id===id),{gridPlacement,gridValid}=await import('/build-grid.js');
  for(let x=-240;x<=240;x+=5)for(let z=-240;z<=240;z+=5){
   const y=m.world.height(x,z),points=[[x-10,z],[x+10,z],[x,z-20],[x,z+5]];
   if(y-Math.floor(y/3.6)*3.6>.4||points.some(([a,b])=>Math.abs(m.world.height(a,b)-y)>1.4))continue;
   if(m.world.obstacles.some(b=>b.min[0]<x+12&&b.max[0]>x-12&&b.min[2]<z+8&&b.max[2]>z-22))continue;
   const origin=[x,y,z],fixture={p:origin,hp:100,air:'landed'};
   const ramp=gridPlacement(fixture,{yaw:0,slot:10},m.world);
   if(y-ramp.y>.4||y-ramp.y<-.1)continue;
   if(![6,10].every(slot=>gridValid(gridPlacement(fixture,{yaw:0,slot},m.world),[],[fixture],m.world)))continue;
   m.structures=[];p.p=origin.slice();p.vy=0;p.impulse=[0,0];p.materials={wood:100,stone:100};p.crouching=false;p.crouchRequested=false;
   window.__buildObservations=[];const tick=m.tickGroundedPlayers;m.tickGroundedPlayers=function(...args){const result=tick.apply(this,args);if(window.__buildObservations.length<2500)window.__buildObservations.push({p:p.p.slice(),vy:p.vy,input:p.input.z});return result;};
   return origin;
  }
  throw Error('No clear flat terrain for building integration check');
 },guestId);
 await guest.waitForFunction(origin=>Math.abs(window.Game.pose().p[0]-origin[0])<.1&&Math.abs(window.Game.pose().p[2]-origin[2])<.1,buildOrigin);
 await guest.mouse.move(640,360);await guest.evaluate(()=>window.Game.look(0,-.15));await guest.keyboard.press('z');
 await guest.waitForFunction(()=>window.Game.input().slot===6&&window.Duel.valid(window.Duel.preview()));
 const wallPreview=await guest.evaluate(()=>window.Duel.preview());
 await guest.mouse.down();await host.waitForFunction(()=>window.__testMatch.structures.length===1);await guest.waitForTimeout(400);await guest.mouse.up();
 const wallResult=await host.evaluate(id=>({structures:window.__testMatch.structures,materials:window.__testMatch.players.find(p=>p.id===id).materials}),guestId);
 assert.equal(wallResult.structures.length,1,'holding build on the same cell cannot duplicate or double-charge');assert.equal(wallResult.materials.wood,90);
 for(const key of['x','y','z','angle','type','material'])assert.equal(wallResult.structures[0][key],wallPreview[key],'wall preview matches authoritative placement: '+key);
 await guest.keyboard.press('g');await guest.keyboard.press('b');await guest.waitForFunction(()=>window.Duel.preview().material==='stone');
 const rotatedPreview=await guest.evaluate(()=>window.Duel.preview());assert.ok(Math.abs(rotatedPreview.angle-wallPreview.angle-Math.PI/2)<1e-8);
 await guest.mouse.down();await host.waitForFunction(()=>window.__testMatch.structures.length===2);await guest.mouse.up();
 const stoneResult=await host.evaluate(id=>({wall:window.__testMatch.structures[1],materials:window.__testMatch.players.find(p=>p.id===id).materials}),guestId);
 assert.equal(stoneResult.materials.stone,90);assert.equal(stoneResult.materials.wood,90);
 for(const key of['x','y','z','angle','type','material'])assert.equal(stoneResult.wall[key],rotatedPreview[key],'rotated stone preview matches placement: '+key);
 await guest.screenshot({path:artifacts+'/building-walls.png'});
 checks.push('Real Z, G and B inputs place matching wood/stone walls, rotate 90 degrees and charge each material once');
 // A separate ramp lane tests the real walking collision and chained upper-level placement.
 await host.evaluate(({id,origin})=>{const m=window.__testMatch,p=m.players.find(p=>p.id===id);m.structures=[];p.p=origin.slice();p.vy=0;p.cool=0;}, {id:guestId,origin:buildOrigin});
 await guest.keyboard.press('g');await guest.keyboard.press('g');await guest.keyboard.press('g');await guest.keyboard.press('b');await guest.keyboard.press('v');
 await guest.waitForFunction(()=>window.Game.input().slot===10&&window.Duel.preview().material==='wood'&&window.Duel.valid(window.Duel.preview()));
 await guest.mouse.down();await host.waitForFunction(()=>window.__testMatch.structures.length===1);await guest.mouse.up();
 const firstRamp=await host.evaluate(()=>window.__testMatch.structures[0]);
 // Stop early enough to remain supported while the release travels to the host.
 await guest.keyboard.down('w');await host.waitForFunction(({id,origin})=>window.__testMatch.players.find(p=>p.id===id).p[1]>origin[1]+2,{id:guestId,origin:buildOrigin});await guest.keyboard.up('w');
 await host.waitForFunction(id=>{const p=window.__testMatch.players.find(p=>p.id===id);return p.input.z===0&&p.moveSpeed<.01;},guestId);
 assert.equal(await host.evaluate(id=>window.__testMatch.players.find(p=>p.id===id).grounded,guestId),true,'the operator remains supported while building the next ramp');
 const rampPosition=await host.evaluate(id=>window.__testMatch.players.find(p=>p.id===id).p.slice(),guestId);
 await guest.waitForFunction(p=>Math.hypot(...window.Game.pose().p.map((v,n)=>v-p[n]))<.02,rampPosition);
 await guest.waitForFunction(y=>Math.abs(window.Duel.preview().y-y)<1e-8&&window.Duel.valid(window.Duel.preview()),firstRamp.y+3.6);
 const upperPreview=await guest.evaluate(()=>window.Duel.preview());
 await guest.mouse.down();await host.waitForFunction(()=>window.__testMatch.structures.length===2);await guest.mouse.up();
 const upper=await host.evaluate(()=>window.__testMatch.structures[1]);
 for(const key of['x','y','z','angle','type','material'])assert.equal(upper[key],upperPreview[key],'upper ramp preview matches authoritative placement: '+key);
 await guest.screenshot({path:artifacts+'/building-ramp-chain.png'});
 await guest.keyboard.down('w');try{
  await host.waitForFunction(({id,origin})=>window.__testMatch.players.find(p=>p.id===id).p[1]>origin[1]+5.4,{id:guestId,origin:buildOrigin},{timeout:12000});
 }catch(error){
  const diagnostics=await host.evaluate(({id,origin})=>{
   const m=window.__testMatch,p=m.players.find(p=>p.id===id),history=window.__buildObservations||[];
   return {origin,position:p.p.slice(),grounded:p.grounded,velocity:p.vy,input:p.input,moveSpeed:p.moveSpeed,
    structures:m.structures,history:history.filter((_,i)=>i%20===0).slice(-80),
    maxHeight:Math.max(...history.map(x=>x.p[1]))};
  },{id:guestId,origin:buildOrigin});
  await guest.keyboard.up('w');
  throw Error('Second ramp ascent failed: '+JSON.stringify(diagnostics));
 }
 await guest.keyboard.up('w');
 assert.equal(await host.evaluate(id=>window.__testMatch.players.find(p=>p.id===id).materials.wood,guestId),70);
 checks.push('Real V input builds connected ramps, preview matches upper-level authority, and walking climbs both levels');
}
