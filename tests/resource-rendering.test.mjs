import test from 'node:test';import assert from 'node:assert/strict';
import * as chunks from '../public/world-chunks.js';
test('resource rendering merges adjacent visible trees but preserves destroyed and distant gaps',()=>{
 assert.equal(typeof chunks.drawVisibleResources,'function');
 const ranges=[{id:'a',x:0,z:0,start:0,count:3},{id:'b',x:1,z:0,start:3,count:6},{id:'c',x:2,z:0,start:9,count:3},{id:'d',x:3,z:0,start:12,count:3},{id:'e',x:500,z:0,start:15,count:3},{id:'f',x:4,z:0,start:18,count:3}],drawn=[];
 chunks.drawVisibleResources(ranges,new Map([['c',0]]),[0,1,0],100,(start,count)=>drawn.push([start,count]));
 assert.deepEqual(drawn,[[0,9],[12,3],[18,3]]);
});
