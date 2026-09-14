export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
export function placement(p,input,world){const angle=Math.round(input.yaw/(Math.PI/2))*Math.PI/2+(input.rotation||0),dx=-Math.sin(angle),dz=-Math.cos(angle),x=Math.round((p.p[0]+dx*5)/5)*5,z=Math.round((p.p[2]+dz*5)/5)*5;return {x,z,y:Math.max(world.height(x,z),Math.floor((p.p[1]+.25)/3.6)*3.6),angle,type:input.slot||2,hp:150};}
export function bounds(s){const r=Math.abs(Math.sin(s.angle))>.5;return {min:[s.x-(r?.22:2.5),s.y,s.z-(r?2.5:.22)],max:[s.x+(r?.22:2.5),s.y+3.6,s.z+(r?2.5:.22)]};}
function overlap(a,b){return a.min.every((v,i)=>v<b.max[i]&&a.max[i]>b.min[i]);}
export function validBuild(s,structures,players,world){if(structures.length>=260||s.y>42)return false;if(structures.some(v=>Math.abs(v.x-s.x)<.1&&Math.abs(v.z-s.z)<.1&&Math.abs(v.y-s.y)<.2&&v.type===s.type&&(s.type!==2||Math.abs(Math.sin(v.angle-s.angle))<.1)))return false;const b=s.type===2?bounds(s):{min:[s.x-2.4,s.y+.15,s.z-2.4],max:[s.x+2.4,s.y+3.5,s.z+2.4]};if(world.obstacles.some(v=>overlap(b,v)))return false;if(s.type===2&&players.some(p=>p.hp>0&&p.air==='landed'&&overlap(b,{min:[p.p[0]-.38,p.p[1],p.p[2]-.38],max:[p.p[0]+.38,p.p[1]+2.3,p.p[2]+.38]})))return false;const floor=world.height(s.x,s.z);return s.y<=floor+.5||structures.some(v=>Math.hypot(v.x-s.x,v.z-s.z)<=5.1&&Math.abs(v.y+3.6-s.y)<.3);}
export function ground(x,z,foot,structures,world){let h=world.height(x,z);for(const b of world.obstacles||[]){if(x>b.min[0]+.08&&x<b.max[0]-.08&&z>b.min[2]+.08&&z<b.max[2]-.08&&b.max[1]<=foot+.55)h=Math.max(h,b.max[1]);}for(const s of structures){if(s.type!==3)continue;const dx=x-s.x,dz=z-s.z,localX=dx*Math.cos(s.angle)-dz*Math.sin(s.angle),localZ=dx*Math.sin(s.angle)+dz*Math.cos(s.angle);if(Math.abs(localX)<=2.48&&Math.abs(localZ)<=2.5){let v=s.y+(2.5-localZ)*.72;if(v<=foot+.48)h=Math.max(h,v);}}return h;}
export function rayBox(o,d,b){let lo=0,hi=180;for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-7){if(o[i]<b.min[i]||o[i]>b.max[i])return Infinity;continue;}let a=(b.min[i]-o[i])/d[i],c=(b.max[i]-o[i])/d[i];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo)return Infinity;}return lo;}
export function sanitize(i={}){const num=(v,a,b)=>clamp(Number.isFinite(v)?v:0,a,b);return {x:num(i.x,-1,1),z:num(i.z,-1,1),yaw:num(i.yaw,-10000,10000),pitch:num(i.pitch,-.9,.7),rotation:num(i.rotation,-10000,10000),slot:[1,2,3].includes(i.slot)?i.slot:1,jump:!!i.jump,sprint:!!i.sprint,aim:!!i.aim,fire:!!i.fire,reload:!!i.reload};}

// A long cross-island route gives the party time to choose between distant POIs.
export const ISLAND_LIMIT=292,BUS_SECONDS=32;
const BUS_START=[-312,188],BUS_END=[312,-188],BUS_ALTITUDE=128,DEPLOY_SECONDS=.95;
const seatOffset=i=>{const row=Math.floor(i/2),side=i%2?1:-1;return [side*1.15,0,3.2-row*2.05];};

export class Match{
 constructor(world,ids,mode='build'){
  this.world=world;this.ids=[...new Set(ids)].slice(0,8);this.mode=mode;this.scores=this.ids.map(()=>0);this.disconnected=new Set();this.targetScore=5;this.round=0;this.events=[];this.eventId=0;this.startRound(true);
 }
 busAt(t){const q=clamp(t/BUS_SECONDS,0,1),ease=q*q*(3-2*q),x=BUS_START[0]+(BUS_END[0]-BUS_START[0])*ease,z=BUS_START[1]+(BUS_END[1]-BUS_START[1])*ease,y=BUS_ALTITUDE+Math.sin(q*Math.PI)*5+Math.sin(t*.72)*.45,yaw=Math.atan2(-(BUS_END[0]-BUS_START[0]),-(BUS_END[1]-BUS_START[1]));return {x,y,z,yaw,progress:q,active:q<1,bank:Math.sin(t*.42)*.025,bob:Math.sin(t*.72)*.45,speed:Math.hypot(BUS_END[0]-BUS_START[0],BUS_END[1]-BUS_START[1])*(6*q*(1-q))/BUS_SECONDS};}
 startRound(waiting=false){
  if(this.disconnected.size){const scoreById=new Map(this.ids.map((id,i)=>[id,this.scores[i]||0]));this.ids=this.ids.filter(id=>!this.disconnected.has(id));this.scores=this.ids.map(id=>scoreById.get(id)||0);this.disconnected.clear();}
  this.round++;this.phase=waiting?'waiting':'bus';this.timer=waiting?0:BUS_SECONDS;this.elapsed=0;this.dropElapsed=0;this.structures=[];this.winner=undefined;
  this.pickups=this.mode==='town'?[{x:0,z:8,type:'shield'},{x:-22,z:20,type:'wood'},{x:25,z:8,type:'health'},{x:36,z:-18,type:'wood'},{x:-38,z:-9,type:'shield'},{x:8,z:38,type:'health'},{x:-205,z:72,type:'shield'},{x:-188,z:91,type:'wood'},{x:176,z:94,type:'health'},{x:198,z:67,type:'wood'},{x:128,z:-188,type:'shield'},{x:-92,z:-178,type:'health'}]:[];
  this.bus=this.busAt(0);
  this.players=this.ids.map((id,i)=>{const off=seatOffset(i);return {id,p:[this.bus.x+off[0],this.bus.y+.1,this.bus.z+off[2]],yaw:this.bus.yaw,vy:0,hp:100,shield:100,ammo:30,material:150,reload:0,cool:0,walk:0,input:sanitize(),lastInput:0,air:'bus',deploy:0,jumpLatch:false,eliminated:false};});
  this.events=[];
 }
 launchDrop(){if(this.phase!=='waiting')return;this.phase='bus';this.timer=BUS_SECONDS;this.dropElapsed=0;this.bus=this.busAt(0);this.event({type:'drop_start'});}
 input(id,input){const p=this.players.find(p=>p.id===id);if(p){p.input=sanitize(input);p.lastInput=0;}}
 disconnect(id){const p=this.players.find(p=>p.id===id);if(!p||this.disconnected.has(id))return;this.disconnected.add(id);p.hp=0;p.eliminated=true;p.air='landed';this.event({type:'elimination',by:null,hit:id,reason:'disconnect'});if(this.phase==='waiting'){const scoreById=new Map(this.ids.map((pid,i)=>[pid,this.scores[i]||0]));this.ids=this.ids.filter(pid=>pid!==id);this.scores=this.ids.map(pid=>scoreById.get(pid)||0);this.players=this.players.filter(v=>v.id!==id);this.disconnected.delete(id);return;}if(['playing','countdown','bus','drop'].includes(this.phase))this.checkRoundEnd();}
 event(e){this.events.push({...e,id:++this.eventId});this.events=this.events.slice(-36);}
 hit(p,n){if(p.hp<=0)return;let shield=Math.min(p.shield,n);p.shield-=shield;p.hp=Math.max(0,p.hp-(n-shield));}
 updateDrop(dt){
  this.dropElapsed+=dt;this.bus=this.busAt(this.dropElapsed);this.timer=Math.max(0,BUS_SECONDS-this.dropElapsed);
  let anyDropped=false;
  for(let index=0;index<this.players.length;index++){
   const p=this.players[index];if(p.hp<=0)continue;p.lastInput+=dt;const i=p.lastInput>.75?sanitize():p.input;const edgeJump=i.jump&&!p.jumpLatch;p.jumpLatch=i.jump;
   if(p.air==='bus'){
    const off=seatOffset(index),cy=Math.cos(this.bus.yaw),sy=Math.sin(this.bus.yaw);p.p[0]=this.bus.x+off[0]*cy+off[2]*sy;p.p[1]=this.bus.y+.2;p.p[2]=this.bus.z-off[0]*sy+off[2]*cy;p.yaw=this.bus.yaw;
    if(edgeJump||i.fire||this.bus.progress>=.995){p.air='freefall';p.yaw=i.yaw||this.bus.yaw;p.vy=-5;this.event({type:'jump',by:p.id});}
   }else if(p.air==='freefall'||p.air==='deploying'||p.air==='glider'){
    anyDropped=true;p.yaw=i.yaw;const steer=p.air==='glider'?11:p.air==='deploying'?12:15,len=Math.max(1,Math.hypot(i.x,i.z)),dx=(Math.cos(i.yaw)*i.x-Math.sin(i.yaw)*i.z)/len*steer*dt,dz=(-Math.sin(i.yaw)*i.x-Math.cos(i.yaw)*i.z)/len*steer*dt;p.p[0]=clamp(p.p[0]+dx,-ISLAND_LIMIT,ISLAND_LIMIT);p.p[2]=clamp(p.p[2]+dz,-ISLAND_LIMIT,ISLAND_LIMIT);
    const floor=ground(p.p[0],p.p[2],p.p[1],this.structures,this.world),clearance=p.p[1]-floor;
    if(p.air==='freefall'&&(edgeJump||clearance<=38)){p.air='deploying';p.deploy=0;this.event({type:'deploy',by:p.id});}
    if(p.air==='deploying'){p.deploy=clamp(p.deploy+dt/DEPLOY_SECONDS,0,1);p.vy=-14+7.8*p.deploy;if(p.deploy>=1)p.air='glider';}
    else p.vy=p.air==='glider'?-6.2:(i.sprint?-25:-18);
    p.p[1]+=p.vy*dt;
    if(p.p[1]<=floor){p.p[1]=floor;p.vy=0;p.air='landed';this.event({type:'land',by:p.id});}
   }
  }
  if(anyDropped&&this.phase==='bus')this.phase='drop';
  if(this.players.filter(p=>p.hp>0).every(p=>p.air==='landed')){this.phase='countdown';this.timer=2.5;this.bus.active=false;this.event({type:'all_landed'});}
 }
 checkRoundEnd(){
  if(!['playing','countdown','bus','drop'].includes(this.phase))return false;
  const alive=this.players.filter(p=>p.hp>0);if(alive.length>1)return false;
  this.winner=alive.length===1?this.players.indexOf(alive[0]):-1;if(this.winner>=0)this.scores[this.winner]++;
  this.phase=this.scores.some(n=>n>=this.targetScore)?'done':'roundover';this.timer=4;this.event({type:'round_end',winner:this.winner});return true;
 }
 tick(dt){
  dt=clamp(dt,0,.05);if(this.phase==='done'||this.phase==='paused'||this.phase==='waiting')return;
  if(this.phase==='bus'||this.phase==='drop'){this.updateDrop(dt);return;}
  if(this.phase==='countdown'||this.phase==='roundover'){this.timer-=dt;if(this.timer<=0){if(this.phase==='countdown')this.phase='playing';else this.startRound(false);}return;}
  this.elapsed+=dt;const walls=this.world.obstacles.concat(this.structures.filter(s=>s.type===2).map(bounds));
  for(const p of this.players){
   if(p.hp<=0)continue;p.lastInput+=dt;const i=p.lastInput>.6?sanitize():p.input;p.cool=Math.max(0,p.cool-dt);if(p.reload>0){p.reload=Math.max(0,p.reload-dt);if(!p.reload)p.ammo=30;}if(i.reload&&p.ammo<30&&!p.reload)p.reload=1.5;p.yaw=i.yaw;
   let speed=(i.sprint?9:6)*(i.aim?.6:1),len=Math.max(1,Math.hypot(i.x,i.z)),dx=(Math.cos(i.yaw)*i.x-Math.sin(i.yaw)*i.z)/len*speed*dt,dz=(-Math.sin(i.yaw)*i.x-Math.cos(i.yaw)*i.z)/len*speed*dt;const blocked=q=>walls.some(b=>overlap({min:[q[0]-.36,q[1]+.12,q[2]-.36],max:[q[0]+.36,q[1]+2.3,q[2]+.36]},b));let q=[p.p[0]+dx,p.p[1],p.p[2]];if(!blocked(q))p.p[0]=clamp(q[0],-ISLAND_LIMIT,ISLAND_LIMIT);q=[p.p[0],p.p[1],p.p[2]+dz];if(!blocked(q))p.p[2]=clamp(q[2],-ISLAND_LIMIT,ISLAND_LIMIT);const floor=ground(p.p[0],p.p[2],p.p[1],this.structures,this.world);if(i.jump&&p.p[1]<=floor+.05)p.vy=8;p.vy-=22*dt;p.p[1]+=p.vy*dt;if(p.p[1]<floor){p.p[1]=floor;p.vy=0;}p.walk+=Math.hypot(dx,dz)*1.4;
   if(i.fire&&p.cool<=0){
    if(i.slot>1){p.cool=.22;const b=placement(p,i,this.world);if((this.mode==='build'||p.material>=10)&&validBuild(b,this.structures,this.players,this.world)){this.structures.push(b);if(this.mode!=='build')p.material-=10;this.event({type:'build',by:p.id});}}
    else if(!p.reload){if(!p.ammo){p.reload=1.5;}else{p.cool=.15;p.ammo--;const d=[-Math.sin(i.yaw)*Math.cos(i.pitch),Math.sin(i.pitch),-Math.cos(i.yaw)*Math.cos(i.pitch)],o=[p.p[0],p.p[1]+1.7,p.p[2]];let nearest=180,target=null,structure=null;for(const b of this.world.obstacles){const t=rayBox(o,d,b);if(t<nearest)nearest=t;}for(let t=.5;t<nearest;t+=.5){if(o[1]+d[1]*t<this.world.height(o[0]+d[0]*t,o[2]+d[2]*t)){nearest=t;break;}}for(const b of this.structures){const bb=b.type===2?bounds(b):{min:[b.x-2.5,b.y,b.z-2.5],max:[b.x+2.5,b.y+3.6,b.z+2.5]};const t=rayBox(o,d,bb);if(t<nearest){nearest=t;structure=b;}}for(const other of this.players){if(other===p||other.hp<=0)continue;const t=rayBox(o,d,{min:[other.p[0]-.43,other.p[1],other.p[2]-.43],max:[other.p[0]+.43,other.p[1]+2.5,other.p[2]+.43]});if(t<nearest){nearest=t;target=other;structure=null;}}const end=o.map((v,k)=>v+d[k]*nearest);if(target){this.hit(target,34);if(target.hp<=0&&!target.eliminated){target.eliminated=true;this.event({type:'elimination',by:p.id,hit:target.id});}}if(structure){structure.hp-=34;if(structure.hp<=0)this.structures=this.structures.filter(s=>s!==structure);}this.event({type:'shot',by:p.id,a:o,b:end,hit:target?.id||null});}}
   }
   if(this.mode==='town'){const radius=Math.max(18,255-this.elapsed*.58);if(Math.hypot(p.p[0],p.p[2])>radius)this.hit(p,7*dt);for(const item of [...this.pickups]){if(Math.hypot(item.x-p.p[0],item.z-p.p[2])<2){if(item.type==='shield'&&p.shield<100)p.shield=Math.min(100,p.shield+40);else if(item.type==='health'&&p.hp<100)p.hp=Math.min(100,p.hp+40);else if(item.type==='wood')p.material+=50;else continue;this.pickups=this.pickups.filter(v=>v!==item);}}}
  }
  for(const p of this.players)if(p.hp<=0&&!p.eliminated){p.eliminated=true;this.event({type:'elimination',by:null,hit:p.id,reason:'storm'});}this.checkRoundEnd();
 }
 snapshot(){return {phase:this.phase,timer:this.timer,elapsed:this.elapsed,round:this.round,mode:this.mode,targetScore:this.targetScore,scores:this.scores,winner:this.winner,bus:this.bus,players:this.players.map(({input,lastInput,jumpLatch,...p})=>p),structures:this.structures,pickups:this.pickups,events:this.events};}
}
