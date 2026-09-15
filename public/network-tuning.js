const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Cadence is intentionally capped below Supabase Free's 100 events/s ceiling.
// The remaining budget covers presence hellos and host-only latency probes.
export function networkCadence(playerCount=2){
 const players=clamp(Math.floor(Number(playerCount)||2),2,8);
 const control={helloMs:3000,pingMs:1500};
 if(players===2)return {...control,inputMs:33,snapshotMs:80};
 if(players===3)return {...control,inputMs:110,snapshotMs:100};
 if(players===4)return {...control,inputMs:260,snapshotMs:200};
 if(players===5)return {...control,inputMs:400,snapshotMs:250};
 if(players===6)return {...control,inputMs:550,snapshotMs:350};
 if(players===7)return {...control,inputMs:850,snapshotMs:450};
 return {...control,inputMs:1250,snapshotMs:550};
}

export function smoothPosition(current,target,dt=.016,snapDistance=45){
 if(!Array.isArray(target)||target.length<3)return Array.isArray(current)?current.slice():[0,0,0];
 const next=target.slice(0,3).map(value=>Number.isFinite(value)?value:0);
 if(!Array.isArray(current)||current.length<3)return next;
 const from=current.slice(0,3).map((value,index)=>Number.isFinite(value)?value:next[index]);
 if(Math.hypot(next[0]-from[0],next[1]-from[1],next[2]-from[2])>snapDistance)return next;
 const blend=1-Math.exp(-12*clamp(Number(dt)||0,0,.1));
 return from.map((value,index)=>value+(next[index]-value)*blend);
}

const vector3=value=>Array.isArray(value)&&value.length>=3?value.slice(0,3).map(number=>Number.isFinite(number)?number:0):null;
const vectorLength=value=>Math.hypot(value[0],value[1],value[2]);
const limitVector=(value,limit)=>{const magnitude=vectorLength(value);return magnitude>limit?value.map(number=>number*limit/magnitude):value;};

// Advances rendering between authoritative snapshots without changing gameplay physics.
// Prediction is intentionally short and bounded so packet jitter stays smooth while
// collisions, damage, landing and final positions remain owned by the host simulation.
export function advanceMotionTrack(track,target,{dt=.016,state='landed',velocity=null,sampleId,maxPrediction=.12,snapDistance=45}={}){
 const sample=vector3(target)||[0,0,0],step=clamp(Number(dt)||0,0,.1),explicitVelocity=vector3(velocity);
 if(!track)return {sample,position:sample.slice(),velocity:limitVector(explicitVelocity||[0,0,0],48),age:0,state,sampleId};
 const priorSample=vector3(track.sample)||sample,priorPosition=vector3(track.position)||priorSample,priorState=track.state||state,sampleDelta=sample.map((number,index)=>number-priorSample[index]),freshPacket=sampleId!==undefined&&sampleId!==track.sampleId,changed=vectorLength(sampleDelta)>1e-5||state!==priorState||freshPacket,teleported=vectorLength(sample.map((number,index)=>number-priorPosition[index]))>snapDistance;
 let age=clamp(Number(track.age)||0,0,maxPrediction),motion=vector3(track.velocity)||[0,0,0],position=priorPosition;
 if(changed){
  const interval=Math.max(.016,age+step);
  if(state!==priorState&&!explicitVelocity)motion=[0,0,0];
  else motion=limitVector(explicitVelocity||sampleDelta.map(number=>number/interval),state==='landed'?14:48);
  age=0;
 }else age=Math.min(maxPrediction,age+step);
 if(explicitVelocity)motion=limitVector(explicitVelocity,48);
 const predicted=sample.map((number,index)=>number+motion[index]*age);
 if(teleported)position=sample.slice();else position=smoothPosition(position,predicted,step,snapDistance);
 return {sample,position,velocity:teleported&&!explicitVelocity?[0,0,0]:motion,age,state,sampleId};
}

export function smoothAngle(current,target,dt=.016){
 const from=Number.isFinite(current)?current:0,to=Number.isFinite(target)?target:from;
 const delta=Math.atan2(Math.sin(to-from),Math.cos(to-from));
 return from+delta*(1-Math.exp(-14*clamp(Number(dt)||0,0,.1)));
}

export function accumulateInput(pending,current={}){
 const fire=Boolean(current.fire||pending?.fire),firePulse=Boolean(pending?.firePulse||(pending?.fire&&!current.fire));
 return {...current,fire,firePulse,jump:Boolean(current.jump||pending?.jump),reload:Boolean(current.reload||pending?.reload)};
}

export function isActiveSocket(owner,socket){
 return Boolean(owner&&!owner.closed&&owner.socket===socket);
}

export function selectViewPlayer(players=[],localId){
 const self=players.find(player=>player.id===localId);
 if(!self)return null;
 return self.hp>0?self:(players.find(player=>player.hp>0&&player.id!==localId)||self);
}
