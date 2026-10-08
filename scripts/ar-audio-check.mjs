import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
const url=process.env.GAME_TEST_URL||'http://127.0.0.1:4174',artifacts=process.env.GAME_ARTIFACTS||'/workspace/fortmulti-artifacts/audio';
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage(),errors=[];let requests=0;
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('/audio/ar-shot.wav'))requests++;});
 await page.addInitScript(()=>{
  window.__plays=[];window.__ends=0;window.__decodes=0;window.__gainFades=[];
  const makeGain=AudioContext.prototype.createGain;
  AudioContext.prototype.createGain=function(...args){
   const node=makeGain.apply(this,args),set=node.gain.setValueAtTime.bind(node.gain),ramp=node.gain.exponentialRampToValueAtTime.bind(node.gain);let from;
   node.gain.setValueAtTime=(value,time)=>{from=value;return set(value,time);};
   node.gain.exponentialRampToValueAtTime=(value,time)=>{window.__gainFades.push({from,to:value});return ramp(value,time);};return node;
  };
  const start=AudioBufferSourceNode.prototype.start,decode=AudioContext.prototype.decodeAudioData;
  AudioBufferSourceNode.prototype.start=function(...args){window.__shotContext=this.context;window.__plays.push({duration:this.buffer?.duration,loop:this.loop,buffer:this.buffer,time:this.context.currentTime});this.addEventListener('ended',()=>window.__ends++);return start.apply(this,args);};
  AudioContext.prototype.decodeAudioData=function(...args){window.__decodes++;return decode.apply(this,args);};
 });
 await page.goto(url);await page.waitForFunction(()=>Boolean(window.Game));
 await page.evaluate(async()=>{
  await window.Game.startAudio();const {Match}=await import('/simulation.js');
  const match=new Match({height:()=>0,obstacles:[]},['audio-test','target']);match.phase='playing';
  match.players.forEach((p,i)=>{p.air='landed';p.p=i?[200,0,200]:[0,0,0];p.vy=0;p.hp=100;p.slot=1;p.inventory=[{id:'audio-ar',type:'ar',ammo:30},null,null,null,null];p.equip=0;});
  window.__audioMatch=match;window.__shotEvents=0;let seen=0;
  window.__fireTick=()=>{match.input('audio-test',{slot:1,fire:true});match.tick(.02);for(const e of match.events)if(e.id>seen){if(e.type==='shot'){window.__shotEvents++;window.Game.effect(e,'audio-test');}seen=e.id;}};
  window.__fireTick();
 });
 const first=await page.evaluate(()=>window.__plays.map(({buffer,...p})=>p));
 assert.equal(first.length,1,'one AR bullet should play exactly one sampled shot');
 assert.ok(Math.abs(first[0].duration-.36)<.001,'AR must use the isolated 360ms shot, not synthetic noise or the entire video');
 assert.equal(first[0].loop,false);
 await page.evaluate(async()=>{for(let n=0;n<4;n++){await new Promise(r=>setTimeout(r,118));for(let step=0;step<6;step++)window.__fireTick();}});
 assert.equal(await page.evaluate(()=>window.__shotEvents),5,'the actual held-fire simulation should emit five AR bullets');
 assert.equal(await page.evaluate(()=>window.__plays.length),5,'five bullets should produce five independent one-shot sources');
 assert.equal(await page.evaluate(()=>window.__plays.every(p=>p.buffer===window.__plays[0].buffer)),true,'reuse the decoded buffer across bullets');
 assert.equal(await page.evaluate(()=>window.__decodes),3,'decode each sample once outside firing');assert.equal(requests,1,'fetch once outside firing');const gameRequests=requests;
 await page.waitForFunction(()=>window.__ends===5);
 assert.equal(await page.evaluate(()=>window.__audioMatch.players[0].inventory[0].ammo),25,'sample count must match bullets actually spent');
 await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__plays.length),5,'playback must stop when bullets stop');
 await page.evaluate(()=>window.Game.effect({type:'shot',weapon:'smg',by:'audio-test',projectileId:'smg-1'},'audio-test'));
 assert.equal(await page.evaluate(()=>window.__plays.slice(5).some(p=>p.buffer===window.__plays[0].buffer)),false,'other guns must retain their own sounds');
 const remote=await page.evaluate(()=>{
  const position=window.Game.pose().p.slice(),before=window.__plays.length;
  window.Game.effect({type:'shot',weapon:'ar',by:'peer',a:[position[0]+10,position[1]+1.6,position[2]],projectileId:'remote-near'},'audio-test');
  const near=window.__plays.slice(before).filter(v=>v.buffer===window.__plays[0].buffer).length,afterNear=window.__plays.length;
  window.Game.effect({type:'shot',weapon:'ar',by:'peer',a:[position[0]+200,position[1]+1.6,position[2]],projectileId:'remote-far'},'audio-test');
  const far=window.__plays.length-afterNear,otherGuns=[];
  for(const weapon of['shotgun','smg','sniper']){
   const start=window.__plays.length;
   window.Game.effect({type:'shot',weapon,by:'peer',a:[position[0]+10,position[1]+1.6,position[2]],projectileId:'remote-'+weapon},'audio-test');
   otherGuns.push({weapon,durations:window.__plays.slice(start).map(p=>p.duration)});
  }
  return {near,far,otherGuns};
 });
 assert.equal(remote.near,1,'a nearby opponent firing must play one audible AR shot');
 assert.equal(remote.far,0,'distant shots outside the hearing radius must not schedule audio');
 for(const gun of remote.otherGuns)assert.equal(gun.durations.length,1,gun.weapon+' must retain one distinct shot sound for nearby opponents');
 assert.ok(Math.abs(remote.otherGuns[0].durations[0]-1.76)<.001,'opponent shotgun uses the uploaded blast');
 const distantFallback=await page.evaluate(()=>{
  const position=window.Game.pose().p.slice(),before=window.__gainFades.length;
  window.Game.effect({type:'shot',weapon:'smg',by:'peer',a:[position[0]+100,position[1],position[2]],projectileId:'quiet-smg'},'audio-test');
  return window.__gainFades.slice(before);
 });
 assert.equal(distantFallback.length,2,'SMG retains its noise and low-frequency layers');
 assert.ok(distantFallback.every(fade=>fade.to<fade.from),'quiet distant fallback gunshots must decay instead of swelling toward a fixed gain floor');
 const suspended=await page.evaluate(async()=>{
  const context=window.__shotContext,position=window.Game.pose().p.slice();await context.suspend();const before=window.__plays.length;
  for(let n=0;n<20;n++)window.Game.effect({type:'shot',weapon:'ar',by:'peer',a:position,projectileId:'suspended-'+n},'audio-test');
  window.Game.effect({type:'shot',weapon:'smg',by:'peer',a:position,projectileId:'suspended-smg'},'audio-test');
  window.Game.effect({type:'shot',weapon:'ar',by:'audio-test',a:position,projectileId:'suspended-local'},'audio-test');
  const queued=window.__plays.length-before;await context.resume();return {queued};
 });
 assert.equal(suspended.queued,0,'suspended audio must not queue stale gunshots for an overlapping burst on resume');
 // Render the real player into an OfflineAudioContext to verify audible output,
 // a complete tail, and simultaneous shot voices without mocks.
 const offline=await page.evaluate(async()=>{
  const {createWeaponAudio}=await import('/weapon-audio.js'),context=new OfflineAudioContext(1,48000,48000),player=createWeaponAudio();await player.load(context);
  player.play(context,'ar');context.suspend(.118).then(()=>{player.play(context,'ar');context.resume();});
  const rendered=await context.startRendering(),data=rendered.getChannelData(0);let early=0,second=0,end=0,peak=0;
  for(let n=0;n<data.length;n++){peak=Math.max(peak,Math.abs(data[n]));if(n<4800)early+=data[n]**2;if(n>=5664&&n<10464)second+=data[n]**2;if(n>24000)end+=data[n]**2;}
  const quietContext=new OfflineAudioContext(1,48000,48000);await player.load(quietContext);
  const muted=player.play(quietContext,'ar',0);player.play(quietContext,'ar',.25);
  const quiet=(await quietContext.startRendering()).getChannelData(0);let maxQuietDifference=0;
  for(let n=0;n<4800;n++)maxQuietDifference=Math.max(maxQuietDifference,Math.abs(quiet[n]-data[n]*.25));
  return {early,second,end,peak,muted,maxQuietDifference};
 });
 assert.ok(offline.early>1&&offline.second>1,'both bullets must produce audible output');assert.equal(offline.end,0,'no continued gunfire after samples end');assert.ok(offline.peak<1,'rapid fire must retain headroom');
 assert.equal(offline.muted,false,'zero volume schedules no shot voice');assert.ok(offline.maxQuietDifference<1e-6,'distance volume scales the real waveform without truncating or replacing it');
 assert.deepEqual(errors,[]);
 const result={bullets:5,sampledSources:5,ammoSpent:5,clipSeconds:first[0].duration,fetches:gameRequests,decodes:3,remote,distantFallback,suspended,offline,errors};
 await writeFile(artifacts+'/ar-audio-browser-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
