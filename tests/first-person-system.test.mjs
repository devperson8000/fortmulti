import test from 'node:test';
import assert from 'node:assert/strict';
import {createCameraPresentation,stepCameraPresentation,cameraMode,canFireDuringPresentation,createCameraBlendOutput,blendCameraViews,shouldShowLocalAvatar,shouldShowViewModel} from '../public/first-person-system.js';

const sample=(overrides={})=>({lobby:false,air:'landed',alive:true,spectating:false,roundToken:1,...overrides});

test('the player stays first-person through ship staging, pods and the live match',()=>{
 assert.equal(cameraMode(sample({lobby:true})),'lobby');for(const air of['ship','pod','landed'])assert.equal(cameraMode(sample({air})),'firstPerson',air);assert.equal(cameraMode(sample({alive:false,spectating:true,air:'pod'})),'spectator');
});

test('deployment keeps a ground-level first-person camera and new rounds reset cleanly',()=>{
 let state=createCameraPresentation();for(const air of['ship','pod','landed']){state=stepCameraPresentation(state,sample({air}),.08);assert.equal(state.mode,'firstPerson');assert.equal(state.blend,1);}
 state=stepCameraPresentation(state,sample({alive:false,spectating:true}),.016);assert.equal(state.mode,'spectator');state=stepCameraPresentation(state,sample({air:'ship',roundToken:2}),.016);assert.equal(state.mode,'firstPerson');assert.equal(state.blend,1);
});

test('the local model stays hidden in first-person and is available to a spectator camera',()=>{
 for(const air of['ship','pod','landed'])assert.equal(shouldShowLocalAvatar({mode:'firstPerson',blend:1},air,true),false);
 assert.equal(shouldShowLocalAvatar({mode:'spectator',blend:0},'landed',true),true);assert.equal(shouldShowLocalAvatar({mode:'spectator',blend:0},'landed',false),false);
});

test('view models appear only for an unscoped living first-person view',()=>{
 assert.equal(shouldShowViewModel({mode:'firstPerson'},true,false,false),true);assert.equal(shouldShowViewModel({mode:'spectator'},true,false,false),false);assert.equal(shouldShowViewModel({mode:'firstPerson'},true,false,true),false);assert.equal(shouldShowViewModel({mode:'firstPerson'},true,true,false),false);assert.equal(canFireDuringPresentation(createCameraPresentation()),true);
});

test('camera blending reuses output vectors and follows transition progress',()=>{
 const output=createCameraBlendOutput(),eye=output.eye,target=output.target;const result=blendCameraViews([0,2,6],[0,2,5],[0,1.7,0],[0,1.7,-1],{mode:'transition',blend:.25},output);
 assert.equal(result,output);assert.equal(result.eye,eye);assert.equal(result.target,target);assert.deepEqual(result.eye,[0,1.925,4.5]);assert.deepEqual(result.target,[0,1.925,3.5]);
});
