import test from 'node:test';
import assert from 'node:assert/strict';
import {Connection,SocialDirectory} from '../public/network.js';
import {sessionRefreshDelay} from '../public/connection-stability.js';

class FakeSocket{
 static instances=[];
 constructor(url){this.url=url;this.readyState=1;this.sent=[];FakeSocket.instances.push(this);}
 send(value){this.sent.push(value);}
 close(){this.readyState=3;}
}

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const join=async(conn,index)=>{
 const promise=conn.connect();
 const socket=FakeSocket.instances[index];
 socket.onopen?.();
 socket.onmessage?.({data:JSON.stringify({event:'phx_reply',ref:conn.joinRef,payload:{status:'ok',response:{}}})});
 await promise;
 return socket;
};

test('stale websocket callbacks cannot affect a newer live socket',async()=>{
 const previous=globalThis.WebSocket;
 globalThis.WebSocket=FakeSocket;
 try{
  const statuses=[],received=[];
  const conn=new Connection(message=>received.push(message),message=>statuses.push(message));
  conn.config={url:'https://example.supabase.co',key:'public-key'};
  conn.session={access_token:'token'};
  conn.room='room-id';
  conn.closed=false;
  const first=await join(conn,0);
  const second=await join(conn,1);
  assert.equal(conn.socket,second);
  assert.equal(conn.connected,true);
  first.onmessage?.({data:JSON.stringify({event:'broadcast',payload:{event:'duel',payload:{type:'hello',data:{name:'stale'},from:'old-peer'}}})});
  first.onerror?.(new Error('stale socket error'));
  first.onclose?.();
  assert.deepEqual(received,[]);
  assert.equal(conn.socket,second);
  assert.equal(conn.connected,true);
  assert.equal(statuses.at(-1),'Online · private party');
  conn.close();
 }finally{
  globalThis.WebSocket=previous;
  FakeSocket.instances.length=0;
 }
});

test('social offline and presence writes stay ordered across directory replacement',async()=>{
 const order=[],oldDirectory=new SocialDirectory(()=>{}),newDirectory=new SocialDirectory(()=>{});
 oldDirectory.session={access_token:'token'};newDirectory.session={access_token:'token'};
 oldDirectory.api=async()=>{await delay(20);order.push('offline');return true;};
 newDirectory.api=async()=>{order.push('presence');return {ok:true};};
 await Promise.all([
  oldDirectory.offline(),
  newDirectory.presence('Ranger','408faf','online',null)
 ]);
 assert.deepEqual(order,['offline','presence']);
});

test('session refresh is scheduled before expiry and retries quickly after a failure',()=>{
 const now=1_000_000;
 const expiresAtSeconds=(now+60*60*1000)/1000;
 const normal=sessionRefreshDelay({expires_at:expiresAtSeconds},now,0);
 assert.ok(normal>=30*60*1000&&normal<=35*60*1000);
 assert.equal(sessionRefreshDelay({expires_at:expiresAtSeconds},now,1),15_000);
 assert.equal(sessionRefreshDelay({expires_at:expiresAtSeconds},now,2),30_000);
 assert.equal(sessionRefreshDelay({expires_at:expiresAtSeconds},now,5),120_000);
});
