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

test('low quality reduces actual pixel work even at device pixel ratio one',async()=>{
 const {renderDimensions}=await import('../public/quality-system.js');assert.equal(typeof renderDimensions,'function');
 const low=renderDimensions(1280,720,1,QUALITY_PRESETS.low),high=renderDimensions(1280,720,1,QUALITY_PRESETS.high);
 assert.ok(low.width*low.height<high.width*high.height*.5);assert.ok(Math.abs(low.width/low.height-1280/720)<.003);
 assert.equal(high.width,1280);assert.equal(high.height,720);
});

test('all presets avoid persistent MSAA cost when lowering quality during gameplay',async()=>{
 const {graphicsContextOptions}=await import('../public/quality-system.js');assert.equal(typeof graphicsContextOptions,'function');for(const level of ['auto','low','medium','high'])assert.equal(graphicsContextOptions(level).antialias,false);
});
