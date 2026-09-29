import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveLobbyRig,sampleSaluteFingerPose,selectSaluteFingerTracks} from '../public/lobby-rig.js';

function makeRigModel(){
 const root={name:'Soldier',children:[]};
 const add=(parent,name)=>{const node={name,parent,children:[]};parent.children.push(node);return node;};
 const spine2=add(root,'mixamorigSpine2');
 const shoulder=add(spine2,'mixamorigRightShoulder');
 const arm=add(shoulder,'mixamorigRightArm');
 const forearm=add(arm,'mixamorigRightForeArm');
 const hand=add(forearm,'mixamorigRightHand');
 const index1=add(hand,'mixamorigRightHandIndex1');
 const index2=add(index1,'mixamorigRightHandIndex2');
 const index3=add(index2,'mixamorigRightHandIndex3');
 const index4=add(index3,'mixamorigRightHandIndex4');
 const thumb1=add(hand,'mixamorigRightHandThumb1');
 const thumb2=add(thumb1,'mixamorigRightHandThumb2');
 const thumb3=add(thumb2,'mixamorigRightHandThumb3');
 const thumb4=add(thumb3,'mixamorigRightHandThumb4');
 const middle1=add(hand,'mixamorigRightHandMiddle1');
 const middle2=add(middle1,'mixamorigRightHandMiddle2');
 const middle3=add(middle2,'mixamorigRightHandMiddle3');
 const middle4=add(middle3,'mixamorigRightHandMiddle4');
 const ring1=add(hand,'mixamorigRightHandRing1');
 const ring2=add(ring1,'mixamorigRightHandRing2');
 const ring3=add(ring2,'mixamorigRightHandRing3');
 const ring4=add(ring3,'mixamorigRightHandRing4');
 const pinky1=add(hand,'mixamorigRightHandPinky1');
 const pinky2=add(pinky1,'mixamorigRightHandPinky2');
 const pinky3=add(pinky2,'mixamorigRightHandPinky3');
 const pinky4=add(pinky3,'mixamorigRightHandPinky4');
 const nodes=[];const walk=node=>{nodes.push(node);node.children.forEach(walk);};walk(root);
 return {root,shoulder,arm,forearm,hand,index1,index2,index3,index4,thumb1,thumb2,thumb3,thumb4,middle1,middle2,middle3,middle4,ring1,ring2,ring3,ring4,pinky1,pinky2,pinky3,pinky4,
  model:{getObjectByName(name){return nodes.find(node=>node.name===name)||null;}}};
}

test('resolves the actual sanitized Soldier rig names and right-hand hierarchy',()=>{
 const expected=makeRigModel();
 const rig=resolveLobbyRig(expected.model);
 assert.equal(rig.rightShoulder,expected.shoulder);
 assert.equal(rig.rightArm,expected.arm);
 assert.equal(rig.rightForeArm,expected.forearm);
 assert.equal(rig.rightHand,expected.hand);
 for(const digit of ['thumb','index','middle','ring','pinky']){
  for(let joint=1;joint<=4;joint++)assert.equal(rig[`right${digit[0].toUpperCase()}${digit.slice(1)}${joint}`],expected[`${digit}${joint}`]);
 }
 assert.equal(rig.rightIndex1,expected.index1);
 assert.equal(rig.rightArm.parent,rig.rightShoulder);
 assert.equal(rig.rightForeArm.parent,rig.rightArm);
 assert.equal(rig.rightHand.parent,rig.rightForeArm);
 assert.equal(rig.rightIndex1.parent,rig.rightHand);
 assert.equal(rig.rightMiddle1.parent,rig.rightHand);
 assert.equal(rig.rightThumb2.parent,rig.rightThumb1);
 assert.equal(rig.rightIndex2.parent,rig.rightIndex1);
 assert.equal(rig.rightMiddle3.parent,rig.rightMiddle2);
 assert.equal(rig.rightRing4.parent,rig.rightRing3);
 assert.equal(rig.rightPinky4.parent,rig.rightPinky3);
});

test('selects the sanitized index and middle finger tracks for the salute layer',()=>{
 const tracks=[
  {name:'mixamorigRightHandMiddle1.position'},
  {name:'mixamorigRightHandMiddle1.quaternion'},
  {name:'mixamorigRightHandMiddle1.scale'},
  {name:'mixamorigRightHandMiddle3.position'},
  {name:'mixamorigRightHandMiddle3.quaternion'},
  {name:'mixamorigRightHandMiddle3.scale'},
  {name:'mixamorigRightHandIndex3.position'},
  {name:'mixamorigRightHandIndex3.quaternion'},
  {name:'mixamorigRightHandIndex3.scale'},
  {name:'mixamorigRightHandMiddle2.position'},
  {name:'mixamorigRightHandMiddle2.quaternion'},
  {name:'mixamorigRightHandMiddle2.scale'},
  {name:'mixamorigRightHandIndex1.position'},
  {name:'mixamorigRightHandIndex1.quaternion'},
  {name:'mixamorigRightHandIndex1.scale'},
  {name:'mixamorigRightHandIndex2.position'},
  {name:'mixamorigRightHandIndex2.quaternion'},
  {name:'mixamorigRightHandIndex2.scale'},
  {name:'mixamorigRightHandRing1.quaternion'},
  {name:'mixamorigRightHandPinky1.quaternion'},
  {name:'mixamorig:RightHandIndex1.quaternion'}
 ];
 assert.deepEqual(selectSaluteFingerTracks({tracks}),tracks.slice(0,18));
});

test('samples only actual index and middle quaternion tracks from the T-pose clip',()=>{
 const sampled=[];
 const makeTrack=(name,value)=>({name,createInterpolant(){return {evaluate(time){sampled.push([name,time]);return value;}};}});
 const clip={tracks:[
  makeTrack('mixamorigRightHandIndex1.quaternion',[0,0,0,1]),
  makeTrack('mixamorigRightHandIndex1.position',[1,2,3]),
  makeTrack('mixamorigRightHandMiddle2.quaternion',[0.2,0.3,0.4,0.8]),
  makeTrack('mixamorigRightHandRing1.quaternion',[0,0,0,1]),
  makeTrack('mixamorig:RightHandIndex2.quaternion',[0,0,0,1])
 ]};
 const pose=sampleSaluteFingerPose(clip,.0083);
 assert.deepEqual(pose,[
  {name:'mixamorigRightHandIndex1',quaternion:[0,0,0,1]},
  {name:'mixamorigRightHandMiddle2',quaternion:[.2,.3,.4,.8]}
 ]);
 assert.deepEqual(sampled,[
  ['mixamorigRightHandIndex1.quaternion',.0083],
  ['mixamorigRightHandMiddle2.quaternion',.0083]
 ]);
});
