import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const url=process.env.GAME_TEST_URL||'http://127.0.0.1:4174',artifacts=process.env.GAME_ARTIFACTS||'/workspace/fortmulti-artifacts/audio';
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage(),errors=[];let requests=0;
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('/audio/ar-shot.wav'))requests++;});
 await page.addInitScript(()=>{
  window.__plays=[];window.__ends=0;window.__decodes=0;
  const start=AudioBufferSourceNode.prototype.start,decode=AudioContext.prototype.decodeAudioData;
  AudioBufferSourceNode.prototype.start=function(...args){window.__plays.push({duration:this.buffer?.duration,loop:this.loop,buffer:this.buffer,time:this.context.currentTime});this.addEventListener('ended',()=>window.__ends++);return start.apply(this,args);};
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
 // Render the real player into an OfflineAudioContext to verify audible output,
 // a complete tail, and simultaneous shot voices without mocks.
 const offline=await page.evaluate(async()=>{
  const {createWeaponAudio}=await import('/weapon-audio.js'),context=new OfflineAudioContext(1,48000,48000),player=createWeaponAudio();await player.load(context);
  player.play(context,'ar');context.suspend(.118).then(()=>{player.play(context,'ar');context.resume();});
  const rendered=await context.startRendering(),data=rendered.getChannelData(0);let early=0,second=0,end=0,peak=0;
  for(let n=0;n<data.length;n++){peak=Math.max(peak,Math.abs(data[n]));if(n<4800)early+=data[n]**2;if(n>=5664&&n<10464)second+=data[n]**2;if(n>24000)end+=data[n]**2;}
  return {early,second,end,peak};
 });
 assert.ok(offline.early>1&&offline.second>1,'both bullets must produce audible output');assert.equal(offline.end,0,'no continued gunfire after samples end');assert.ok(offline.peak<1,'rapid fire must retain headroom');
 assert.deepEqual(errors,[]);
 const result={bullets:5,sampledSources:5,ammoSpent:5,clipSeconds:first[0].duration,fetches:gameRequests,decodes:3,offline,errors};
 await writeFile(artifacts+'/ar-audio-browser-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
