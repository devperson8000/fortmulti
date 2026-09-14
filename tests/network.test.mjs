import test from 'node:test';import assert from 'node:assert/strict';import {Connection,Voice} from '../public/network.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('four same-browser party connections share one room',async()=>{const inbox=[[],[],[],[]],clients=inbox.map((box)=>new Connection(m=>box.push(m),()=>{}));await clients[0].open({},'',true,true);for(let i=1;i<clients.length;i++)await clients[i].open({},clients[0].code,false,true);for(let i=0;i<clients.length;i++)clients[i].send('hello',{name:'P'+i});await delay(35);for(let i=0;i<clients.length;i++){assert.equal(inbox[i].filter(m=>m.type==='hello').length,3);assert.deepEqual(new Set(inbox[i].filter(m=>m.type==='hello').map(m=>m.data.name)),new Set(['P0','P1','P2','P3'].filter(n=>n!=='P'+i)));}clients.forEach(c=>c.close());});
test('target metadata survives the room broadcast for app-level routing',async()=>{let got=[];const host=new Connection(m=>got.push(m),()=>{}),guest=new Connection(()=>{},()=>{});await host.open({},'',true,true);await guest.open({},host.code,false,true);guest.send('ping',{time:1},host.id);await delay(25);assert.equal(got[0].to,host.id);assert.equal(got[0].from,guest.id);host.close();guest.close();});

test('voice mute state is explicit and cleanup stops microphone tracks',()=>{
 const reports=[],track={enabled:true,stopped:false,stop(){this.stopped=true;}},voice=new Voice(()=>{},state=>reports.push(state));
 voice.stream={getAudioTracks:()=>[track],getTracks:()=>[track]};
 assert.equal(voice.mute(true),true);assert.equal(track.enabled,false);assert.equal(reports.at(-1).muted,true);
 assert.equal(voice.mute(false),false);assert.equal(track.enabled,true);assert.equal(reports.at(-1).muted,false);
 voice.stop();assert.equal(track.stopped,true);assert.equal(reports.at(-1).enabled,false);assert.equal(reports.at(-1).tone,'off');
});

test('same-browser social directory discovers players and accepts party invites',async()=>{
 const {SocialDirectory}=await import('../public/network.js');
 const a=new SocialDirectory(()=>{}),b=new SocialDirectory(()=>{});
 await a.open({},true);await b.open({},true);
 await a.presence('Alpha','408faf','online');await b.presence('Bravo','dc8255','online');
 await delay(35);
 const online=await a.online();assert.ok(online.some(p=>p.id===b.id&&p.display_name==='Bravo'));
 await a.invite(b.id,'ABCDEF1234','Alpha','408faf');await delay(35);
 const invites=await b.invites();assert.equal(invites.length,1);assert.equal(invites[0].from_name,'Alpha');
 const accepted=await b.respond(invites[0].id,true);assert.equal(accepted.accepted,true);assert.equal(accepted.code,'ABCDEF1234');
 a.close();b.close();
});

test('accepted local invite joins the actual private party channel',async()=>{
 const {SocialDirectory}=await import('../public/network.js');
 const socialA=new SocialDirectory(()=>{}),socialB=new SocialDirectory(()=>{}),inA=[],inB=[];
 await socialA.open({},true);await socialB.open({},true);
 await socialA.presence('Leader','408faf','online');await socialB.presence('Guest','dc8255','online');
 const leader=new Connection(m=>inA.push(m),()=>{});await leader.open({},'',true,true);
 await socialA.presence('Leader','408faf','party',leader.code);await delay(20);
 await socialA.invite(socialB.id,leader.code,'Leader','408faf');await delay(20);
 const [invite]=await socialB.invites();const accepted=await socialB.respond(invite.id,true);
 const guest=new Connection(m=>inB.push(m),()=>{});await guest.open({},accepted.code,false,true);
 leader.send('hello',{name:'Leader'});guest.send('hello',{name:'Guest'});await delay(30);
 assert.equal(inA.some(m=>m.type==='hello'&&m.data.name==='Guest'),true);assert.equal(inB.some(m=>m.type==='hello'&&m.data.name==='Leader'),true);
 leader.close();guest.close();socialA.close();socialB.close();
});

test('eight same-browser clients can share one party without message loss',async()=>{
 const boxes=Array.from({length:8},()=>[]),clients=boxes.map(box=>new Connection(m=>box.push(m),()=>{}));
 await clients[0].open({},'',true,true);for(let i=1;i<8;i++)await clients[i].open({},clients[0].code,false,true);
 clients.forEach((c,i)=>c.send('hello',{name:'P'+i}));await delay(55);
 for(let i=0;i<8;i++)assert.equal(boxes[i].filter(m=>m.type==='hello').length,7);
 clients.forEach(c=>c.close());
});
