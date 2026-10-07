import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WEAPON_PROFILES} from '../public/weapon-system.js';
import {reloadStage} from '../public/view-model.js';

async function samples(name){
 const wav=await readFile(new URL('../public/audio/'+name+'.wav',import.meta.url));let data;
 for(let offset=12;offset+8<=wav.length;){const tag=wav.toString('ascii',offset,offset+4),size=wav.readUInt32LE(offset+4);if(tag==='data')data=wav.subarray(offset+8,offset+8+size);offset+=8+size+(size%2);}
 assert.ok(data);return Array.from({length:data.length/2},(_,n)=>data.readInt16LE(n*2)/32768);
}
const energy=(a,start,end)=>a.slice(Math.round(start*48000),Math.round(end*48000)).reduce((sum,v)=>sum+v*v,0)/((end-start)*48000);
test('AR decay fades gradually over the longer tail',async()=>{
 const a=await samples('ar-shot');assert.equal(a.length/48000,.36);
 assert.ok(energy(a,.18,.23)>energy(a,.28,.33)*8,'tail grows quieter before ending');assert.ok(energy(a,.3,.36)<.00012,'last 60ms must already be quiet');
});
test('shotgun blast preserves its decay and excludes the separate reload sequence',async()=>{
 const a=await samples('shotgun-shot');assert.equal(a.length/48000,1.76);
 assert.ok(energy(a,.02,.2)>energy(a,1.4,1.7)*100,'blast decays into quiet rather than ending abruptly');assert.ok(Math.abs(a.at(-1))<.001);
});
test('shotgun reload mechanics fit the same duration and action phase as the animation',async()=>{
 const a=await samples('shotgun-reload'),p=WEAPON_PROFILES.shotgun;assert.equal(a.length/48000,p.reloadDuration);assert.equal(p.reloadDuration,2.7);
 assert.ok(energy(a,.1,.25)>.002&&energy(a,1.95,2.2)>.002,'opening mechanics and final pump both survive the edit');
 assert.equal(reloadStage(p,p.reloadDuration-2.1),'action','final strong pump sound aligns with pump animation');assert.ok(Math.abs(a[0])<.001&&Math.abs(a.at(-1))<.001);
});
