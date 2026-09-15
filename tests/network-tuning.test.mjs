import test from 'node:test';
import assert from 'node:assert/strict';

const tuning=await import('../public/network-tuning.js').catch(()=>({}));

test('adaptive cadence stays under the Supabase Free Realtime event ceiling',()=>{
 assert.equal(typeof tuning.networkCadence,'function');
 for(const players of [2,3,4,5,6,7,8]){
  const {inputMs,snapshotMs,helloMs,pingMs}=tuning.networkCadence(players);
  // Supabase counts both messages sent by clients and messages delivered to them.
  // The current private room topic therefore costs `players` events per broadcast.
  const gameplay=players*(players-1)*(1000/inputMs)+players*(1000/snapshotMs);
  const presence=players*players*(1000/helloMs);
  const roundRobinPing=2*players*(1000/pingMs);
  const eventsPerSecond=gameplay+presence+roundRobinPing;
  assert.ok(eventsPerSecond<=95,`${players} players would send ${eventsPerSecond.toFixed(1)} events/s`);
 }
 assert.ok(tuning.networkCadence(2).inputMs<=35);
 assert.ok(tuning.networkCadence(2).snapshotMs<=85);
});

test('network position smoothing blends normal updates and snaps teleports',()=>{
 assert.equal(typeof tuning.smoothPosition,'function');
 const blended=tuning.smoothPosition([0,0,0],[10,2,-4],.05);
 assert.ok(blended[0]>0&&blended[0]<10);
 assert.ok(blended[1]>0&&blended[1]<2);
 assert.deepEqual(tuning.smoothPosition([0,0,0],[100,2,0],.05),[100,2,0]);
 assert.deepEqual(tuning.smoothPosition(null,[4,5,6],.05),[4,5,6]);
});

test('angle smoothing takes the shortest path across the wrap boundary',()=>{
 assert.equal(typeof tuning.smoothAngle,'function');
 const from=Math.PI-.05,target=-Math.PI+.05,next=tuning.smoothAngle(from,target,.05);
 assert.ok(next>from&&next<Math.PI+.06,`expected a small forward turn, got ${next}`);
});

test('input accumulation preserves short action taps between network sends',()=>{
 assert.equal(typeof tuning.accumulateInput,'function');
 let pending=tuning.accumulateInput(null,{z:1,fire:true,jump:false,reload:false});
 pending=tuning.accumulateInput(pending,{z:0,fire:false,jump:true,reload:true});
 assert.equal(pending.z,0);
 assert.equal(pending.fire,true);
 assert.equal(pending.firePulse,true);
 assert.equal(pending.jump,true);
 assert.equal(pending.reload,true);
});

test('socket ownership rejects delayed events from replaced connections',()=>{
 assert.equal(typeof tuning.isActiveSocket,'function');
 const oldSocket={},currentSocket={},owner={socket:currentSocket,closed:false};
 assert.equal(tuning.isActiveSocket(owner,currentSocket),true);
 assert.equal(tuning.isActiveSocket(owner,oldSocket),false);
 owner.closed=true;assert.equal(tuning.isActiveSocket(owner,currentSocket),false);
});

test('spectator view selects a living player while preserving the local score owner',()=>{
 assert.equal(typeof tuning.selectViewPlayer,'function');
 const players=[{id:'self',hp:0},{id:'alive',hp:65},{id:'out',hp:0}];
 assert.equal(tuning.selectViewPlayer(players,'self').id,'alive');
 players[1].hp=0;
 assert.equal(tuning.selectViewPlayer(players,'self').id,'self');
});
