import test from 'node:test';
import assert from 'node:assert/strict';
import * as cinematic from '../public/deployment-cinematic.js';
const {deploymentCinematic,cinematicCamera,cinematicPodPosition,cinematicFov,podExitPosition,podExitYaw,DEPLOYMENT_CUES,MUSIC_START}=cinematic;
import {DEPLOYMENT_TIMELINE,deploymentStageAt} from '../public/deployment-sequence.js';

test('music starts only on full black and the title follows the measured vocal cues',()=>{
 const at=t=>deploymentCinematic(MUSIC_START+t);
 assert.equal(at(0).black,1);
 assert.equal(at(DEPLOYMENT_CUES.uhYeahStart-.07).logo,0);
 assert.ok(at(DEPLOYMENT_CUES.uhYeahStart+.8).logo>.95);
 assert.equal(at(DEPLOYMENT_CUES.lyricsStart+1.56).logo,0);
 assert.equal(at(DEPLOYMENT_CUES.businessStart).black,0);
 assert.equal(at(DEPLOYMENT_CUES.businessStart).orbit,1);
 assert.equal(at(DEPLOYMENT_CUES.impact).black,0);
});

test('the Horizon mark fades visibly from the first uh instead of flashing on',()=>{
 const on=DEPLOYMENT_CUES.uhYeahStart,at=t=>deploymentCinematic(MUSIC_START+on+t).logo;
 assert.equal(at(0),0);assert.ok(at(.12)>0&&at(.12)<.2);assert.ok(at(.35)>.35&&at(.35)<.65);assert.ok(at(.7)>.99);
});

test('the salute gets a frontal held shot before fading the unrepeated supplied song',()=>{
 const r=cinematic.POD_RELEASE,start=DEPLOYMENT_CUES.impact+r.hold+r.open+r.exit,end=cinematic.DEPLOYMENT_MUSIC_END;
 assert.ok(end<=30,'the ending fits inside the uploaded audio');
 assert.ok(end-cinematic.DEPLOYMENT_MUSIC_FADE-start-r.salute*.23>=.8,'full raised salute holds before music fade');
 const actor=[.32,0,2.35],yaw=Math.PI,state=deploymentCinematic(MUSIC_START+start+r.salute*.5),view=cinematicCamera([0,0,0],0,state,{subjectPosition:actor,returnYaw:yaw});
 assert.equal(state.returnProgress,0);assert.ok(view.eye[2]>actor[2]+2);assert.ok(Math.abs(view.eye[0]-actor[0])<.01,'camera is directly in front of the operator');
 assert.ok(Math.abs(view.target[0]-actor[0])<.01);
});

test('the authoritative landing boundary is the exact Big stepper cue',()=>{
 const impact=MUSIC_START+DEPLOYMENT_CUES.impact;
 assert.equal(DEPLOYMENT_TIMELINE.sealSeconds+DEPLOYMENT_TIMELINE.launchSeconds,impact);
 assert.equal(deploymentStageAt(impact-.001),'transition');
 assert.equal(deploymentStageAt(impact),'landed');
 assert.ok(DEPLOYMENT_CUES.lyricsStart<DEPLOYMENT_CUES.businessStart&&DEPLOYMENT_CUES.businessStart<DEPLOYMENT_CUES.impact);
});

test('camera finishes facing the operator and stays outside the pod and character',()=>{
 const p=[12,80,-18],yaw=.7;
 for(let i=0;i<=100;i++){
  const pose=cinematicCamera(p,yaw,{orbit:i/100,impact:0});
  assert.ok(Math.hypot(pose.eye[0]-p[0],pose.eye[2]-p[2])>=2.2);
  assert.ok(pose.eye.every(Number.isFinite));
 }
 const front=cinematicCamera(p,0,{orbit:1,impact:0});
 assert.ok(front.eye[2]>p[2],'the door-facing camera stays in front of the sealed pod');
 assert.ok(front.target[1]>p[1]+1.7&&front.target[1]<p[1]+2,'frame the centre of the full-height sealed capsule');
});

test('descent is continuous, stays above the island, and touches chosen ground on the beat',()=>{
 const landing={x:12,y:7,z:-18},at=t=>cinematicPodPosition(landing,MUSIC_START+t);
 assert.ok(at(DEPLOYMENT_CUES.businessStart)[1]>landing.y+10);
 assert.ok(at(DEPLOYMENT_CUES.impact-.02)[1]>landing.y);
 assert.deepEqual(at(DEPLOYMENT_CUES.impact),[12,7,-18]);
 assert.deepEqual(at(DEPLOYMENT_CUES.impact+1),[12,7,-18]);
});

test('the exit camera returns continuously to the actual first-person position and heading',()=>{
 const p=[12,7,-18],yaw=.7,time=DEPLOYMENT_TIMELINE;
 const exitAt=MUSIC_START+DEPLOYMENT_CUES.impact+time.landedSeconds+time.openingSeconds;
 assert.equal(deploymentCinematic(exitAt).returnProgress,0);
 assert.equal(deploymentCinematic(exitAt+time.exitSeconds).returnProgress,0,'the camera stays outside for the salute');
 assert.equal(deploymentCinematic(exitAt+time.exitSeconds+time.saluteSeconds).returnProgress,1);
 const heading=yaw+Math.PI;
 let previous=cinematicCamera(p,yaw,{orbit:1,returnProgress:0},{returnYaw:heading});
 for(let i=1;i<=120;i++){
  const state=deploymentCinematic(exitAt+(time.exitSeconds+time.saluteSeconds)*i/120),view=cinematicCamera(p,yaw,state,{returnYaw:heading});
  assert.ok(Math.hypot(...view.eye.map((v,k)=>v-previous.eye[k]))<.5,'no single-frame camera cut');
  assert.ok(Math.hypot(...view.target.map((v,k)=>v-view.eye[k]))>.03,'look direction never degenerates');
  previous=view;
 }
 assert.ok(Math.hypot(...previous.eye.map((v,k)=>v-[12,8.72,-18][k]))<1e-9);
 const forward=previous.target.map((v,k)=>v-previous.eye[k]);
 assert.ok(forward[0]*-Math.sin(heading)+forward[2]*-Math.cos(heading)>0,'camera faces the same direction as the exiting player');
 assert.ok(Math.abs(Math.atan2(forward[1],Math.hypot(forward[0],forward[2]))+.04)<1e-8);
});

test('cinematic camera respects nearby terrain and keeps narrow screens wide enough for the capsule',()=>{
 const p=[0,0,0],view=cinematicCamera(p,0,{orbit:.5},{groundHeight:()=>2});
 assert.ok(view.eye[1]>=2.35,'the cinematic camera cannot sink below sloping terrain');
 for(const aspect of [9/16,4/3,16/9,21/9]){
  const fov=cinematicFov(aspect),halfWidth=Math.tan(fov/2)*aspect*2.55;
  assert.ok(halfWidth>=1.18,'capsule and both rails stay inside the frame');
  assert.ok(fov<=86*Math.PI/180);
 }
});

test('the complete pod roof and floor fit the portrait shot across screen sizes',()=>{
 const dot=(a,b)=>a.reduce((v,n,k)=>v+n*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>a.map(v=>v/Math.hypot(...a));
 for(const aspect of [9/16,4/3,16/9,21/9])for(const orbit of [.4,.7,1]){
  const view=cinematicCamera([0,0,0],0,{orbit}),forward=norm(view.target.map((v,k)=>v-view.eye[k])),right=norm(cross(forward,[0,1,0])),up=cross(right,forward),lens=Math.tan(cinematicFov(aspect)/2);
  for(const x of[-1.03,1.03])for(const y of[0,3.82])for(const z of[-.98,1.12]){
   const offset=[x,y,z].map((v,k)=>v-view.eye[k]),depth=dot(offset,forward);
   assert.ok(Math.abs(dot(offset,right)/(depth*lens*aspect))<.96,'pod rails fit horizontally');
   assert.ok(Math.abs(dot(offset,up)/(depth*lens))<.96,'roof and floor fit vertically');
  }
 }
});

test('the heavy final descent reaches the beat with a finite velocity instead of teleporting the last metres',()=>{
 const landing={x:2,y:7,z:9},at=t=>cinematicPodPosition(landing,MUSIC_START+t)[1],hit=DEPLOYMENT_CUES.impact;
 const speeds=[.2,.1,.04,.02].map(dt=>(at(hit-dt)-landing.y)/dt);
 assert.ok(speeds.every(speed=>speed>30&&speed<60),'the final approach is fast, with bounded motion between frames');
 assert.ok(at(hit-.2)-at(hit-.1)<6,'the exterior camera can follow the final approach without a cut');
});

test('impact has a downward camera punch and settles before the hatch opens',()=>{
 const c=DEPLOYMENT_CUES,at=age=>cinematicCamera([0,0,0],0,{musicTime:c.impact+age,orbit:1,impact:Math.exp(-age*3.8)}),steady=age=>cinematicCamera([0,0,0],0,{musicTime:c.impact+age,orbit:1,impact:Math.exp(-age*3.8)},{reducedMotion:true});
 assert.ok(at(0).eye[1]<steady(0).eye[1]-.16,'the initial hit must push the camera down');
 assert.ok(Math.hypot(...at(.09).eye.map((v,k)=>v-steady(.09).eye[k]))>.12,'the heavy impact is visible after the first frame');
 assert.ok(Math.hypot(...at(1).eye.map((v,k)=>v-steady(1).eye[k]))<.01,'camera settles before walkout');
});

test('landing launches visible earth chunks and dust within every graphics budget',()=>{
 assert.equal(typeof cinematic.podLandingBurst,'function');
 for(const budget of [0,40,80,144]){
  const burst=cinematic.podLandingBurst({x:12,y:7,z:-18},budget,()=>.5);
  assert.equal(burst.length,budget);
  if(!budget)continue;
  const debris=burst.filter(p=>p.kind==='pod-debris'),dust=burst.filter(p=>p.kind==='pod-dust');
  assert.ok(debris.length>=8&&dust.length>=20,'each quality retains both chunks and dust');
  assert.ok(debris.every(p=>p.v[1]>=8&&p.radius>=.08),'earth chunks fly upward and are large enough to see');
  assert.ok(burst.every(p=>p.p[1]>7&&p.life<=2.5&&p.maxLife===p.life),'nothing starts below ground or persists into gameplay');
  assert.ok(new Set(burst.map(p=>Math.sign(p.v[0])+','+Math.sign(p.v[2]))).size>=4,'the burst spreads around all sides of the capsule');
 }
});

test('landing particles expand and settle above terrain instead of falling through the map',()=>{
 assert.equal(typeof cinematic.stepPodLandingParticle,'function');
 assert.equal(typeof cinematic.podLandingParticleSize,'function');
 const [rock,...particles]=cinematic.podLandingBurst({x:0,y:2,z:0},40,()=>.5),dust=particles.find(p=>p.kind==='pod-dust');
 const initial=cinematic.podLandingParticleSize(dust);dust.life*=.6;
 assert.ok(cinematic.podLandingParticleSize(dust)>initial,'the dust plume grows after the hit');
 for(let n=0;n<100;n++){rock.life-=.016;cinematic.stepPodLandingParticle(rock,.016,()=>2);assert.ok(rock.p[1]>=2,'the chunk cannot pass through terrain');}
 dust.life=0;assert.equal(cinematic.podLandingParticleSize(dust),0);
});

test('landing gear compresses on impact and is stationary before the door opens',()=>{
 assert.equal(typeof cinematic.podImpactOffset,'function');
 assert.equal(cinematic.podImpactOffset(-.01),0);
 assert.equal(cinematic.podImpactOffset(0),0);
 assert.ok(cinematic.podImpactOffset(.055)<-.045,'the hull visibly compresses after the impact');
 assert.equal(cinematic.podImpactOffset(cinematic.POD_RELEASE.hold),0,'the open pod floor cannot move under the exiting Soldier');
 for(let t=0;t<1;t+=.01)assert.ok(Math.abs(cinematic.podImpactOffset(t))<.16,'landing gear travel stays small');
});

test('the operator stays concealed until the hatch actually opens after impact',()=>{
 const c=DEPLOYMENT_CUES,r=cinematic.POD_RELEASE,at=t=>deploymentCinematic(MUSIC_START+t);
 for(const t of [c.businessStart,c.impact-.001,c.impact,c.impact+r.hold-.001]){
  assert.equal(at(t).hatchOpen,0);assert.equal(at(t).operatorOpacity,0,'no cutaway view during descent or touchdown');
 }
 assert.equal(at(c.impact+r.hold+r.open*.04).operatorOpacity,0,'a tiny opening does not pop the Soldier into view');
 assert.ok(at(c.impact+r.hold+r.open*.5).operatorOpacity>.95,'opening hatch naturally reveals the Soldier');
 assert.equal(at(c.impact+r.hold+r.open+r.exit*.5).operatorOpacity,1,'the walkout remains fully visible');
});

test('the pod walk-out follows its rotated hatch and preserves terrain height',()=>{
 const ground=(x,z)=>x*.08+z*.02;
 const landing={x:22,y:ground(22,-8),z:-8};
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const start=podExitPosition(landing,yaw,-1,0,ground);
  assert.deepEqual(start,[landing.x,landing.y,landing.z]);
  const exit=podExitPosition(landing,yaw,-1,1,ground);
  const lateral=-.32,forward=2.35;
  assert.ok(Math.abs(exit[0]-(landing.x+lateral*Math.cos(yaw)+forward*Math.sin(yaw)))<1e-8);
  assert.ok(Math.abs(exit[2]-(landing.z-lateral*Math.sin(yaw)+forward*Math.cos(yaw)))<1e-8);
  assert.ok(Math.abs(exit[1]-ground(exit[0],exit[2]))<1e-8);
  assert.equal(podExitYaw(yaw,0),yaw);
  assert.ok(Math.abs(podExitYaw(yaw,1)-yaw-Math.PI)<1e-8);
 }
});

test('the exit camera holds outside the stationary pod while panning toward the walking Soldier',()=>{
 const pod=[12,3,-18],yaw=.4;
 const a=cinematicCamera(pod,yaw,{musicTime:DEPLOYMENT_CUES.impact+2.5,orbit:1,returnProgress:0},{
  subjectPosition:pod,returnYaw:yaw});
 const soldier=[pod[0]+Math.sin(yaw)*2.35,pod[1],pod[2]+Math.cos(yaw)*2.35];
 const b=cinematicCamera(pod,yaw,{musicTime:DEPLOYMENT_CUES.impact+5,orbit:1,returnProgress:0},{
  subjectPosition:soldier,returnYaw:yaw+Math.PI});
 assert.ok(Math.hypot(...a.eye.map((v,i)=>v-b.eye[i]))<1e-8,'tripod remains fixed while the Soldier walks');
 assert.ok(Math.hypot(...a.target.map((v,i)=>v-b.target[i]))>1.5,'camera pans toward Soldier');
 const end=cinematicCamera(pod,yaw,{musicTime:DEPLOYMENT_CUES.impact+6,orbit:1,returnProgress:1},{
  subjectPosition:soldier,returnYaw:yaw+Math.PI});
 assert.ok(Math.hypot(...end.eye.map((v,i)=>v-[soldier[0],soldier[1]+1.72,soldier[2]][i]))<1e-8,'handoff reaches Soldier eye');
});

test('reduced-motion mode disables the impact camera vibration',()=>{
 const pod=[0,1,0],cinema={musicTime:DEPLOYMENT_CUES.impact+.06,impact:1,orbit:1};
 const shaking=cinematicCamera(pod,0,cinema,{reducedMotion:false});
 const steady=cinematicCamera(pod,0,cinema,{reducedMotion:true});
 assert.ok(Math.hypot(...shaking.eye.map((v,i)=>v-steady.eye[i]))>.05);
});
