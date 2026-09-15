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
