import {createEffectPool} from '../public/effect-pool.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {createBulletTracer,bulletTracerSegment,bulletVisualOrigin} from '../public/bullet-presentation.js';
test('tracers reach authoritative endpoints at every weapon range and never overshoot',()=>{
 for(const distance of [.05,5,91,110,180,300,900]){const start=[3,4,5],end=[3+distance*.6,4,5-distance*.8],effect=createBulletTracer(start,end,[1,1,1]);
 let previous=0;for(let age=0;age<=effect.maxLife+.01;age+=.002){effect.life=Math.max(0,effect.maxLife-age);const {tail,head}=bulletTracerSegment(effect),travel=Math.hypot(...head.map((v,i)=>v-start[i]));assert.ok(travel>=previous-1e-8&&travel<=distance+1e-8);assert.ok(Math.hypot(...head.map((v,i)=>v-tail[i]))<=1.50001);previous=travel;}
 effect.life=0;assert.ok(Math.hypot(...bulletTracerSegment(effect).head.map((v,i)=>v-end[i]))<1e-7);}
});
test('near cover cannot send the local tracer backwards from the displayed muzzle',()=>{
 const eye=[0,0,0],muzzle=[.2,-.2,-1],forward=[0,0,-1];assert.deepEqual(bulletVisualOrigin(eye,muzzle,[0,0,-.3],forward),eye);assert.deepEqual(bulletVisualOrigin(eye,muzzle,[0,0,-50],forward),muzzle);
});

test('pooled tracers preserve their speed and display the endpoint before expiration',()=>{
 const pool=createEffectPool(2),effect=pool.spawn(createBulletTracer([0,0,0],[0,0,-900],[1,1,1]));
 let reached=false;for(let n=0;n<30;n++){pool.update(1/60);pool.forEachActive(e=>{if(Math.abs(bulletTracerSegment(e).head[2]+900)<1e-6)reached=true;});}
 assert.ok(reached);assert.equal(pool.activeCount,0);
});
