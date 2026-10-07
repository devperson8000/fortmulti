import test from 'node:test';
import assert from 'node:assert/strict';
import { DEPLOYMENT_TIMELINE, DEPLOYMENT_STATES, createDeploymentClock, stepDeploymentClock, deploymentStageAt, safeLandingPoint } from '../public/deployment-sequence.js';
import { DEPLOYMENT_CUES, MUSIC_START, CINEMATIC_CAMERA_RADIUS } from '../public/deployment-cinematic.js';
import { SHIP_PODS, clampShipPosition, moveInShip } from '../public/deployment-ship.js';

const world={height:(x,z)=>Math.sin(x*.02)+Math.cos(z*.02),obstacles:[{min:[-5,-2,-5],max:[5,15,5]}]};

test('deployment timeline covers seal, the musical intro, beat touchdown, opening and exit',()=>{
 assert.deepEqual(DEPLOYMENT_STATES,['ship_waiting','landing_selection','pod_available','entering_pod','pod_ready','both_ready','pod_sealing','launching','transition','landed','pod_opening','exiting','match_active']);
 assert.equal(DEPLOYMENT_TIMELINE.sealSeconds+DEPLOYMENT_TIMELINE.launchSeconds,MUSIC_START+DEPLOYMENT_CUES.impact);
 assert.ok(DEPLOYMENT_TIMELINE.fadeAt>2.3&&DEPLOYMENT_TIMELINE.fadeAt<DEPLOYMENT_TIMELINE.launchSeconds);
 assert.equal(deploymentStageAt(DEPLOYMENT_TIMELINE.sealSeconds+DEPLOYMENT_TIMELINE.fadeAt),'transition');
 assert.equal(deploymentStageAt(DEPLOYMENT_TIMELINE.sealSeconds+DEPLOYMENT_TIMELINE.launchSeconds),'landed');
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
