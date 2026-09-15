import {Connection,SocialDirectory} from './network.js';

let installed=false,socialWriteQueue=Promise.resolve();
const REFRESH_MIN_MS=30_000,REFRESH_MAX_MS=35*60_000,REFRESH_EARLY_MS=5*60_000,PRESENCE_HEARTBEAT_MS=10_000;
const socialPresenceState=new WeakMap(),socialReadState=new WeakMap();

const queueSocialWrite=operation=>{
 const run=socialWriteQueue.catch(()=>{}).then(operation);
 socialWriteQueue=run.catch(()=>{});
 return run;
};

export function sessionRefreshDelay(session,now=Date.now(),failures=0){
 if(failures>0)return Math.min(120_000,15_000*2**Math.min(failures-1,3));
 const expiresAt=Number(session?.expires_at||0)*1000;
 if(!Number.isFinite(expiresAt)||expiresAt<=0)return REFRESH_MAX_MS;
 return Math.max(REFRESH_MIN_MS,Math.min(REFRESH_MAX_MS,expiresAt-now-REFRESH_EARLY_MS));
}

const installRefreshLoop=(owner,renew,report=()=>{})=>{
 clearTimeout(owner.refresh);clearInterval(owner.refresh);
 let failures=0;
 const run=async()=>{
  if(owner.closed||owner.local)return;
  try{await renew();failures=0;}catch(error){failures++;report(error);}
  if(!owner.closed&&!owner.local)owner.refresh=setTimeout(run,sessionRefreshDelay(owner.session,Date.now(),failures));
 };
 owner.refresh=setTimeout(run,sessionRefreshDelay(owner.session));
};

const guardSocketCallbacks=(owner,socket)=>{
 if(!socket||socket.__sunnyLifecycleGuard)return;
 for(const key of ['onopen','onmessage','onerror','onclose']){
  const handler=socket[key];
  if(typeof handler!=='function')continue;
  socket[key]=(event)=>{
   if(owner.socket!==socket||owner.closed)return;
   return handler.call(socket,event);
  };
 }
 socket.__sunnyLifecycleGuard=true;
};

const matchRunning=()=>globalThis.window?.Duel?.lobby===false;
const readState=directory=>{
 let state=socialReadState.get(directory);
 if(!state){state={online:[],invites:[]};socialReadState.set(directory,state);}
 return state;
};

export function installConnectionStability(){
 if(installed)return;installed=true;

 const originalConnect=Connection.prototype.connect;
 Connection.prototype.connect=function(...args){
  if(this.__stableConnect)return this.__stableConnect;
  clearTimeout(this.reconnect);this.reconnect=null;
  const run=(async()=>{
   const pending=originalConnect.apply(this,args);
   const socket=this.socket;
   guardSocketCallbacks(this,socket);
   const result=await pending;
   clearTimeout(this.reconnect);this.reconnect=null;
   return result;
  })();
  this.__stableConnect=run.finally(()=>{this.__stableConnect=null;});
  return this.__stableConnect;
 };

 const originalConnectionOpen=Connection.prototype.open;
 Connection.prototype.open=async function(...args){
  const result=await originalConnectionOpen.apply(this,args);
  if(!this.local)installRefreshLoop(this,()=>this.renew(),error=>this.onstatus?.(`Session refresh issue · retrying (${error?.message||'network error'})`));
  return result;
 };

 const originalTouch=Connection.prototype.touch;
 Connection.prototype.touch=function(...args){
  if(this.__stableTouch)return this.__stableTouch;
  const run=Promise.resolve().then(()=>originalTouch.apply(this,args));
  this.__stableTouch=run.finally(()=>{this.__stableTouch=null;});
  return this.__stableTouch;
 };

 const originalSocialOpen=SocialDirectory.prototype.open;
 SocialDirectory.prototype.open=async function(...args){
  const result=await originalSocialOpen.apply(this,args);
  if(!this.local)installRefreshLoop(this,()=>this.renewSession());
  return result;
 };

 const originalPresence=SocialDirectory.prototype.presence;
 const originalOffline=SocialDirectory.prototype.offline;
 const originalOnline=SocialDirectory.prototype.online;
 const originalInvites=SocialDirectory.prototype.invites;
 SocialDirectory.prototype.presence=function(...args){
  if(this.local)return originalPresence.apply(this,args);
  const signature=JSON.stringify(args),now=Date.now(),previous=socialPresenceState.get(this);
  if(previous?.signature===signature){
   if(previous.promise)return previous.promise;
   if(now-previous.at<PRESENCE_HEARTBEAT_MS)return Promise.resolve({ok:true,cached:true});
  }
  const promise=queueSocialWrite(()=>originalPresence.apply(this,args));
  socialPresenceState.set(this,{signature,at:now,promise});
  return promise.then(result=>{socialPresenceState.set(this,{signature,at:Date.now(),promise:null});return result;},error=>{socialPresenceState.delete(this);throw error;});
 };
 SocialDirectory.prototype.offline=function(...args){
  if(this.local)return originalOffline.apply(this,args);
  if(this.closed||!this.session?.access_token)return Promise.resolve();
  socialPresenceState.delete(this);
  return queueSocialWrite(()=>this.api('/rest/v1/rpc/duel_presence_offline',{}, {keepalive:true}).catch(()=>{}));
 };
 SocialDirectory.prototype.online=function(...args){
  if(this.local)return originalOnline.apply(this,args);
  const state=readState(this);if(matchRunning())return Promise.resolve([...state.online]);
  return Promise.resolve(originalOnline.apply(this,args)).then(result=>{state.online=Array.isArray(result)?result:[];return result;});
 };
 SocialDirectory.prototype.invites=function(...args){
  if(this.local)return originalInvites.apply(this,args);
  const state=readState(this);if(matchRunning())return Promise.resolve([...state.invites]);
  return Promise.resolve(originalInvites.apply(this,args)).then(result=>{state.invites=Array.isArray(result)?result:[];return result;});
 };
}

installConnectionStability();
