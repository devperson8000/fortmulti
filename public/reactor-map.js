import {REACTOR_COLLISION} from './maps/reactor/collision-data.js';
export const REACTOR_Y_OFFSET=8;
export const REACTOR_GATE_HEIGHT=6.8;
export const REACTOR_GATE_ANGLES=Object.freeze([-20,45,75,135,180,225,270,315].map(degrees=>degrees*Math.PI/180));
const names=['East Relay','Southeast Dock','South Array','Southwest Forge','West Hangar','Northwest Vault','North Exchange','Northeast Beacon'];
export const REACTOR_POIS=Object.freeze(names.map((name,i)=>{const angle=REACTOR_GATE_ANGLES[i];return Object.freeze({name,x:Math.cos(angle)*146,z:Math.sin(angle)*146,y:6.8,radius:7,angle});}));
const point=(m,p)=>[0,1,2].map(k=>m[9+k]+m[k]*p[0]+m[3+k]*p[1]+m[6+k]*p[2]);
function bounds(m,size,offset=[0,0,0]){const c=point(m,offset),ext=[0,1,2].map(k=>Math.abs(m[k])*size[0]/2+Math.abs(m[3+k])*size[1]/2+Math.abs(m[6+k])*size[2]/2);return {min:c.map((v,k)=>v-ext[k]),max:c.map((v,k)=>v+ext[k]),surface:'metal'};}
const gateAt=(x,z,margin=0)=>REACTOR_POIS.some(p=>{const c=Math.cos(p.angle),s=Math.sin(p.angle),r=x*c+z*s,t=-x*s+z*c;return r>100-margin&&r<136+margin&&Math.abs(t)<8+margin;});
function sourceBoxes(){const result=[];for(const shape of REACTOR_COLLISION){const m=shape.transform,size=shape.size;
 if(shape.type==='CylinderShape3D'){// Thin strips follow the circular perimeter rather than a solid square.
 const r=shape.radius,n=Math.ceil(r*2/.8);for(let i=0;i<n;i++){const x=-r+(i+.5)*2*r/n,z=Math.sqrt(Math.max(0,r*r-Math.max(0,Math.abs(x)-r/n)**2));result.push({...bounds(m,[2*r/n,size[1],2*z],[x,0,0]),source:shape.name,supportOnlyNative:true});}continue;}
 const rotated=[0,1,2].some(k=>m.slice(k*3,k*3+3).filter(v=>Math.abs(v)>.001).length>1),wall=shape.name.includes('/OuterWalls/')&&!shape.name.endsWith('/Ceiling');
 const counts=size.map((v,k)=>m.slice(k*3,k*3+3).filter(n=>Math.abs(n)>.001).length>1&&v>3?Math.ceil(v/7):1);
 // Vertical wall boxes need one bottom segment and one lintel, never 30 tiny height cells.
 if(wall)counts[1]=1;
 for(let ix=0;ix<counts[0];ix++)for(let iy=0;iy<counts[1];iy++)for(let iz=0;iz<counts[2];iz++){
 const indices=[ix,iy,iz],piece=size.map((v,k)=>v/counts[k]),offset=size.map((v,k)=>-v/2+(indices[k]+.5)*piece[k]);
 const b={...bounds(m,piece,offset),source:shape.name,supportOnlyNative:true};
 if(wall&&gateAt((b.min[0]+b.max[0])/2,(b.min[2]+b.max[2])/2,Math.hypot(piece[0],piece[2])*.55))b.min[1]=Math.max(b.min[1],12.8);
 result.push(b);
 }
 }return result;}
let cached;
let supportCells;
const cellKey=(x,z)=>`${Math.floor(x/16)},${Math.floor(z/16)}`;
function indexSupport(entries){const cells=new Map();for(const e of entries){const b=e.shape?bounds(e.shape.transform,e.shape.size):bounds([1,0,0,0,1,0,0,0,1,...e.part.position],e.part.size);for(let x=Math.floor(b.min[0]/16);x<=Math.floor(b.max[0]/16);x++)for(let z=Math.floor(b.min[2]/16);z<=Math.floor(b.max[2]/16);z++){const key=`${x},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(e);}}return cells;}
export function reactorLayout(){if(cached)return cached;const parts=[],chests=[],resources=[];
 const add=(position,size,color='354754',kind='floor',solid=true)=>parts.push({position,size,color,kind,solid});
 for(const pad of REACTOR_POIS){const c=Math.cos(pad.angle),s=Math.sin(pad.angle),local=(r,t,y)=>[r*c-t*s,y,r*s+t*c];
 // Rasterize rotated decks into broad shared mesh/collision rows.
 const deck=(r0,r1,t0,t1,color)=>{const corners=[[r0,t0],[r0,t1],[r1,t0],[r1,t1]].map(([r,t])=>local(r,t,0)),minX=Math.floor(Math.min(...corners.map(p=>p[0]))),maxX=Math.ceil(Math.max(...corners.map(p=>p[0]))),minZ=Math.floor(Math.min(...corners.map(p=>p[2]))),maxZ=Math.ceil(Math.max(...corners.map(p=>p[2])));let last=null;
 for(let z=minZ;z<maxZ;z++){let first=Infinity,end=-Infinity;for(let x=minX;x<maxX;x++){const r=(x+.5)*c+(z+.5)*s,t=-(x+.5)*s+(z+.5)*c;if(r>=r0&&r<=r1&&t>=t0&&t<=t1){first=Math.min(first,x);end=Math.max(end,x+1);}}
 if(end>first){if(last&&last.position[0]===(first+end)/2&&last.size[0]===end-first){last.position[2]+=.5;last.size[2]+=1;}else{add([(first+end)/2,6.55,z+.5],[end-first,.5,1],color);last=parts.at(-1);}}else last=null;
 }};
 deck(96,110,-7,7,'425762');deck(104,155,-5,5,'425762');deck(137,155,-9,9,'526975');
 for(const t of [-9.3,9.3])for(let r=137;r<155;r+=2)add(local(r+1,t,7.4),[.3,1.2,.3],'9dadb2','rail');
 for(const t of [-9.3,9.3])for(let r=137;r<155;r+=2){add(local(r+1,t,7.8),[Math.abs(c)*2.1+.12,.15,Math.abs(s)*2.1+.12],'9dadb2','rail');add(local(r+1,t*.94,6.815),[.8,.025,.8],'edb044','hazard',false);}
 for(let t=-9;t<9;t+=2){add(local(155.2,t+1,7.8),[Math.abs(s)*2.1+.12,.15,Math.abs(c)*2.1+.12],'9dadb2','rail');add(local(154.6,t+1,6.815),[.8,.025,.8],'edb044','hazard',false);}
 for(let t=-3;t<=3;t+=1)add(local(145,t,6.825),[.55,.025,.55],'d5e5e8','landing-marker',false);
 for(const t of [-8.5,8.5]){add(local(117,t,9.8),[.6,6,.6],'8daab8','gate');add(local(117,t,7),[.85,.22,.85],'ffb84a','light',false);}
 add(local(117,0,13.05),[Math.abs(c)*.6+Math.abs(s)*18,.5,Math.abs(s)*.6+Math.abs(c)*18],'7a939e','gate');
 add(local(149,6,7.2),[1.4,.8,1.4],'879fa8','cargo');chests.push({id:`chest:facility:${names.indexOf(pad.name)}`,x:local(149,6,7.6)[0],y:7.6,z:local(149,6,7.6)[2]});
 }
 // Shared inside gallery: its floor also bridges the source's open western arc.
 for(let z=-101;z<=101;z++){let run=null;for(let x=-101;x<=101;x++){const r=Math.hypot(x+.5,z+.5),inside=r>=97&&r<=101;if(inside){if(run===null)run=x;}else if(run!==null){add([(run+x)/2,6.55,z+.5],[x-run,.5,1],'425762');run=null;}}if(run!==null)add([(run+102)/2,6.55,z+.5],[102-run,.5,1],'425762');}
 // These four source corridors are clear of the native cargo and structural pillars.
 for(const degrees of [-20,52,265,322]){const angle=degrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);for(let step=0;step<23;step++){const r=96.2-step*.5,top=6.8-step*(5.2/22);for(let t=-1;t<=1;t++)add([r*c-t*s,top-.12,r*s+t*c],[.88,.24,.88],'71848b','stairs');}}
 const obstacles=[...sourceBoxes(),...parts.filter(p=>p.solid).map(p=>({...bounds([1,0,0,0,1,0,0,0,1,...p.position],p.size),source:`outpost/${p.kind}`}))];
 // Interior loot sits on verified source floors with standing clearance.
 const candidates=[];
 for(let x=-105;x<=105;x+=10)for(let z=-105;z<=105;z+=10){if(Math.hypot(x,z)>108||Math.hypot(x,z)<20)continue;let y=-50;for(const shape of REACTOR_COLLISION){const top=sourceSupport(shape,x,z);if(top!==null&&top<=6.81&&top>y)y=top;}if(y<-33||y>7)continue;if(obstacles.some(b=>x+.5>b.min[0]&&x-.5<b.max[0]&&z+.5>b.min[2]&&z-.5<b.max[2]&&b.max[1]>y+.15&&b.min[1]<y+1.78))continue;candidates.push({x,y,z});}
 // Spread loot across the actual usable source layout instead of filling the exterior.
 const selected=[];while(selected.length<16&&candidates.length){let best=0,distance=-1;for(let i=0;i<candidates.length;i++){const p=candidates[i],d=selected.length?Math.min(...selected.map(q=>Math.hypot(p.x-q.x,p.z-q.z))):100-Math.abs(Math.hypot(p.x,p.z)-80);if(d>distance){distance=d;best=i;}}const p=candidates.splice(best,1)[0];selected.push(p);chests.push({...p,id:`chest:facility:interior:${selected.length}`});}
 // Supply pallets remain dynamic harvest targets, never permanent collision boxes.
 for(let index=0;index<REACTOR_POIS.length;index++){const pad=REACTOR_POIS[index],c=Math.cos(pad.angle),sn=Math.sin(pad.angle);for(const [kind,r,t] of [['wood',150,-6],['stone',141,6]])resources.push({id:`resource:facility:pad:${index}:${kind}`,kind,x:r*c-t*sn,y:6.8,z:r*sn+t*c,hp:100});}
 let interiorSupplies=0;for(const chest of selected){if(interiorSupplies>=8)break;for(const [dx,dz] of [[2,0],[-2,0],[0,2],[0,-2]]){const x=chest.x+dx,z=chest.z+dz;let floor=-50;for(const shape of REACTOR_COLLISION){const top=sourceSupport(shape,x,z);if(top!==null&&top<=chest.y+.05&&top>floor)floor=top;}if(Math.abs(floor-chest.y)>.1||obstacles.some(b=>x+.6>b.min[0]&&x-.6<b.max[0]&&z+.6>b.min[2]&&z-.6<b.max[2]&&b.max[1]>floor+.15&&b.min[1]<floor+1.78))continue;resources.push({id:`resource:facility:interior:${interiorSupplies}`,kind:interiorSupplies%2?'stone':'wood',x,y:floor,z,hp:100});interiorSupplies++;break;}}
 cached={parts,obstacles,chests,resources};return cached;
}
function sourceSupport(shape,x,z){const m=shape.transform,origin=[x-m[9],-m[10],z-m[11]],q=[],dy=[];for(let k=0;k<3;k++){const v=m.slice(k*3,k*3+3),len=v.reduce((n,a)=>n+a*a,0);q[k]=origin.reduce((n,a,i)=>n+a*v[i],0)/len;dy[k]=v[1]/len;}
 let low=-Infinity,high=Infinity;
 for(let k=0;k<3;k++){const half=shape.size[k]/2;if(Math.abs(dy[k])<1e-8){if(Math.abs(q[k])>half+.001)return null;}else{const a=(-half-q[k])/dy[k],b=(half-q[k])/dy[k];low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b));}}
 if(high<low)return null;
 if(shape.type==='CylinderShape3D'){// All imported cylinders are vertical.
 if(Math.hypot(q[0],q[2])>shape.radius)return null;
 }
 // Gate cuts are open up to their authored lintels.
 if(shape.name.includes('/OuterWalls/')&&!shape.name.endsWith('/Ceiling')&&gateAt(x,z)&&high>12.8)return null;
 return high;
}
export function reactorSupportHeight(x,z,footY,maxRise=.38){if(!supportCells)supportCells=indexSupport([...REACTOR_COLLISION.map(shape=>({shape})),...reactorLayout().parts.filter(p=>p.solid).map(part=>({part}))]);let best=-50,limit=footY+maxRise;
 for(const e of supportCells.get(cellKey(x,z))||[]){if(e.shape){const top=sourceSupport(e.shape,x,z);if(top!==null&&top<=limit+.001&&top>best)best=top;}else{const p=e.part,top=p.position[1]+p.size[1]/2;if(top<=limit+.001&&top>best&&Math.abs(x-p.position[0])<=p.size[0]/2&&Math.abs(z-p.position[2])<=p.size[2]/2)best=top;}}return best;}
export function reactorHeight(x,z){return reactorSupportHeight(x,z,6.8,0);}
export function reactorIsLandingAllowed(x,z){return REACTOR_POIS.some(p=>{const dx=x-p.x,dz=z-p.z,c=Math.cos(p.angle),s=Math.sin(p.angle);return Math.abs(dx*c+dz*s)<=5.5&&Math.abs(-dx*s+dz*c)<=5.5;});}
export const isReactorLandingAllowed=reactorIsLandingAllowed;
export function drawReactorMap(ctx,x,y,width,height){
 ctx.save();ctx.translate(x,y);ctx.fillStyle='#101c26';ctx.fillRect(0,0,width,height);ctx.translate(width/2,height/2);ctx.scale(width/640,height/640);
 ctx.strokeStyle='#607481';ctx.lineWidth=12;ctx.beginPath();ctx.arc(0,0,109,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle='#384e5a';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,77,0,Math.PI*2);ctx.stroke();
 ctx.fillStyle='#da773b';ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.fill();
 for(const p of REACTOR_POIS){ctx.strokeStyle='#71919d';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(p.x/146*100,p.z/146*100);ctx.lineTo(p.x,p.z);ctx.stroke();ctx.fillStyle='#bac8bc';ctx.fillRect(p.x-6,p.z-6,12,12);}
 ctx.restore();
}
