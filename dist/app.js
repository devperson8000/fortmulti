import './engine.js';
import {Connection,Voice,SocialDirectory,uid} from './network.js';
import {Match,placement,validBuild} from './simulation.js';
import {orderPartyProfiles} from './lobby-state.js';

const $=id=>document.getElementById(id),game=window.Game;
let conn=null,peers=new Map(),host=false,ready=false,match=null,snapshot=null,matchId='',seenEvent=0,lastHello=0,lastSnap=0,busy=false,voiceWanted=false,muted=false,showMenu=false,enteredLocal=false,entered=new Set();
let social=null,onlinePlayers=[],incomingInvites=[],socialBusy=false,socialTimer=null,socialError='',lastStatusAt=0,latencies=new Map();

const readStore=k=>{try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;}};
const writeStore=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}};
let config={...window.SUNNY_CONFIG,...(readStore('duel-config')||{})},profile=readStore('duel-profile')||{name:'Ranger',color:'408faf'};
$('name').value=profile.name;$('outfit').value=profile.color;

const cleanName=v=>String(v||'Ranger').trim().replace(/\s+/g,' ').slice(0,20)||'Ranger';
const cleanColor=v=>/^[0-9a-f]{6}$/i.test(v||'')?v:'408faf';
const activePeers=()=>[...peers.values()].filter(p=>Date.now()-p.lastSeen<14000);
const playerName=id=>id===conn?.id?profile.name:(peers.get(id)?.name||'Player');
const colors=()=>Object.fromEntries([[conn?.id,profile.color],...activePeers().map(p=>[p.id,p.color])]);
const participantIds=()=>{if(!conn)return[];const ids=[conn.id,...activePeers().map(p=>p.id)],leader=conn.host||conn.id;return [leader,...ids.filter(id=>id!==leader).sort()].slice(0,conn.maxPlayers||8);};
const inMatch=()=>!!(match||snapshot)&&!window.Duel?.lobby;
const currentActivity=()=>inMatch()?'match':conn?'party':'online';
const validOnlineConfig=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test((config.url||'').replace(/\/$/,''))&&!!config.key;

function status(text,tone='normal'){
 const el=$('connection');el.textContent=text;el.dataset.tone=tone;lastStatusAt=Date.now();
}
function say(name,text,system=false){
 const row=document.createElement('p'),b=document.createElement('b');b.textContent=name+(system?' · ':': ');row.append(b,document.createTextNode(text));if(system)row.className='system-message';$('messages').append(row);while($('messages').children.length>80)$('messages').firstChild.remove();$('messages').scrollTop=$('messages').scrollHeight;
}

const voice=new Voice((to,data)=>conn?.send('voice',data,to),t=>$('voice-status').textContent=t);
const voicePeerIds=()=>activePeers().filter(p=>p.voice).map(p=>p.id);
function syncVoice(){if(voiceWanted&&conn)voice.sync(conn.id,voicePeerIds());}

function partyProfiles(){
 if(!conn)return[{id:'local-preview',name:profile.name,color:profile.color,ready:false,self:true,host:true}];
 const all=[{id:conn.id,name:profile.name,color:profile.color,ready,self:true,host:conn.host===conn.id},...activePeers().map(p=>({...p,self:false,host:p.id===conn.host}))];
 // The local player always owns the central hero platform, even when joining somebody else's party.
 return orderPartyProfiles(all);
}
function drawPartyCards(){
 const grid=$('party-grid');grid.textContent='';const party=partyProfiles(),max=conn?.maxPlayers||8;$('party-count').textContent=`${party.length} / ${max}`;
 for(let i=0;i<max;i++){
  const p=party[i],card=document.createElement('div');card.className='party-card'+(p?.ready?' ready':'')+(p?.host?' host':'')+(p?.self?' self':'')+(!p?' empty':'');
  const avatar=document.createElement('i'),copy=document.createElement('span'),name=document.createElement('b'),state=document.createElement('small');
  if(p){avatar.style.setProperty('--outfit','#'+p.color);name.textContent=p.name+(p.self?' · YOU':'');state.textContent=p.host?(p.ready?'PARTY LEADER · READY':'PARTY LEADER'):(p.ready?'READY':'NOT READY');}
  else{name.textContent='OPEN PARTY SLOT';state.textContent='INVITE FROM ONLINE PLAYERS';card.tabIndex=0;card.onclick=()=>focusOnline();card.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')focusOnline();};}
  copy.append(name,state);card.append(avatar,copy);grid.append(card);
 }
 const partyCount=party.length,readyCount=party.filter(p=>p.ready).length;
 $('party-summary').textContent=conn?(partyCount<2?'Invite at least one player to begin.':`${readyCount}/${partyCount} ready · ${host?'You are party leader':'Waiting for party leader'}`):'Create a party or invite someone who is online.';
}
function renderOnlinePlayers(){
 const list=$('online-list');list.textContent='';$('online-count').textContent=String(onlinePlayers.filter(p=>p&&p.id).length);
 if(socialError){list.innerHTML='<div class="empty-online"><b>Party finder unavailable</b><span></span><button id="open-setup-inline">OPEN SETUP</button></div>';list.querySelector('span').textContent=socialError;$('open-setup-inline').onclick=openSetup;return;}
 if($('local').checked&&social&&!onlinePlayers.length){list.innerHTML='<div class="empty-online"><b>Waiting for another tab…</b><span>Open this game in another tab with Same-browser test enabled.</span></div>';return;}
 if(!$('local').checked&&!validOnlineConfig()){list.innerHTML='<div class="empty-online"><b>Online play needs setup</b><span>Add your Supabase URL and publishable key, then run the latest supabase.sql.</span><button id="open-setup-inline">OPEN SETUP</button></div>';$('open-setup-inline').onclick=openSetup;return;}
 const partyIds=new Set([conn?.id,...activePeers().map(p=>p.id)].filter(Boolean));
 const visible=onlinePlayers.filter(p=>p&&p.id);
 if(!visible.length){list.innerHTML='<div class="empty-online"><b>No other players online</b><span>Players appear here automatically while they have the lobby open.</span></div>';return;}
 for(const p of visible){
  const row=document.createElement('div');row.className='online-player';const avatar=document.createElement('i');avatar.style.setProperty('--outfit','#'+cleanColor(p.outfit_color));
  const info=document.createElement('span'),name=document.createElement('b'),state=document.createElement('small'),button=document.createElement('button');name.textContent=cleanName(p.display_name);const inParty=partyIds.has(p.id)||(!!conn&&p.room_code===conn.code),activity=p.activity||'online';state.textContent=inParty?'IN YOUR PARTY':activity==='match'?'IN MATCH':activity==='party'?'IN A PARTY':'ONLINE';
  button.textContent=inParty?'IN PARTY':activity==='match'?'BUSY':'INVITE';button.disabled=inParty||activity==='match'||inMatch()||busy||(conn&&partyProfiles().length>=(conn.maxPlayers||8));button.onclick=()=>invitePlayer(p.id,cleanName(p.display_name));info.append(name,state);row.append(avatar,info,button);list.append(row);
 }
}
function renderInvites(){
 const tray=$('invite-tray'),list=$('invite-list');list.textContent='';const now=Date.now();incomingInvites=incomingInvites.filter(v=>Date.parse(v.expires_at||0)>now);
 if(!incomingInvites.length){tray.hidden=true;return;}tray.hidden=false;
 for(const inv of incomingInvites){const card=document.createElement('div');card.className='invite-card';const top=document.createElement('div'),avatar=document.createElement('i'),text=document.createElement('span'),name=document.createElement('b'),sub=document.createElement('small'),actions=document.createElement('div'),accept=document.createElement('button'),decline=document.createElement('button');avatar.style.setProperty('--outfit','#'+cleanColor(inv.from_color));name.textContent=cleanName(inv.from_name);sub.textContent='invited you to their party';text.append(name,sub);top.append(avatar,text);accept.textContent='ACCEPT';accept.className='accept';accept.disabled=inMatch();decline.textContent='DECLINE';accept.onclick=()=>respondInvite(inv,true);decline.onclick=()=>respondInvite(inv,false);actions.append(accept,decline);card.append(top,actions);list.append(card);}
}
function updateNetworkChip(){
 const chip=$('net-ping');if(!conn){chip.textContent=social?'ONLINE · PARTY FINDER READY':'OFFLINE';return;}const vals=[...latencies.values()].filter(Number.isFinite);const ping=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null;chip.textContent=`${ping===null?'—':ping+' ms'} · ${partyProfiles().length} PLAYERS`;
}
function refresh(){
 const party=partyProfiles();window.Duel.myColor=profile.color;window.Duel.party=party;window.Duel.peerColors=colors();
 $('hero-name').textContent=profile.name;$('hero-state').textContent=ready?'READY':'NOT READY';$('hero-state').classList.toggle('ready',ready);
 $('ready').textContent=ready?'CANCEL READY':'READY UP';$('ready').disabled=!conn||party.length<2||!game||!!match;$('mode').disabled=(!!conn&&!host)||!!match;$('room-actions').hidden=!conn;$('connect').hidden=!!conn;
 if(conn){$('room-code').textContent=host?'PRIVATE PARTY · YOU ARE LEADER':'PRIVATE PARTY · MEMBER';$('invite-more').disabled=inMatch()||party.length>=(conn.maxPlayers||8);}
 $('outfit').disabled=inMatch();$('name').disabled=inMatch();$('local').disabled=!!conn;drawPartyCards();renderOnlinePlayers();renderInvites();updateNetworkChip();
}
function focusOnline(){const panel=$('social-panel');panel.classList.add('open','attention');panel.setAttribute('aria-hidden','false');$('social-scrim').hidden=false;setTimeout(()=>panel.classList.remove('attention'),800);}
function closeOnline(){const panel=$('social-panel');panel.classList.remove('open','attention');panel.setAttribute('aria-hidden','true');$('social-scrim').hidden=true;}
function toggleProfile(force){const open=force??!document.body.classList.contains('profile-open');document.body.classList.toggle('profile-open',open);$('profile-toggle').classList.toggle('active',open);}
function hello(){conn?.send('hello',{name:profile.name,color:profile.color,ready,host:conn.host||null,mode:$('mode').value,match:matchId,voice:voiceWanted,maxPlayers:conn.maxPlayers||8});}
function everyoneReady(){const party=partyProfiles();return party.length>=2&&party.every(p=>p.ready);}
function beginIfEntered(){if(host&&match?.phase==='waiting'&&match.ids.length>=2&&match.ids.every(id=>entered.has(id))){match.launchDrop();sendSnapshot();}}

async function updatePresence(){if(!social)return;try{await social.presence(profile.name,profile.color,currentActivity(),conn?.code||null);}catch(e){if(Date.now()-lastStatusAt>5000)status(e.message,'error');}}
async function pollSocial(){
 if(!social||socialBusy)return;socialBusy=true;
 try{await updatePresence();const [players,invites]=await Promise.all([social.online(),social.invites()]);onlinePlayers=players;incomingInvites=invites;renderOnlinePlayers();renderInvites();updateNetworkChip();}
 catch(e){if(Date.now()-lastStatusAt>6000)status(e.message,'error');}
 finally{socialBusy=false;}
}
async function startSocial(){
 clearInterval(socialTimer);social?.close();social=null;socialError='';onlinePlayers=[];incomingInvites=[];renderOnlinePlayers();renderInvites();
 const local=$('local').checked;if(!local&&!validOnlineConfig()){status('Online play is not configured yet. Open Setup to connect Supabase.');updateNetworkChip();return;}
 try{social=new SocialDirectory(()=>{});await social.open(config,local);await updatePresence();await pollSocial();socialTimer=setInterval(pollSocial,3500);status(local?'Local party finder ready · open another tab to test invites':'Online · choose a player to invite');}
 catch(e){social?.close();social=null;socialError=e.message;status(e.message,'error');renderOnlinePlayers();updateNetworkChip();}
}

async function connect(create,codeOverride=''){
 if(busy||conn)return false;busy=true;$('create').disabled=true;$('join').disabled=true;const candidate=new Connection(receive,status);
 try{
  profile.name=cleanName($('name').value);profile.color=cleanColor($('outfit').value);writeStore('duel-profile',profile);
  const raw=String(codeOverride||$('code').value||'').trim();const parsed=raw.includes('#')?raw.split('#').pop():raw;const code=parsed.toUpperCase();if(!create&&!/^[A-Z0-9]{8,12}$/.test(code))throw Error('That fallback party code is invalid.');
  await candidate.open(config,code,create,$('local').checked);conn=candidate;host=conn.id===conn.host;ready=false;peers.clear();latencies.clear();match=null;snapshot=null;refresh();hello();await updatePresence();
  status(create?(conn.local?'Party created · invite another local tab from Online Players':'Party created · invite players from the online list'):'Joining party…');return true;
 }catch(e){candidate.close();status(e.message,'error');return false;}
 finally{busy=false;$('create').disabled=false;$('join').disabled=false;refresh();}
}
async function invitePlayer(id,name){
 if(busy||inMatch())return;if(!social){status('Party finder is offline. Open Setup or enable Same-browser test.','error');return;}
 try{if(!conn){const ok=await connect(true);if(!ok)return;}if(partyProfiles().length>=(conn.maxPlayers||8)){status('Your party is already full.','error');return;}await social.invite(id,conn.code,profile.name,profile.color);status(`Invite sent to ${name}.`,'success');}
 catch(e){status(e.message,'error');}
}
async function respondInvite(inv,accept){
 if(!social||busy)return;
 try{const result=await social.respond(inv.id,accept);incomingInvites=incomingInvites.filter(v=>v.id!==inv.id);if(!accept){status(`Declined ${cleanName(inv.from_name)}'s invite.`);renderInvites();return;}if(inMatch()){status('Finish or leave your current match before switching parties.','error');return;}if(conn)leave('Switching parties…',true);const ok=await connect(false,result.code||inv.room_code);if(ok)status(`Joined ${cleanName(inv.from_name)}'s party.`,'success');}
 catch(e){status(e.message,'error');}
 finally{renderInvites();refresh();}
}

function resetMatchState(){match=null;snapshot=null;matchId='';seenEvent=0;showMenu=false;enteredLocal=false;entered=new Set();$('enter-match').hidden=true;$('match-actions').hidden=true;$('round-banner').textContent='';window.Duel.lobby=true;document.body.classList.remove('dropping');document.body.classList.add('in-lobby','menu');$('lobby').hidden=false;game?.clear();document.exitPointerLock?.();}
function leave(reason='Party left. Invite someone online to start another.',quiet=false){const wasHost=host;conn?.close();conn=null;peers.clear();latencies.clear();host=false;ready=false;resetMatchState();voice.stop();voiceWanted=false;muted=false;$('voice').textContent='VOICE OFF';$('voice-status').textContent='Microphone off';refresh();updatePresence();if(!quiet)status(reason);if(wasHost&&!quiet)say('Party','Party closed.',true);}
function resetToLobby(broadcast=false){if(broadcast&&host)conn?.send('lobby');resetMatchState();ready=false;for(const p of peers.values())p.ready=false;hello();refresh();updatePresence();status(host?'Party lobby · ready up when everyone is ready':'Party lobby · waiting for the leader');}
function start(){if(!game||!host||match||!everyoneReady())return;const ids=participantIds();if(ids.length<2)return;match=new Match(game.world,ids,$('mode').value);matchId=uid();seenEvent=0;ready=false;for(const p of peers.values())p.ready=false;enteredLocal=false;entered=new Set();sendSnapshot();updatePresence();status('Match prepared · everyone must enter the drop.','success');}
function sendSnapshot(){if(!match||!host)return;const data={id:matchId,state:match.snapshot()};conn.send('snapshot',data);apply(data);}
function roundBanner(s){const me=s.players.find(p=>p.id===conn.id);if(s.phase==='waiting')return enteredLocal?'WAITING FOR THE PARTY':'ENTER THE DROP WHEN READY';if(s.phase==='bus'||s.phase==='drop'){if(me?.air==='bus')return `SKYLINER CROSSING · ${Math.ceil(s.timer||0)}s · SPACE TO JUMP`;if(me?.air==='freefall')return 'FREEFALL · SPACE TO OPEN CANOPY';if(me?.air==='deploying')return `CANOPY OPENING · ${Math.round((me.deploy||0)*100)}%`;if(me?.air==='glider')return 'CANOPY DEPLOYED · STEER TO YOUR LANDING';return 'LANDED · WAITING FOR THE PARTY';}if(s.phase==='countdown')return `ROUND ${s.round} · ${Math.max(1,Math.ceil(s.timer))}`;if(s.phase==='roundover'){if(s.winner<0)return 'ROUND DRAW';const winner=s.players[s.winner];return winner?.id===conn.id?'ROUND WON':`${playerName(winner?.id)} WON THE ROUND`;}if(s.phase==='paused')return 'CONNECTION INTERRUPTED · HOLDING MATCH';if(s.phase==='done'){const champ=s.scores.findIndex(n=>n>=s.targetScore),winner=champ>=0?s.players[champ]:s.players[s.winner];return winner?.id===conn.id?'VICTORY':`${playerName(winner?.id)} WINS THE MATCH`;}if(me?.hp<=0)return 'ELIMINATED · SPECTATING';return '';}
function apply(data){
 if(!data?.state?.players||data.state.players.length<1||data.state.players.length>8||!conn)return;const s=data.state;if(!s.players.some(p=>p.id===conn.id))return;const fresh=matchId!==data.id||!snapshot;matchId=data.id;snapshot=s;window.Duel.lobby=false;document.body.classList.remove('in-lobby','menu');document.body.classList.toggle('dropping',s.phase==='bus'||s.phase==='drop');$('lobby').hidden=true;
 if(fresh||window.Duel.round!==s.round){const me=s.players.find(p=>p.id===conn.id);game.look(me?.yaw||0);seenEvent=0;window.Duel.round=s.round;showMenu=false;$('match-actions').hidden=true;updatePresence();}
 $('enter-match').hidden=s.phase!=='waiting'||enteredLocal;$('round-banner').textContent=roundBanner(s);for(const e of s.events||[])if(e.id>seenEvent){game.effect(e,conn.id);seenEvent=e.id;}
 if(s.phase==='done'){showMenu=true;$('match-actions').hidden=false;$('resume').hidden=true;$('rematch').hidden=false;$('back-lobby').hidden=false;document.exitPointerLock?.();}else if(!showMenu)$('match-actions').hidden=true;refresh();
}
function removePeer(id,reason='left the party'){
 const p=peers.get(id);if(!p)return;peers.delete(id);latencies.delete(id);voice.remove(id);entered.delete(id);
 if(host&&match?.ids.includes(id)){match.disconnect(id);if(participantIds().length<2){resetToLobby(true);status('Not enough players remain. Returned to the party lobby.');}else if(match.phase==='waiting'){beginIfEntered();sendSnapshot();}}
 say('Party',`${p.name} ${reason}.`,true);refresh();
}
function receive(m){
 if(!conn||!m||m.from===conn.id||typeof m.type!=='string'||(m.to&&m.to!==conn.id))return;const d=m.data||{};
 if(m.type==='hello'){
  const known=peers.has(m.from);if(host&&!known&&peers.size>=((conn.maxPlayers||8)-1)){conn.send('full',{},m.from);return;}if(host&&match&&!match.ids.includes(m.from)){conn.send('locked',{},m.from);return;}
  if(!conn.host&&d.host===m.from){conn.host=m.from;host=false;}
  const old=peers.get(m.from),peer={id:m.from,name:cleanName(d.name),color:cleanColor(d.color),ready:!!d.ready,voice:!!d.voice,lastSeen:Date.now()};peers.set(m.from,peer);
  if(m.from===conn.host&&['build','town'].includes(d.mode)&&$('mode').value!==d.mode){$('mode').value=d.mode;ready=false;}
  if(!known)say('Party',`${peer.name} joined the party.`,true);refresh();syncVoice();if(host)start();return;
 }
 if(m.type==='full'){leave('That party is full (8 players maximum).');return;}
 if(m.type==='locked'){leave('That party is already in a match. Ask for another invite when they return to the lobby.');return;}
 const peer=peers.get(m.from);if(peer)peer.lastSeen=Date.now();
 if(m.type==='snapshot'){if(m.from===conn.host&&!host)apply(d);return;}
 if(m.type==='input'&&host&&match&&d.id===matchId&&match.ids.includes(m.from)){match.input(m.from,d.input);return;}
 if(m.type==='entered'&&host&&match&&d.id===matchId&&match.ids.includes(m.from)){entered.add(m.from);beginIfEntered();return;}
 if(m.type==='chat'&&peer&&typeof d.text==='string'){say(peer.name,d.text.slice(0,200));return;}
 if(m.type==='leave'){if(m.from===conn.host&&!host){leave('The party leader left, so the party was closed.');return;}removePeer(m.from);return;}
 if(m.type==='lobby'&&m.from===conn.host&&!host){resetToLobby(false);return;}
 if(m.type==='lobby-request'&&host){resetToLobby(true);return;}
 if(m.type==='mode'&&m.from===conn.host&&!host&&['build','town'].includes(d.mode)){if($('mode').value!==d.mode){$('mode').value=d.mode;ready=false;hello();refresh();status('Party leader changed the match mode · ready up again.');}return;}
 if(m.type==='voice'&&peer){if(typeof d.enabled==='boolean'){peer.voice=d.enabled;if(!d.enabled)voice.remove(m.from);syncVoice();refresh();}else voice.receive(m.from,d).catch(e=>$('voice-status').textContent=e.message);return;}
 if(m.type==='ping'){conn.send('pong',{time:d.time},m.from);return;}
 if(m.type==='pong'&&Number.isFinite(d.time)){latencies.set(m.from,Math.max(0,Date.now()-d.time));updateNetworkChip();}
}

window.Duel={active:true,lobby:true,round:0,myColor:profile.color,party:partyProfiles(),peerColors:{},menu(){game.clear();if(this.lobby)return;showMenu=true;$('match-actions').hidden=false;$('resume').hidden=false;$('rematch').hidden=snapshot?.phase!=='done';$('back-lobby').hidden=false;document.exitPointerLock?.();},preview(){const p=game.pose(),i=game.input();return placement(p,i,game.world);},valid(s){return !!snapshot&&validBuild(s,snapshot.structures,snapshot.players,game.world);},render(){if(snapshot&&conn)game.apply(snapshot,conn.id,colors());}};

$('create').onclick=()=>connect(true);
$('join').onclick=()=>connect(false);
$('leave').onclick=$('forfeit').onclick=()=>leave();
$('invite-more').onclick=focusOnline;
$('open-online').onclick=$('social-toggle').onclick=$('footer-social').onclick=focusOnline;
$('social-close').onclick=$('social-scrim').onclick=closeOnline;
$('profile-toggle').onclick=()=>toggleProfile();$('profile-close').onclick=()=>toggleProfile(false);
$('online-refresh').onclick=()=>social?pollSocial():startSocial();
$('ready').onclick=()=>{if(!conn||match)return;ready=!ready;game?.startAudio();hello();refresh();if(host)start();};
$('name').onchange=$('name').onblur=()=>{profile.name=cleanName($('name').value);$('name').value=profile.name;writeStore('duel-profile',profile);ready=false;hello();refresh();updatePresence();};
$('outfit').onchange=()=>{profile.color=cleanColor($('outfit').value);writeStore('duel-profile',profile);ready=false;hello();refresh();updatePresence();};
$('mode').onchange=()=>{if(!host&&conn)return;ready=false;for(const p of peers.values())p.ready=false;if(conn)conn.send('mode',{mode:$('mode').value});hello();refresh();status('Match mode changed · everyone needs to ready up again.');};
$('copy').onclick=async()=>{if(!conn)return;try{await navigator.clipboard.writeText(conn.code);status('Fallback party code copied.');}catch{status(`Fallback code: ${conn.code}`);}};
$('enter-match').onclick=()=>{if(!snapshot||snapshot.phase!=='waiting')return;enteredLocal=true;$('enter-match').hidden=true;game.startAudio();game.capture();if(host){entered.add(conn.id);beginIfEntered();}else conn.send('entered',{id:matchId});};
$('resume').onclick=()=>{showMenu=false;$('match-actions').hidden=true;game.capture();};
$('rematch').onclick=$('back-lobby').onclick=()=>{if(host)resetToLobby(true);else conn?.send('lobby-request');};
$('chat-form').onsubmit=e=>{e.preventDefault();const text=$('message').value.trim();if(!text||!conn||peers.size<1)return;conn.send('chat',{text});say(profile.name,text);$('message').value='';};
$('chat-toggle').onclick=()=>{$('chat-content').hidden=!$('chat-content').hidden;$('chat-toggle').textContent=$('chat-content').hidden?'+':'−';};
$('footer-chat').onclick=()=>{const hidden=$('chat-content').hidden;$('chat-content').hidden=!hidden;$('chat-toggle').textContent=hidden?'−':'+';};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('social-panel').classList.contains('open')){closeOnline();e.stopPropagation();}else if(e.key==='Escape'&&document.body.classList.contains('profile-open'))toggleProfile(false);},{capture:true});
$('voice').onclick=async()=>{if(!conn||peers.size<1){status('Invite at least one player before enabling voice.');return;}if(voiceWanted){muted=!muted;voice.mute();$('voice').textContent=muted?'MIC MUTED':'MIC ON';return;}try{await voice.enable(conn.id,voicePeerIds());voiceWanted=true;muted=false;conn.send('voice',{enabled:true});hello();syncVoice();$('voice').textContent='MIC ON';$('voice-status').textContent='Party voice enabled';}catch(e){$('voice-status').textContent='Microphone unavailable: '+e.message;}};
function openSetup(){$('service-url').value=config.url||'';$('service-key').value=config.key||'';$('setup').showModal();}
$('settings').onclick=openSetup;$('close-setup').onclick=()=>$('setup').close();
$('save-setup').onclick=async()=>{const url=$('service-url').value.trim().replace(/\/$/,''),key=$('service-key').value.trim();if(key.startsWith('sb_secret_')){status('Only a publishable key is allowed.','error');return;}if(key.startsWith('eyJ')){try{if(JSON.parse(atob(key.split('.')[1])).role==='service_role'){status('Do not use a service-role key.','error');return;}}catch{}}config={url,key};writeStore('duel-config',config);$('setup').close();status('Online settings saved. Connecting party finder…');await startSocial();};
$('local').onchange=()=>{if(conn){$('local').checked=!$('local').checked;return;}startSocial();};

const ping=document.createElement('span');ping.id='net-ping';ping.textContent='OFFLINE';document.querySelector('header').append(ping);
if(location.hash){$('code').value=location.hash.slice(1).toUpperCase();history.replaceState(null,'',location.pathname+location.search);}
if(new URLSearchParams(location.search).get('local')==='1')$('local').checked=true;
document.addEventListener('pointerlockchange',()=>{if(snapshot?.phase==='waiting'&&enteredLocal&&!document.pointerLockElement){enteredLocal=false;$('enter-match').hidden=false;}});
window.addEventListener('beforeunload',()=>{voice.stop();conn?.close();social?.close();});

let previous=performance.now();
setInterval(()=>{
 const now=performance.now(),dt=Math.min(.05,(now-previous)/1000);previous=now;if(!conn)return;
 if(now-lastHello>950){hello();lastHello=now;for(const p of activePeers())conn.send('ping',{time:Date.now()},p.id);}
 for(const p of [...peers.values()])if(Date.now()-p.lastSeen>19000){if(p.id===conn.host&&!host){leave('The party leader disconnected.');return;}removePeer(p.id,'disconnected');}
 if(match&&host){match.input(conn.id,showMenu?{}:game.input());match.tick(dt);if(now-lastSnap>66){sendSnapshot();lastSnap=now;}}
 else if(snapshot&&!host)conn.send('input',{id:matchId,input:showMenu?{}:game.input()},conn.host);
},33);

refresh();startSocial();
if(!game){const warning=document.createElement('div');warning.id='graphics-warning';warning.textContent='3D graphics are unavailable. Enable graphics acceleration in Chrome and restart it. Lobby, invites and chat are still available.';document.body.append(warning);}
