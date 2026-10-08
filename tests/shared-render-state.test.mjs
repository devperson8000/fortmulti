import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchCharacterRenderer} from '../public/match-character-renderer.js';

test('raw renderer detaches Three vertex arrays before changing attribute buffers',()=>{
 const calls=[];
 const gl=new Proxy({DEPTH_TEST:1,LESS:2,BLEND:3,CULL_FACE:4},{get(target,key){return key in target?target[key]:(...args)=>calls.push([key,...args]);}});
 const shared={gl,rawProgram:'world',rawPosition:0,rawColor:1,renderer:{resetState(){calls.push(['resetState']);}}};
 MatchCharacterRenderer.prototype.restoreRawState.call(shared);
 assert.deepEqual(calls[0],['resetState'],'release cached Three VAOs before raw vertexAttribPointer changes');
 assert.ok(calls.find(c=>c[0]==='useProgram'&&c[1]==='world'));
});
