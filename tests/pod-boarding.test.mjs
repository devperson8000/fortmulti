import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Match} from '../public/simulation.js';
import {SHIP_PODS,DEPLOYMENT_SHIP,DEPLOYMENT_LAUNCH,shipLaunchAt,shipBoardingCamera} from '../public/deployment-ship.js';
import {MUSIC_START,deploymentCinematic,DEPLOYMENT_CUES,DEPLOYMENT_MUSIC_END} from '../public/deployment-cinematic.js';
import {DEPLOYMENT_TIMELINE,deploymentStageAt} from '../public/deployment-sequence.js';

const tick=(match,seconds)=>{for(let time=0;time<seconds;time+=.04)match.tick(.04);};
test('press E reserves a pod and starts an exterior boarding shot; the first teammate waits',()=>{
 const match=new Match({height:()=>0,obstacles:[]},['one','two']);
 match.beginDeployment();
 assert.equal(match.chooseLanding('one',{x:26,z:33}),true);
 const pod=SHIP_PODS[0],player=match.players[0];
 player.shipLocal=[pod.x,0,pod.z+2.2];player.p=match.shipWorld(player.shipLocal);
 assert.equal(match.enterPod('one'),true);
 assert.equal(player.deploymentState,'entering_pod');
 const camera=shipBoardingCamera(pod,DEPLOYMENT_SHIP.origin);
 assert.ok(camera,'the pod has a dedicated exterior camera');
 assert.ok(camera.eye[2]>DEPLOYMENT_SHIP.origin[2]+pod.z+3);
 assert.ok(Math.hypot(camera.eye[0]-DEPLOYMENT_SHIP.origin[0]-pod.x,camera.eye[2]-DEPLOYMENT_SHIP.origin[2]-pod.z)>4);
 tick(match,DEPLOYMENT_TIMELINE.enterSeconds+.15);
 assert.equal(player.deploymentState,'pod_ready');
 assert.equal(match.deployment.stage,'landing_selection','the first operator cannot launch without their teammate');
 assert.equal(shipLaunchAt(0).hatchOpen,0);
});

test('hatches open, pods disappear through real deck openings, and then blackout starts',()=>{
 const c=DEPLOYMENT_LAUNCH;
 assert.equal(DEPLOYMENT_TIMELINE.sealSeconds,c.seal);
 assert.equal(shipLaunchAt(c.hatchStart-.001).hatchOpen,0);
 assert.equal(shipLaunchAt(c.dropStart-.001).drop,0);
 assert.ok(shipLaunchAt(c.dropStart).hatchOpen>.99,'deck must be fully open before acceleration');
 assert.ok(shipLaunchAt(c.dropStart+c.dropSeconds*.5).drop>4);
 assert.equal(shipLaunchAt(c.dropStart+c.dropSeconds).drop,c.dropDistance);
 assert.ok(c.dropStart+c.dropSeconds<c.fadeStart,'the launch completes before the screen goes black');
 assert.equal(deploymentCinematic(c.dropStart+c.dropSeconds).black,0);
 assert.equal(deploymentCinematic(MUSIC_START).black,1);
 assert.equal(deploymentStageAt(c.fadeStart),'transition');
});

test('exterior camera holds on sealed pod and follows a launched pod into its shaft',()=>{
 const pod=SHIP_PODS[2],origin=DEPLOYMENT_SHIP.origin;
 const waiting=shipBoardingCamera(pod,origin),sealed=shipBoardingCamera(pod,origin,DEPLOYMENT_LAUNCH.seal);
 assert.deepEqual(waiting,sealed,'the exterior view must remain unchanged while the second player boards');
 const shot=shipBoardingCamera(pod,origin,DEPLOYMENT_LAUNCH.dropStart+DEPLOYMENT_LAUNCH.dropSeconds*.75);
 assert.ok(shot.target[1]<waiting.target[1]-5,'camera tracks the falling pod instead of staring into an empty hatch');
 assert.ok(shot.eye[1]>shot.target[1],'the departing pod is seen from above');
});

test('outro is an uninterrupted portion of the original track ending at gameplay',()=>{
 assert.ok(DEPLOYMENT_MUSIC_END>DEPLOYMENT_CUES.impact+4);
 assert.ok(DEPLOYMENT_MUSIC_END<30);
 assert.equal(DEPLOYMENT_TIMELINE.sealSeconds+DEPLOYMENT_TIMELINE.launchSeconds,MUSIC_START+DEPLOYMENT_CUES.impact);
 const rendered=deploymentCinematic(MUSIC_START+DEPLOYMENT_MUSIC_END-.8);
 assert.equal(rendered.returnProgress,0,'hold the full camera-facing salute before the final handoff');
});

test('ship rendering uses the outside camera, perforated deck and sealed exterior only',async()=>{
 const engine=await readFile(new URL('../public/engine.js',import.meta.url),'utf8');
 assert.match(engine,/shipBoardingCamera\(boardingPod/);
 assert.match(engine,/shipLaunchAt\(sequenceElapsed\)/);
 assert.match(engine,/Segmented deck provides actual launch holes/);
 assert.match(engine,/if\(!boardingView&&\(cinematic/);
 assert.match(engine,/body\.classList\.toggle\('pod-exterior'/);
});

test('exterior boarding camera cannot read a timeline variable before initialization',async()=>{
 const engine=await readFile(new URL('../public/engine.js',import.meta.url),'utf8');
 const begin=engine.indexOf('const sequenceElapsed=deploymentData?.sequenceElapsed||0;');
 const camera=engine.indexOf('shipBoardingCamera(boardingPod');
 assert.ok(begin>=0&&begin<camera,'shared sequence time must be initialized before the boarding camera');
 assert.doesNotMatch(engine,/const sequence=deploymentData\?\.stage\|\|'',sequenceElapsed=/,'do not redeclare timeline after camera has used it');
});
