import test from 'node:test';
import assert from 'node:assert/strict';
import {WEAPON_PROFILES} from '../public/weapon-system.js';
import {createViewModelState,stepViewModel,reloadStage,createWeaponPartState,stepWeaponParts} from '../public/view-model.js';

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

test('weapon switching begins lowered and returns to the ready anchor',()=>{
 const profile=WEAPON_PROFILES.ar,state=createViewModelState(),base={weapon:profile,moving:0,sprinting:false,aiming:false,reloading:0,mouseX:0,mouseY:0,shotImpulse:0,time:0};
 for(let i=0;i<90;i++)stepViewModel(state,{...base,equipRemaining:0},1/60);
 const readyY=state.position[1];
 for(let i=0;i<8;i++)stepViewModel(state,{...base,equipRemaining:profile.equipDuration},1/60);
 assert.ok(state.position[1]<readyY-.2);
 for(let i=0;i<90;i++)stepViewModel(state,{...base,equipRemaining:0},1/60);
 assert.ok(Math.abs(state.position[1]-readyY)<.01);
});
