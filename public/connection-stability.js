import {Connection,SocialDirectory} from './network.js';

let installed=false;

const serial=(owner,key,operation)=>{
 const previous=owner[key]||Promise.resolve();
 const next=previous.catch(()=>{}).then(operation);
 const chained=next.finally(()=>{if(owner[key]===chained)owner[key]=null;});
 owner[key]=chained;
 return chained;
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
 SocialDirectory.prototype.presence=function(...args){
  return serial(this,'__stablePresence',()=>originalPresence.apply(this,args));
 };
}

installConnectionStability();
