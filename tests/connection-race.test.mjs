import test from 'node:test';
import assert from 'node:assert/strict';
import {Connection} from '../public/network.js';
import '../public/connection-stability.js';

class FakeSocket{
 static instances=[];
 constructor(url){this.url=url;this.readyState=1;this.sent=[];FakeSocket.instances.push(this);}
 send(value){this.sent.push(value);}
 close(){this.readyState=3;}
}

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
