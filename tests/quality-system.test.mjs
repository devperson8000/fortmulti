import test from 'node:test';
import assert from 'node:assert/strict';
import {QUALITY_PRESETS,createAutoQuality,sampleAutoQuality} from '../public/quality-system.js';

test('auto quality changes only after sustained pressure and uses hysteresis',()=>{
 const state=createAutoQuality('high');let now=0;
 const advance=(duration,frameMs)=>{const until=now+duration;for(;now<until;now+=frameMs)sampleAutoQuality(state,frameMs,now);};
 advance(1800,25);assert.equal(state.level,'high');
 advance(4200,25);assert.equal(state.level,'medium');
 advance(2000,10);assert.equal(state.level,'medium');
 advance(20000,10);assert.equal(state.level,'high');
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

test('retina and ultrawide windows stay inside a finite pixel budget without stretching',async()=>{
 const {renderDimensions}=await import('../public/quality-system.js');
 for(const [level,budget] of [['low',960*540],['medium',1600*900],['high',1920*1080]]){
  const size=renderDimensions(3840,2160,2,QUALITY_PRESETS[level]);
  assert.ok(size.width*size.height<=budget+3840,`${level} wastes work rendering ${size.width*size.height} pixels`);
  assert.ok(Math.abs(size.width/size.height-16/9)<.005);
 }
});

test('auto quality responds to sustained 50 FPS before three seconds',()=>{
 const state=createAutoQuality('high');
 for(let now=0;now<=2600;now+=20)sampleAutoQuality(state,20,now);
 assert.equal(state.level,'medium');
});

test('auto quality keeps stable 60 FPS and isolated loading spikes at the selected level',()=>{
 const state=createAutoQuality('high');
 for(let index=0;index<600;index++)sampleAutoQuality(state,index===200?80:1000/60,index*1000/60);
 assert.equal(state.level,'high');
});
