import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeploymentAudio} from '../public/deployment-audio.js';

function context(){
 const starts=[],stops=[];let decodes=0;
 const ctx={currentTime:10,state:'running',destination:{},decodeAudioData:async()=>{decodes++;return {duration:28};},createBufferSource:()=>({connect(){},disconnect(){},start(...args){starts.push(args);},stop(...args){stops.push(args);}}),createGain:()=>({connect(){},disconnect(){},gain:{value:0,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){}}})};
 return {ctx,starts,stops,get decodes(){return decodes;}};
}
const fetchAudio=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});

test('one music source per deployment, scheduled from black onset, follows the audio clock',async()=>{
 const c=context(),player=createDeploymentAudio({fetchAudio});await player.load(c.ctx);
 assert.equal(player.update(c.ctx,'round:1',-1),-1);
 assert.deepEqual(c.starts,[[11,0]]);
 c.ctx.currentTime=15;
 assert.equal(player.update(c.ctx,'round:1',1),4,'stale snapshots cannot restart or rewind the song');
 assert.equal(c.starts.length,1);
 assert.equal(c.decodes,1);
 player.stop(c.ctx);
 assert.equal(c.stops.length,1);
 assert.equal(player.update(c.ctx,'round:1',5),null,'leaving cannot restart the cancelled sequence');
 assert.equal(c.starts.length,1);
});

test('late join seeks to the current cue and a rematch plays a fresh source',async()=>{
 const c=context(),player=createDeploymentAudio({fetchAudio});await player.load(c.ctx);
 assert.equal(player.update(c.ctx,'round:1',20),20);
 assert.deepEqual(c.starts,[[10,20]]);
 player.update(c.ctx,'round:2',0);
 assert.equal(c.starts.length,2);
 assert.equal(c.stops.length,1);
 player.reset(c.ctx);player.update(c.ctx,'round:2',0);
 assert.equal(c.starts.length,3,'a new full match may reuse a sequence ID');
});

test('unavailable or suspended audio safely leaves animation on the multiplayer clock',async()=>{
 const c=context(),player=createDeploymentAudio({fetchAudio:async()=>{throw Error('offline');}});
 assert.equal(await player.load(c.ctx),false);
 assert.equal(player.update(c.ctx,'1',5),null);
 assert.equal(c.starts.length,0);
 const good=createDeploymentAudio({fetchAudio});await good.load(c.ctx);c.ctx.state='suspended';
 assert.equal(good.update(c.ctx,'1',5),null);assert.equal(c.starts.length,0);
});
