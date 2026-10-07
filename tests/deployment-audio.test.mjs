import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeploymentAudio} from '../public/deployment-audio.js';

function context(){
 const starts=[],stops=[],sources=[];let decodes=0;
 const ctx={currentTime:10,state:'running',destination:{},decodeAudioData:async()=>{decodes++;return {duration:28};},createBufferSource:()=>{const source={connect(){},disconnect(){},start(...args){starts.push(args);},stop(...args){stops.push(args);}};sources.push(source);return source;},createGain:()=>({connect(){},disconnect(){},gain:{value:0,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){}}})};
 return {ctx,starts,stops,sources,get decodes(){return decodes;}};
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

test('resuming after suspension seeks the current cue even without animation frames during suspension',async()=>{
 const c=context(),events=new EventTarget();c.ctx.addEventListener=events.addEventListener.bind(events);
 const player=createDeploymentAudio({fetchAudio});await player.load(c.ctx);player.update(c.ctx,'round:1',5);
 c.ctx.currentTime=10.35;c.ctx.state='suspended';events.dispatchEvent(new Event('statechange'));
 assert.deepEqual(c.stops,[[10.35]],'a frozen voice must stop immediately so it cannot play behind the camera on resume');
 c.ctx.state='running';events.dispatchEvent(new Event('statechange'));c.ctx.currentTime=10.4;
 assert.equal(player.update(c.ctx,'round:1',6.6),6.6);
 assert.deepEqual(c.starts,[[10,5],[10.4,6.6]]);
 c.ctx.currentTime=10.9;assert.ok(Math.abs(player.update(c.ctx,'round:1',5)-7.1)<1e-9,'stale snapshots stay ignored after the recovery seek');
});

test('a suspended update cancels a scheduled voice before its future start',async()=>{
 const c=context(),player=createDeploymentAudio({fetchAudio});await player.load(c.ctx);player.update(c.ctx,'round:1',-2);
 c.ctx.state='suspended';assert.equal(player.update(c.ctx,'round:1',-1),null);
 assert.deepEqual(c.stops,[[10]],'a cancelled future voice cannot burst into playback when the browser resumes');
 c.ctx.state='running';assert.equal(player.update(c.ctx,'round:1',1),1);assert.deepEqual(c.starts,[[12,0],[10,1]]);
});

test('leaving while the browser is suspended keeps its cancelled sequence stopped after resume',async()=>{
 const c=context(),events=new EventTarget();c.ctx.addEventListener=events.addEventListener.bind(events);
 const player=createDeploymentAudio({fetchAudio});await player.load(c.ctx);player.update(c.ctx,'round:1',5);
 c.ctx.state='suspended';events.dispatchEvent(new Event('statechange'));player.stop(c.ctx);
 c.ctx.state='running';events.dispatchEvent(new Event('statechange'));
 assert.equal(player.update(c.ctx,'round:1',7),null);assert.equal(c.starts.length,1);
 assert.equal(player.update(c.ctx,'round:2',0),0);assert.equal(c.starts.length,2);
});

test('music timing follows audible output when the browser supplies a valid output timestamp',async()=>{
 const c=context(),player=createDeploymentAudio({fetchAudio});await player.load(c.ctx);
 c.ctx.getOutputTimestamp=()=>({contextTime:c.ctx.currentTime-.032,performanceTime:performance.now()});
 assert.ok(Math.abs(player.update(c.ctx,'round:1',5)-4.968)<.001,'the camera must wait for the rendered audio to reach the speaker');
 c.ctx.currentTime=11;
 assert.ok(Math.abs(player.update(c.ctx,'round:1',0)-5.968)<.001);
 c.ctx.getOutputTimestamp=()=>({contextTime:0,performanceTime:0});
 assert.equal(player.update(c.ctx,'round:1',0),6,'uninitialized browser timestamps retain the render-clock fallback');
});

test('a deployment first observed after the song ends cannot be restarted by a stale snapshot',async()=>{
 const c=context(),player=createDeploymentAudio({fetchAudio});await player.load(c.ctx);
 assert.equal(player.update(c.ctx,'round:1',34),null);
 assert.equal(player.update(c.ctx,'round:1',10),null,'a completed song stays completed even if a reconnect delivers an older snapshot');
 assert.equal(c.starts.length,0);
 assert.equal(player.update(c.ctx,'round:2',0),0);assert.equal(c.starts.length,1);
});

test('delayed decoding starts at the latest cue without scheduling duplicate voices',async()=>{
 const c=context();let finishDecode;
 c.ctx.decodeAudioData=()=>new Promise(resolve=>{finishDecode=resolve;});
 const player=createDeploymentAudio({fetchAudio}),ready=player.load(c.ctx);
 assert.equal(player.update(c.ctx,'round:1',-1),null);
 await new Promise(resolve=>setImmediate(resolve));
 c.ctx.currentTime=12.5;assert.equal(player.update(c.ctx,'round:1',2.5),null);assert.equal(c.starts.length,0);
 finishDecode({duration:28});assert.equal(await ready,true);
 assert.equal(player.update(c.ctx,'round:1',2.5),2.5);assert.deepEqual(c.starts,[[12.5,2.5]]);
 player.update(c.ctx,'round:1',2.5);assert.equal(c.starts.length,1);
});

test('ended callbacks from cancelled voices cannot finish a replacement deployment',async()=>{
 const c=context(),player=createDeploymentAudio({fetchAudio});await player.load(c.ctx);
 player.update(c.ctx,'round:1',-1);player.stop(c.ctx);player.update(c.ctx,'round:2',3);
 c.sources[0].onended();c.ctx.currentTime=11;
 assert.equal(player.update(c.ctx,'round:2',0),4);assert.equal(c.starts.length,2);
 c.sources[1].onended();assert.equal(player.update(c.ctx,'round:2',0),null);
 assert.equal(c.starts.length,2,'natural completion cannot be undone by stale snapshots');
});

test('audible output timestamps are projected to the current frame and bounded by render time',async()=>{
 const c=context(),player=createDeploymentAudio({fetchAudio});await player.load(c.ctx);
 c.ctx.getOutputTimestamp=()=>({contextTime:c.ctx.currentTime-.052,performanceTime:performance.now()-20});
 assert.ok(Math.abs(player.update(c.ctx,'round:1',5)-4.968)<.001);
 c.ctx.getOutputTimestamp=()=>({contextTime:c.ctx.currentTime+.1,performanceTime:performance.now()-20});
 assert.equal(player.update(c.ctx,'round:1',0),5,'a discontinuous device timestamp cannot advance beyond the rendered song');
 c.ctx.getOutputTimestamp=()=>({contextTime:NaN,performanceTime:performance.now()});
 assert.equal(player.update(c.ctx,'round:1',0),5);
});

test('device timestamp jitter cannot rewind the deployment camera clock',async()=>{
 const c=context(),player=createDeploymentAudio({fetchAudio});await player.load(c.ctx);
 c.ctx.getOutputTimestamp=()=>({contextTime:9.968,performanceTime:performance.now()});
 const first=player.update(c.ctx,'round:1',5);
 c.ctx.getOutputTimestamp=()=>({contextTime:9.960,performanceTime:performance.now()});
 assert.equal(player.update(c.ctx,'round:1',0),first,'a device timestamp refresh may hold the cue but must not move the camera backward');
 c.ctx.currentTime=10.1;c.ctx.getOutputTimestamp=()=>({contextTime:10.068,performanceTime:performance.now()});
 assert.ok(player.update(c.ctx,'round:1',0)>first,'the audible clock advances normally once the timestamp catches up');
});

test('read-only cue lookup follows the active voice without loading, scheduling or changing sequence',async()=>{
 const c=context(),player=createDeploymentAudio({fetchAudio});
 assert.equal(typeof player.time,'function');
 assert.equal(player.time(c.ctx,'round:1'),null);assert.equal(c.starts.length,0);assert.equal(c.decodes,0);
 await player.load(c.ctx);assert.equal(player.time(c.ctx,'round:1'),null);
 player.update(c.ctx,'round:1',5);c.ctx.currentTime=11;
 assert.equal(player.time(c.ctx,'round:1'),6);assert.equal(player.time(c.ctx,'round:2'),null);
 assert.equal(player.update(c.ctx,'round:1',0),6);assert.equal(c.starts.length,1);assert.equal(c.stops.length,0);
 c.ctx.state='suspended';assert.equal(player.time(c.ctx,'round:1'),null);assert.equal(c.stops.length,0,'lookup cannot change voice lifecycle');
 c.ctx.state='running';c.sources[0].onended();assert.equal(player.time(c.ctx,'round:1'),null);
 player.update(c.ctx,'round:2',3);assert.equal(player.time(c.ctx,'round:1'),null);assert.equal(player.time(c.ctx,'round:2'),3);
 assert.equal(c.starts.length,2);player.stop(c.ctx);assert.equal(player.time(c.ctx,'round:2'),null);
});

test('read-only cue lookup shares audible output timing and its monotonic guard',async()=>{
 const c=context(),player=createDeploymentAudio({fetchAudio});await player.load(c.ctx);
 assert.equal(typeof player.time,'function');
 c.ctx.getOutputTimestamp=()=>({contextTime:9.968,performanceTime:performance.now()});
 const first=player.update(c.ctx,'round:1',5);
 c.ctx.getOutputTimestamp=()=>({contextTime:9.960,performanceTime:performance.now()});
 assert.equal(player.time(c.ctx,'round:1'),first);
 c.ctx.currentTime=10.1;c.ctx.getOutputTimestamp=()=>({contextTime:10.068,performanceTime:performance.now()});
 assert.ok(Math.abs(player.time(c.ctx,'round:1')-5.068)<.001);assert.equal(c.starts.length,1);
});

test('the instrument riff is extended after impact without restarting the vocal intro',async()=>{
 const c=context(),player=createDeploymentAudio({fetchAudio});await player.load(c.ctx);
 assert.equal(player.update(c.ctx,'round:1',0),0);
 assert.equal(c.starts.length,1);
 c.ctx.currentTime+=26.2;
 assert.ok(player.update(c.ctx,'round:1',0)>26);
 assert.equal(c.starts.length,2,'the instrument loop starts only around touchdown');
 assert.equal(c.sources[1].loop,true);
 assert.ok(c.stops.length>=1,'the loop has a finite fade-out at gameplay start');
});
