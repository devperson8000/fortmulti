import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnimationBlend, resolveCharacterAnimation, stepAnimationBlend } from '../public/character-animation.js';

test('character animation selects grounded locomotion from the authoritative movement state',()=>{
 assert.equal(resolveCharacterAnimation({grounded:true,speed:0}).state,'idle');
 assert.equal(resolveCharacterAnimation({grounded:true,speed:2}).state,'walk');
 assert.equal(resolveCharacterAnimation({grounded:true,speed:5.4,sprinting:true}).state,'run');
 assert.equal(resolveCharacterAnimation({grounded:false,velocity:4}).state,'jump');
 assert.equal(resolveCharacterAnimation({grounded:false,velocity:-2}).state,'fall');
 assert.equal(resolveCharacterAnimation({grounded:true,crouching:true,speed:0}).state,'crouch');
});

test('animation layers blend smoothly, stay normalized and ignore unsupported clips',()=>{
 const blend=createAnimationBlend('idle');
 const next=stepAnimationBlend(blend,{state:'run',supported:new Set(['idle','walk','run'])},.08);
 assert.equal(next.state,'run');
 assert.ok(next.weights.run>0&&next.weights.run<1);
 assert.ok(Math.abs(Object.values(next.weights).reduce((sum,value)=>sum+value,0)-1)<1e-8);
 const fallback=stepAnimationBlend(next,{state:'jump',supported:new Set(['idle','walk','run'])},.08);
 assert.equal(fallback.state,'idle');
 assert.ok(fallback.weights.run>0);
});

test('pod entry, pod exit and crouch use the supplied locomotion clips when dedicated clips are absent',()=>{
 const supported=new Set(['idle','walk','run']);
 for(const state of ['pod-enter','pod-exit','crouch']){
  assert.equal(stepAnimationBlend(createAnimationBlend('idle'),{state,supported},.08).state,'walk',state);
 }
});
