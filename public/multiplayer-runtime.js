import {Connection} from './network.js';
import {Match} from './simulation.js';

const VALID_SLOTS=new Set([1,2,3,4,5,6]);
const ITEM_BY_SLOT={1:'ar',2:'shotgun',3:'smg',4:'sniper'};
const stateByConnection=new WeakMap();
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const lerpAngle=(a,b,t)=>a+angleDelta(b,a)*t;
const nowMs=()=>typeof performance!=='undefined'?performance.now():Date.now();

export function cadenceForPlayers(count=2){
 const n=clamp(Math.round(Number(count)||2),2,8);
 if(n<=2)return {inputMs:80,snapshotMs:100,heartbeatMs:600};
 if(n===3)return {inputMs:110,snapshotMs:125,heartbeatMs:650};
 if(n===4)return {inputMs:200,snapshotMs:200,heartbeatMs:700};
 if(n===5)return {inputMs:300,snapshotMs:250,heartbeatMs:750};
 if(n===6)return {inputMs:500,snapshotMs:333,heartbeatMs:850};
 if(n===7)return {inputMs:600,snapshotMs:400,heartbeatMs:900};
 return {inputMs:800,snapshotMs:500,heartbeatMs:950};
}

export function inputTransition(prev,next){
 if(!prev)return true;
 for(const key of ['x','z','slot','jump','sprint','aim','fire','reload','rotation'])if(prev[key]!==next[key])return true;
 return false;
}

export function aimChanged(prev,next,threshold=.018){
 if(!prev)return true;
 return Math.abs(angleDelta(Number(next.yaw)||0,Number(prev.yaw)||0))>threshold||
  Math.abs((Number(next.pitch)||0)-(Number(prev.pitch)||0))>threshold||
  Math.abs(angleDelta(Number(next.aimYaw)||0,Number(prev.aimYaw)||0))>threshold||
  Math.abs((Number(next.aimPitch)||0)-(Number(prev.aimPitch)||0))>threshold;
}

export function shouldForwardInput(prev,next,elapsed,cadence){
 if(!prev||inputTransition(prev,next))return true;
 if(aimChanged(prev,next)&&elapsed>=cadence.inputMs)return true;
 return elapsed>=cadence.heartbeatMs;
}

export function smoothPoint(current,target,rate,dt){
 const t=1-Math.exp(-Math.max(0,rate)*Math.max(0,dt));
 return current.map((v,i)=>v+(target[i]-v)*t);
}

function connectionState(conn){
 let state=stateByConnection.get(conn);
 if(!state){state={lastInput:null,lastInputAt:-Infinity,lastSnapshotAt:-Infinity,lastHelloAt:-Infinity,lastHelloSig:'',pingAt:new Map()};stateByConnection.set(conn,state);}
 return state;
}

function partySize(conn,data){
 const fromState=Number(data?.state?.players?.length)||0;
 const fromUi=Number(globalThis.window?.Duel?.party?.length)||0;
 return clamp(fromState||fromUi||Number(conn.memberCount)||2,2,8);
}

let networkInstalled=false;
export function installNetworkStability(){
 if(networkInstalled)return;networkInstalled=true;
 const originalSend=Connection.prototype.send;
 Connection.prototype.send=function(type,data={},to=null){
  const state=connectionState(this),now=nowMs(),cadence=cadenceForPlayers(partySize(this,data));
  if(type==='input'){
   const next=data?.input||{},elapsed=now-state.lastInputAt;
   if(!shouldForwardInput(state.lastInput,next,elapsed,cadence))return;
   state.lastInput={...next};state.lastInputAt=now;
  }else if(type==='snapshot'){
   if(now-state.lastSnapshotAt<cadence.snapshotMs)return;
   state.lastSnapshotAt=now;
   if(Array.isArray(data?.state?.events)&&data.state.events.length>10)data={...data,state:{...data.state,events:data.state.events.slice(-10)}};
  }else if(type==='hello'){
   const sig=JSON.stringify([data?.name,data?.color,!!data?.ready,data?.host,data?.mode,data?.match,!!data?.voice,data?.maxPlayers]);
   if(sig===state.lastHelloSig&&now-state.lastHelloAt<3000)return;
   state.lastHelloSig=sig;state.lastHelloAt=now;
  }else if(type==='ping'){
   const key=String(to||'*'),last=state.pingAt.get(key)||-Infinity;
   if(now-last<4500)return;state.pingAt.set(key,now);
  }
  return originalSend.call(this,type,data,to);
 };
}

let simulationInstalled=false;
export function installSimulationGrace(){
 if(simulationInstalled)return;simulationInstalled=true;
 const originalInput=Match.prototype.input;
 Match.prototype.input=function(id,input){
  const result=originalInput.call(this,id,input),player=this.players?.find?.(p=>p.id===id);
  if(player)player.lastInput=Math.min(Number(player.lastInput)||0,-2.15);
  return result;
 };
}

function playerVelocity(player,track,localInput,isLocal,phase){
 if(['freefall','deploying','glider'].includes(player.air)&&Array.isArray(player.airVelocity))return player.airVelocity.map(Number);
 if(isLocal&&player.air==='landed'&&phase==='playing'&&localInput){
  const len=Math.hypot(localInput.x||0,localInput.z||0),scale=1/Math.max(1,len),speed=(localInput.sprint?9:6)*(localInput.aim?.58:1),yaw=Number(localInput.yaw)||0;
  return [(Math.cos(yaw)*(localInput.x||0)-Math.sin(yaw)*(localInput.z||0))*scale*speed,0,(-Math.sin(yaw)*(localInput.x||0)-Math.cos(yaw)*(localInput.z||0))*scale*speed];
 }
 return track.estimatedVelocity||[0,0,0];
}

function installGameSmoothing(){
 const game=globalThis.window?.Game;if(!game||game.__multiplayerStabilityInstalled)return false;
 game.__multiplayerStabilityInstalled=true;
 const originalInput=game.input.bind(game),originalApply=game.apply.bind(game);
 let desiredSlot=VALID_SLOTS.has(originalInput()?.slot)?originalInput().slot:1,lastSnapshot=null,lastSnapshotAt=nowMs(),lastFrameAt=lastSnapshotAt;
 const tracks=new Map();
 const syncDesired=()=>{const selected=originalInput()?.slot;if(VALID_SLOTS.has(selected))desiredSlot=selected;};
 const deferSync=()=>queueMicrotask(syncDesired);
 document.addEventListener('keydown',deferSync);
 document.addEventListener('click',deferSync);
 document.addEventListener('wheel',deferSync,{passive:true});
 game.input=()=>{const input=originalInput();input.slot=desiredSlot;return input;};
 game.apply=(snapshot,id,colors)=>{
  if(!snapshot?.players?.length)return originalApply(snapshot,id,colors);
  const now=nowMs(),dt=clamp((now-lastFrameAt)/1000,.001,.05),isNew=snapshot!==lastSnapshot,snapshotDt=clamp((now-lastSnapshotAt)/1000,.03,.6);lastFrameAt=now;
  const localInput=game.input();
  if(isNew){
   const live=new Set(snapshot.players.map(p=>p.id));for(const key of tracks.keys())if(!live.has(key))tracks.delete(key);
   for(const p of snapshot.players){
    let track=tracks.get(p.id),target=Array.isArray(p.p)?p.p.map(Number):[0,0,0];
    if(!track){track={render:target.slice(),target:target.slice(),previousTarget:target.slice(),estimatedVelocity:[0,0,0],yaw:Number(p.yaw)||0,airPitch:Number(p.airPitch)||0,airRoll:Number(p.airRoll)||0,diveBlend:Number(p.diveBlend)||0,deploy:Number(p.deploy)||0,updatedAt:now,air:p.air};tracks.set(p.id,track);}
    else{
     const previous=track.target.slice(),distance=Math.hypot(target[0]-previous[0],target[1]-previous[1],target[2]-previous[2]);
     track.previousTarget=previous;track.target=target;const estimate=target.map((v,i)=>(v-previous[i])/snapshotDt),horizontal=Math.hypot(estimate[0],estimate[2]);if(horizontal>12){const scale=12/horizontal;estimate[0]*=scale;estimate[2]*=scale;}estimate[1]=clamp(estimate[1],-24,24);track.estimatedVelocity=estimate;track.updatedAt=now;
     if(distance>28||p.air==='bus'||(track.air!==p.air&&['landed','bus'].includes(p.air))){track.render=target.slice();track.estimatedVelocity=[0,0,0];}
     track.air=p.air;
    }
   }
   lastSnapshot=snapshot;lastSnapshotAt=now;
  }
  const renderedPlayers=snapshot.players.map(p=>{
   const track=tracks.get(p.id);if(!track)return p;
   const isLocal=p.id===id,age=clamp((now-track.updatedAt)/1000,0,.2),velocity=playerVelocity(p,track,localInput,isLocal,snapshot.phase),prediction=isLocal?.92:.72,predicted=track.target.map((v,i)=>v+(Number(velocity[i])||0)*age*prediction),rate=isLocal?22:14;
   track.render=smoothPoint(track.render,predicted,rate,dt);
   if(p.air==='landed')track.render[1]=track.render[1]+((track.target[1]||0)-track.render[1])*(1-Math.exp(-24*dt));
   const yawTarget=isLocal&&p.air!=='landed'?Number(localInput.yaw)||Number(p.yaw)||0:Number(p.yaw)||0;track.yaw=lerpAngle(track.yaw,yawTarget,1-Math.exp(-(isLocal?18:12)*dt));
   for(const [key,rate2] of [['airPitch',12],['airRoll',12],['diveBlend',10],['deploy',10]])track[key]=(Number(track[key])||0)+((Number(p[key])||0)-(Number(track[key])||0))*(1-Math.exp(-rate2*dt));
   const patched={...p,p:track.render.slice(),yaw:track.yaw,airPitch:track.airPitch,airRoll:track.airRoll,diveBlend:track.diveBlend,deploy:track.deploy};
   if(isLocal&&VALID_SLOTS.has(desiredSlot)&&p.slot!==desiredSlot){patched.slot=desiredSlot;if(ITEM_BY_SLOT[desiredSlot]){patched.weapon=ITEM_BY_SLOT[desiredSlot];patched.building=false;}else patched.building=true;}
   return patched;
  });
  return originalApply({...snapshot,players:renderedPlayers},id,colors);
 };
 return true;
}

let booted=false;
export function installMultiplayerStability(){
 if(booted)return;booted=true;installNetworkStability();installSimulationGrace();
 if(typeof window==='undefined')return;
 const boot=()=>{if(!installGameSmoothing())requestAnimationFrame(boot);};boot();
}

if(typeof window!=='undefined')installMultiplayerStability();
