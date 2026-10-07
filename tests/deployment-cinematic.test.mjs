import test from 'node:test';
import assert from 'node:assert/strict';
import * as cinematic from '../public/deployment-cinematic.js';
const {deploymentCinematic,cinematicCamera,cinematicPodPosition,cinematicFov,podExitPosition,podExitYaw,DEPLOYMENT_CUES,MUSIC_START}=cinematic;
import {DEPLOYMENT_TIMELINE,deploymentStageAt} from '../public/deployment-sequence.js';

test('music starts only on full black and the title follows the measured vocal cues',()=>{
 const at=t=>deploymentCinematic(MUSIC_START+t);
 assert.equal(at(0).black,1);
 assert.equal(at(DEPLOYMENT_CUES.uhYeahStart-.07).logo,0);
 assert.ok(at(DEPLOYMENT_CUES.uhYeahStart+.4).logo>.95);
 assert.equal(at(DEPLOYMENT_CUES.lyricsStart+1.56).logo,0);
 assert.equal(at(DEPLOYMENT_CUES.businessStart).black,0);
 assert.equal(at(DEPLOYMENT_CUES.businessStart).orbit,1);
 assert.equal(at(DEPLOYMENT_CUES.impact).black,0);
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
 assert.ok(front.target[1]>p[1]+.8&&front.target[1]<p[1]+1.4);
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
 let previous=cinematicCamera(p,yaw,{orbit:1,returnProgress:0});
 for(let i=1;i<=120;i++){
  const state=deploymentCinematic(exitAt+(time.exitSeconds+time.saluteSeconds)*i/120),view=cinematicCamera(p,yaw,state);
  assert.ok(Math.hypot(...view.eye.map((v,k)=>v-previous.eye[k]))<.5,'no single-frame camera cut');
  assert.ok(Math.hypot(...view.target.map((v,k)=>v-view.eye[k]))>.03,'look direction never degenerates');
  previous=view;
 }
 assert.ok(Math.hypot(...previous.eye.map((v,k)=>v-[12,8.72,-18][k]))<1e-9);
 const forward=previous.target.map((v,k)=>v-previous.eye[k]);
 assert.ok(forward[0]<0&&forward[2]<0,'camera faces the same direction as the player');
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
  for(const x of[-.94,.94])for(const y of[-.18,2.35])for(const z of[-.89,.89]){
   const offset=[x,y,z].map((v,k)=>v-view.eye[k]),depth=dot(offset,forward);
   assert.ok(Math.abs(dot(offset,right)/(depth*lens*aspect))<.96,'pod rails fit horizontally');
   assert.ok(Math.abs(dot(offset,up)/(depth*lens))<.96,'roof and floor fit vertically');
  }
 }
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
