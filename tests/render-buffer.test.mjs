import test from 'node:test';
import assert from 'node:assert/strict';
import {ReusableFloatBuffer} from '../public/render-buffer.js';

test('dynamic render data reuses CPU storage across normal frames',()=>{
 const cache=new ReusableFloatBuffer(8);
 const first=cache.copy([1,2,3,4,5,6]);
 assert.deepEqual([...first],[1,2,3,4,5,6]);
 const storage=cache.buffer;
 const second=cache.copy([7,8,9]);
 assert.equal(cache.buffer,storage);
 assert.deepEqual([...second],[7,8,9]);
 assert.equal(cache.length,3);
});

test('dynamic render storage grows geometrically instead of reallocating every frame',()=>{
 const cache=new ReusableFloatBuffer(4);
 const before=cache.allocations;
 cache.copy(new Array(33).fill(2));
 assert.ok(cache.capacity>=33);
 assert.equal(cache.allocations,before+1);
 const grown=cache.buffer;
 cache.copy(new Array(30).fill(3));
 assert.equal(cache.buffer,grown);
 assert.equal(cache.allocations,before+1);
});
