import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('game and lobby frames reuse dynamic geometry storage',async()=>{
 const source=await readFile(new URL('../public/engine.js',import.meta.url),'utf8');
 assert.match(source,/new ReusableFloatBuffer\(/);
 assert.equal((source.match(/new Float32Array\(geo\)/g)||[]).length,1,'only the one-time static-world upload may allocate from geo');
 assert.equal((source.match(/geo\s*=\s*\[\]/g)||[]).length,1,'only the initial geometry array allocation is allowed');
 assert.ok((source.match(/dynamicData\.copy\(geo\)/g)||[]).length>=2);
});

test('renderer applies bounded motion tracks to the viewed player and peers',async()=>{
 const source=await readFile(new URL('../public/engine.js',import.meta.url),'utf8');
 assert.ok((source.match(/advanceMotionTrack\(/g)||[]).length>=2);
 assert.doesNotMatch(source,/player\.p\s*=\s*smoothPosition/);
});
