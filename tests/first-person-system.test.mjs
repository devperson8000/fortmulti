import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createCameraPresentation,
 stepCameraPresentation,
 cameraMode,
 canFireDuringPresentation,
 createCameraBlendOutput,
 blendCameraViews,
 shouldShowLocalAvatar,
 shouldShowViewModel
} from '../public/first-person-system.js';

const sample=(overrides={})=>({
 lobby:false,
 air:'landed',
 alive:true,
 spectating:false,
 roundToken:1,
 ...overrides
});

test('lobby and aerial modes never enter first person',()=>{
 assert.equal(cameraMode(sample({lobby:true})),'lobby');
 assert.equal(cameraMode(sample({air:'glider'})),'aerial');
 assert.equal(cameraMode(sample({air:'freefall'})),'aerial');
});

test('landing blends for 450ms and enables firing as the first-person hands arrive',()=>{
 let state=createCameraPresentation();
 state=stepCameraPresentation(state,sample({air:'glider'}),.016);
 state=stepCameraPresentation(state,sample(),.075);
 assert.equal(state.mode,'transition');
 assert.ok(state.blend>0&&state.blend<.45);
 assert.equal(canFireDuringPresentation(state),false);
 state=stepCameraPresentation(state,sample(),.15);
 assert.ok(state.blend>=.45);
 assert.equal(canFireDuringPresentation(state),true);
 state=stepCameraPresentation(state,sample(),.30);
 assert.equal(state.mode,'firstPerson');
 assert.equal(state.blend,1);
});

test('death and a new round reset the presentation deterministically',()=>{
 let state={...createCameraPresentation(),mode:'firstPerson',blend:1,roundToken:1,lastAir:'landed'};
 state=stepCameraPresentation(state,sample({alive:false,spectating:true}),.016);
 assert.equal(state.mode,'spectator');
 state=stepCameraPresentation(state,sample({air:'bus',roundToken:2}),.016);
 assert.equal(state.mode,'aerial');
 assert.equal(state.blend,0);
});

test('local avatar stays visible in the air and disappears halfway through landing',()=>{
 assert.equal(shouldShowLocalAvatar({mode:'aerial',blend:0},'glider',true),true);
 assert.equal(shouldShowLocalAvatar({mode:'transition',blend:.49},'landed',true),true);
 assert.equal(shouldShowLocalAvatar({mode:'transition',blend:.5},'landed',true),false);
 assert.equal(shouldShowLocalAvatar({mode:'firstPerson',blend:1},'landed',true),false);
 assert.equal(shouldShowLocalAvatar({mode:'aerial',blend:0},'glider',false),false);
});

test('view model appears only for a living unscoped local first-person view',()=>{
 assert.equal(shouldShowViewModel({mode:'firstPerson'},true,false,false),true);
 assert.equal(shouldShowViewModel({mode:'transition',blend:.44},true,false,false),false);
 assert.equal(shouldShowViewModel({mode:'transition',blend:.45},true,false,false),true);
 assert.equal(shouldShowViewModel({mode:'aerial'},true,false,false),false);
 assert.equal(shouldShowViewModel({mode:'firstPerson'},true,false,true),false);
 assert.equal(shouldShowViewModel({mode:'firstPerson'},true,true,false),false);
});

test('camera blending reuses output vectors and follows transition progress',()=>{
 const output=createCameraBlendOutput(),eye=output.eye,target=output.target;
 const result=blendCameraViews([0,2,6],[0,2,5],[0,1.7,0],[0,1.7,-1],{mode:'transition',blend:.25},output);
 assert.equal(result,output);
 assert.equal(result.eye,eye);
 assert.equal(result.target,target);
 assert.deepEqual(result.eye,[0,1.925,4.5]);
 assert.deepEqual(result.target,[0,1.925,3.5]);
});
