import test from 'node:test';
import assert from 'node:assert/strict';
import {DEPLOYMENT_CUES,MUSIC_START,POD_TOUCHDOWN,DEPLOYMENT_MUSIC_END,deploymentCinematic,cinematicCamera} from '../public/deployment-cinematic.js';
import {deploymentActorPose,deploymentStageAt} from '../public/deployment-sequence.js';
const actorAt=t=>deploymentActorPose({x:0,y:0,z:0},0,1,MUSIC_START+t);

test('the operator is planted and fully saluting on Big stepper, before the unchanged music fade',()=>{
 const on=DEPLOYMENT_CUES.bigStart;
 assert.ok(actorAt(on)?.saluteProgress>.999,'the palm must reach the forehead on the lyric');
 assert.ok(actorAt(DEPLOYMENT_CUES.stepperStart)?.saluteProgress>.999);
 assert.ok(actorAt(on-.18)?.saluteProgress<.2,'a sharp raise, not an early held salute');
 assert.equal(actorAt(on).moveSpeed,0);
 assert.equal(deploymentStageAt(MUSIC_START+on),'saluting');
 assert.ok(POD_TOUCHDOWN<MUSIC_START+DEPLOYMENT_CUES.impact-2);
 assert.equal(DEPLOYMENT_MUSIC_END,29.835,'keep the original continuous song ending');
});
test('the salute camera punches on the measured bass drop and settles without a cut',()=>{
 const view=t=>{const s=deploymentCinematic(MUSIC_START+t);return cinematicCamera([0,0,0],0,s,{subjectPosition:[.32,0,2.35],returnYaw:Math.PI});};
 const before=deploymentCinematic(MUSIC_START+DEPLOYMENT_CUES.impact-.001),hit=deploymentCinematic(MUSIC_START+DEPLOYMENT_CUES.impact+.05);
 assert.equal(before.salutePunch,0);assert.ok(hit.salutePunch>.8);
 assert.ok(deploymentCinematic(MUSIC_START+DEPLOYMENT_CUES.stepperStart).salutePunch>.99,'hold the punch through the full salute and stepper lyric');
 const a=view(DEPLOYMENT_CUES.impact-.001),b=view(DEPLOYMENT_CUES.impact+.05);
 assert.ok(Math.hypot(...b.eye.map((v,i)=>v-a.eye[i]))>.12,'a visible but bounded camera push');
 assert.ok(Math.hypot(...b.eye.map((v,i)=>v-a.eye[i]))<.65);
 const still=cinematicCamera([0,0,0],0,hit,{subjectPosition:[.32,0,2.35],returnYaw:Math.PI,reducedMotion:true});
 assert.ok(Math.hypot(...still.eye.map((v,i)=>v-b.eye[i]))>.1,'reduced motion suppresses the punch');
 assert.ok(deploymentCinematic(MUSIC_START+DEPLOYMENT_CUES.impact+1).salutePunch<.01);
});
test('salute framing widens safely when terrain constrains the camera, including portrait screens',async()=>{
 const {cinematicSaluteFov}=await import('../public/deployment-cinematic.js');
 assert.equal(typeof cinematicSaluteFov,'function');
 assert.ok(cinematicSaluteFov(16/9,2.4)>cinematicSaluteFov(16/9,4.4));
 assert.ok(cinematicSaluteFov(9/16,2.4)>cinematicSaluteFov(16/9,2.4));
 assert.ok(cinematicSaluteFov(9/16,.1)<=86*Math.PI/180);
});
