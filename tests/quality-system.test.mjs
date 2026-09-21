import test from 'node:test';
import assert from 'node:assert/strict';
import {QUALITY_PRESETS,createAutoQuality,sampleAutoQuality} from '../public/quality-system.js';

test('auto quality changes only after sustained pressure and uses hysteresis',()=>{
 let state=createAutoQuality('high');
 for(let index=0;index<60;index++)state=sampleAutoQuality(state,25,index*100);
 assert.equal(state.level,'medium');
 for(let index=0;index<20;index++)state=sampleAutoQuality(state,10,7000+index*100);
 assert.equal(state.level,'medium');
 for(let index=0;index<180;index++)state=sampleAutoQuality(state,10,10000+index*100);
 assert.equal(state.level,'high');
});

test('every quality preset has bounded render budgets',()=>{
 for(const preset of Object.values(QUALITY_PRESETS)){
  assert.ok(preset.pixelRatio>0&&preset.pixelRatio<=1.6);
  assert.ok(preset.effects>=16&&preset.effects<=160);
  assert.ok(preset.remoteDetail>0&&preset.remoteDetail<=1);
 }
});
