import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
const url=process.env.GAME_TEST_URL||'http://127.0.0.1:4174',artifacts=process.env.GAME_ARTIFACTS||'/workspace/fortmulti-artifacts/audio/shotgun';await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__sounds=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){window.__sounds.push({source:this,buffer:this.buffer,args,rate:this.playbackRate.value,ended:false});this.addEventListener('ended',()=>window.__sounds.find(v=>v.source===this).ended=true);return start.apply(this,args);};});
 await page.goto(url);await page.waitForFunction(()=>Boolean(window.Game));
 const blast=await page.evaluate(async()=>{
  await window.Game.startAudio();const {Match}=await import('/simulation.js');const match=new Match({height:()=>0,obstacles:[]},['me','peer']);match.phase='playing';match.players.forEach((p,i)=>{p.air='landed';p.p=i?[200,0,200]:[0,0,0];p.vy=0;p.hp=100;p.slot=1;p.inventory=[{id:'sg',type:'shotgun',ammo:5},null,null,null,null];p.equip=0;});
  window.__sgMatch=match;match.input('me',{slot:1,fire:true});match.tick(.02);const event=match.events.find(e=>e.type==='shot');window.Game.effect(event,'me');return {pellets:event.traces.length,sounds:window.__sounds.length,duration:window.__sounds[0]?.buffer.duration};
 });
 assert.equal(blast.pellets,8);assert.equal(blast.sounds,1,'eight pellets produce one shotgun blast');assert.ok(blast.duration>1.5&&blast.duration<1.9,'preserve shotgun decay, not synthetic noise');
 const reload=await page.evaluate(async()=>{
  const {WEAPON_PROFILES}=await import('/weapon-system.js');const m=window.__sgMatch;m.input('me',{slot:1,reload:true});m.tick(.02);const e=m.events.find(e=>e.type==='reload');window.__reloadEvent=e;for(let n=0;n<9;n++){m.input('me',{slot:1,reload:true});m.tick(.02);}window.Game.effect(e,'me',m.snapshot());window.Game.apply(m.snapshot(),'me',{me:'577363',peer:'e37b58'});const v=window.__sounds.at(-1);return {duration:e.duration,profile:WEAPON_PROFILES.shotgun.reloadDuration,sound:v.buffer.duration,rate:v.rate,offset:v.args[1]||0,remaining:m.players[0].reload};
 });
 assert.equal(reload.duration,2.7);assert.equal(reload.profile,2.7);assert.ok(Math.abs(reload.sound/reload.rate-reload.duration)<.001,'audio matches full authoritative reload duration');assert.ok(reload.offset>.17,'exercise delayed snapshot delivery');assert.ok(Math.abs((reload.sound-reload.offset)/reload.rate-reload.remaining)<.002,'late snapshot starts at matching audio position');
 // Animation and server duration share one profile, including actual ammo completion.
 const completion=await page.evaluate(async()=>{const {stepWeaponParts,createWeaponPartState}=await import('/view-model.js'),{WEAPON_PROFILES}=await import('/weapon-system.js');const m=window.__sgMatch,p=m.players[0];m.input('me',{slot:1});while(p.reload>.025){m.input('me',{slot:1});m.tick(.01);}const before=p.inventory[0].ammo;m.tick(.05);window.Game.apply(m.snapshot(),'me',{me:'577363',peer:'e37b58'});return {before,after:p.inventory[0].ammo,remaining:p.reload,stage:stepWeaponParts(createWeaponPartState(),WEAPON_PROFILES.shotgun,p.reload).stage};});
 assert.equal(completion.before,4);assert.equal(completion.after,6);assert.equal(completion.remaining,0);assert.equal(completion.stage,'idle');
 const stale=await page.evaluate(()=>{const before=window.__sounds.length;window.Game.effect(window.__reloadEvent,'me',window.__sgMatch.snapshot());return {before,after:window.__sounds.length};});assert.equal(stale.before,stale.after,'completed reload snapshot must not replay stale reload audio');
 await page.waitForFunction(()=>window.__sounds.every(v=>v.ended));
 await page.evaluate(()=>{const m=window.__sgMatch;m.players[0].inventory[0].ammo=3;m.input('me',{slot:1,reload:true});m.tick(.02);window.Game.effect(m.events.filter(e=>e.type==='reload').at(-1),'me',m.snapshot());window.Game.apply(m.snapshot(),'me',{me:'577363',peer:'e37b58'});m.input('me',{slot:0});m.tick(.02);window.Game.apply(m.snapshot(),'me',{me:'577363',peer:'e37b58'});});
 await page.waitForFunction(()=>window.__sounds.at(-1).ended);assert.equal(await page.evaluate(()=>window.__sgMatch.players[0].reload),0,'weapon switching cancels authoritative reload and its sound');
 const race=await page.evaluate(()=>{const m=window.__sgMatch,p=m.players[0];p.inventory[0].ammo=3;p.inventory[1]={id:'ar2',type:'ar',ammo:30};p.slot=1;p.equip=0;m.input('me',{slot:1});m.tick(.02);window.Game.apply(m.snapshot(),'me',{me:'577363',peer:'e37b58'});m.input('me',{slot:1,reload:true});m.tick(.02);const event=m.events.filter(e=>e.type==='reload').at(-1),before=window.__sounds.length;document.dispatchEvent(new KeyboardEvent('keydown',{code:'Digit2',bubbles:true}));window.Game.effect(event,'me',m.snapshot());window.Game.apply(m.snapshot(),'me',{me:'577363',peer:'e37b58'});return {before,after:window.__sounds.length,slot:window.Game.input().slot};});
 assert.equal(race.slot,2);assert.equal(race.before,race.after,'delayed reload event cannot revive audio after local weapon switching');
 const offline=await page.evaluate(async()=>{
  const {createWeaponAudio}=await import('/weapon-audio.js');
  async function render(cancel){const c=new OfflineAudioContext(1,48000*4,48000),p=createWeaponAudio();await p.load(c);p.playReload(c,'shotgun',2.7);let cancelledAt=0;if(cancel)c.suspend(2.09).then(()=>{cancelledAt=c.currentTime;p.stopReload(c);c.resume();});const b=await c.startRendering(),d=b.getChannelData(0),rms=(a,z)=>{let e=0;for(let i=Math.floor(a*48000);i<Math.floor(z*48000);i++)e+=d[i]**2;return Math.sqrt(e/((z-a)*48000));};return {data:d,cancelledAt,metrics:{first:rms(.03,.5),late:rms(1.8,2.3),after:rms(cancel?2.2:2.75,3.9)}};}
  const full=await render(false),cancelled=await render(true);
  const relative=(start,end)=>{let dot=0,energy=0;for(let n=Math.floor((cancelled.cancelledAt+start)*48000);n<Math.floor((cancelled.cancelledAt+end)*48000);n++){dot+=full.data[n]*cancelled.data[n];energy+=full.data[n]**2;}return dot/energy;};
  return {full:full.metrics,cancelled:cancelled.metrics,fade:{early:relative(.005,.015),late:relative(.03,.04)}};
 });
 assert.ok(offline.full.first>.001&&offline.full.late>.001,'full reload mechanics remain audible');assert.equal(offline.full.after,0);assert.equal(offline.cancelled.after,0,'cancelled reload ends after its brief fade');
 assert.ok(offline.fade.early>.6&&offline.fade.late>.05&&offline.fade.late<.4&&offline.fade.early>offline.fade.late,'interruption attenuates gradually instead of cutting off');
 assert.deepEqual(errors,[]);const result={blast,reload,completion,offline,errors};await writeFile(artifacts+'/browser-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
