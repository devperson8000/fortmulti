import {ISLAND_POIS,drawIslandMap,militaryLayout,islandRoadRibbon} from './island-map.js';
import {REACTOR_POIS,drawReactorMap} from './reactor-map.js';
import './engine.js';
import {Connection,Voice,SocialDirectory,uid} from './network.js';
import {Match,placement,validBuild} from './simulation.js';
import {lobbyTabState,orderPartyProfiles} from './lobby-state.js';
import {networkCadence,accumulateInput,acceptSnapshot} from './network-tuning.js';

const $=id=>document.getElementById(id),game=window.Game;
let conn=null,peers=new Map(),host=false,ready=false,match=null,snapshot=null,matchId='',seenEvent=0,lastHello=0,lastPing=0,pingCursor=0,lastSnap=0,lastInput=0,pendingInput=null,busy=false,voiceWanted=false,muted=false,showMenu=false,snapshotFrame=-1,matchEpoch=0;
let selectedMap='island',startingMatch=false,mapGeneration=0,pendingSnapshot=null,loadingSnapshot=false;
const validMap=id=>id==='island'||id==='facility';
const mapName=id=>id==='facility'?'REACTOR FACILITY':'IRONWOOD ISLAND';
let social=null,onlinePlayers=[],incomingInvites=[],socialBusy=false,socialTimer=null,socialError='',lastStatusAt=0,latencies=new Map();

const readStore=k=>{try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;}};
const writeStore=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}};
let config={...window.HORIZON_CONFIG,...(readStore('duel-config')||{})},profile=readStore('duel-profile')||{name:'Ranger',color:'408faf'};
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

let voiceState={message:'Microphone off',tone:'off',connected:0,enabled:false,muted:false,speaking:false};
function renderVoice(next={}){
 voiceState={...voiceState,...next};const button=$('voice'),box=$('chatbox');
 $('voice-status').textContent=voiceState.message||'Microphone off';$('voice-peers').textContent=String(voiceState.connected||0);
 $('voice-label').textContent=!voiceState.enabled?'VOICE OFF':voiceState.muted?'MIC MUTED':voiceState.speaking?'SPEAKING':'MIC ON';
 button.setAttribute('aria-pressed',String(!!voiceState.enabled&&!voiceState.muted));button.title=voiceState.enabled?'Click to mute or unmute':'Enable encrypted browser voice chat';
 for(const c of['voice-on','voice-muted','voice-speaking','voice-warning','voice-connecting'])box.classList.remove(c);
 if(voiceState.enabled)box.classList.add('voice-on');if(voiceState.muted)box.classList.add('voice-muted');if(voiceState.speaking)box.classList.add('voice-speaking');if(voiceState.tone==='warning')box.classList.add('voice-warning');if(voiceState.tone==='connecting')box.classList.add('voice-connecting');
}
const voice=new Voice((to,data)=>conn?.send('voice',data,to),renderVoice);
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
 $('hero-name').textContent=profile.name;$('character-preview-name').textContent=profile.name+' · CURRENT OUTFIT';$('hero-state').textContent=ready?'READY':'NOT READY';$('hero-state').classList.toggle('ready',ready);
 $('ready').textContent=startingMatch?'LOADING MAP…':ready?'CANCEL READY':'READY UP';$('ready').disabled=!conn||party.length<2||!game||!!match||startingMatch;
 $('map-choice').value=selectedMap;$('map-choice').disabled=(!!conn&&!host)||inMatch()||startingMatch;$('map-description').textContent=selectedMap==='facility'?'Armored reactor · exterior landing pads':'Open terrain · six military outposts';$('mode').disabled=(!!conn&&!host)||!!match||startingMatch;$('room-actions').hidden=!conn;$('connect').hidden=!!conn;
 if(conn){$('room-code').textContent=host?'PRIVATE PARTY · YOU ARE LEADER':'PRIVATE PARTY · MEMBER';$('invite-more').disabled=inMatch()||party.length>=(conn.maxPlayers||8);}
 $('outfit').disabled=inMatch();$('name').disabled=inMatch();$('local').disabled=!!conn;drawPartyCards();renderOnlinePlayers();renderInvites();updateNetworkChip();
}
function focusOnline(){const panel=$('social-panel');panel.classList.add('open','attention');panel.setAttribute('aria-hidden','false');$('social-scrim').hidden=false;setTimeout(()=>panel.classList.remove('attention'),800);}
function closeOnline(){const panel=$('social-panel');panel.classList.remove('open','attention');panel.setAttribute('aria-hidden','true');$('social-scrim').hidden=true;}
function selectLobbyTab(tab){
 const state=lobbyTabState(tab),tabs=[['lobby-play-toggle','play'],['profile-toggle','outfit'],['character-preview-toggle','character']];
 for(const[id,name]of tabs){const button=$(id),active=name===state.activeTab;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
 document.body.classList.toggle('profile-open',state.profileOpen);document.body.classList.toggle('character-preview-open',state.characterPreview);
 $('character-preview-panel').hidden=!state.characterPreview;if(window.Duel)window.Duel.characterPreview=state.characterPreview;
}
function toggleProfile(force){const open=force??!document.body.classList.contains('profile-open');selectLobbyTab(open?'outfit':'play');}
function hello(){conn?.send('hello',{name:profile.name,color:profile.color,ready,host:conn.host||null,mode:$('mode').value,mapId:selectedMap,match:matchId,voice:voiceWanted,maxPlayers:conn.maxPlayers||8});}
function everyoneReady(){const party=partyProfiles();return party.length>=2&&party.every(p=>p.ready);}

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

function resetMatchState(){mapGeneration++;pendingSnapshot=null;startingMatch=false;match=null;snapshot=null;matchId='';snapshotFrame=-1;seenEvent=0;lastSnap=0;lastInput=0;pendingInput=null;showMenu=false;$('match-actions').hidden=true;$('round-banner').textContent='';$('deployment-ui').hidden=true;window.Duel.lobby=true;selectLobbyTab('play');document.body.classList.remove('deployment','dropping','deployment-cinematic');document.body.classList.add('in-lobby','menu');$('lobby').hidden=false;game?.clear({resetInventory:true});document.exitPointerLock?.();}
function leave(reason='Party left. Invite someone online to start another.',quiet=false){const wasHost=host;conn?.close();conn=null;peers.clear();latencies.clear();host=false;ready=false;resetMatchState();voice.stop();voiceWanted=false;muted=false;refresh();updatePresence();if(!quiet)status(reason);if(wasHost&&!quiet)say('Party','Party closed.',true);}
function resetToLobby(broadcast=false){if(broadcast&&host)conn?.send('lobby');resetMatchState();ready=false;for(const p of peers.values())p.ready=false;hello();refresh();updatePresence();status(host?'Party lobby · ready up when everyone is ready':'Party lobby · waiting for the leader');}
async function start(){
 if(!game||!host||match||startingMatch||!everyoneReady())return;
 const connection=conn,generation=mapGeneration,mapId=selectedMap;startingMatch=true;refresh();
 try{
  status('Loading '+mapName(mapId)+' · preparing the map…');
  await game.setMap(mapId);
  if(conn!==connection||generation!==mapGeneration||!host||selectedMap!==mapId||!everyoneReady())return;
  const ids=participantIds();if(ids.length<2)return;
  match=new Match(game.world,ids,$('mode').value);match.beginDeployment();matchId=uid();matchEpoch=Math.max(Date.now(),matchEpoch+1);snapshotFrame=-1;seenEvent=0;ready=false;for(const p of peers.values())p.ready=false;sendSnapshot();updatePresence();status('Deployment ship secured · choose a landing zone and enter a pod.','success');
 }catch(e){ready=false;hello();status('Map could not load. Please ready up to try again.','error');}
 finally{startingMatch=false;refresh();}
}
function sendSnapshot(state=match?.snapshot()){if(!match||!host||!state)return;const data={id:matchId,epoch:matchEpoch,frame:snapshotFrame+1,mapId:selectedMap,state};conn.send('snapshot',data);apply(data);}
const landingPois=()=>selectedMap==='facility'?REACTOR_POIS:ISLAND_POIS;
const LANDING_ROADS=militaryLayout().roads.map(islandRoadRibbon);
function renderLandingMap(s,me){
 const LANDING_POIS=landingPois();renderLandingQuickPicks();
 const canvas=$('landing-map'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,pad=30,extent=selectedMap==='facility'?360:584,scaleX=(w-pad*2)/extent,scaleZ=(h-pad*2)/extent,map=(x,z)=>[w/2+x*scaleX,h/2+z*scaleZ];
 ctx.clearRect(0,0,w,h);const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#122d43');bg.addColorStop(1,'#081927');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 ctx.strokeStyle='#8dc0ce16';ctx.lineWidth=1;for(let i=0;i<=10;i++){const x=pad+i*(w-pad*2)/10,y=pad+i*(h-pad*2)/10;ctx.beginPath();ctx.moveTo(x,pad);ctx.lineTo(x,h-pad);ctx.stroke();ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-pad,y);ctx.stroke();}
 const [mx,my]=map(-320,-320);(selectedMap==='facility'?drawReactorMap:drawIslandMap)(ctx,mx,my,640*scaleX,640*scaleZ);
 ctx.strokeStyle='#acbba0';ctx.lineWidth=2;ctx.beginPath();for(const points of selectedMap==='facility'?[]:LANDING_ROADS)for(const [i,p] of points.entries()){const [x,y]=map(p.center[0],p.center[2]);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
 ctx.font='700 10px Arial';ctx.textAlign='center';ctx.textBaseline='bottom';
 for(const poi of LANDING_POIS){const [x,y]=map(poi.x,poi.z);ctx.beginPath();ctx.fillStyle='#ffe19a';ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#142b36';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#edf3e0';ctx.shadowColor='#061421';ctx.shadowBlur=4;ctx.fillText(poi.name,x,y-8);}
 const dest=window.Game?.landingChoice?.()||me?.destination;if(dest){const [x,y]=map(dest.x,dest.z);ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fillStyle='#60dafa55';ctx.fill();ctx.strokeStyle='#b8f8ff';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.moveTo(x-14,y);ctx.lineTo(x+14,y);ctx.moveTo(x,y-14);ctx.lineTo(x,y+14);ctx.stroke();}
 ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle='#d9edf0a0';ctx.font='700 9px Arial';ctx.fillText('N',w/2-4,8);ctx.fillText(mapName(selectedMap)+' · DROP GRID',14,h-19);
 const picked=dest&&LANDING_POIS.reduce((best,poi)=>Math.hypot(dest.x-poi.x,dest.z-poi.z)<best.distance?{poi,distance:Math.hypot(dest.x-poi.x,dest.z-poi.z)}:best,{poi:LANDING_POIS[0],distance:Infinity});$('landing-destination').textContent=dest?`${picked.poi.name} · ${Math.round(dest.x)}, ${Math.round(dest.z)}`:'SELECT A DROP ZONE';
 $('landing-roster').textContent=s.players.filter(p=>p.hp>0).map(p=>`${playerName(p.id)} · ${p.deploymentState==='pod_ready'||p.deploymentState==='both_ready'?'POD READY':p.destination?'DESTINATION SET':'CHOOSING'}`).join('   /   ');
}
function updateDeploymentUI(s,me){const active=s.phase==='deployment';$('deployment-ui').hidden=!active;if(!active)return;const state=me?.deploymentState||'landing_selection',mapOpen=!me?.pod&&['landing_selection','pod_available'].includes(state);$('landing-picker').hidden=!mapOpen;$('pod-status').textContent=me?.pod?`POD ${me.pod} · ${state.replaceAll('_',' ').toUpperCase()}`:me?.destination?'DESTINATION LOCKED IN · WALK TO A LIT POD':'CHOOSE YOUR DROP ZONE';$('pod-hint').textContent=me?.pod?'Stand by. The sequence begins automatically when every player is sealed.':'Move through the ship · Press E at an available pod';renderLandingMap(s,me);}
function roundBanner(s){
 const me=s.players.find(p=>p.id===conn.id);
 if(s.phase==='deployment'){
  const stage=s.deployment?.stage||'landing_selection';
  if(stage==='both_ready')return 'ALL OPERATORS SEALED · PREPARING DROP';
  if(stage==='pod_sealing')return 'POD SEALING · STAND BY';
  if(stage==='launching')return 'DEPLOYMENT POD LAUNCHING';
  if(stage==='transition')return 'DESCENT · HOLD POSITION';
  if(stage==='landed')return 'POD LANDED · PRESSURE EQUALIZING';
  if(stage==='pod_opening')return 'POD OPENING · STAND BY';
  if(stage==='exiting')return 'EXIT POD · MOVE OUT';
   if(stage==='saluting')return 'DEPLOYED · HORIZON SALUTE';
  if(me?.deploymentState==='entering_pod')return 'POD ENTRY · ALIGNING';
  if(me?.deploymentState==='pod_ready')return 'POD READY · WAITING FOR SQUAD';
  return me?.destination?'DESTINATION SET · ENTER A DEPLOYMENT POD':'SELECT A LANDING ZONE';
 }
 if(s.phase==='countdown')return `ROUND ${s.round} · ${Math.max(1,Math.ceil(s.timer))}`;
 if(s.phase==='roundover'){if(s.winner<0)return 'ROUND DRAW';const winner=s.players[s.winner];return winner?.id===conn.id?'ROUND WON':`${playerName(winner?.id)} WON THE ROUND`;}
 if(s.phase==='paused')return 'CONNECTION INTERRUPTED · HOLDING MATCH';
 if(s.phase==='done'){const champ=s.scores.findIndex(n=>n>=s.targetScore),winner=champ>=0?s.players[champ]:s.players[s.winner];return winner?.id===conn.id?'VICTORY':`${playerName(winner?.id)} WINS THE MATCH`;}
 if(me?.hp<=0)return 'ELIMINATED · SPECTATING';return '';
}
function apply(data){
 if(!validMap(data?.mapId)||!conn||!acceptSnapshot(matchId,snapshotFrame,data.id,data.frame,matchEpoch,data.epoch))return;
 if(game.mapId()!==data.mapId||loadingSnapshot){
  if(!pendingSnapshot||acceptSnapshot(pendingSnapshot.id,pendingSnapshot.frame,data.id,data.frame,pendingSnapshot.epoch,data.epoch))pendingSnapshot=data;
  if(!loadingSnapshot)loadSnapshotMap();return;
 }
 selectedMap=data.mapId;applyReadySnapshot(data);
}
async function loadSnapshotMap(){
 loadingSnapshot=true;status('Loading the party’s map · preparing deployment…');const connection=conn,generation=mapGeneration;
 try{
  while(pendingSnapshot&&conn===connection&&generation===mapGeneration){
   const data=pendingSnapshot;pendingSnapshot=null;await game.setMap(data.mapId);
   if(conn!==connection||generation!==mapGeneration)return;
   if(pendingSnapshot)continue;selectedMap=data.mapId;applyReadySnapshot(data);
  }
 }catch(e){pendingSnapshot=null;ready=false;status('Map could not load. Return to the lobby and try again.','error');}
 finally{loadingSnapshot=false;if(pendingSnapshot)loadSnapshotMap();}
}
function applyReadySnapshot(data){
 if(!data?.state?.players||data.state.players.length<1||data.state.players.length>8||!conn||!acceptSnapshot(matchId,snapshotFrame,data.id,data.frame,matchEpoch,data.epoch))return;const s=data.state,localPlayer=s.players.find(p=>p.id===conn.id);if(!localPlayer)return;const fresh=matchId!==data.id||!snapshot;matchId=data.id;matchEpoch=data.epoch;snapshotFrame=data.frame;snapshot=s;window.Duel.lobby=false;document.body.classList.remove('in-lobby','menu');document.body.classList.toggle('deployment',s.phase==='deployment');document.body.classList.toggle('dropping',s.phase==='deployment'&&['pod_sealing','launching','transition','landed','pod_opening','exiting'].includes(s.deployment?.stage));$('lobby').hidden=true;updateDeploymentUI(s,localPlayer);
 if(fresh||window.Duel.round!==s.round){const me=s.players.find(p=>p.id===conn.id);game.look(me?.yaw||0);seenEvent=0;window.Duel.round=s.round;showMenu=false;$('match-actions').hidden=true;updatePresence();}
 $('round-banner').textContent=roundBanner(s);for(const e of s.events||[])if(e.id>seenEvent){game.effect(e,conn.id,s);seenEvent=e.id;}
 if(s.phase==='done'){showMenu=true;$('match-actions').hidden=false;$('resume').hidden=true;$('rematch').hidden=false;$('back-lobby').hidden=false;document.exitPointerLock?.();}else if(!showMenu)$('match-actions').hidden=true;refresh();
}
function removePeer(id,reason='left the party'){
 const p=peers.get(id);if(!p)return;peers.delete(id);latencies.delete(id);voice.remove(id);
 if(host&&match?.ids.includes(id)){match.disconnect(id);if(participantIds().length<2){resetToLobby(true);status('Not enough players remain. Returned to the party lobby.');}else sendSnapshot();}
 say('Party',`${p.name} ${reason}.`,true);refresh();
}
function receive(m){
 if(!conn||!m||m.from===conn.id||typeof m.type!=='string'||(m.to&&m.to!==conn.id))return;const d=m.data||{};
 if(m.type==='hello'){
  const known=peers.has(m.from);if(host&&!known&&peers.size>=((conn.maxPlayers||8)-1)){conn.send('full',{},m.from);return;}if(host&&match&&!match.ids.includes(m.from)){conn.send('locked',{},m.from);return;}
  if(!conn.host&&d.host===m.from){conn.host=m.from;host=false;}
  const old=peers.get(m.from),peer={id:m.from,name:cleanName(d.name),color:cleanColor(d.color),ready:!!d.ready&&(!host||d.mapId===selectedMap),voice:!!d.voice,lastSeen:Date.now()};peers.set(m.from,peer);
  if(m.from===conn.host&&validMap(d.mapId)&&!inMatch()&&selectedMap!==d.mapId){selectedMap=d.mapId;ready=false;hello();}
  if(m.from===conn.host&&['build','town'].includes(d.mode)&&$('mode').value!==d.mode){$('mode').value=d.mode;ready=false;}
  if(!known)say('Party',`${peer.name} joined the party.`,true);refresh();syncVoice();if(host)start();return;
 }
 if(m.type==='full'){leave('That party is full (8 players maximum).');return;}
 if(m.type==='locked'){leave('That party is already in a match. Ask for another invite when they return to the lobby.');return;}
 const peer=peers.get(m.from);if(peer)peer.lastSeen=Date.now();
 if(m.type==='snapshot'){if(m.from===conn.host&&!host)apply(d);return;}
 if(m.type==='inventory-move'&&host&&match&&d.id===matchId&&d.epoch===matchEpoch&&match.ids.includes(m.from)){const ack=match.moveInventory(m.from,d.operation);conn.send('inventory-ack',{matchId,epoch:matchEpoch,ack},m.from);sendSnapshot();return;}
 if(m.type==='inventory-ack'&&m.from===conn.host&&!host&&d.matchId===matchId&&d.epoch===matchEpoch){game.ackInventory(d.ack);return;}
 if(m.type==='input'&&host&&match&&d.id===matchId&&match.ids.includes(m.from)){match.input(m.from,d.input);return;}
 if(m.type==='chat'&&peer&&typeof d.text==='string'){say(peer.name,d.text.slice(0,200));return;}
 if(m.type==='leave'){if(m.from===conn.host&&!host){leave('The party leader left, so the party was closed.');return;}removePeer(m.from);return;}
 if(m.type==='lobby'&&m.from===conn.host&&!host){resetToLobby(false);return;}
 if(m.type==='lobby-request'&&host){resetToLobby(true);return;}
 if(m.type==='mode'&&m.from===conn.host&&!host&&['build','town'].includes(d.mode)){if($('mode').value!==d.mode){$('mode').value=d.mode;ready=false;hello();refresh();status('Party leader changed the match mode · ready up again.');}return;}
 if(m.type==='map'&&m.from===conn.host&&!host&&validMap(d.mapId)&&!inMatch()){if(selectedMap!==d.mapId){selectedMap=d.mapId;ready=false;for(const p of peers.values())p.ready=false;hello();refresh();status('Party leader changed the map · ready up again.');}return;}
 if(m.type==='voice'&&peer){if(typeof d.enabled==='boolean'){peer.voice=d.enabled;if(!d.enabled)voice.remove(m.from);syncVoice();refresh();}else voice.receive(m.from,d).catch(e=>renderVoice({message:'Voice connection issue: '+e.message,tone:'warning'}));return;}
 if(m.type==='ping'){conn.send('pong',{time:d.time},m.from);return;}
 if(m.type==='pong'&&Number.isFinite(d.time)){latencies.set(m.from,Math.max(0,Date.now()-d.time));updateNetworkChip();}
}

window.Duel={moveInventory(operation){if(!conn||!snapshot||snapshot.phase!=='playing')return;if(host&&match){game.ackInventory(match.moveInventory(conn.id,operation));snapshot=match.snapshot();sendSnapshot(snapshot);}else conn.send('inventory-move',{id:matchId,epoch:matchEpoch,operation},conn.host);},active:true,lobby:true,characterPreview:false,round:0,myColor:profile.color,party:partyProfiles(),peerColors:{},menu(){game.clear();if(this.lobby)return;showMenu=true;$('match-actions').hidden=false;$('resume').hidden=false;$('rematch').hidden=snapshot?.phase!=='done';$('back-lobby').hidden=false;document.exitPointerLock?.();},preview(){const p=game.pose(),i=game.input();return placement(p,i,game.world,snapshot?.structures||[]);},valid(s){return !!snapshot&&validBuild(s,snapshot.structures,snapshot.players,game.world);},render(dt){if(snapshot&&conn)game.apply(snapshot,conn.id,colors(),dt);}};

$('create').onclick=()=>connect(true);
$('join').onclick=()=>connect(false);
$('leave').onclick=$('forfeit').onclick=()=>leave();
$('invite-more').onclick=focusOnline;
$('open-online').onclick=$('social-toggle').onclick=$('footer-social').onclick=focusOnline;
$('social-close').onclick=$('social-scrim').onclick=closeOnline;
$('lobby-play-toggle').onclick=()=>selectLobbyTab('play');$('profile-toggle').onclick=()=>toggleProfile();$('profile-close').onclick=()=>toggleProfile(false);$('character-preview-toggle').onclick=()=>selectLobbyTab('character');
$('online-refresh').onclick=()=>social?pollSocial():startSocial();
$('ready').onclick=()=>{if(!conn||match)return;ready=!ready;game?.startAudio({deployment:true});hello();refresh();if(host)start();};
function chooseLanding(x,z){if(!game?.setLanding(x,z))return;const me=snapshot?.players.find(player=>player.id===conn?.id);if(snapshot&&me)updateDeploymentUI(snapshot,{...me,destination:{x,z}});}
$('landing-map').onclick=e=>{const rect=e.currentTarget.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width,z=(e.clientY-rect.top)/rect.height;if(x<.058||x>.942||z<.088||z>.912)return;const extent=selectedMap==='facility'?360:584;chooseLanding(((x-.058)/.884-.5)*extent,((z-.088)/.824-.5)*extent);};
let quickPickMap='';
function renderLandingQuickPicks(){
 if(quickPickMap===selectedMap)return;quickPickMap=selectedMap;
 const tray=document.querySelector('.landing-quick-picks');tray.textContent='';
 for(const poi of landingPois()){const button=document.createElement('button');button.textContent=poi.name.toUpperCase();button.onclick=()=>chooseLanding(poi.x,poi.z);tray.append(button);}
 $('landing-map').setAttribute('aria-label','Choose a landing position on '+mapName(selectedMap));
}
$('map-choice').onchange=()=>{
 if((conn&&!host)||inMatch()||startingMatch){refresh();return;}
 const id=$('map-choice').value;if(!validMap(id))return;selectedMap=id;ready=false;for(const p of peers.values())p.ready=false;
 conn?.send('map',{mapId:selectedMap});hello();refresh();status('Map changed · everyone needs to ready up again.');
};
$('name').onchange=$('name').onblur=()=>{profile.name=cleanName($('name').value);$('name').value=profile.name;writeStore('duel-profile',profile);ready=false;hello();refresh();updatePresence();};
$('outfit').onchange=()=>{profile.color=cleanColor($('outfit').value);writeStore('duel-profile',profile);ready=false;hello();refresh();updatePresence();};
$('mode').onchange=()=>{if(!host&&conn)return;ready=false;for(const p of peers.values())p.ready=false;if(conn)conn.send('mode',{mode:$('mode').value});hello();refresh();status('Match mode changed · everyone needs to ready up again.');};
$('copy').onclick=async()=>{if(!conn)return;try{await navigator.clipboard.writeText(conn.code);status('Fallback party code copied.');}catch{status(`Fallback code: ${conn.code}`);}};
$('resume').onclick=()=>{showMenu=false;$('match-actions').hidden=true;game.capture();};
$('rematch').onclick=$('back-lobby').onclick=()=>{if(host)resetToLobby(true);else conn?.send('lobby-request');};
$('chat-form').onsubmit=e=>{e.preventDefault();const text=$('message').value.trim();if(!text||!conn||peers.size<1)return;conn.send('chat',{text});say(profile.name,text);$('message').value='';};
function toggleChat(force){const content=$('chat-content'),open=force??content.hidden;content.hidden=!open;$('chat-toggle').textContent=open?'−':'+';$('chat-toggle').setAttribute('aria-expanded',String(open));if(open)$('message').focus();}
$('chat-toggle').onclick=()=>toggleChat();
$('footer-chat').onclick=()=>toggleChat();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('social-panel').classList.contains('open')){closeOnline();e.stopPropagation();}else if(e.key==='Escape'&&document.body.classList.contains('profile-open'))toggleProfile(false);},{capture:true});
$('voice').onclick=async()=>{if(!conn||peers.size<1){status('Invite at least one player before enabling voice.');toggleChat(true);return;}if(voiceWanted){muted=voice.mute(!muted);conn.send('voice',{enabled:true,muted});return;}try{renderVoice({message:'Requesting microphone permission…',tone:'connecting'});await voice.enable(conn.id,voicePeerIds());voiceWanted=true;muted=false;conn.send('voice',{enabled:true,muted:false});hello();syncVoice();toggleChat(true);}catch(e){renderVoice({message:'Microphone unavailable: '+e.message,tone:'warning',enabled:false});toggleChat(true);}};
function openSetup(){$('service-url').value=config.url||'';$('service-key').value=config.key||'';$('setup').showModal();}
$('settings').onclick=openSetup;$('close-setup').onclick=()=>$('setup').close();
$('save-setup').onclick=async()=>{const url=$('service-url').value.trim().replace(/\/$/,''),key=$('service-key').value.trim();if(key.startsWith('sb_secret_')){status('Only a publishable key is allowed.','error');return;}if(key.startsWith('eyJ')){try{if(JSON.parse(atob(key.split('.')[1])).role==='service_role'){status('Do not use a service-role key.','error');return;}}catch{}}config={url,key};writeStore('duel-config',config);$('setup').close();status('Online settings saved. Connecting party finder…');await startSocial();};
$('local').onchange=()=>{if(conn){$('local').checked=!$('local').checked;return;}startSocial();};

const ping=document.createElement('span');ping.id='net-ping';ping.textContent='OFFLINE';document.querySelector('header').append(ping);
if(location.hash){$('code').value=location.hash.slice(1).toUpperCase();history.replaceState(null,'',location.pathname+location.search);}
if(new URLSearchParams(location.search).get('local')==='1')$('local').checked=true;
window.addEventListener('beforeunload',()=>{voice.stop();conn?.close();social?.close();});

let previous=performance.now();
setInterval(()=>{
 const now=performance.now(),dt=Math.max(0,(now-previous)/1000);previous=now;if(!conn)return;
 const cadence=networkCadence(partyProfiles().length);
 if(now-lastHello>=cadence.helloMs){hello();lastHello=now;}
 if(host&&now-lastPing>=cadence.pingMs){const live=activePeers();if(live.length){const peer=live[pingCursor++%live.length];conn.send('ping',{time:Date.now()},peer.id);}lastPing=now;}
 for(const p of [...peers.values()])if(Date.now()-p.lastSeen>19000){if(p.id===conn.host&&!host){leave('The party leader disconnected.');return;}removePeer(p.id,'disconnected');}
 if(match&&host){match.input(conn.id,showMenu?{}:game.input());match.tick(dt,{deploymentElapsed:match.phase==='deployment'?game.audioDeploymentElapsed(match.deployment.sequenceId):null});snapshot=match.snapshot();if(now-lastSnap>=cadence.snapshotMs){sendSnapshot(snapshot);lastSnap=now;}}
 else if(snapshot&&!host){pendingInput=accumulateInput(pendingInput,showMenu?{}:game.input());if(now-lastInput>=cadence.inputMs){conn.send('input',{id:matchId,input:pendingInput},conn.host);pendingInput=null;lastInput=now;}}
},33);

renderVoice();refresh();startSocial();
if(!game){const warning=document.createElement('div');warning.id='graphics-warning';warning.textContent='3D graphics are unavailable. Enable graphics acceleration in Chrome and restart it. Lobby, invites and chat are still available.';document.body.append(warning);}
