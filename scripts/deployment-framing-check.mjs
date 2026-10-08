import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const artifacts=process.env.GAME_ARTIFACTS||'/workspace/fortmulti-artifacts/deployment-polish',url=process.env.GAME_TEST_URL||'http://127.0.0.1:4174';
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(url);await page.waitForFunction(()=>Boolean(window.Game));
 await page.evaluate(async()=>{
  const [{Match},{MatchCharacterRenderer},{SHIP_PODS},{DEPLOYMENT_CUES,MUSIC_START},{DEPLOYMENT_TIMELINE},THREE]=await Promise.all([import('/simulation.js'),import('/match-character-renderer.js'),import('/deployment-ship.js'),import('/deployment-cinematic.js'),import('/deployment-sequence.js'),import('three')]);
  const render=MatchCharacterRenderer.prototype.render;MatchCharacterRenderer.prototype.render=function(...args){window.__renderer=this;return render.apply(this,args);};
  window.__THREE=THREE;let sequence=0;
  window.__portrait=(musicTime=DEPLOYMENT_CUES.businessStart)=>{
   window.Game.clear({resetInventory:true});const m=new Match(window.Game.world,['a','b']);m.beginDeployment();
   m.players.forEach((p,i)=>{m.chooseLanding(p.id,{x:i?-85:18,z:i?70:68});const pod=SHIP_PODS[i];p.shipLocal=[pod.x,0,pod.z+2.2];p.p=m.shipWorld(p.shipLocal);if(!m.enterPod(p.id))throw Error('Fixture pod entry failed');});
   while(m.deployment.stage!=='both_ready')m.tick(.05);
   m.deployment.sequenceId='framing:'+ ++sequence;
   m.tick(.05,{deploymentElapsed:DEPLOYMENT_TIMELINE.readyBeat+MUSIC_START+musicTime});
   const snapshot=m.snapshot();window.Duel.lobby=false;document.body.classList.remove('in-lobby','menu');document.getElementById('lobby').hidden=true;
   window.Duel.render=()=>window.Game.apply(snapshot,'a',{a:'557959',b:'408faf'},1/60);
   window.__snapshot=snapshot;
  };
  window.__portrait();
 });
 await page.waitForFunction(()=>window.__renderer?.ready&&window.Game.deploymentView().black===0,{timeout:30000});
 for(const [name,width,height] of [['desktop',1280,720],['compact',800,600],['ultrawide',2100,900],['portrait',540,960]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>window.__portrait());
  await page.waitForFunction(()=>window.Game.deploymentView().black===0);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const result=await page.evaluate(()=>{
   const r=window.__renderer,THREE=window.__THREE,view=window.Game.deploymentView(),instance=r.instances.get('a'),anchor=view.podPosition,podPoints=[];
   r.scene.updateMatrixWorld(true);
   for(const x of[-1.03,1.03])for(const y of[0,3.82])for(const z of[-.98,1.12])podPoints.push(new THREE.Vector3(anchor[0]+x,anchor[1]+y,anchor[2]+z).project(r.camera).toArray());
   const feet=[...instance.bones].filter(([n])=>/toebase$/.test(n)).map(([name,bone])=>({name,position:bone.getWorldPosition(new THREE.Vector3()).toArray()}));
   return {width:innerWidth,height:innerHeight,view,podPoints,feet,bodyOpacity:instance.holder.visible?instance.cinematicOpacity:0,fill:r.cinematicLight.intensity,ui:['mapbox','deployment-ui','inventory','chatbox','resume-control'].map(id=>getComputedStyle(document.getElementById(id)).visibility)};
  });
  assert.ok(result.podPoints.every(p=>Math.abs(p[0])<1&&Math.abs(p[1])<1),'whole capsule must fit the actual camera');
  assert.equal(result.view.localVisible,false,'the operator stays concealed by the closed pod');
  assert.equal(result.view.operatorOpacity,0);assert.equal(result.view.hatchOpen,0);
  assert.equal(result.bodyOpacity,0);assert.ok(result.fill>0);assert.ok(result.ui.every(v=>v==='hidden'));
  await page.screenshot({path:artifacts+'/framing-'+name+'.png'});results.push({name,...result});
 }
 await page.setViewportSize({width:1280,height:720});
 for(const phase of ['opening','walkout','salute']){
  await page.evaluate(async phase=>{const {DEPLOYMENT_CUES:c,POD_RELEASE:r}=await import('/deployment-cinematic.js');window.__portrait(c.impact+r.hold+(phase==='opening'?r.open*.55:r.open+(phase==='walkout'?r.exit*.5:r.exit+r.salute*.5)));},phase);
  await page.waitForFunction(()=>window.Game.deploymentView().localVisible);
  const result=await page.evaluate(()=>{const view=window.Game.deploymentView(),p=window.Game.pose(),r=window.__renderer;return {view,position:p.p.slice(),animation:p.animationState,salute:p.saluteProgress,feet:[...r.instances.get('a').bones].filter(([n])=>/toebase$/.test(n)).map(([,b])=>b.getWorldPosition(new window.__THREE.Vector3()).toArray()),input:window.Game.input()};});
  assert.ok(result.view.operatorOpacity>.99);assert.equal(result.input.fire,false);assert.equal(result.input.slot,0);
  if(phase==='opening'){assert.ok(result.view.hatchOpen>.5&&result.view.hatchOpen<.8);assert.ok(Math.hypot(result.position[0]-result.view.podPosition[0],result.position[2]-result.view.podPosition[2])<.01);}
  else assert.ok(Math.hypot(result.position[0]-result.view.podPosition[0],result.position[2]-result.view.podPosition[2])>1,'operator steps outside the stationary pod');
  if(phase==='salute')assert.ok(result.salute>.99,'native salute is fully raised');
  await page.screenshot({path:artifacts+'/framing-'+phase+'.png'});results.push({name:phase,...result});
 }
 // A delayed server snapshot can still say exiting after the local music
 // clock finishes. Keep the open shell anchored until gameplay is confirmed.
 await page.setViewportSize({width:1280,height:720});
 await page.evaluate(async()=>{const {DEPLOYMENT_CUES,POD_RELEASE}=await import('/deployment-cinematic.js');window.__portrait(DEPLOYMENT_CUES.impact+POD_RELEASE.hold+POD_RELEASE.open+POD_RELEASE.exit-.04);});
 await page.waitForFunction(()=>window.Game.deploymentView().returnProgress===1);
 const delayedExit=await page.evaluate(()=>({view:window.Game.deploymentView(),position:window.Game.pose().p.slice(),expected:window.__snapshot.players[0].p.slice(),cinematic:document.body.classList.contains('deployment-cinematic')}));
 assert.equal(delayedExit.cinematic,true,'hold cinematic presentation until the server confirms gameplay');
 assert.equal(delayedExit.view.localVisible,false);assert.ok(delayedExit.view.podPosition,'the open capsule stays anchored');
 assert.ok(Math.hypot(...delayedExit.position.map((v,k)=>v-delayedExit.expected[k]))<.01,'a late exit snapshot must never snap the operator back inside the pod');
 assert.ok(Math.hypot(delayedExit.view.eye[0]-delayedExit.position[0],delayedExit.view.eye[2]-delayedExit.position[2])<.01);
 await page.screenshot({path:artifacts+'/framing-delayed-exit.png'});
 await page.evaluate(()=>{window.__snapshot.phase='playing';window.__snapshot.deployment.stage='match_active';window.__snapshot.players.forEach(p=>{p.air='landed';p.deploymentState='match_active';p.pod=null;});});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const confirmed=await page.evaluate(()=>({cinematic:document.body.classList.contains('deployment-cinematic'),view:window.Game.deploymentView(),air:window.Game.pose().air}));
 assert.equal(confirmed.cinematic,false);assert.equal(confirmed.view.podPosition,null);assert.equal(confirmed.air,'landed');assert.equal(confirmed.view.localVisible,false);
 await page.screenshot({path:artifacts+'/framing-confirmed-gameplay.png'});
 assert.deepEqual(errors,[]);await writeFile(artifacts+'/framing-results.json',JSON.stringify({results,delayedExit,confirmed,errors},null,2));console.log(JSON.stringify({passed:results.length+2,sizes:results.map(r=>r.name),delayedExit:'passed',authoritativeHandoff:'passed',errors},null,2));
}finally{await browser.close();}
