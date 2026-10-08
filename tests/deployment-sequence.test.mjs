import test from 'node:test';
import assert from 'node:assert/strict';
import { DEPLOYMENT_TIMELINE, DEPLOYMENT_STATES, createDeploymentClock, stepDeploymentClock, deploymentStageAt, safeLandingPoint, deploymentActorPose } from '../public/deployment-sequence.js';
import { DEPLOYMENT_CUES, MUSIC_START, CINEMATIC_CAMERA_RADIUS, deploymentCinematic, cinematicPodPosition, DEPLOYMENT_MUSIC_END } from '../public/deployment-cinematic.js';
import { SHIP_PODS, clampShipPosition, moveInShip } from '../public/deployment-ship.js';
import {characterLocomotion} from '../public/character-animation.js';

const world={height:(x,z)=>Math.sin(x*.02)+Math.cos(z*.02),obstacles:[{min:[-5,-2,-5],max:[5,15,5]}]};

test('deployment timeline covers seal, the musical intro, beat touchdown, opening and exit',()=>{
 assert.deepEqual(DEPLOYMENT_STATES,['ship_waiting','landing_selection','pod_available','entering_pod','pod_ready','both_ready','pod_sealing','launching','transition','landed','pod_opening','exiting','saluting','match_active']);
 assert.equal(DEPLOYMENT_TIMELINE.sealSeconds+DEPLOYMENT_TIMELINE.launchSeconds,MUSIC_START+DEPLOYMENT_CUES.impact);
 assert.ok(DEPLOYMENT_TIMELINE.fadeAt>1.4&&DEPLOYMENT_TIMELINE.fadeAt<3,'the pod fires before the first music frame');
 assert.equal(deploymentStageAt(DEPLOYMENT_TIMELINE.sealSeconds+DEPLOYMENT_TIMELINE.fadeAt),'transition');
 assert.equal(deploymentStageAt(DEPLOYMENT_TIMELINE.sealSeconds+DEPLOYMENT_TIMELINE.launchSeconds),'landed');
 const touchdown=DEPLOYMENT_TIMELINE.sealSeconds+DEPLOYMENT_TIMELINE.launchSeconds;
 const opening=touchdown+DEPLOYMENT_TIMELINE.landedSeconds;
 const exiting=opening+DEPLOYMENT_TIMELINE.openingSeconds;
 const saluting=exiting+DEPLOYMENT_TIMELINE.exitSeconds;
 assert.equal(deploymentStageAt(opening),'pod_opening');
 assert.equal(deploymentStageAt(exiting),'exiting');
 assert.equal(deploymentStageAt(saluting),'saluting');
 assert.equal(deploymentStageAt(saluting+DEPLOYMENT_TIMELINE.saluteSeconds),'match_active');
 assert.ok(DEPLOYMENT_TIMELINE.saluteSeconds>=1.5);
 assert.equal(deploymentStageAt(Infinity),'pod_sealing');
});

test('cinematic clock advances smoothly between slower multiplayer snapshots and never runs backward',()=>{
 let clock=createDeploymentClock();
 clock=stepDeploymentClock(clock,{sequenceId:'1:1',serverElapsed:0,active:true},.016);
 for(let i=0;i<30;i++)clock=stepDeploymentClock(clock,{sequenceId:'1:1',serverElapsed:0,active:true},.016);
 const before=clock.elapsed;
 clock=stepDeploymentClock(clock,{sequenceId:'1:1',serverElapsed:.55,active:true},.016);
 assert.ok(clock.elapsed>=before&&clock.elapsed<.7);
 clock=stepDeploymentClock(clock,{sequenceId:'1:2',serverElapsed:0,active:true},.016);
 assert.equal(clock.elapsed,.016,'a new deployment sequence resets its presentation clock');
});

test('safe landing rejects non-finite coordinates and finds unoccupied ground inside island bounds',()=>{
 assert.equal(safeLandingPoint([Infinity,0],world),null);
 const target=safeLandingPoint([0,0],world);
 assert.ok(target&&target.x!==0,'the building footprint at the requested point must be avoided');
 assert.ok(Math.abs(target.x)<=292&&Math.abs(target.z)<=292);
 assert.ok(Number.isFinite(target.y));
 const second=safeLandingPoint([0,0],world,[target]);
 assert.ok(Math.hypot(second.x-target.x,second.z-target.z)>1.4);
});

test('safe landing reserves the full cinematic camera orbit near cars and buildings',()=>{
 const obstacle={min:[5.4,0,-3.5],max:[8.6,2.4,1.5]},world={height:()=>0,obstacles:[obstacle]};
 const landing=safeLandingPoint({x:7,z:2.26},world);
 assert.ok(landing);
 const dx=Math.max(obstacle.min[0]-landing.x,0,landing.x-obstacle.max[0]),dz=Math.max(obstacle.min[2]-landing.z,0,landing.z-obstacle.max[2]);
 assert.ok(Math.hypot(dx,dz)>=CINEMATIC_CAMERA_RADIUS+.2,'the camera orbit stays outside the obstacle rather than collapsing into the capsule');
});

test('ship movement is constrained by walls and deployment pod shells',()=>{
 assert.deepEqual(clampShipPosition([999,0,999]),[8,0,14]);
 const wall=moveInShip([7.4,0,0],[3,0,0]);
 assert.ok(wall[0]<=8);
 const pod=SHIP_PODS[0],approach=[pod.x,pod.z+2.7],blocked=moveInShip([approach[0],0,approach[1]],[0,0,-1.2],pod.id);
 assert.ok(Math.hypot(blocked[0]-pod.x,blocked[2]-pod.z)>=1.2,'player capsule stays outside pod shell');
});

test('ship movement preserves diagonal input instead of snapping to aisle lines',()=>{
 const moved=moveInShip([0,0,0],[1.2,0,.8]);
 assert.ok(moved[0]>.9,'lateral movement remains responsive');
 assert.ok(moved[2]>.6,'forward movement remains responsive');
});

test('first uh-yeah starts the Horizon mark on cue and the logo holds through the ad-lib',()=>{
 const before=deploymentCinematic(MUSIC_START+DEPLOYMENT_CUES.uhYeahStart-.25);
 const onBeat=deploymentCinematic(MUSIC_START+DEPLOYMENT_CUES.uhYeahStart+.2);
 const late=deploymentCinematic(MUSIC_START+DEPLOYMENT_CUES.lyricsStart-.04);
 assert.equal(before.logo,0);
 assert.ok(onBeat.logo>.4&&onBeat.logo<.9,'title has a visible fade-in, not a one-frame pop');
 assert.ok(deploymentCinematic(MUSIC_START+DEPLOYMENT_CUES.uhYeahStart+.42).logo>.95);
 assert.ok(late.logo>.85);
 const fading=deploymentCinematic(MUSIC_START+DEPLOYMENT_CUES.lyricsStart+.4);
 assert.ok(fading.logo>0&&fading.logo<.8,'mark dissolves as the opening lyric begins');
 assert.equal(deploymentCinematic(MUSIC_START+DEPLOYMENT_CUES.lyricsStart+.81).logo,0);
});

test('landing accelerates into the impact and the track continues under the salute',()=>{
 const c=DEPLOYMENT_CUES,at=t=>cinematicPodPosition({x:10,y:5,z:20},MUSIC_START+t)[1];
 const earlier=at(c.impact-.5)-at(c.impact-.35);
 const later=at(c.impact-.15)-at(c.impact);
 assert.ok(later>earlier,'the final descent accelerates into the kick');
 assert.equal(at(c.impact),5);
 assert.ok(DEPLOYMENT_MUSIC_END>c.impact+4&&DEPLOYMENT_MUSIC_END<30,'outro fits the original audio clip');
 assert.ok(deploymentCinematic(MUSIC_START+c.impact+.01).impact>.95);
});

test('nearby launch capsules and cameras have clear space',()=>{
 const level={height:()=>0,obstacles:[]},landings=[];
 for(let i=0;i<8;i++){
  const point=safeLandingPoint({x:20,z:20},level,landings);
  assert.ok(point,'eight close selections can be separated');
  for(const other of landings)assert.ok(Math.hypot(point.x-other.x,point.z-other.z)>=CINEMATIC_CAMERA_RADIUS*2+1.2-1e-8);
  landings.push(point);
 }
});
test('terrain sampling rejects steep slopes and invalid heights',()=>{
 assert.equal(safeLandingPoint({x:32,z:40},{height:(x,z)=>x*.95,obstacles:[]}),null);
 const broken={height:(x,z)=>x>11?Infinity:0,obstacles:[]};
 const landing=safeLandingPoint({x:10.5,z:25},broken);
 if(landing)assert.ok(landing.x<=11-1.22);
 const level={height:(x,z)=>3.4+Math.sin(x*.02)*.06+Math.cos(z*.02)*.06,obstacles:[]};
 const safe=safeLandingPoint({x:32,z:40},level);
 assert.ok(safe&&Math.hypot(safe.x-32,safe.z-40)<.01);
});

test('scripted actor pose is continuous through hatch opening, walk and salute',()=>{
 const t=DEPLOYMENT_TIMELINE;
 const opening=t.sealSeconds+t.launchSeconds+t.landedSeconds;
 const exiting=opening+t.openingSeconds, saluting=exiting+t.exitSeconds, finished=saluting+t.saluteSeconds;
 const landing={x:45,y:0,z:30},terrain=(x,z)=>.004*x+.006*z,yaw=Math.PI/3,side=-1;
 assert.equal(deploymentActorPose(landing,yaw,side,opening-.001,terrain),null);
 const first=deploymentActorPose(landing,yaw,side,opening,terrain);
 assert.ok(first);
 assert.equal(first.animationState,'idle');
 assert.ok(Math.abs(first.yaw-yaw)<1e-8);
 const opened=deploymentActorPose(landing,yaw,side,exiting,terrain);
 assert.ok(Math.abs(opened.yaw-yaw-Math.PI)<1e-8,'the Soldier turns towards the hatch');
 assert.ok(Math.hypot(opened.position[0]-first.position[0],opened.position[2]-first.position[2])<1e-8);
 const stride=deploymentActorPose(landing,yaw,side,exiting+.4*t.exitSeconds,terrain);
 assert.equal(stride.animationState,'pod-exit');
 assert.ok(stride.exitProgress>.39&&stride.exitProgress<.41);
 const out=deploymentActorPose(landing,yaw,side,saluting,terrain);
 assert.ok(Math.hypot(out.position[0]-landing.x,out.position[2]-landing.z)>2);
 const gesture=deploymentActorPose(landing,yaw,side,saluting+.5*t.saluteSeconds,terrain);
 assert.equal(gesture.animationState,'idle');
 assert.ok(gesture.saluteProgress>.99,'native model has time to hold a full salute');
 assert.ok(Math.hypot(...out.position.map((v,i)=>v-gesture.position[i]))<1e-8,'the Soldier remains stationary while saluting');
 const fade=deploymentActorPose(landing,yaw,side,finished-.01,terrain);
 assert.ok(fade.saluteProgress<.1,'the salute lowers before gameplay');
 assert.equal(deploymentActorPose(landing,yaw,side,finished,terrain),null);
});
test('continuous actor pose cannot be affected by intermittent network snapshots',()=>{
 const origin={x:52,y:3,z:-35},t=DEPLOYMENT_TIMELINE;
 const exit=t.sealSeconds+t.launchSeconds+t.landedSeconds+t.openingSeconds;
 const sample=Array.from({length:64},(_,i)=>deploymentActorPose(origin,0,1,exit+i*t.exitSeconds/63,()=>origin.y));
 const increments=sample.slice(1).map((next,i)=>Math.hypot(next.position[0]-sample[i].position[0],next.position[2]-sample[i].position[2]));
 assert.ok(increments.every(v=>v>.00001&&v<.09),'each rendered frame advances a small, continuous distance');
 const once=deploymentActorPose(origin,0,1,exit+.4*t.exitSeconds,()=>origin.y);
 const again=deploymentActorPose(origin,0,1,exit+.4*t.exitSeconds,()=>origin.y);
 assert.deepEqual(again,once,'the same clock tick always produces the same pose');
});

test('scripted opening and salute clear stale ship locomotion before rendering',()=>{
 const t=DEPLOYMENT_TIMELINE,opening=t.sealSeconds+t.launchSeconds+t.landedSeconds;
 for(const at of [opening+.4,opening+t.openingSeconds+t.exitSeconds+t.saluteSeconds*.5]){
  const pose=deploymentActorPose({x:18,y:0,z:68},0,1,at);
  const actor={locomotionState:'walk',moveSpeed:5,grounded:false,vy:3,...pose};
  assert.equal(characterLocomotion(actor).state,'idle','boarding movement cannot leak into the standing cinematic pose');
 }
});
