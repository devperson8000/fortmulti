import test from 'node:test';
import assert from 'node:assert/strict';
import {createMapSelection} from '../public/map-selection.js';
test('unused facility is not loaded and repeated selection shares its load',async()=>{
 let loads=0,resolve;const loader=()=>{loads++;return new Promise(r=>resolve=r);};const applied=[];
 const maps=createMapSelection(loader,id=>applied.push(id));assert.equal(maps.id,'island');assert.equal(loads,0);
 const first=maps.select('facility'),second=maps.select('facility');assert.equal(loads,1);resolve();await Promise.all([first,second]);assert.equal(maps.id,'facility');assert.deepEqual(applied,['facility']);
});
test('late facility load cannot override a newer outdoor selection',async()=>{
 let resolve;const applied=[];const maps=createMapSelection(()=>new Promise(r=>resolve=r),id=>applied.push(id));
 const pending=maps.select('facility');await maps.select('island');resolve();assert.equal(await pending,false);assert.equal(maps.id,'island');assert.deepEqual(applied,[]);
});
test('failed facility load leaves the outdoor map usable and permits retry',async()=>{
 let tries=0;const maps=createMapSelection(()=>{if(++tries===1)throw new Error('offline');},()=>{});
 await assert.rejects(maps.select('facility'),/offline/);assert.equal(maps.id,'island');await maps.select('facility');assert.equal(maps.id,'facility');await assert.rejects(maps.select('bad'),/Unknown map/);
});
