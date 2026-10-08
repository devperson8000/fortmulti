import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {DEPLOYMENT_CUES} from '../public/deployment-cues.js';
import {POD_RELEASE,DEPLOYMENT_MUSIC_END} from '../public/deployment-cinematic.js';
const url=process.env.GAME_TEST_URL||'http://127.0.0.1:4174',artifacts=process.env.GAME_ARTIFACTS||'/workspace/fortmulti-artifacts/deployment';
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding','--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:960,height:540},recordVideo:{dir:artifacts+'/raw-video',size:{width:960,height:540}}}),errors=[],checks=[];
async function open(){
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{
  window.__music=[];window.__landings=[];window.__views=[];
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){
   if(this.buffer?.duration>20||(this.loop&&this.buffer?.duration>5)){window.__music.push({duration:this.buffer.duration,loop:this.loop,loopStart:this.loopStart,loopEnd:this.loopEnd,start:args[0],offset:args[1],anchor:args[0]-(args[1]||0),context:this.context,performance:performance.now()});}
   return start.apply(this,args);
  };
 });
 await p.goto(url+'/?local=1');await p.waitForFunction(()=>Boolean(window.Game));
 await p.evaluate(async()=>{
  const [{Connection},{Match}]=await Promise.all([import('/network.js'),import('/simulation.js')]);
  const originalOpen=Connection.prototype.open;Connection.prototype.open=async function(...args){await originalOpen.apply(this,args);window.__testConnection=this;};
  const round=Match.prototype.startRound;Match.prototype.startRound=function(...args){const result=round.apply(this,args);window.__testMatch=this;return result;};
  const effect=window.Game.effect;window.Game.effect=function(e,...args){if(e.type==='deployment_landed'){const m=window.__music.at(-1);window.__landings.push({musicTime:m?m.context.currentTime-m.anchor:null,sequence:e.sequence});}return effect.call(this,e,...args);};
  const sample=()=>{const v=window.Game.deploymentView();if(document.body.classList.contains('deployment-cinematic'))window.__views.push({...v,at:performance.now(),position:window.Game.pose().p.slice(),logoOpacity:Number(document.getElementById('deployment-cinematic').style.opacity)});requestAnimationFrame(sample);};requestAnimationFrame(sample);
 });return p;
}
try{
 const host=await open(),guest=await open();await host.locator('#create').click();await host.waitForFunction(()=>window.__testConnection?.connected);
 const code=await host.evaluate(()=>window.__testConnection.code);await guest.locator('.test-tools summary').first().click();await guest.locator('#code').fill(code);await guest.locator('#join').click();
 await host.waitForFunction(()=>document.getElementById('party-count').textContent.startsWith('2'));await guest.waitForFunction(()=>window.__testConnection?.host);
 await host.locator('#ready').click();await guest.locator('#ready').click();await host.waitForFunction(()=>Boolean(window.__testMatch));
 await Promise.all([host.evaluate(()=>window.Game.startAudio({deployment:true})),guest.evaluate(()=>window.Game.startAudio({deployment:true}))]);
 // Match input must work immediately after the lobby transitions to the
 // staging ship; the solo Play overlay is not part of this multiplayer flow.
 await host.waitForFunction(()=>window.Game.deploymentView().stage==='landing_selection');
 await host.keyboard.down('w');
 assert.equal(await host.evaluate(()=>window.Game.input().z),1,'ship movement is enabled without a hidden solo Play click');
 await host.keyboard.up('w');
 checks.push('Multiplayer input activates automatically in the staging ship');
 // Both operators choose their destinations with the real on-screen map.
 // Screen coordinates are derived from the same canvas mapping as app.js.
 async function pickLanding(page,x,z){
  const canvas=page.locator('#landing-map'),bounds=await canvas.boundingBox();
  assert.ok(bounds&&bounds.width>0&&bounds.height>0,'landing map must be visible and interactive');
  await canvas.click({position:{x:bounds.width*(.058+.884*(x/584+.5)),y:bounds.height*(.088+.824*(z/584+.5))}});
 }
 await pickLanding(host,18,68);
 await host.waitForFunction(()=>Boolean(window.__testMatch.players[0].destination),{timeout:6000});
 await pickLanding(guest,-85,70);
 await host.waitForFunction(()=>Boolean(window.__testMatch.players[1].destination),{timeout:7000});
 const chosen=await host.evaluate(()=>window.__testMatch.players.map(p=>p.destination));
 assert.ok(Math.hypot(chosen[0].x-chosen[1].x,chosen[0].z-chosen[1].z)>10,'distinct selections must survive network transport');
 checks.push('Both players pick distinct island landing zones using the visible map');

 // Walk through the real ship from the middle aisle toward the accessible
 // pods. W moves toward negative Z (the forward row of pods).
 // The server moves and collides players, not the browser test.
 async function walkToPod(page,id,direction){
  await page.evaluate(()=>window.Game.look(0));
  const sideways=direction<0?'a':'d';
  await page.keyboard.down(sideways);
  await host.waitForFunction(({id,direction})=>{
   const p=window.__testMatch.players.find(p=>p.id===id);
   return p&&p.shipLocal[0]*direction>5.1;
  },{id,direction},{timeout:7000});
  await page.keyboard.up(sideways);
  await page.keyboard.down('w');
  await host.waitForFunction(id=>{
   const p=window.__testMatch.players.find(p=>p.id===id);
   return p&&p.shipLocal[2]<-6.6;
  },id,{timeout:7000});
  await page.keyboard.up('w');
  const position=await host.evaluate(id=>window.__testMatch.players.find(p=>p.id===id).shipLocal.slice(),id);
  assert.ok(position[0]*direction>5&&position[2]<-6.55,'operator physically walks across ship to a pod');
  return position;
 }
 const hostId=await host.evaluate(()=>window.__testConnection.id);
 const guestId=await guest.evaluate(()=>window.__testConnection.id);
 await walkToPod(host,hostId,-1);
 await host.keyboard.down('e');
 await host.waitForFunction(id=>window.__testMatch.players.find(p=>p.id===id)?.deploymentState==='entering_pod',hostId,{timeout:6000});
 await host.keyboard.up('e');
 await host.waitForFunction(()=>window.Game.pose().deploymentState==='pod_ready',{timeout:10000});
 await host.waitForFunction(()=>document.body.classList.contains('pod-exterior'),{timeout:10000});
 const waiting=await host.evaluate(()=>({stage:window.Game.deploymentView().stage,pose:window.Game.pose().deploymentState,camera:window.Game.deploymentView().eye,player:window.Game.pose().p,exterior:document.body.classList.contains('pod-exterior'),cinematic:document.body.classList.contains('deployment-cinematic')}));
 assert.equal(waiting.stage,'landing_selection','wait for the second player');
 assert.equal(waiting.pose,'pod_ready');assert.equal(waiting.exterior,true);
 assert.equal(waiting.cinematic,false,'no cinematic before teammate boards');
 assert.ok(Math.hypot(waiting.camera[0]-waiting.player[0],waiting.camera[2]-waiting.player[2])>3,'camera is outside sealed pod');
 await host.screenshot({path:artifacts+'/00-waiting-pod.png'});
 checks.push('Host walks from middle aisle, presses E and waits in a sealed pod with exterior camera');

 await walkToPod(guest,guestId,1);
 await guest.waitForFunction(()=>window.Game.pose().deploymentState==='pod_available',{timeout:6000});
 await guest.keyboard.down('e');
 await host.waitForFunction(id=>window.__testMatch.players.find(p=>p.id===id)?.deploymentState==='entering_pod',guestId,{timeout:7000});
 await guest.keyboard.up('e');
 await host.waitForFunction(()=>window.__testMatch.deployment.stage==='launching',{timeout:15000});
 await Promise.all([host,guest].map(p=>p.waitForFunction(()=>document.body.classList.contains('pod-exterior'),{timeout:10000})));
 const launched=await Promise.all([host,guest].map(p=>p.evaluate(()=>({exterior:document.body.classList.contains('pod-exterior'),fade:Number(document.getElementById('deployment-fade').style.opacity)}))));
 assert.ok(launched.every(v=>v.exterior&&v.fade<.05),'both pods visible before blackout');
 checks.push('Guest presses E across the network; both clients show exterior launch before blackout');
 await guest.waitForFunction(()=>window.Game.deploymentView().musicTime>=.15,{timeout:30000});
 const black=await guest.evaluate(()=>({view:window.Game.deploymentView(),fade:Number(document.getElementById('deployment-fade').style.opacity),ui:['mapbox','deployment-ui','inventory','chatbox','round-banner','resume-control'].map(id=>[id,getComputedStyle(document.getElementById(id)).visibility])}));
 assert.equal(black.fade,1);assert.ok(black.ui.every(([,v])=>v==='hidden'));await guest.screenshot({path:artifacts+'/01-black-screen.png'});checks.push('Music begins on full black with gameplay UI hidden');
 await guest.waitForFunction(c=>window.Game.deploymentView().musicTime>=c.uhYeahStart+.5,DEPLOYMENT_CUES,{timeout:30000});
 assert.ok(await guest.evaluate(()=>Number(document.getElementById('deployment-cinematic').style.opacity)>.99));await guest.screenshot({path:artifacts+'/02-horizon-reveal.png'});checks.push('HORIZON symbol appears at the uh yeah cue');
 await guest.waitForFunction(c=>window.Game.deploymentView().musicTime>=c.businessStart,DEPLOYMENT_CUES,{timeout:30000});
 const portrait=await guest.evaluate(()=>({view:window.Game.deploymentView(),position:window.Game.pose().p,landing:window.Game.pose().destination,logo:Number(document.getElementById('deployment-cinematic').style.opacity)}));
 assert.equal(portrait.logo,0);assert.equal(portrait.view.black,0);assert.equal(portrait.view.orbit,1);assert.equal(portrait.view.localVisible,false);assert.equal(portrait.view.operatorOpacity,0);assert.equal(portrait.view.hatchOpen,0);assert.ok(portrait.position[1]>portrait.landing.y+10);
 await guest.screenshot({path:artifacts+'/03-sealed-pod.png'});checks.push('Logo fades at the opening lyric; the descent shows only the sealed capsule exterior');
 await guest.waitForFunction(c=>window.Game.deploymentView().musicTime>=c.impact+.08,DEPLOYMENT_CUES,{timeout:15000});
 const impact=await guest.evaluate(()=>({view:window.Game.deploymentView(),position:window.Game.pose().p.slice(),landing:window.Game.pose().destination}));
 assert.deepEqual(impact.position,[impact.landing.x,impact.landing.y,impact.landing.z]);assert.equal(impact.view.localVisible,false);assert.equal(impact.view.hatchOpen,0);await guest.screenshot({path:artifacts+'/04-touchdown.png'});checks.push('Sealed pod slams onto the selected ground on the measured bass drop');
 for(const phase of ['opening','walkout','salute']){
  const time=DEPLOYMENT_CUES.impact+POD_RELEASE.hold+(phase==='opening'?POD_RELEASE.open*.55:POD_RELEASE.open+(phase==='walkout'?POD_RELEASE.exit*.5:POD_RELEASE.exit+POD_RELEASE.salute*.5));
  await guest.waitForFunction(t=>window.Game.deploymentView().musicTime>=t,time,{timeout:15000});
  const shot=await guest.evaluate(()=>({view:window.Game.deploymentView(),position:window.Game.pose().p.slice(),animation:window.Game.pose().animationState,salute:window.Game.pose().saluteProgress,input:window.Game.input()}));
  assert.equal(shot.view.localVisible,true);assert.ok(shot.view.operatorOpacity>.99);assert.equal(shot.input.fire,false);assert.equal(shot.input.slot,0);
  if(phase==='opening'){assert.ok(shot.view.hatchOpen>.4&&shot.view.hatchOpen<=1,'pod hatch must be visibly opened');}
  else assert.ok(Math.hypot(shot.position[0]-shot.view.podPosition[0],shot.position[2]-shot.view.podPosition[2])>1);
  if(phase==='salute'){assert.ok(shot.salute>.99,'native salute is fully raised');assert.ok(shot.view.musicTime<DEPLOYMENT_MUSIC_END);}
  await guest.screenshot({path:artifacts+'/0'+(phase==='opening'?5:phase==='walkout'?6:7)+'-'+phase+'.png'});
 }
 checks.push('Hatch reveals the operator after impact; walkout and salute remain visible with music and combat locked');
 await host.waitForFunction(()=>window.__testMatch.phase==='playing',{timeout:15000});
 // The local audio clock can reach its final frame before the network delivers
 // the host's final landed snapshot. Wait for BOTH, not just the camera stage.
 await Promise.all([host,guest].map(page=>page.waitForFunction(()=>window.Game.deploymentView().stage==='match_active'&&window.Game.pose().air==='landed'&&!document.body.classList.contains('deployment-cinematic'),{timeout:15000})));
 // Frame counts are diagnostic only: one 0.5-second camera handoff can draw
 // anywhere from zero to many frames under GitHub's software WebGL runner.
 // Assert the real shot before it and the authoritative first-person handoff.
 const gameplay=await Promise.all([host,guest].map(async page=>page.evaluate(()=>({
  view:window.Game.deploymentView(),air:window.Game.pose().air,
  position:window.Game.pose().p.slice(),cinematic:document.body.classList.contains('deployment-cinematic')
 }))));
 for(const view of gameplay){
  assert.equal(view.view.stage,'match_active','both clients must reach gameplay');
  assert.equal(view.air,'landed');assert.equal(view.cinematic,false);
  assert.ok(Math.hypot(view.view.eye[0]-view.position[0],view.view.eye[2]-view.position[2])<.35,'camera finishes at the player rather than the pod');
 }
 // A fresh match intentionally starts without a weapon. Build selection
 // proves the input handler is active without creating test-only inventory.
 await guest.keyboard.press('z');
 await guest.waitForFunction(()=>window.Game.input().slot===6,{timeout:5000});
 await guest.keyboard.down('w');
 assert.equal(await guest.evaluate(()=>window.Game.input().z),1,'movement unlocks after the salute');
 await guest.keyboard.up('w');
 await guest.screenshot({path:artifacts+'/08-gameplay.png'});
 checks.push('Both players return to first person and movement/weapon controls unlock after salute');
 const results=await Promise.all([host,guest].map(async p=>p.evaluate(c=>({music:window.__music.map(({context,...m})=>m),landings:window.__landings,frames:window.__views.length,firstLogo:window.__views.find(v=>v.logoOpacity>0),firstVisible:window.__views.find(v=>v.black<.02&&v.portrait),firstImpact:window.__views.find(v=>v.musicTime>=c.impact),exit:window.__views.filter(v=>v.returnProgress>.15&&v.returnProgress<1).map(v=>({returnProgress:v.returnProgress,position:v.position,podPosition:v.podPosition,eye:v.eye,localVisible:v.localVisible})),largestFrameGap:window.__views.reduce((max,v,i,a)=>i?Math.max(max,v.at-a[i-1].at):max,0)}),DEPLOYMENT_CUES)));
 await writeFile(artifacts+'/deployment-clock-diagnostics.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.map(r=>({music:r.music,landings:r.landings,firstImpact:r.firstImpact})),null,2));
 for(const result of results){assert.equal(result.music.filter(m=>!m.loop).length,1,'one complete song per client');assert.equal(result.music.filter(m=>m.loop).length,0,'no replayed or looped instrumental tail');assert.ok(result.music[0].duration>=DEPLOYMENT_MUSIC_END-.1,'original recording covers the salute');assert.equal(result.landings.length,1,'one touchdown per client');assert.ok(Math.abs(result.landings[0].musicTime-DEPLOYMENT_CUES.impact)<.25,'network touchdown must align with the music');assert.ok(result.firstImpact.musicTime-DEPLOYMENT_CUES.impact<.16,'visible touchdown occurs on the audio clock');assert.ok(result.firstLogo.musicTime>=DEPLOYMENT_CUES.uhYeahStart&&result.firstLogo.musicTime-DEPLOYMENT_CUES.uhYeahStart<.16,'first logo frame follows the measured vocal onset');}
 checks.push('Both real network clients play one uninterrupted song and synchronize distinct landings');
 for(const result of results){
  // An inactive tab may sample zero frames in this short transition. The
  // elapsed-time unit test covers every camera step at 120 subdivisions;
  // browser frames provide additional validation whenever available.
  if(result.exit.length){
   const start=result.exit[0].podPosition;
   assert.ok(start,'pod anchor remains available throughout the handoff');
   assert.ok(result.exit.every(v=>v.podPosition?.every((n,k)=>Math.abs(n-start[k])<1e-8)),'landed pod stays anchored during return');
   assert.ok(result.exit.every(v=>v.returnProgress>0&&v.returnProgress<1),'sampled handoff progress stays in range');
   assert.ok(result.exit.every(v=>v.eye.every(Number.isFinite)),'camera position stays finite');
   for(const end of result.exit.filter(v=>v.returnProgress>.9)){
    assert.equal(end.localVisible,false,'hide avatar before camera enters first person');
    assert.ok(Math.hypot(end.eye[0]-end.position[0],end.eye[2]-end.position[2])<.35,'camera approaches the first-person eye');
   }
  }
 }
 checks.push('Pods stay fixed during exit and camera returns smoothly to first person');assert.deepEqual(errors,[]);
 await writeFile(artifacts+'/deployment-browser-results.json',JSON.stringify({checks,errors,cues:DEPLOYMENT_CUES,black,portrait,impact,clients:results},null,2));
 console.log(JSON.stringify({passed:checks.length,checks,errors,clients:results.map(r=>({frames:r.frames,landingMusicTime:r.landings[0].musicTime,visibleImpactMusicTime:r.firstImpact.musicTime,largestFrameGap:r.largestFrameGap}))},null,2));
 await guest.waitForTimeout(800);
}finally{await writeFile(artifacts+'/recordings.json',JSON.stringify(await Promise.all(context.pages().map(async p=>({file:await p.video().path()}))),null,2));await context.close();await browser.close();}
