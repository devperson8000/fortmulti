import test from 'node:test';
import assert from 'node:assert/strict';
import * as boarding from '../public/deployment-ship.js';
import {deploymentCinematic,MUSIC_START} from '../public/deployment-cinematic.js';

test('boarding finishes walking into the capsule before its doors start closing',()=>{
 assert.equal(typeof boarding.podBoardingPose,'function');
 const pod=boarding.SHIP_PODS[0],start=[pod.x,0,pod.z+2.35];
 const walking=boarding.podBoardingPose(pod,start,.35),inside=boarding.podBoardingPose(pod,start,.7),sealed=boarding.podBoardingPose(pod,start,1);
 assert.equal(walking.doorOpen,1);assert.ok(walking.position[2]>pod.z+.2);
 assert.deepEqual(inside.position,[pod.x,0,pod.z]);assert.ok(inside.doorOpen>0&&inside.doorOpen<1);
 assert.deepEqual(sealed.position,[pod.x,0,pod.z]);assert.equal(sealed.doorOpen,0);assert.equal(sealed.moveSpeed,0);
});

test('the boarding operator fades out before the closing pod doors hide the body',()=>{
 const pod=boarding.SHIP_PODS[0],start=[pod.x,0,pod.z+2.35],opacity=t=>boarding.podBoardingAvatarOpacity(boarding.podBoardingPose(pod,start,t));
 assert.equal(opacity(.64),1,'the character remains visible while the doors are fully open');
 assert.ok(opacity(.82)>0&&opacity(.82)<1,'the character fades as the pod closes');
 assert.equal(opacity(.92),0,'the body is hidden before the hatch seals');
});

test('launch hatches clear before the capsule accelerates below the entire deck',()=>{
 assert.equal(typeof boarding.podShipLaunch,'function');
 const opening=boarding.podShipLaunch(.22),moving=boarding.podShipLaunch(.6),gone=boarding.podShipLaunch(1.1);
 assert.ok(opening.hatchOpen>.2);assert.equal(opening.drop,0);
 assert.equal(moving.hatchOpen,1);assert.ok(moving.drop>1.5);
 assert.ok(gone.drop>5,'the complete 3.82 m capsule has cleared the floor before blackout');
 assert.equal(deploymentCinematic(1.1).black,0);assert.equal(deploymentCinematic(MUSIC_START).black,1);
});

test('the ship deck has eight real launch apertures with no intersecting floor geometry',()=>{
 assert.ok(Array.isArray(boarding.SHIP_DECK_PANELS));
 for(const pod of boarding.SHIP_PODS)assert.ok(boarding.SHIP_DECK_PANELS.every(p=>Math.abs(pod.x-p.center[0])>=p.size[0]/2||Math.abs(pod.z-p.center[1])>=p.size[1]/2));
 const area=boarding.SHIP_DECK_PANELS.reduce((sum,p)=>sum+p.size[0]*p.size[1],0);
 assert.ok(Math.abs(area-(24*36-8*2.44**2))<1e-6,'floor panels cover the deck outside its exact launch holes');
});

test('exterior boarding camera is stationary outside the capsule during entry and waiting',()=>{
 assert.equal(typeof boarding.podBoardingCamera,'function');
 const pod=boarding.SHIP_PODS[0],view=boarding.podBoardingCamera(pod,[0,240,0]);
 assert.ok(Math.hypot(view.eye[0]-pod.x,view.eye[2]-pod.z)>4.5);
 assert.ok(view.eye[1]>241.7&&view.eye[1]<243);
 assert.ok(view.target[1]>241.4&&view.target[1]<242.2);
 assert.deepEqual(view,boarding.podBoardingCamera(pod,[0,240,0]));
});

test('side boarding routes through the front hatch rather than cutting through capsule armor',()=>{
 const pod=boarding.SHIP_PODS[0];
 for(const start of[[pod.x+2.8,0,pod.z+2.35],[pod.x-2.8,0,pod.z+2.35],[pod.x+2.4,0,pod.z+.8]]){
  for(let n=0;n<=100;n++){
   const pose=boarding.podBoardingPose(pod,start,n/100),x=Math.abs(pose.position[0]-pod.x),z=pose.position[2]-pod.z;
   assert.ok(z>1.55||x<.05||x>1.5,'approach stays clear of side armor until aligned with the open hatch');
   if(z<=1.55&&x<1.5)assert.ok(x<.05,'the operator crosses the front plane through the centre of the hatch');
  }
  assert.equal(boarding.podBoardingPose(pod,start,1).yaw,0);
 }
});


test('all eight boarding paths keep body clearance from ship furniture and walls',()=>{
 for(const pod of boarding.SHIP_PODS)for(const side of[-1,1])for(const z of[.8,1.35,2.35]){
  const start=[pod.x+side*2.4,0,pod.z+z];
  for(let n=0;n<=100;n++){
   const {position:p}=boarding.podBoardingPose(pod,start,n/100);
   assert.ok(boarding.SHIP_COLLIDERS.every(box=>p[0]<box.min[0]-.42||p[0]>box.max[0]+.42||p[2]<box.min[2]-.42||p[2]>box.max[2]+.42),`${pod.id} route must leave player-width clearance from furniture`);
  }
 }
});
