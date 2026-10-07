import test from 'node:test';
import assert from 'node:assert/strict';
import {deploymentCinematic,cinematicCamera,cinematicPodPosition,DEPLOYMENT_CUES,MUSIC_START} from '../public/deployment-cinematic.js';
import {DEPLOYMENT_TIMELINE,deploymentStageAt} from '../public/deployment-sequence.js';

test('music starts only on full black and the title follows the measured vocal cues',()=>{
 const at=t=>deploymentCinematic(MUSIC_START+t);
 assert.equal(at(0).black,1);
 assert.equal(at(DEPLOYMENT_CUES.uhYeahStart-.01).logo,0);
 assert.ok(at(DEPLOYMENT_CUES.uhYeahStart+.4).logo>.95);
 assert.equal(at(DEPLOYMENT_CUES.lyricsStart+.6).logo,0);
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
 assert.ok(front.eye[2]<p[2]);
 assert.ok(front.target[1]>p[1]+.8&&front.target[1]<p[1]+1.4);
});

test('descent is continuous, stays above the island, and touches chosen ground on the beat',()=>{
 const landing={x:12,y:7,z:-18},at=t=>cinematicPodPosition(landing,MUSIC_START+t);
 assert.ok(at(DEPLOYMENT_CUES.businessStart)[1]>landing.y+10);
 assert.ok(at(DEPLOYMENT_CUES.impact-.02)[1]>landing.y);
 assert.deepEqual(at(DEPLOYMENT_CUES.impact),[12,7,-18]);
 assert.deepEqual(at(DEPLOYMENT_CUES.impact+1),[12,7,-18]);
});
