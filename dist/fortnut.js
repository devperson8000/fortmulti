// Fortnut is an independent, deliberately clumsy third-person toy game.
// It owns its scene, controls, pickups, bots, HUD and local party messages.
import * as THREE from 'three';

const $=id=>document.getElementById(id);
const root=$('fortnut-lobby'),canvas=$('fortnut-world');
const menu=$('fn-menu'),hud=$('fn-hud'),toastNode=$('fn-toast');
let renderer,scene,camera,player,bus,room=null,channel=null,started=false,phase='lobby';
let yaw=0,health=100,shield=0,nuts=0,elims=0,weapon=0,fireAt=0,lastSend=0,lastToast=0,toastText='';
let jumpV=0,onGround=true,mouseDrag=false,storm=74,lastStorm=0,lastCircle=0,clock=0;
const keys=new Set(),peers=new Map(),bots=[],chests=[],pickups=[],playerMeshes=new Map();
const mat=(color,roughness=.95)=>new THREE.MeshStandardMaterial({color,roughness,flatShading:true});
const materials={grass:mat(0x8ac541),dirt:mat(0x9d7650),water:mat(0x48a6bd),wood:mat(0xa7652e),wood2:mat(0x754722),metal:mat(0x83908b),red:mat(0xe95e35),yellow:mat(0xf0d648),shirt:mat(0x5f74e4),pants:mat(0x613e85),skin:mat(0xffbe7a),black:mat(0x292d3b),gold:mat(0xffcf38),pink:mat(0xef55ca),shield:mat(0x42d9e7)};
const box=(parent,w,h,d,material,x=0,y=0,z=0)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);parent.add(m);return m;};
const cylinder=(parent,r1,r2,h,material,x=0,y=0,z=0,n=6)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,n),material);m.position.set(x,y,z);parent.add(m);return m;};
function announce(text){toastText=text;lastToast=performance.now();toastNode.textContent=text;toastNode.style.opacity='1';}
function makeCharacter(color=0x5f74e4){
  const g=new THREE.Group();g.userData.legs=[];
  const shirt=mat(color),torso=box(g,.84,1.02,.5,shirt,0,1.58,0);torso.rotation.z=-.05;
  const head=new THREE.Mesh(new THREE.SphereGeometry(.39,7,5),materials.skin);head.scale.set(1,1.15,.9);head.position.y=2.42;g.add(head);
  cylinder(g,.43,.45,.24,materials.gold,0,2.8,0,7);
  for(const x of [-.55,.55]){const arm=cylinder(g,.17,.14,.88,shirt,x,1.58,0,5);arm.rotation.z=x<0?-.28:.28;}
  for(const x of [-.23,.23]){const leg=cylinder(g,.22,.18,.8,materials.pants,x,.55,0,5);g.userData.legs.push(leg);box(g,.28,.16,.46,materials.black,x,.13,.07);}
  box(g,.15,.15,.45,materials.black,.54,1.65,.39).rotation.x=-.4;
  box(g,.1,.3,.1,materials.yellow,-.17,2.45,.35);
  return g;
}
function init(){
  if(renderer)return;
  renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));renderer.setSize(innerWidth,innerHeight,false);
  renderer.shadowMap.enabled=false;renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene=new THREE.Scene();scene.background=new THREE.Color(0x8ad4ec);scene.fog=new THREE.Fog(0x8ad4ec,100,260);
  camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,400);
  scene.add(new THREE.HemisphereLight(0xe5f9ff,0x5d5742,2));const sun=new THREE.DirectionalLight(0xffe5a8,2);sun.position.set(-25,50,20);scene.add(sun);
  buildIsland();player=makeCharacter();player.position.set(0,0,8);scene.add(player);buildBus();buildLoot();buildBots();
  window.addEventListener('resize',resize);resize();requestAnimationFrame(frame);
}
function buildIsland(){
  const land=new THREE.Mesh(new THREE.CylinderGeometry(92,103,12,13),materials.grass);land.position.y=-6;land.receiveShadow=false;scene.add(land);
  const sea=new THREE.Mesh(new THREE.CylinderGeometry(155,155,1,32),materials.water);sea.position.y=-12.1;scene.add(sea);
  // Random-looking ugly hills, trees and buildings are only visual scenery.
  for(let i=0;i<28;i++){
    const a=i*2.399,r=18+(i%7)*8,x=Math.cos(a)*r,z=Math.sin(a)*r;
    const hill=new THREE.Mesh(new THREE.DodecahedronGeometry(3+(i%5),0),i%3?materials.grass:materials.dirt);hill.scale.set(1.4,.65,1);hill.position.set(x,1,z);scene.add(hill);
    if(i%2===0){const trunk=cylinder(scene,.45,.7,3,materials.wood,x,2,z,5);cylinder(scene,.1,.02,2,materials.grass,x,4.4,z,5).scale.set(2.2,1.8,2.2);}
    if(i%4===0){const shack=new THREE.Group();shack.position.set(x+4,.2,z+2);box(shack,4,2.4,3,materials.wood,0,1,0);box(shack,4.5,.4,3.5,materials.red,0,2.4,0);box(shack,1,1.4,.12,materials.black,0,.8,1.57);scene.add(shack);}
  }
  // One spectacularly poor ring to suggest a shrinking storm.
  const ring=new THREE.Mesh(new THREE.TorusGeometry(54,.3,3,32),new THREE.MeshBasicMaterial({color:0xd94fd5,wireframe:true}));ring.rotation.x=Math.PI/2;ring.position.y=.6;scene.add(ring);
}
function buildBus(){
  bus=new THREE.Group();box(bus,12,3.4,5,materials.red,0,0,0);box(bus,12,.8,5,materials.metal,0,-1.9,0);
  for(let x=-4.4;x<=4.5;x+=2.2)box(bus,.9,1.2,.16,materials.yellow,x,.5,2.57);
  for(const x of [-4,4])for(const z of [-2.1,2.1])cylinder(bus,.8,.8,.5,materials.black,x,-1.5,z,8).rotation.z=Math.PI/2;
  const balloon=new THREE.Mesh(new THREE.SphereGeometry(2,6,4),materials.pink);balloon.position.set(0,4,0);bus.add(balloon);cylinder(bus,.08,.08,3,materials.wood,0,2.4,0,5);
  bus.position.set(0,35,0);scene.add(bus);
}
function makeChest(x,z){
  const g=new THREE.Group();box(g,2.2,1.2,1.5,materials.wood2,0,.6,0);box(g,2.28,.28,1.62,materials.gold,0,1.22,0);box(g,.25,.52,.12,materials.metal,0,.9,.83);g.position.set(x,0,z);scene.add(g);g.userData.open=false;chests.push(g);
}
function makePickup(x,z,type){
  const g=new THREE.Group(),m=type==='shield'?materials.shield:type==='nut'?materials.gold:materials.black;
  if(type==='shield'){const d=new THREE.Mesh(new THREE.OctahedronGeometry(.75,0),m);d.position.y=1.3;g.add(d);}
  else if(type==='nut'){const d=new THREE.Mesh(new THREE.SphereGeometry(.5,5,4),m);d.scale.set(1,.8,.65);d.position.y=.8;g.add(d);cylinder(g,.12,.18,.35,materials.wood,0,1.25,0,5);}
  else {box(g,.45,.8,.4,m,0,.7,0);box(g,.13,.45,.18,materials.gold,0,.7,.26);}
  g.position.set(x,0,z);scene.add(g);g.userData.type=type;g.userData.taken=false;pickups.push(g);
}
function buildLoot(){
  for(const [x,z] of [[-18,-15],[20,-18],[-28,15],[26,22],[2,-32],[37,-2],[-38,-4],[7,35]])makeChest(x,z);
  for(const [x,z,t] of [[-8,2,'shield'],[17,10,'shield'],[-33,-19,'nut'],[30,-25,'nut'],[5,28,'gun']])makePickup(x,z,t);
}
function buildBots(){for(let i=0;i<5;i++){const b=makeCharacter([0xe95756,0x52d6c7,0xf0a23b,0x9257ca,0xa4cf48][i]);const a=i*1.26;b.position.set(Math.cos(a)*(16+i*5),0,Math.sin(a)*(15+i*5));scene.add(b);b.userData={hp:3,dir:a,wait:Math.random()*2,id:'bot-'+i,lastAttack:0};bots.push(b);}}
function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
function localPlayer(){return {id:room?.id||'solo',name:room?.name||'YOU',x:player.position.x,z:player.position.z,health,shield,nuts,elims,weapon};}
function setRoom(code){
  channel?.postMessage({type:'bye',id:room?.id});channel?.close();peers.clear();for(const id of [...playerMeshes.keys()])removePlayer(id);room={id:Math.random().toString(36).slice(2,8),name:(localStorage.getItem('fortnut-name')||'NUT PLAYER').slice(0,16),code};
  channel=new BroadcastChannel('fortnut-party-'+code);
  channel.onmessage=e=>{const m=e.data;if(!m||m.id===room.id)return;if(m.type==='state'){peers.set(m.id,{...m,seen:performance.now()});paintRoster();}if(m.type==='bye'){peers.delete(m.id);removePlayer(m.id);paintRoster();}if(m.type==='toast')announce(m.text);};
  channel.postMessage({type:'state',...localPlayer()});$('fn-room').textContent=code;$('fn-status').textContent='PRIVATE PARTY · '+code;
  announce('Joined Fortnut room '+code+' · same-browser tabs only');paintRoster();
}
function paintRoster(){const rows=[localPlayer(),...peers.values()].slice(0,8);$('fn-roster').innerHTML=rows.map(p=>`<span>${escapeHtml(p.name)} · ♥${Math.max(0,Math.round(p.health))} · 🌰${p.nuts||0}</span>`).join('');}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function removePlayer(id){const m=playerMeshes.get(id);if(m){scene.remove(m);playerMeshes.delete(id);}}
function updateRemote(){for(const [id,p] of peers){if(performance.now()-p.seen>10000){peers.delete(id);removePlayer(id);continue;}let m=playerMeshes.get(id);if(!m){m=makeCharacter(0x46c5db);scene.add(m);playerMeshes.set(id,m);}m.position.set(p.x,0,p.z);m.rotation.y=p.yaw||0;}paintRoster();}
function distance(a,b){return Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z);}
function nearest(list,max){let found=null,d=max;for(const x of list){if(x.userData.open||x.userData.taken)continue;const n=distance(player,x);if(n<d){d=n;found=x;}}return found;}
function openChest(){const c=nearest(chests,4);if(!c){announce('No chest here. Just bad terrain.');return;}c.userData.open=true;c.children[1].rotation.x=-1.3;makePickup(c.position.x+2,c.position.z,'nut');makePickup(c.position.x-2,c.position.z,'shield');if(Math.random()>.4)makePickup(c.position.x,c.position.z+2,'gun');announce('CHEST OPENED! It contained: more stuff.');}
function usePickup(){for(const p of pickups){if(p.userData.taken||distance(player,p)>2.4)continue;p.userData.taken=true;p.visible=false;const t=p.userData.type;if(t==='shield'){shield=Math.min(100,shield+35);announce('SHIELD JUICE acquired. Probably fizzy.');}else if(t==='nut'){nuts++;announce('You found a nut. Currency? Food? Unclear.');}else{weapon=1;announce('Equipped the loud rectangle.');}syncHud();return true;}return false;}
function fire(){if(performance.now()-fireAt<420)return;fireAt=performance.now();const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),target=bots.filter(b=>b.visible).sort((a,b)=>distance(player,a)-distance(player,b))[0];if(target&&distance(player,target)<22){const delta=target.position.clone().sub(player.position).setY(0).normalize();if(forward.dot(delta)>.72){target.userData.hp--;target.position.addScaledVector(delta,1.1);if(target.userData.hp<=0){target.visible=false;elims++;makePickup(target.position.x,target.position.z,'nut');announce('BOT BONKED. ELIMINATION-ISH!');syncHud();return;}}}announce(weapon?'PEW! (approximately)':'BONK! Your fist is emotionally powerful.');}
function syncHud(){$('fn-health').textContent=Math.max(0,Math.ceil(health));$('fn-shield').textContent=Math.ceil(shield);$('fn-nuts').textContent=nuts;$('fn-elims').textContent=elims;paintRoster();}
function begin(){started=true;phase='bus';clock=0;health=100;shield=0;nuts=0;elims=0;storm=74;lastCircle=performance.now();player.position.set(0,0,8);bus.visible=true;for(const b of bots){b.visible=true;b.userData.hp=3;}for(const c of chests){c.userData.open=false;c.children[1].rotation.x=0;}for(const p of pickups){p.userData.taken=false;p.visible=true;}syncHud();$('fn-menu').hidden=true;hud.hidden=false;$('fn-status').textContent='ON THE BATTLE BUS';$('fn-objective').textContent='BUS DEPARTS WHEN THE DRIVER FINDS THE KEY';bus.position.set(0,21,-10);announce('Welcome aboard. The bus is mostly a box.');}
function leave(){channel?.postMessage({type:'bye',id:room?.id});channel?.close();location.href='/';}
function enter(){init();}
function party(){const typed=$('fn-code').value.trim().toUpperCase();const code=typed||Math.random().toString(36).slice(2,8).toUpperCase();$('fn-code').value=code;setRoom(code);}
document.addEventListener('DOMContentLoaded',enter,{once:true});$('fortnut-back').addEventListener('click',leave);$('fn-party').addEventListener('click',party);$('fn-start').addEventListener('click',()=>{if(!room)party();begin();});
window.addEventListener('keydown',e=>{if(!root.hidden){keys.add(e.code);if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='Escape'&&started){started=false;phase='lobby';menu.hidden=false;hud.hidden=true;$('fn-status').textContent='FORTNUT LOBBY';}if(e.code==='KeyE'){if(!usePickup())openChest();}if(e.code==='Digit1')weapon=0;if(e.code==='Digit2')weapon=1;}});
window.addEventListener('keyup',e=>keys.delete(e.code));
canvas.addEventListener('pointerdown',e=>{mouseDrag=true;canvas.setPointerCapture(e.pointerId);if(started&&phase==='landed')fire();});
canvas.addEventListener('pointerup',()=>mouseDrag=false);canvas.addEventListener('pointercancel',()=>mouseDrag=false);
canvas.addEventListener('pointermove',e=>{if(mouseDrag&&started&&phase==='landed')yaw-=e.movementX*.004;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function step(dt){
  clock+=dt;
  if(phase==='bus'){bus.position.x=Math.sin(clock*1.3)*32;bus.position.z=-10+clock*10;bus.position.y=22+Math.sin(clock*4)*1.3;bus.rotation.z=Math.sin(clock*7)*.035;if(clock>3.8){phase='landed';bus.visible=false;$('fn-status').textContent='LANDED · NO PLAN';$('fn-objective').textContent='LOOT THINGS. BONK PEOPLE. AVOID PINK CIRCLE.';announce('The bus has stopped being a bus. Go!');}}
  if(started&&phase==='landed'){
    const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),move=new THREE.Vector3();if(keys.has('KeyW'))move.add(forward);if(keys.has('KeyS'))move.sub(forward);if(keys.has('KeyD'))move.add(right);if(keys.has('KeyA'))move.sub(right);if(move.lengthSq())move.normalize().multiplyScalar((keys.has('ShiftLeft')?11:7)*dt);player.position.add(move);player.position.x=THREE.MathUtils.clamp(player.position.x,-88,88);player.position.z=THREE.MathUtils.clamp(player.position.z,-88,88);if(move.lengthSq()){player.rotation.y=yaw;for(const l of player.userData.legs)l.rotation.x=Math.sin(clock*14)*.35;}
    if(keys.has('Space')&&onGround){jumpV=7;onGround=false;}player.position.y+=jumpV*dt;jumpV-=18*dt;if(player.position.y<0){player.position.y=0;jumpV=0;onGround=true;}
    if(performance.now()-lastCircle>15000){storm=Math.max(22,storm-9);lastCircle=performance.now();announce('The pink circle is shrinking. Badly.');}
    if(Math.hypot(player.position.x,player.position.z)>storm&&performance.now()-lastStorm>1000){lastStorm=performance.now();if(shield>0)shield=Math.max(0,shield-4);else health=Math.max(0,health-4);announce('PINK STORM BONKED YOU. Move inward-ish.');if(health===0){started=false;menu.hidden=false;hud.hidden=true;$('fn-status').textContent='YOU LOST TO CIRCLE';}}
    for(const b of bots){if(!b.visible)continue;b.userData.wait-=dt;if(b.userData.wait<0){const toward=player.position.clone().sub(b.position).setY(0);if(toward.length()<28){toward.normalize();b.position.addScaledVector(toward,dt*(2+Math.sin(clock*3)));b.rotation.y=Math.atan2(-toward.x,-toward.z);}else b.userData.dir+=dt*.4;if(distance(player,b)<2.5&&performance.now()-b.userData.lastAttack>1300){b.userData.lastAttack=performance.now();if(shield)shield=Math.max(0,shield-8);else health=Math.max(0,health-8);syncHud();announce('A badly programmed bot touched you.');}}}
    for(const p of pickups)if(!p.userData.taken)p.rotation?.set?.(0,clock,0);
  }
  if(room&&channel&&performance.now()-lastSend>100){lastSend=performance.now();channel.postMessage({type:'state',...localPlayer(),yaw,seen:performance.now()});updateRemote();}
  const focus=player.position.clone().add(new THREE.Vector3(0,1.3,0)),back=new THREE.Vector3(Math.sin(yaw)*10,5,Math.cos(yaw)*10);camera.position.lerp(focus.clone().add(back),.13);camera.lookAt(focus);
  if(performance.now()-lastToast>2200)toastNode.style.opacity='0';if(started&&phase==='landed')syncHud();
}
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.04,(now-(frame.last||now))/1000);frame.last=now;if(!renderer||root.hidden)return;step(dt);renderer.render(scene,camera);}

