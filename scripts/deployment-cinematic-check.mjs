import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {DEPLOYMENT_CUES} from '../public/deployment-cues.js';
import {POD_RELEASE,DEPLOYMENT_MUSIC_END} from '../public/deployment-cinematic.js';
const url=process.env.GAME_TEST_URL||'http://127.0.0.1:4174',artifacts=process.env.GAME_ARTIFACTS||'/workspace/fortmulti-artifacts/deployment';
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding','--autoplay-policy=no-user-gesture-required']});
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
  const {MatchCharacterRenderer}=await import('/match-character-renderer.js'),render=MatchCharacterRenderer.prototype.render;
  MatchCharacterRenderer.prototype.render=function(...args){window.__renderer=this;return render.apply(this,args);};
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
 await host.waitForFunction(()=>window.Game.deploymentView().stage==='landing_selection');
 // Both clients must decode the actual locally hosted CC0 GLBs, not silently
 // show procedural fallback or hotlink external content.
 await Promise.all([host,guest].map(page=>page.waitForFunction(()=>{
  const stats=window.Game.environmentStats?.();
  return stats?.readyKinds.includes('wood')&&stats?.readyKinds.includes('stone')&&stats.count>100;
 },{timeout:20000})));
 const environment=await Promise.all([host,guest].map(page=>page.evaluate(()=>window.Game.environmentStats())));
 assert.ok(environment.every(stats=>stats.drawBatches>0&&stats.drawBatches<30),'batch imported island models efficiently');
 checks.push('Both clients load real CC0 Kenney trees and rocks as GPU-instanced map scenery');
 await host.keyboard.down('w');assert.equal(await host.evaluate(()=>window.Game.input().z),1);await host.keyboard.up('w');
 checks.push('Multiplayer controls activate from lobby without clicking the hidden solo Play button');
 async function pickLanding(page,x,z){
  const canvas=page.locator('#landing-map'),bounds=await canvas.boundingBox();assert.ok(bounds&&bounds.width>0);
  await canvas.click({position:{x:bounds.width*(.058+.884*(x/584+.5)),y:bounds.height*(.088+.824*(z/584+.5))}});
 }
 await pickLanding(host,18,68);await pickLanding(guest,-85,70);
 await host.waitForFunction(()=>window.__testMatch.players.every(p=>p.destination));
 const chosen=await host.evaluate(()=>window.__testMatch.players.map(p=>p.destination));assert.ok(Math.hypot(chosen[0].x-chosen[1].x,chosen[0].z-chosen[1].z)>10);
 checks.push('Both connected players select distinct landing zones with the visible map');
 async function walkToPod(page,direction){
  const id=await page.evaluate(()=>window.__testConnection.id),sideways=direction<0?'a':'d';await page.evaluate(()=>window.Game.look(0));
  await page.keyboard.down(sideways);await host.waitForFunction(({id,direction})=>window.__testMatch.players.find(p=>p.id===id).shipLocal[0]*direction>5.1,{id,direction},{timeout:8000});await page.keyboard.up(sideways);
  await page.keyboard.down('w');await host.waitForFunction(id=>window.__testMatch.players.find(p=>p.id===id).shipLocal[2]<-6.6,id,{timeout:8000});await page.keyboard.up('w');
 }
 await walkToPod(guest,1);
 // Use actual keyboard interaction, not direct enterPod calls.
 await guest.waitForFunction(()=>window.Game.pose().deploymentState==='pod_available'&&window.Game.pose().p[0]>5);
 await guest.keyboard.down('e');await guest.waitForFunction(()=>window.Game.pose().deploymentState==='entering_pod');await guest.keyboard.up('e');
 await guest.waitForFunction(()=>window.Game.pose().podProgress>.25&&window.Game.pose().podProgress<.6);
 const boarding=await guest.evaluate(()=>({view:window.Game.deploymentView(),p:window.Game.pose().p.slice(),input:window.Game.input()}));
 assert.equal(boarding.view.boarding,true);assert.equal(boarding.view.localVisible,true);assert.equal(boarding.view.boardingDoorOpen,1);
 assert.ok(Math.hypot(boarding.view.eye[0]-boarding.p[0],boarding.view.eye[2]-boarding.p[2])>3);
 await guest.screenshot({path:artifacts+'/00a-boarding.png'});checks.push('Pressing E switches to exterior camera watching the operator enter through open doors');
 await guest.waitForFunction(()=>window.Game.pose().deploymentState==='pod_ready');
 const waiting=await guest.evaluate(()=>({view:window.Game.deploymentView(),sources:window.__music.length,locked:window.Game.input()}));
 assert.equal(waiting.view.boardingDoorOpen,0);assert.equal(waiting.view.localVisible,false);assert.equal(waiting.sources,0);
 assert.equal(waiting.locked.interact,false);await guest.screenshot({path:artifacts+'/00b-sealed-waiting.png'});
 await guest.waitForTimeout(500);assert.deepEqual(await guest.evaluate(()=>window.Game.deploymentView().eye),waiting.view.eye);
 checks.push('Doors close after boarding; sealed exterior view stays stationary while waiting for teammate');
 await walkToPod(host,-1);
 await host.keyboard.down('e');await host.waitForFunction(()=>window.Game.pose().deploymentState==='entering_pod');await host.keyboard.up('e');
 await guest.waitForFunction(()=>window.Game.deploymentView().sequenceElapsed>.68&&window.Game.deploymentView().sequenceElapsed<1.1);
 const ejection=await guest.evaluate(()=>({view:window.Game.deploymentView(),p:window.Game.pose().p.slice(),operators:[...window.__renderer.instances.values()].map(i=>({visible:i.holder.visible,opacity:i.cinematicOpacity}))}));
 assert.equal(ejection.view.boarding,true);assert.equal(ejection.view.shipLaunch.hatchOpen,1);assert.ok(ejection.view.shipLaunch.drop>5);assert.equal(ejection.view.black,0);assert.ok(ejection.operators.every(i=>!i.visible||i.opacity===0),'all sealed operators stay concealed, including remote players');
 await guest.screenshot({path:artifacts+'/00c-pod-ejection.png'});checks.push('Launch hatches slide open and complete pods fire below the floor before blackout');
 await guest.waitForFunction(()=>window.Game.deploymentView().musicTime>=.15,{timeout:30000});
 const black=await guest.evaluate(()=>({view:window.Game.deploymentView(),fade:Number(document.getElementById('deployment-fade').style.opacity),ui:['mapbox','deployment-ui','inventory','chatbox','round-banner','resume-control'].map(id=>[id,getComputedStyle(document.getElementById(id)).visibility])}));
 assert.equal(black.fade,1);assert.ok(black.ui.every(([,v])=>v==='hidden'));await guest.screenshot({path:artifacts+'/01-black-screen.png'});checks.push('Music begins on full black with gameplay UI hidden');
 await guest.waitForFunction(c=>window.Game.deploymentView().musicTime>=c.uhYeahStart+.85,DEPLOYMENT_CUES,{timeout:30000});
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
  if(phase==='opening'){assert.ok(shot.view.hatchOpen>.35&&shot.view.hatchOpen<=1,'the pod hatch has visibly opened');}
  else assert.ok(Math.hypot(shot.position[0]-shot.view.podPosition[0],shot.position[2]-shot.view.podPosition[2])>1);
  if(phase==='salute'){assert.ok(shot.salute>.99,'native salute is fully raised');assert.ok(shot.view.musicTime<DEPLOYMENT_MUSIC_END-.4);assert.equal(shot.view.saluteFraming,1);assert.equal(shot.view.returnProgress,0);assert.ok(Math.abs(shot.view.eye[0]-shot.position[0])<.01);assert.ok(shot.view.eye[2]>shot.position[2]+2,'camera views the front of the saluting character');}
  await guest.screenshot({path:artifacts+'/0'+(phase==='opening'?5:phase==='walkout'?6:7)+'-'+phase+'.png'});
 }
 checks.push('Hatch reveals the operator after impact; walkout and salute remain visible with music and combat locked');
 await host.waitForFunction(()=>window.__testMatch.phase==='playing',{timeout:15000});await guest.waitForFunction(()=>window.Game.deploymentView().stage==='match_active'&&!document.body.classList.contains('deployment-cinematic'),{timeout:15000});
 assert.equal(await guest.evaluate(()=>document.body.classList.contains('deployment-cinematic')),false);await guest.screenshot({path:artifacts+'/08-gameplay.png'});checks.push('Salute finishes before the camera returns and gameplay unlocks');
 await guest.keyboard.press('z');await guest.waitForFunction(()=>window.Game.input().slot===6);await guest.keyboard.down('w');assert.equal(await guest.evaluate(()=>window.Game.input().z),1);await guest.keyboard.up('w');checks.push('Gameplay build and movement controls work after the salute');
 const results=await Promise.all([host,guest].map(async p=>p.evaluate(c=>({music:window.__music.map(({context,...m})=>m),firstBoarding:window.__views.find(v=>v.boarding),landings:window.__landings,frames:window.__views.length,firstLogo:window.__views.find(v=>v.logoOpacity>0),firstVisible:window.__views.find(v=>v.black<.02&&v.portrait),firstImpact:window.__views.find(v=>v.musicTime>=c.impact),exit:window.__views.filter(v=>v.returnProgress>.15&&v.returnProgress<1).map(v=>({returnProgress:v.returnProgress,position:v.position,podPosition:v.podPosition,eye:v.eye,localVisible:v.localVisible})),largestFrameGap:window.__views.reduce((max,v,i,a)=>i?Math.max(max,v.at-a[i-1].at):max,0)}),DEPLOYMENT_CUES)));
 await writeFile(artifacts+'/deployment-clock-diagnostics.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.map(r=>({music:r.music,landings:r.landings,firstImpact:r.firstImpact})),null,2));
 for(const result of results){assert.equal(result.music.filter(m=>!m.loop).length,1,'one complete song per client');assert.equal(result.music.length,1,'the supplied song continues with no repeat or extra voice');assert.equal(result.music.filter(m=>m.loop).length,0);assert.ok(result.music.find(m=>!m.loop).duration>=30);assert.equal(result.landings.length,1,'one touchdown per client');assert.ok(Math.abs(result.landings[0].musicTime-DEPLOYMENT_CUES.impact)<.25,'network touchdown must align with the music');assert.ok(result.firstImpact.musicTime-DEPLOYMENT_CUES.impact<.16,'visible touchdown occurs on the audio clock');assert.ok(result.firstLogo.musicTime>=DEPLOYMENT_CUES.uhYeahStart&&result.firstLogo.musicTime-DEPLOYMENT_CUES.uhYeahStart<.16,'first logo frame follows the measured vocal onset');}
 checks.push('Both real network clients play once, retain distinct landings and synchronize touchdown');
 for(const result of results){
  // Under software WebGL the 0.5-second first-person camera return might
  // yield only one sampled frame. Dense camera continuity is tested by the
  // per-frame cinematic unit test; validate available browser samples here.
  if(result.exit.length){
   const start=result.exit[0].podPosition;
   assert.ok(result.exit.every(v=>v.podPosition?.every((n,k)=>Math.abs(n-start[k])<1e-8)),'pod stays anchored while the camera returns');
   assert.ok(result.exit.every(v=>v.eye.every(Number.isFinite)),'camera coordinates are finite');
   for(const end of result.exit.filter(v=>v.returnProgress>.9)){
    assert.equal(end.localVisible,false,'hide avatar at the first-person eye');
    assert.ok(Math.hypot(end.eye[0]-end.position[0],end.eye[2]-end.position[2])<.35);
   }
  }
 }
 checks.push('Pods stay fixed during exit and camera returns smoothly to first person');assert.deepEqual(errors,[]);
 await writeFile(artifacts+'/deployment-browser-results.json',JSON.stringify({checks,errors,cues:DEPLOYMENT_CUES,boarding,waiting,ejection,black,portrait,impact,clients:results},null,2));
 console.log(JSON.stringify({passed:checks.length,checks,errors,clients:results.map(r=>({frames:r.frames,landingMusicTime:r.landings[0].musicTime,visibleImpactMusicTime:r.firstImpact.musicTime,largestFrameGap:r.largestFrameGap}))},null,2));
 await guest.waitForTimeout(800);
}finally{await writeFile(artifacts+'/recordings.json',JSON.stringify(await Promise.all(context.pages().map(async p=>({file:await p.video().path()}))),null,2));await context.close();await browser.close();}
