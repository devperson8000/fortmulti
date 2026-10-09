import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {PLATFORM_COLLISION as collision} from '../public/maps/platform23/collision-data.js';
const base=new URL('../public/maps/platform23/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('environment.json',base)));
const buffer=gunzipSync(readFileSync(new URL('geometry.bin.gz',base)));
const binary=buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
const primitives=manifest.models.flatMap(m=>m.meshes.flat());
test('Platform 23 authored assets decode with correct winding, indices and material references',()=>{
 let triangles=0;
 for(const p of primitives){
  assert.ok(manifest.materials[p.material]);assert.equal(p.indexType,16);
  const q=new Uint16Array(binary,p.position.offset,p.position.length),n=new Int16Array(binary,p.normal.offset,p.normal.length),uv=new Float32Array(binary,p.uv.offset,p.uv.length),index=new Uint16Array(binary,p.index.offset,p.index.length);
  assert.equal(n.length,q.length);assert.equal(uv.length,q.length/3*2);assert.equal(index.length%3,0);
  assert.ok([...uv].every(Number.isFinite));
  const pos=i=>[0,1,2].map(k=>p.min[k]+q[i*3+k]/65535*p.span[k]);
  for(let i=0;i<index.length;i+=3){
   const ids=[index[i],index[i+1],index[i+2]];assert.ok(ids.every(x=>x<q.length/3));
   const [a,b,c]=ids.map(pos),u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]);
   const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
   const length=Math.hypot(...cross);if(length>1e-8)assert.ok(cross.reduce((s,x,k)=>s+x*n[ids[0]*3+k]/32767,0)>-1e-7,'front face must follow authored outward normal');
  }
  triangles+=index.length/3;
 }
 assert.ok(triangles>25000);assert.deepEqual(manifest.sourceTransform.offset,[0,0,56.75]);
 for(const m of Object.values(manifest.materials))for(const key of ['map','normalMap'])if(m[key])assert.ok(existsSync(new URL('textures/'+m[key],base)));
});
test('Platform 23 collision retains exact convex planes and original curved triangles',()=>{
 assert.equal(collision.brushes.length,3542);assert.equal(collision.patches.length,189);
 assert.ok(collision.walkable.positions.length>5000*9);
 for(const b of collision.brushes){
  assert.ok(b.supportOnlyNative);assert.ok(b.planes.length>=4);assert.ok(b.min.every((x,k)=>x<=b.max[k]));
  for(const p of b.planes){assert.equal(p.length,4);assert.ok(p.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...p.slice(0,3))-1)<2e-6);}
  assert.ok(!b.flags.includes('common/trigger'));
  if(b.type==='playerclip')assert.equal(b.blocksShots,false);
 }
 for(const p of collision.patches){assert.equal(p.positions.length%9,0);assert.ok(p.positions.every(Number.isFinite));}
 assert.ok(collision.brushes.some(b=>b.planes.some(p=>Math.abs(p[0])>.1&&Math.abs(p[2])>.1)),'diagonal solids retain authored planes');
});
test('Platform 23 original landing centers have standing clearance and explicit sky boundary semantics',()=>{
 const sites=JSON.parse(readFileSync(new URL('landing-analysis.json',base))).sites;
 for(const {position:[x,y,z]} of sites){
  const center=[x,y+.915,z];
  const blocking=collision.brushes.filter(b=>b.planes.every(p=>p[0]*center[0]+p[1]*center[1]+p[2]*center[2]<=p[3]+.4+Math.abs(p[1])*.5-.005));
  assert.equal(blocking.length,0,`landing center ${x},${y},${z} has authored body clearance`);
 }
 const boundary=collision.brushes.filter(b=>b.type==='boundary');assert.ok(boundary.length>30);
 for(const b of boundary)assert.equal(b.blocksShots,false);
});

test('Every landing region, chest and supply crate has a visible source floor at its collision height',async()=>{
 const {loadPlatformMap,platformLayout}=await import('../public/platform23-map.js');await loadPlatformMap();const world=platformLayout(),triangles=[];
 for(const p of primitives){const q=new Uint16Array(binary,p.position.offset,p.position.length),index=new Uint16Array(binary,p.index.offset,p.index.length),pos=i=>[0,1,2].map(k=>p.min[k]+q[i*3+k]/65535*p.span[k]);for(let i=0;i<index.length;i+=3)triangles.push([pos(index[i]),pos(index[i+1]),pos(index[i+2])]);}
 for(const point of [...world.pois,...world.chests,...world.resources]){
  const visible=triangles.some(([a,b,c])=>{const denominator=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(denominator)<1e-9)return false;const u=((b[2]-c[2])*(point.x-c[0])+(c[0]-b[0])*(point.z-c[2]))/denominator,v=((c[2]-a[2])*(point.x-c[0])+(a[0]-c[0])*(point.z-c[2]))/denominator,w=1-u-v;return Math.min(u,v,w)>=-1e-6&&Math.abs(u*a[1]+v*b[1]+w*c[1]-point.y)<.05;});
  assert.equal(visible,true,point.name||point.id);
 }
});

test('rectangular 9 by 3 source patches retain their smooth longitudinal surface',()=>{
 const p=collision.patches.find(p=>p.source===17),expected=[68.890625,9.890625,26.25];
 assert.ok(p);let found=false;for(let i=0;i<p.positions.length;i+=3)if(expected.every((v,k)=>Math.abs(v-p.positions[i+k])<1e-6))found=true;
 assert.equal(found,true,'Bezier midpoint uses the authored 9 outer columns and 3 inner rows');
});
