import {Connection} from './network.js';
import {networkCadence,smoothPosition} from './network-tuning.js';

const VALID_SLOTS=new Set([1,2,3,4,5,6]),ITEM_BY_SLOT={1:'ar',2:'shotgun',3:'smg',4:'sniper'};
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

export function cadenceForPlayers(count=2){const cadence=networkCadence(count);return {...cadence,heartbeatMs:cadence.helloMs};}
export function inputTransition(prev,next){if(!prev)return true;for(const key of ['x','z','slot','jump','sprint','aim','fire','reload','rotation'])if(prev[key]!==next[key])return true;return false;}
export function aimChanged(prev,next,threshold=.018){if(!prev)return true;return Math.abs(angleDelta(Number(next.yaw)||0,Number(prev.yaw)||0))>threshold||Math.abs((Number(next.pitch)||0)-(Number(prev.pitch)||0))>threshold||Math.abs(angleDelta(Number(next.aimYaw)||0,Number(prev.aimYaw)||0))>threshold||Math.abs((Number(next.aimPitch)||0)-(Number(prev.aimPitch)||0))>threshold;}
export function shouldForwardInput(prev,next,elapsed,cadence){if(!prev||inputTransition(prev,next))return true;if(aimChanged(prev,next)&&elapsed>=cadence.inputMs)return true;return elapsed>=cadence.heartbeatMs;}
export function smoothPoint(current,target,rate,dt){const t=1-Math.exp(-Math.max(0,rate)*Math.max(0,dt));return current.map((value,index)=>value+(target[index]-value)*t);}
export function isStaleSnapshotGap(seconds){return Number(seconds)>.75;}

let networkInstalled=false;
export function installNetworkStability(){
 if(networkInstalled)return;networkInstalled=true;const originalSend=Connection.prototype.send;
 Connection.prototype.send=function(type,data={},to=null){if(type==='snapshot'&&Array.isArray(data?.state?.events)&&data.state.events.length>10)data={...data,state:{...data.state,events:data.state.events.slice(-10)}};return originalSend.call(this,type,data,to);};
}

function installSlotPrediction(){
 const game=globalThis.window?.Game;if(!game||game.__slotPredictionInstalled)return false;game.__slotPredictionInstalled=true;
 const originalInput=game.input.bind(game),originalApply=game.apply.bind(game);let desiredSlot=VALID_SLOTS.has(originalInput()?.slot)?originalInput().slot:1;
 const sync=()=>queueMicrotask(()=>{const selected=originalInput()?.slot;if(VALID_SLOTS.has(selected))desiredSlot=selected;});
 document.addEventListener('keydown',sync);document.addEventListener('click',sync);document.addEventListener('wheel',sync,{passive:true});
 game.input=()=>{const input=originalInput();input.slot=desiredSlot;return input;};
 game.apply=(snapshot,id,colors,dt)=>{if(!snapshot?.players?.length)return originalApply(snapshot,id,colors,dt);const players=snapshot.players.map(player=>{if(player.id!==id||player.slot===desiredSlot)return player;return {...player,slot:desiredSlot,weapon:ITEM_BY_SLOT[desiredSlot]||player.weapon,building:!ITEM_BY_SLOT[desiredSlot]};});return originalApply({...snapshot,players},id,colors,dt);};
 return true;
}

let booted=false;
export function installMultiplayerStability(){if(booted)return;booted=true;installNetworkStability();if(typeof window==='undefined')return;const boot=()=>{if(!installSlotPrediction())requestAnimationFrame(boot);};boot();}
if(typeof window!=='undefined')installMultiplayerStability();
