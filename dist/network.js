export const uid=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
const timeout=(p,ms,label)=>Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(Error(label)),ms))]);
const AUTH_STORE='sunny-auth-v3';
const readAuth=()=>{try{return typeof sessionStorage==='undefined'?null:JSON.parse(sessionStorage.getItem(AUTH_STORE)||'null');}catch{return null;}};
const saveAuth=s=>{try{if(typeof sessionStorage!=='undefined')sessionStorage.setItem(AUTH_STORE,JSON.stringify({access_token:s.access_token,refresh_token:s.refresh_token,user:s.user,expires_at:s.expires_at||0}));}catch{}};
const clearAuth=()=>{try{if(typeof sessionStorage!=='undefined')sessionStorage.removeItem(AUTH_STORE);}catch{}};
const cleanConfig=config=>({...config,url:(config?.url||'').replace(/\/$/,'')});
const validConfig=config=>/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config?.url||'')&&!!config?.key;
const friendlyError=j=>{
 const raw=String(j?.msg||j?.message||j?.error_description||j?.error||'Connection failed');
 if(/anonymous.*disabled|anonymous_provider_disabled/i.test(raw))return 'Supabase anonymous sign-ins are disabled. Enable Anonymous Sign-Ins in Supabase Authentication, then try again.';
 if(/2 players maximum|two players|old 1v1/i.test(raw))return 'Your Supabase project is still using the old room schema. Run the latest supabase.sql, then try again.';
 if(/room is full/i.test(raw))return 'That party is full (8 players maximum).';
 if(/host is offline/i.test(raw))return 'That party leader is offline. Ask them to create a new party.';
 if(/invite.*expired|not found/i.test(raw))return 'That invite expired or is no longer available.';
 return raw;
};

class SupabaseClient{
 constructor(onstatus=()=>{}){this.onstatus=onstatus;this.session=null;}
 configure(config){this.config=cleanConfig(config);if(!validConfig(this.config))throw Error('Online play needs Supabase configuration. Open Setup to connect your project.');}
 async api(path,data,{auth=true,keepalive=false}={}){
  const r=await fetch(this.config.url+path,{method:'POST',headers:{apikey:this.config.key,'Content-Type':'application/json',...(auth&&this.session?.access_token?{Authorization:'Bearer '+this.session.access_token}:{})},body:JSON.stringify(data??{}),signal:keepalive?undefined:AbortSignal.timeout(12000),keepalive});
  const raw=await r.text();let j={};try{j=raw?JSON.parse(raw):{};}catch{j={message:raw};}
  if(!r.ok)throw Error(friendlyError(j));return j;
 }
 async authenticate(){
  const saved=readAuth();
  if(saved?.access_token&&saved?.user&&Number(saved.expires_at||0)*1000>Date.now()+60000){this.session=saved;return this.session;}
  if(saved?.refresh_token){try{this.session=await this.api('/auth/v1/token?grant_type=refresh_token',{refresh_token:saved.refresh_token},{auth:false});saveAuth(this.session);return this.session;}catch{clearAuth();this.session=null;}}
  this.session=await this.api('/auth/v1/signup',{},{auth:false});saveAuth(this.session);return this.session;
 }
 async renewSession(){this.session=await this.api('/auth/v1/token?grant_type=refresh_token',{refresh_token:this.session.refresh_token},{auth:false});saveAuth(this.session);return this.session;}
}

export class SocialDirectory extends SupabaseClient{
 constructor(onstatus=()=>{}){super(onstatus);this.id='';this.local=false;this.localPeers=new Map();this.localInvites=[];this.profile={name:'Ranger',color:'408faf',activity:'online',roomCode:null};}
 async open(config,local=false){
  this.local=!!local;this.closed=false;
  if(this.local){
   this.id=uid();this.channel=new BroadcastChannel('sunny-social-v1');
   this.channel.onmessage=e=>this.receiveLocal(e.data);
   this.broadcast({kind:'query',from:this.id});
   return this;
  }
  this.configure(config);await this.authenticate();this.id=this.session.user.id;
  this.refresh=setInterval(()=>this.renewSession().catch(()=>{}),40*60*1000);
  return this;
 }
 broadcast(message){if(this.channel&&!this.closed)this.channel.postMessage(message);}
 receiveLocal(m){
  if(!m||m.from===this.id)return;
  if(m.kind==='query'){this.broadcast({kind:'presence',from:this.id,...this.profile,at:Date.now()});return;}
  if(m.kind==='presence'){this.localPeers.set(m.from,{id:m.from,display_name:String(m.name||'Ranger').slice(0,20),outfit_color:String(m.color||'408faf'),activity:m.activity||'online',room_code:m.roomCode||null,last_seen:Date.now()});return;}
  if(m.kind==='offline'){this.localPeers.delete(m.from);return;}
  if(m.kind==='invite'&&m.to===this.id){this.localInvites=this.localInvites.filter(v=>v.id!==m.id);this.localInvites.push({id:m.id,from_user:m.from,from_name:m.fromName,from_color:m.fromColor,room_code:m.roomCode,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+45000).toISOString()});}
 }
 async presence(name,color,activity='online',roomCode=null){
  this.profile={name:String(name||'Ranger').slice(0,20),color:String(color||'408faf'),activity,roomCode:roomCode||null};
  if(this.local){this.broadcast({kind:'presence',from:this.id,...this.profile,at:Date.now()});return {ok:true};}
  return this.api('/rest/v1/rpc/duel_presence_upsert',{display_name:this.profile.name,outfit_color:this.profile.color,activity_state:activity,room_code:roomCode||null});
 }
 async online(){
  if(this.local){const cutoff=Date.now()-16000;for(const [id,p] of this.localPeers)if(p.last_seen<cutoff)this.localPeers.delete(id);return [...this.localPeers.values()];}
  const result=await this.api('/rest/v1/rpc/duel_online_players',{});return Array.isArray(result)?result:[];
 }
 async invites(){
  if(this.local){const now=Date.now();this.localInvites=this.localInvites.filter(v=>Date.parse(v.expires_at)>now);return [...this.localInvites];}
  const result=await this.api('/rest/v1/rpc/duel_invites',{});return Array.isArray(result)?result:[];
 }
 async invite(targetUser,roomCode,fromName='Ranger',fromColor='408faf'){
  if(this.local){const id=uid();this.broadcast({kind:'invite',id,from:this.id,to:targetUser,fromName,fromColor,roomCode});return {id};}
  return this.api('/rest/v1/rpc/duel_invite_send',{target_user:targetUser,invite_code:roomCode});
 }
 async respond(inviteId,accept){
  if(this.local){const invite=this.localInvites.find(v=>v.id===inviteId);this.localInvites=this.localInvites.filter(v=>v.id!==inviteId);if(!invite)throw Error('That invite expired or is no longer available.');return {accepted:!!accept,code:accept?invite.room_code:null};}
  return this.api('/rest/v1/rpc/duel_invite_respond',{invite_uuid:inviteId,accept_invite:!!accept});
 }
 async offline(){
  if(this.closed)return;
  if(this.local){this.broadcast({kind:'offline',from:this.id});return;}
  if(this.session?.access_token)await this.api('/rest/v1/rpc/duel_presence_offline',{}, {keepalive:true}).catch(()=>{});
 }
 close(){if(this.closed)return;this.offline();this.closed=true;clearInterval(this.refresh);this.channel?.close();}
}

export class Connection extends SupabaseClient{
 constructor(onmessage,onstatus){super(onstatus);this.onmessage=onmessage;this.id=uid();this.ref=0;this.closed=false;this.connected=false;this.retry=0;this.maxPlayers=8;}
 async open(config,code,create,local=false){
  this.config=cleanConfig(config);this.local=!!local;this.closed=false;
  if(this.local){this.id=uid();this.code=create?uid().slice(0,10).toUpperCase():String(code||'').toUpperCase();this.host=create?this.id:null;this.channel=new BroadcastChannel('sunny-party-'+this.code);this.channel.onmessage=e=>this.onmessage(e.data);this.connected=true;this.memberCount=1;this.onstatus('Local test · party connected');return;}
  if(!validConfig(this.config))throw Error('Online play needs Supabase configuration. Open Setup, or use the same-browser test.');
  await this.authenticate();this.id=this.session.user.id;
  const room=await this.api('/rest/v1/rpc/duel_room',{invite:create?null:String(code||'').toUpperCase()});
  this.code=room.code;this.host=room.host;this.room=room.id;this.maxPlayers=room.max_players||8;this.memberCount=room.member_count||1;
  await this.connect();
  this.refresh=setInterval(()=>this.renew().catch(e=>this.onstatus(e.message)),40*60*1000);
  this.presence=setInterval(()=>this.touch().catch(()=>{}),20000);await this.touch().catch(()=>{});
 }
 async renew(){await this.renewSession();this.raw('access_token',{access_token:this.session.access_token});}
 async touch(){if(this.local||!this.room||this.closed)return;const r=await this.api('/rest/v1/rpc/duel_room_heartbeat',{room_uuid:this.room});if(r?.host)this.host=r.host;if(Number.isFinite(r?.member_count))this.memberCount=r.member_count;}
 release(){if(this.local||!this.room||!this.session?.access_token)return Promise.resolve();return this.api('/rest/v1/rpc/duel_room_leave',{room_uuid:this.room},{keepalive:true}).catch(()=>{});}
 async connect(){
  if(this.closed)return;this.connected=false;this.onstatus(this.retry?'Reconnecting…':'Connecting to private party…');
  const socket=new WebSocket(this.config.url.replace('https:','wss:')+'/realtime/v1/websocket?apikey='+encodeURIComponent(this.config.key)+'&vsn=1.0.0');this.socket=socket;this.topic='realtime:duel:'+this.room;this.joinRef=String(++this.ref);
  await timeout(new Promise((resolve,reject)=>{
   let settled=false;
   const fail=e=>{if(settled)return;settled=true;reject(e);};
   socket.onopen=()=>this.raw('phx_join',{config:{broadcast:{ack:false,self:false},presence:{enabled:false},private:true},access_token:this.session.access_token},this.joinRef);
   socket.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}if(m.event==='phx_reply'&&m.ref===this.joinRef){if(m.payload.status!=='ok'){fail(Error(m.payload.response?.reason||'Room authorization failed. Run the latest supabase.sql.'));socket.close();return;}if(!settled){settled=true;this.connected=true;this.retry=0;this.onstatus('Online · private party');resolve();}}if(m.event==='broadcast'&&m.payload.event==='duel')this.onmessage(m.payload.payload);if(m.event==='phx_error')socket.close();};
   socket.onerror=()=>fail(Error('Could not reach the room service.'));
   socket.onclose=()=>{clearInterval(this.heartbeat);this.connected=false;if(!this.closed){this.onstatus('Connection lost · reconnecting');clearTimeout(this.reconnect);this.reconnect=setTimeout(()=>this.connect().catch(e=>this.onstatus(e.message)),Math.min(10000,1000*2**this.retry++));}};
  }),12000,'Room connection timed out.');
  clearInterval(this.heartbeat);this.heartbeat=setInterval(()=>{if(socket.readyState===1)socket.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:String(++this.ref)}));},20000);
 }
 raw(event,payload,ref){if(this.socket?.readyState===1)this.socket.send(JSON.stringify({topic:this.topic,event,payload,ref:ref||String(++this.ref),join_ref:this.joinRef}));}
 send(type,data={},to=null){if(!this.connected)return;const msg={type,data,from:this.id,...(to?{to}:{})};if(this.local)this.channel.postMessage(msg);else this.raw('broadcast',{type:'broadcast',event:'duel',payload:msg});}
 close(){if(this.closed)return;this.send('leave');this.release();this.closed=true;this.connected=false;clearInterval(this.heartbeat);clearInterval(this.refresh);clearInterval(this.presence);clearTimeout(this.reconnect);this.channel?.close();this.socket?.close();}
}

export class Voice{
 constructor(send,report=()=>{}){this.send=send;this.report=report;this.pending=new Map();this.pcs=new Map();this.audios=new Map();this.retries=new Map();this.localId='';this.muted=false;this.speaking=false;}
 state(message,tone='idle'){
  const states=[...this.pcs.values()].map(v=>v.connectionState),connected=states.filter(s=>s==='connected').length,connecting=states.filter(s=>s==='new'||s==='connecting').length;
  this.report({message,tone,connected,connecting,total:this.pcs.size,speaking:this.speaking,muted:this.muted,enabled:!!this.stream});
 }
 async enable(localId,peerIds=[]){
  if(this.stream){await this.audioContext?.resume?.();this.sync(localId,peerIds);return;}
  try{this.localId=localId;this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false});this.muted=false;this.startMeter();this.sync(localId,peerIds);this.state(peerIds.length?'Connecting secure party voice…':'Microphone ready · waiting for party','connecting');}catch(e){this.stop(false);throw e;}
 }
 startMeter(){
  const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx||!this.stream)return;
  try{this.audioContext=new AudioCtx();this.meterSource=this.audioContext.createMediaStreamSource(this.stream);this.analyser=this.audioContext.createAnalyser();this.analyser.fftSize=512;this.analyser.smoothingTimeConstant=.72;this.meterSource.connect(this.analyser);const samples=new Uint8Array(this.analyser.fftSize);let last=false,lastReport=0;
   const measure=now=>{if(!this.stream||!this.analyser)return;this.analyser.getByteTimeDomainData(samples);let power=0;for(const value of samples){const n=(value-128)/128;power+=n*n;}const speaking=!this.muted&&Math.sqrt(power/samples.length)>.035;if(speaking!==last||now-lastReport>1200){last=speaking;lastReport=now;this.speaking=speaking;this.state(speaking?'Speaking…':this.connectionMessage(),speaking?'speaking':'ready');}this.meterFrame=requestAnimationFrame(measure);};this.meterFrame=requestAnimationFrame(measure);
  }catch{}
 }
 connectionMessage(){const states=[...this.pcs.values()].map(v=>v.connectionState),connected=states.filter(s=>s==='connected').length;if(this.muted)return 'Microphone muted';if(connected)return `Party voice · ${connected} connected`;if(states.some(s=>s==='failed'))return 'Voice link blocked · check firewall or TURN setup';if(states.some(s=>s==='connecting'||s==='new'))return 'Connecting secure party voice…';return 'Microphone ready · waiting for party';}
 sync(localId,peerIds=[]){this.localId=localId||this.localId;if(!this.stream)return;const wanted=new Set(peerIds.filter(Boolean));for(const id of [...this.pcs.keys()])if(!wanted.has(id))this.remove(id);for(const id of wanted)this.ensure(id);}
 ensure(id){
  if(!id||id===this.localId||this.pcs.has(id)||!this.stream)return this.pcs.get(id);
  const configured=Array.isArray(window.SUNNY_CONFIG?.iceServers)?window.SUNNY_CONFIG.iceServers:[],pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},...configured]});this.pcs.set(id,pc);this.pending.set(id,[]);this.stream.getAudioTracks().forEach(t=>pc.addTrack(t,this.stream));
  pc.onicecandidate=e=>{if(e.candidate)this.send(id,{candidate:e.candidate.toJSON?.()||e.candidate});};
  pc.ontrack=e=>{let audio=this.audios.get(id);if(!audio){audio=new Audio();audio.autoplay=true;audio.playsInline=true;this.audios.set(id,audio);}audio.srcObject=e.streams[0]||new MediaStream([e.track]);audio.play().catch(()=>this.state('Voice connected · click MIC ON to allow audio','warning'));};
  pc.onconnectionstatechange=()=>{const state=pc.connectionState;if(state==='connected'){clearTimeout(this.retries.get(id));this.retries.delete(id);this.state(this.connectionMessage(),'ready');}else if(state==='failed'){this.state(this.connectionMessage(),'warning');this.reconnect(id);}else if(state==='connecting'||state==='new')this.state(this.connectionMessage(),'connecting');};
  if(this.localId<id)queueMicrotask(()=>this.offer(id).catch(()=>this.reconnect(id)));return pc;
 }
 reconnect(id){if(this.retries.has(id)||!this.stream)return;const timer=setTimeout(()=>{this.retries.delete(id);if(!this.stream||!this.pcs.has(id))return;this.remove(id,false);const pc=this.ensure(id);if(pc&&this.localId<id)this.offer(id).catch(()=>{});},1400);this.retries.set(id,timer);}
 async offer(id){const pc=this.ensure(id);if(!pc||pc.signalingState!=='stable')return;await pc.setLocalDescription(await pc.createOffer());this.send(id,{description:pc.localDescription});}
 async receive(from,m){if(!this.stream||!m||typeof m!=='object')return;const pc=this.ensure(from);if(!pc)return;if(m.description){if(!['offer','answer'].includes(m.description.type))return;if(m.description.type==='offer'&&pc.signalingState!=='stable'){try{await pc.setLocalDescription({type:'rollback'});}catch{}}await pc.setRemoteDescription(m.description);for(const c of this.pending.get(from)?.splice(0)||[])try{await pc.addIceCandidate(c);}catch{}if(m.description.type==='offer'){await pc.setLocalDescription(await pc.createAnswer());this.send(from,{description:pc.localDescription});}}else if(m.candidate){if(pc.remoteDescription)await pc.addIceCandidate(m.candidate);else this.pending.get(from)?.push(m.candidate);}}
 remove(id,emit=true){clearTimeout(this.retries.get(id));this.retries.delete(id);const pc=this.pcs.get(id);pc?.close();this.pcs.delete(id);this.pending.delete(id);const audio=this.audios.get(id);if(audio){audio.pause?.();audio.srcObject=null;}this.audios.delete(id);if(emit&&this.stream)this.state(this.connectionMessage(),'ready');}
 mute(value=!this.muted){if(!this.stream)return false;this.muted=!!value;this.stream.getAudioTracks().forEach(t=>t.enabled=!this.muted);this.speaking=false;this.state(this.connectionMessage(),this.muted?'muted':'ready');return this.muted;}
 stop(emit=true){globalThis.cancelAnimationFrame?.(this.meterFrame);this.meterSource?.disconnect?.();this.analyser?.disconnect?.();this.audioContext?.close?.().catch?.(()=>{});this.audioContext=null;this.meterSource=null;this.analyser=null;this.stream?.getTracks().forEach(t=>t.stop());for(const id of [...this.pcs.keys()])this.remove(id,false);for(const timer of this.retries.values())clearTimeout(timer);this.retries.clear();this.pcs.clear();this.pending.clear();this.audios.clear();this.stream=null;this.muted=false;this.speaking=false;if(emit)this.state('Microphone off','off');}
}
