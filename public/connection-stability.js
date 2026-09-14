import {Connection,SocialDirectory} from './network.js';

let installed=false,socialWriteQueue=Promise.resolve();

const queueSocialWrite=operation=>{
 const run=socialWriteQueue.catch(()=>{}).then(operation);
 socialWriteQueue=run.catch(()=>{});
 return run;
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

 const originalTouch=Connection.prototype.touch;
 Connection.prototype.touch=function(...args){
  if(this.__stableTouch)return this.__stableTouch;
  const run=Promise.resolve().then(()=>originalTouch.apply(this,args));
  this.__stableTouch=run.finally(()=>{this.__stableTouch=null;});
  return this.__stableTouch;
 };

 const originalPresence=SocialDirectory.prototype.presence;
 const originalOffline=SocialDirectory.prototype.offline;
 SocialDirectory.prototype.presence=function(...args){
  if(this.local)return originalPresence.apply(this,args);
  return queueSocialWrite(()=>originalPresence.apply(this,args));
 };
 SocialDirectory.prototype.offline=function(...args){
  if(this.local)return originalOffline.apply(this,args);
  if(this.closed||!this.session?.access_token)return Promise.resolve();
  return queueSocialWrite(()=>this.api('/rest/v1/rpc/duel_presence_offline',{}, {keepalive:true}).catch(()=>{}));
 };
}

installConnectionStability();
