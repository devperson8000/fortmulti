import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('AR sample contains one short blast and a fading tail rather than the uploaded burst',async()=>{
 const wav=await readFile(new URL('../public/audio/ar-shot.wav',import.meta.url));
 assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');
 let format,data;
 for(let offset=12;offset+8<=wav.length;){const tag=wav.toString('ascii',offset,offset+4),size=wav.readUInt32LE(offset+4),chunk=wav.subarray(offset+8,offset+8+size);if(tag==='fmt ')format=chunk;if(tag==='data')data=chunk;offset+=8+size+(size%2);}
 assert.ok(format&&data,'valid PCM WAV');assert.equal(format.readUInt16LE(0),1);assert.equal(format.readUInt16LE(2),1);assert.equal(format.readUInt32LE(4),48000);assert.equal(format.readUInt16LE(14),16);
 const samples=Array.from({length:data.length/2},(_,n)=>data.readInt16LE(n*2)/32768);
 assert.equal(samples.length/48000,.3,'the entire 2.26-second burst must never be shipped as a shot');
 const energy=(start,end)=>samples.slice(start,end).reduce((sum,v)=>sum+v*v,0)/(end-start);
 assert.ok(energy(0,4800)>energy(7200,12000)*8,'single initial blast dominates the quieter decay');
 assert.ok(Math.max(...samples.map(Math.abs))<.85,'headroom for overlapping gunshots');
 assert.ok(Math.abs(samples[0])<.001&&Math.abs(samples.at(-1))<.001,'fade boundaries avoid playback clicks');
});
