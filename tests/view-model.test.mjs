import test from 'node:test';
import assert from 'node:assert/strict';
import {WEAPON_PROFILES} from '../public/weapon-system.js';
import {createViewModelState,stepViewModel,reloadStage,createWeaponPartState,stepWeaponParts,createFirstPersonHandPose} from '../public/view-model.js';
import {WEAPON_MODELS} from '../public/weapon-model.js';
import * as viewModel from '../public/view-model.js';

const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

test('each weapon exposes immutable first-person presentation tuning',()=>{
 for(const profile of Object.values(WEAPON_PROFILES)){
  assert.equal(profile.presentation.anchor.length,3);
  assert.equal(profile.presentation.adsAnchor.length,3);
  assert.equal(profile.presentation.recoil.length,3);
  assert.ok(Object.isFrozen(profile.presentation));
  assert.ok(Object.isFrozen(profile.presentation.anchor));
  assert.ok(Object.isFrozen(profile.presentation.adsAnchor));
  assert.ok(Object.isFrozen(profile.presentation.recoil));
 }
});

test('reload phases progress through the visible weapon sequence',()=>{
 const profile=WEAPON_PROFILES.ar,duration=profile.reloadDuration;
 assert.equal(reloadStage(profile,duration),'release');
 assert.equal(reloadStage(profile,duration*.72),'eject');
 assert.equal(reloadStage(profile,duration*.44),'insert');
 assert.equal(reloadStage(profile,duration*.18),'action');
 assert.equal(reloadStage(profile,duration*.04),'settle');
 assert.equal(reloadStage(profile,0),'idle');
});

test('view-model motion reuses state and recovers after recoil',()=>{
 let state=createViewModelState();
 const original=state;
 const base={weapon:WEAPON_PROFILES.ar,moving:0,sprinting:false,aiming:false,reloading:0,equipRemaining:0,mouseX:0,mouseY:0,time:0};
 state=stepViewModel(state,{...base,shotImpulse:1},.016);
 assert.equal(state,original);
 assert.ok(state.recoil>0);
 for(let i=0;i<120;i++)state=stepViewModel(state,{...base,time:i/60},1/60);
 assert.ok(state.recoil<.01);
 for(const value of [...state.position,...state.rotation])assert.ok(Number.isFinite(value)&&Math.abs(value)<2);
});

test('aim and sprint converge toward different stable poses',()=>{
 const ads=createViewModelState(),sprint=createViewModelState(),profile=WEAPON_PROFILES.smg;
 for(let i=0;i<90;i++){
  stepViewModel(ads,{weapon:profile,moving:0,aiming:true,sprinting:false,reloading:0,mouseX:0,mouseY:0,shotImpulse:0,time:i/60},1/60);
  stepViewModel(sprint,{weapon:profile,moving:1,aiming:false,sprinting:true,reloading:0,mouseX:0,mouseY:0,shotImpulse:0,time:i/60},1/60);
 }
 assert.ok(Math.abs(ads.position[0])<.01);
 assert.ok(sprint.position[0]>.2);
 assert.ok(sprint.rotation[0]>.3);
});

test('reload parts eject the magazine and cycle the weapon action',()=>{
 const profile=WEAPON_PROFILES.sniper,state=createWeaponPartState(),original=state;
 stepWeaponParts(state,profile,profile.reloadDuration*.7);
 assert.equal(state,original);
 assert.equal(state.stage,'eject');
 assert.ok(state.magazine[1]<-.1);
 assert.equal(state.magazineVisible,true);
 stepWeaponParts(state,profile,profile.reloadDuration*.2);
 assert.equal(state.stage,'action');
 assert.ok(state.action>0);
 assert.equal(state.magazineVisible,false);
 assert.equal(state.freshMagazineVisible,true);
 stepWeaponParts(state,profile,0);
 assert.equal(state.stage,'idle');
 assert.deepEqual(state.magazine,[0,0,0]);
 assert.deepEqual(state.freshMagazine,[0,0,0]);
 assert.equal(state.action,0);
});

test('reload hand releases, retrieves and seats a fresh magazine in clear stages',()=>{
 const profile=WEAPON_PROFILES.ar,state=createWeaponPartState();
 stepWeaponParts(state,profile,profile.reloadDuration*.76);
 const released=state.supportHand.slice();
 stepWeaponParts(state,profile,profile.reloadDuration*.5);
 const insertion=state.supportHand.slice();
 assert.equal(state.stage,'insert');
 assert.ok(state.freshMagazineVisible);
 assert.ok(state.freshMagazine[0]<0);
 assert.ok(insertion[1]>released[1]);
 stepWeaponParts(state,profile,profile.reloadDuration*.04);
 assert.equal(state.stage,'settle');
 assert.ok(state.freshMagazineVisible);
});

test('first-person gloves anchor to each weapon grip and fore-end',()=>{
 for(const profile of Object.values(WEAPON_PROFILES)){
  const parts=createWeaponPartState(),pose=createFirstPersonHandPose(profile,parts),model=WEAPON_MODELS[profile.id].parts;
  const grip=model.find(part=>part.id==='grip').position;
  const foreEnd=model.find(part=>part.id==='handguard'||part.id==='fore-end').position;
  assert.ok(distance(pose.shooting.palm,grip)<.13,`${profile.id} firing hand should wrap its grip`);
  assert.ok(distance(pose.support.palm,[foreEnd[0],foreEnd[1]-.075,foreEnd[2]])<.04,`${profile.id} support hand should wrap its fore-end`);
  assert.ok(distance(pose.shooting.wrist,pose.shooting.palm)>.08);
  assert.ok(distance(pose.support.wrist,pose.support.palm)>.08);
 }
});

test('first-person support hand reaches the magazine and returns to the fore-end on reload',()=>{
 const profile=WEAPON_PROFILES.ar,parts=createWeaponPartState();
 const ready=createFirstPersonHandPose(profile,parts).support.palm;
 stepWeaponParts(parts,profile,profile.reloadDuration*.5);
 const reload=createFirstPersonHandPose(profile,parts).support.palm;
 const magazine=WEAPON_MODELS.ar.parts.find(part=>part.id==='magazine').position;
 assert.equal(parts.stage,'insert');
 assert.ok(distance(reload,ready)>.2,'support glove must leave its ready grip');
 assert.ok(distance(reload,[magazine[0],magazine[1]-.1,magazine[2]])<.13,'support glove should meet the magazine during insertion');
 stepWeaponParts(parts,profile,0);
 assert.ok(distance(createFirstPersonHandPose(profile,parts).support.palm,ready)<.001,'support glove must return to its fore-end grip');
});

test('first-person GLB trigger stays on the firing finger and each asset fits its weapon slot',()=>{
 const createPose=viewModel.createFirstPersonAssetPose;
 assert.equal(typeof createPose,'function','first-person GLB assets need a testable camera-space pose');
 const profile=WEAPON_PROFILES.ar,state={position:[.34,-.34,-.78],rotation:[.12,-.08,.03]},parts={rootTilt:-.42};
 const pose=createPose(profile,state,parts,.8),hand=createFirstPersonHandPose(profile,createWeaponPartState());
 assert.deepEqual(pose.position,state.position);
 assert.deepEqual(pose.rotation,[-.3,-.08,0]);
 assert.equal(pose.scale,1.6875);
 assert.ok(distance(hand.shooting.digits[0].to,pose.trigger)<.03,'the trigger pivot must meet the index fingertip');
 for(const weapon of Object.values(WEAPON_PROFILES)){
  const fitted=createPose(weapon,state,{rootTilt:0},.8);
  assert.ok(Math.abs(fitted.scale*.8-1.35*weapon.presentation.scale)<1e-9,`${weapon.id} should keep a consistent first-person length`);
 }
});

test('weapon switching begins lowered and returns to the ready anchor',()=>{
 const profile=WEAPON_PROFILES.ar,state=createViewModelState(),base={weapon:profile,moving:0,sprinting:false,aiming:false,reloading:0,mouseX:0,mouseY:0,shotImpulse:0,time:0};
 for(let i=0;i<90;i++)stepViewModel(state,{...base,equipRemaining:0},1/60);
 const readyY=state.position[1];
 for(let i=0;i<8;i++)stepViewModel(state,{...base,equipRemaining:profile.equipDuration},1/60);
 assert.ok(state.position[1]<readyY-.2);
 for(let i=0;i<90;i++)stepViewModel(state,{...base,equipRemaining:0},1/60);
 assert.ok(Math.abs(state.position[1]-readyY)<.01);
});

test('hand attachments retain world size through the Soldier centimeter hierarchy',()=>{
 assert.equal(typeof viewModel.handAttachmentScale,'function');
 const inherited=.01*1.08,sourceLength=2.4,worldLength=.82;
 const localScale=viewModel.handAttachmentScale(inherited,worldLength,sourceLength);
 assert.ok(Math.abs(localScale*inherited*sourceLength-worldLength)<1e-9);
 assert.ok(Math.abs(viewModel.handAttachmentScale(inherited)*inherited-1)<1e-9);
});
