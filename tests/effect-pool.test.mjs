import test from 'node:test';
import assert from 'node:assert/strict';
import {createEffectPool} from '../public/effect-pool.js';

test('effect pool remains bounded and replaces the shortest-lived slot',()=>{
 const pool=createEffectPool(8);
 for(let index=0;index<100;index++)pool.spawn({kind:'tracer',life:.2,maxLife:.2,a:[0,0,0],b:[0,0,-index],col:[1,1,1]});
 assert.equal(pool.activeCount,8);
 assert.equal(pool.capacity,8);
 pool.update(.21);
 assert.equal(pool.activeCount,0);
 for(let index=0;index<8;index++)pool.spawn({kind:'impact',life:.1,p:[index,0,0],v:[0,0,0],col:[1,0,0]});
 assert.equal(pool.activeCount,8);
});

test('effect slots reuse their vector storage across respawns',()=>{
 const pool=createEffectPool(1),first=pool.spawn({kind:'shell',life:.1,p:[1,2,3],v:[4,5,6],col:[.1,.2,.3]});
 const position=first.p,velocity=first.v,color=first.col;
 pool.update(.2);
 const second=pool.spawn({kind:'shell',life:.3,p:[7,8,9],v:[1,2,3],col:[.4,.5,.6]});
 assert.equal(first,second);
 assert.equal(second.p,position);
 assert.equal(second.v,velocity);
 assert.equal(second.col,color);
 assert.deepEqual(second.p,[7,8,9]);
});
