import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {DEPLOYMENT_CUES} from '../public/deployment-cues.js';
const url=process.env.GAME_TEST_URL||'http://127.0.0.1:4174',artifacts=process.env.GAME_ARTIFACTS||'/workspace/fortmulti-artifacts/deployment';
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding','--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:960,height:540},recordVideo:{dir:artifacts+'/raw-video',size:{width:960,height:540}}}),errors=[],checks=[];
async function open(){
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{
  window.__music=[];window.__landings=[];window.__views=[];
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){
   if(this.buffer?.duration>20){window.__music.push({duration:this.buffer.duration,start:args[0],offset:args[1],anchor:args[0]-(args[1]||0),context:this.context,performance:performance.now()});}
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
 await host.evaluate(async()=>{
  const {SHIP_PODS}=await import('/deployment-ship.js'),m=window.__testMatch;
  m.players.forEach((p,i)=>{if(!m.chooseLanding(p.id,{x:i?-85:18,z:i?70:68}))throw Error('Landing failed');const pod=SHIP_PODS[i];p.shipLocal=[pod.x,0,pod.z+2.2];p.p=m.shipWorld(p.shipLocal);if(!m.enterPod(p.id))throw Error('Pod entry failed');});
 });
 await guest.waitForFunction(()=>window.Game.deploymentView().musicTime>=.15,{timeout:30000});
 const black=await guest.evaluate(()=>({view:window.Game.deploymentView(),fade:Number(document.getElementById('deployment-fade').style.opacity),ui:['mapbox','deployment-ui','inventory','chatbox','round-banner','resume-control'].map(id=>[id,getComputedStyle(document.getElementById(id)).visibility])}));
 assert.equal(black.fade,1);assert.ok(black.ui.every(([,v])=>v==='hidden'));await guest.screenshot({path:artifacts+'/01-black-screen.png'});checks.push('Music begins on full black with gameplay UI hidden');
 await guest.waitForFunction(c=>window.Game.deploymentView().musicTime>=c.uhYeahStart+.5,DEPLOYMENT_CUES,{timeout:30000});
 assert.ok(await guest.evaluate(()=>Number(document.getElementById('deployment-cinematic').style.opacity)>.99));await guest.screenshot({path:artifacts+'/02-horizon-reveal.png'});checks.push('HORIZON symbol appears at the uh yeah cue');
 await guest.waitForFunction(c=>window.Game.deploymentView().musicTime>=c.businessStart,DEPLOYMENT_CUES,{timeout:30000});
 const portrait=await guest.evaluate(()=>({view:window.Game.deploymentView(),position:window.Game.pose().p,landing:window.Game.pose().destination,logo:Number(document.getElementById('deployment-cinematic').style.opacity)}));
 assert.equal(portrait.logo,0);assert.equal(portrait.view.black,0);assert.equal(portrait.view.orbit,1);assert.equal(portrait.view.localVisible,true);assert.ok(portrait.position[1]>portrait.landing.y+10);
 await guest.screenshot({path:artifacts+'/03-operator-in-pod.png'});checks.push('Logo fades at the opening lyric and camera faces the actual operator by business');
 await guest.waitForFunction(c=>window.Game.deploymentView().musicTime>=c.impact+.08,DEPLOYMENT_CUES,{timeout:15000});
 const impact=await guest.evaluate(()=>({view:window.Game.deploymentView(),position:window.Game.pose().p.slice(),landing:window.Game.pose().destination}));
 assert.deepEqual(impact.position,[impact.landing.x,impact.landing.y,impact.landing.z]);await guest.screenshot({path:artifacts+'/04-touchdown.png'});checks.push('Visible pod touches the selected ground on Big stepper');
 await host.waitForFunction(()=>window.__testMatch.phase==='playing',{timeout:15000});await guest.waitForFunction(()=>window.Game.deploymentView().stage==='match_active',{timeout:15000});
 assert.equal(await guest.evaluate(()=>document.body.classList.contains('deployment-cinematic')),false);checks.push('Pod opens, exits cleanly and restores gameplay');
 const results=await Promise.all([host,guest].map(async p=>p.evaluate(c=>({music:window.__music.map(({context,...m})=>m),landings:window.__landings,frames:window.__views.length,firstVisible:window.__views.find(v=>v.black<.02&&v.portrait),firstImpact:window.__views.find(v=>v.musicTime>=c.impact),exit:window.__views.filter(v=>v.returnProgress>.15&&v.returnProgress<1).map(v=>({returnProgress:v.returnProgress,position:v.position,podPosition:v.podPosition,eye:v.eye,localVisible:v.localVisible})),largestFrameGap:window.__views.reduce((max,v,i,a)=>i?Math.max(max,v.at-a[i-1].at):max,0)}),DEPLOYMENT_CUES)));
 await writeFile(artifacts+'/deployment-clock-diagnostics.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.map(r=>({music:r.music,landings:r.landings,firstImpact:r.firstImpact})),null,2));
 for(const result of results){assert.equal(result.music.length,1,'one music source per client');assert.equal(result.landings.length,1,'one touchdown per client');assert.ok(Math.abs(result.landings[0].musicTime-DEPLOYMENT_CUES.impact)<.25,'network touchdown must align with the music');assert.ok(result.firstImpact.musicTime-DEPLOYMENT_CUES.impact<.16,'visible touchdown occurs on the audio clock');}
 checks.push('Both real network clients play once, retain distinct landings and synchronize touchdown');
 for(const result of results){
  assert.ok(result.exit.length>3,'exit camera must render a continuous handoff');
  const start=result.exit[0].podPosition;
  assert.ok(result.exit.every(v=>v.podPosition.every((n,k)=>Math.abs(n-start[k])<1e-8)),'landed pod stays anchored while the operator exits');
  assert.ok(result.exit.some(v=>Math.hypot(v.position[0]-start[0],v.position[2]-start[2])>.4),'operator actually walks out of the stationary pod');
  const end=result.exit.at(-1);
  assert.ok(end.returnProgress>.9);assert.equal(end.localVisible,false,'hide avatar before camera enters the first-person head');
  assert.ok(Math.hypot(end.eye[0]-end.position[0],end.eye[2]-end.position[2])<.25,'camera approaches the true first-person eye continuously');
 }
 checks.push('Pods stay fixed during exit and camera returns smoothly to first person');assert.deepEqual(errors,[]);
 await writeFile(artifacts+'/deployment-browser-results.json',JSON.stringify({checks,errors,cues:DEPLOYMENT_CUES,black,portrait,impact,clients:results},null,2));
 console.log(JSON.stringify({passed:checks.length,checks,errors,clients:results.map(r=>({frames:r.frames,landingMusicTime:r.landings[0].musicTime,visibleImpactMusicTime:r.firstImpact.musicTime,largestFrameGap:r.largestFrameGap}))},null,2));
 await writeFile(artifacts+'/recordings.json',JSON.stringify({host:await host.video().path(),guest:await guest.video().path()},null,2));
}finally{await writeFile(artifacts+'/recordings.json',JSON.stringify(await Promise.all(context.pages().map(async p=>({file:await p.video().path()}))),null,2));await context.close();await browser.close();}
