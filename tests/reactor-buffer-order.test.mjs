import test from 'node:test';import assert from 'node:assert/strict';import {MeshoptEncoder} from 'meshoptimizer';import {reorderPrimitive} from '../scripts/optimize-reactor-buffers.mjs';
test('cache optimization preserves triangle winding and all packed vertex attributes at every detail level',async()=>{
 await MeshoptEncoder.ready;
 const streams=[{size:3,array:new Uint16Array([0,0,0,2,0,0,0,2,0,2,2,0,4,2,0])},{size:3,array:new Int16Array([0,0,1,0,0,2,0,0,3,0,0,4,0,0,5])},{size:2,array:new Float32Array([0,0,1,0,0,1,1,1,2,1])}],full=new Uint32Array([1,3,2,0,1,2,1,4,3]),lod=new Uint32Array([1,4,3,0,1,2]);
 const result=reorderPrimitive(streams,full,[lod]);
 const triangles=(indices,attributes)=>Array.from({length:indices.length/3},(_,i)=>JSON.stringify(Array.from(indices.slice(i*3,i*3+3),v=>attributes.flatMap((a,k)=>Array.from(a.slice(v*streams[k].size,(v+1)*streams[k].size)))))).sort();
 assert.deepEqual(triangles(result.indices,result.attributes),triangles(full,streams.map(s=>s.array)));
 assert.deepEqual(triangles(result.lods[0],result.attributes),triangles(lod,streams.map(s=>s.array)));
 assert.deepEqual(Array.from(full),[1,3,2,0,1,2,1,4,3]);
});
