import {WEAPON_PROFILES,WEAPON_ORDER,BUILD_SLOTS,createLoadout,weaponForSlot,weaponIdForSlot,isWeaponSlot,isBuildSlot,currentAmmo,shotSpread,spreadDirection,reloadProgress} from './weapon-system.js';
import {advanceMotionTrack,smoothAngle,selectViewPlayer} from './network-tuning.js';
import {ReusableFloatBuffer} from './render-buffer.js';
import {createCameraPresentation,stepCameraPresentation,canFireDuringPresentation,createCameraBlendOutput,blendCameraViews,shouldShowLocalAvatar,shouldShowViewModel} from './first-person-system.js';
import {createViewModelState,stepViewModel,createWeaponPartState,stepWeaponParts,reloadStage} from './view-model.js';
import {createEffectPool} from './effect-pool.js';
import {acceptEventId} from './multiplayer-runtime.js';
import {createAutoQuality,sampleAutoQuality,qualityPreset} from './quality-system.js';
import {skyshipFirstPersonView,cabinPoint,clampCabinWorldPosition} from './skyship-camera.js';
import {AVATAR_MODEL_PARTS,AVATAR_GEAR} from './avatar-model.js';
import {WEAPON_MODELS} from './weapon-model.js';

'use strict';
(()=>{
const $=id=>document.getElementById(id),canvas=$('game'),gl=canvas.getContext('webgl',{antialias:true,alpha:false});
if(!gl){$('heading').textContent='WebGL is unavailable';$('intro').textContent='Enable hardware acceleration in your browser, then reopen the game.';$('play').style.display='none';return;}
document.body.classList.add('menu');
const readSetting=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}},writeSetting=(key,value)=>{try{localStorage.setItem(key,String(value));}catch{}},clampSetting=(value,min,max,fallback)=>{const number=Number(value);return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback;};
let graphicsSelection=['auto','low','medium','high'].includes(readSetting('sunny.graphicsQuality','auto'))?readSetting('sunny.graphicsQuality','auto'):'auto',mouseSensitivity=clampSetting(readSetting('sunny.mouseSensitivity','1'),.5,2,1),scopeSensitivity=clampSetting(readSetting('sunny.scopeSensitivity','.7'),.35,1.25,.7),autoQuality=createAutoQuality('high'),currentQuality=qualityPreset(graphicsSelection,autoQuality);
const V=(x=0,y=0,z=0)=>[x,y,z],add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=a=>Math.hypot(...a),norm=a=>mul(a,1/(length(a)||1)),clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
let seed=428;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const color=h=>[parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255];
const C={grass:color('83b946'),darkGrass:color('55963e'),rock:color('a8ad9b'),trunk:color('785943'),leaves:color('3a8748'),pine:color('4d9f56'),cream:color('f5e3af'),teal:color('408f90'),red:color('e37b58'),road:color('747b77'),line:color('eee4b8'),skin:color('d69e72'),vest:color('577363'),pants:color('645c4e'),black:color('283e45'),metal:color('4d6670'),blue:color('58d6ed'),wood:color('bf9058'),gold:color('e9c95f'),glass:color('80d7ee'),cable:color('b9c8cf')};
const vertex=`attribute vec3 aPosition;attribute vec3 aColor;uniform mat4 uMatrix;uniform vec3 uEye;varying vec3 vColor;varying float vFog;void main(){gl_Position=uMatrix*vec4(aPosition,1.);vColor=aColor;vFog=clamp((distance(aPosition,uEye)-90.)/190.,0.,.86);}`;
const fragment=`precision mediump float;varying vec3 vColor;varying float vFog;void main(){gl_FragColor=vec4(mix(vColor,vec3(.62,.83,.86),vFog),1.);}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Renderer could not start');gl.useProgram(program);
const ap=gl.getAttribLocation(program,'aPosition'),ac=gl.getAttribLocation(program,'aColor'),um=gl.getUniformLocation(program,'uMatrix'),ue=gl.getUniformLocation(program,'uEye');gl.enableVertexAttribArray(ap);gl.enableVertexAttribArray(ac);gl.enable(gl.DEPTH_TEST);gl.clearColor(.48,.77,.88,1);
const light=norm([-.6,1,.4]);let geo=[];
function triCoordinates(ax,ay,az,bx,by,bz,cx,cy,cz,col){const abx=bx-ax,aby=by-ay,abz=bz-az,acx=cx-ax,acy=cy-ay,acz=cz-az,nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx,length=Math.hypot(nx,ny,nz)||1,shade=.62+.38*Math.max(0,(nx*light[0]+ny*light[1]+nz*light[2])/length),r=col[0]*shade,g=col[1]*shade,b=col[2]*shade;geo.push(ax,ay,az,r,g,b,bx,by,bz,r,g,b,cx,cy,cz,r,g,b);}
function tri(a,b,c,col){triCoordinates(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2],col);}
function quad(a,b,c,d,col){tri(a,b,c,col);tri(a,c,d,col);}
function transform(p,o,yaw=0,rx=0){let [x,y,z]=p;[y,z]=[y*Math.cos(rx)-z*Math.sin(rx),y*Math.sin(rx)+z*Math.cos(rx)];return [o[0]+x*Math.cos(yaw)+z*Math.sin(yaw),o[1]+y,o[2]-x*Math.sin(yaw)+z*Math.cos(yaw)];}
function poseTransform(p,o,yaw=0,pitch=0,roll=0,pivot=[0,1.25,0]){let x=p[0]-pivot[0],y=p[1]-pivot[1],z=p[2]-pivot[2];[x,y]=[x*Math.cos(roll)-y*Math.sin(roll),x*Math.sin(roll)+y*Math.cos(roll)];[y,z]=[y*Math.cos(pitch)-z*Math.sin(pitch),y*Math.sin(pitch)+z*Math.cos(pitch)];return transform([x+pivot[0],y+pivot[1],z+pivot[2]],o,yaw);}
const BOX_CORNERS=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],BOX_FACES=[[0,3,2,1],[4,5,6,7],[1,2,6,5],[0,4,7,3],[3,7,6,2],[0,1,5,4]],boxScratch=new Float32Array(24);
function box(o,s,c,yaw=0,rx=0){const cy=Math.cos(yaw),sy=Math.sin(yaw),cr=Math.cos(rx),sr=Math.sin(rx);for(let i=0;i<8;i++){const corner=BOX_CORNERS[i],x=corner[0]*s[0]*.5,y=corner[1]*s[1]*.5,z=corner[2]*s[2]*.5,ry=y*cr-z*sr,rz=y*sr+z*cr,k=i*3;boxScratch[k]=o[0]+x*cy+rz*sy;boxScratch[k+1]=o[1]+ry;boxScratch[k+2]=o[2]-x*sy+rz*cy;}for(const f of BOX_FACES){const a=f[0]*3,b=f[1]*3,d=f[2]*3,e=f[3]*3;triCoordinates(boxScratch[a],boxScratch[a+1],boxScratch[a+2],boxScratch[b],boxScratch[b+1],boxScratch[b+2],boxScratch[d],boxScratch[d+1],boxScratch[d+2],c);triCoordinates(boxScratch[a],boxScratch[a+1],boxScratch[a+2],boxScratch[d],boxScratch[d+1],boxScratch[d+2],boxScratch[e],boxScratch[e+1],boxScratch[e+2],c);}}
function cone(o,r1,r2,h,c,n=16){for(let i=0;i<n;i++){let a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,p=[o[0]+Math.cos(a)*r1,o[1],o[2]+Math.sin(a)*r1],q=[o[0]+Math.cos(b)*r1,o[1],o[2]+Math.sin(b)*r1],s=[o[0]+Math.cos(a)*r2,o[1]+h,o[2]+Math.sin(a)*r2],t=[o[0]+Math.cos(b)*r2,o[1]+h,o[2]+Math.sin(b)*r2];quad(p,s,t,q,c);tri([o[0],o[1]+h,o[2]],t,s,c);}}
function gem(o,s,c,n=7){const top=add(o,[0,s[1],0]),bottom=add(o,[0,-s[1]*.65,0]);for(let i=0;i<n;i++){let a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;let p=add(o,[Math.cos(a)*s[0],0,Math.sin(a)*s[2]]),q=add(o,[Math.cos(b)*s[0],0,Math.sin(b)*s[2]]);tri(top,q,p,c);tri(bottom,p,q,c);}}
const sphereTemplates=new Map();
function sphereTemplate(n,rings){
 n=Math.max(3,Math.round(n));rings=Math.max(3,Math.round(rings));const key=`${n}/${rings}`,cached=sphereTemplates.get(key);if(cached)return cached;
 const vertices=new Float32Array((n+1)*(rings+1)*3);let cursor=0;
 for(let j=0;j<=rings;j++){const b=j/rings*Math.PI,sinB=Math.sin(b),cosB=Math.cos(b);for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;vertices[cursor++]=Math.cos(a)*sinB;vertices[cursor++]=cosB;vertices[cursor++]=Math.sin(a)*sinB;}}
 const indices=new Uint32Array(n*2*(rings-1)*3);cursor=0;
 for(let j=0;j<rings;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+1,d=a+n+1,e=d+1;if(j>0){indices[cursor++]=a;indices[cursor++]=b;indices[cursor++]=d;}if(j<rings-1){indices[cursor++]=b;indices[cursor++]=e;indices[cursor++]=d;}}
 const template={vertices,indices,transformed:new Float32Array(vertices.length)};sphereTemplates.set(key,template);return template;
}
function ellipsoid(o,r,c,n=24,rings=14){const template=sphereTemplate(n,rings),source=template.vertices,target=template.transformed;for(let i=0;i<source.length;i+=3){target[i]=o[0]+source[i]*r[0];target[i+1]=o[1]+source[i+1]*r[1];target[i+2]=o[2]+source[i+2]*r[2];}const indices=template.indices;for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,d=indices[i+2]*3;triCoordinates(target[a],target[a+1],target[a+2],target[b],target[b+1],target[b+2],target[d],target[d+1],target[d+2],c);}}
function poseOvoid(v,r,c,o,yaw=0,pitch=0,roll=0,n=28,rings=16,pivot=[0,1.25,0]){
 const template=sphereTemplate(n,rings),source=template.vertices,target=template.transformed,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);
 for(let i=0;i<source.length;i+=3){let x=v[0]+source[i]*r[0]-pivot[0],y=v[1]+source[i+1]*r[1]-pivot[1],z=v[2]+source[i+2]*r[2]-pivot[2],rx=x*cr-y*sr; y=x*sr+y*cr;x=rx;const py=y*cp-z*sp,pz=y*sp+z*cp;y=py;z=pz;x+=pivot[0];y+=pivot[1];z+=pivot[2];target[i]=o[0]+x*cy+z*sy;target[i+1]=o[1]+y;target[i+2]=o[2]-x*sy+z*cy;}
 const indices=template.indices;for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,d=indices[i+2]*3;triCoordinates(target[a],target[a+1],target[a+2],target[b],target[b+1],target[b+2],target[d],target[d+1],target[d+2],c);}
}
function shadow(x,z,r){let y=height(x,z)+.04;for(let i=0;i<20;i++){let a=i/20*6.283,b=(i+1)/20*6.283;tri([x,y,z],[x+Math.cos(b)*r,height(x+Math.cos(b)*r,z+Math.sin(b)*r)+.04,z+Math.sin(b)*r],[x+Math.cos(a)*r,height(x+Math.cos(a)*r,z+Math.sin(a)*r)+.04,z+Math.sin(a)*r],color('60913e'));}}
function beam(a,b,width,col){const axis=sub(b,a),side=mul(norm(cross(axis,[0,1,0])),width);const up=mul(norm(cross(side,axis)),width);let p=[add(add(a,side),up),add(sub(a,side),up),sub(sub(a,side),up),sub(add(a,side),up)],q=p.map(v=>add(v,axis));for(let i=0;i<4;i++)quad(p[i],q[i],q[(i+1)%4],p[(i+1)%4],col);}
function tube(a,b,r,col,n=16){const axis=norm(sub(b,a)),guide=Math.abs(axis[1])>.92?[1,0,0]:[0,1,0],side=mul(norm(cross(axis,guide)),r),up=mul(norm(cross(side,axis)),r);for(let i=0;i<n;i++){const t=i/n*Math.PI*2,u=(i+1)/n*Math.PI*2,p=add(a,add(mul(side,Math.cos(t)),mul(up,Math.sin(t)))),q=add(a,add(mul(side,Math.cos(u)),mul(up,Math.sin(u)))),s=add(b,add(mul(side,Math.cos(t)),mul(up,Math.sin(t)))),v=add(b,add(mul(side,Math.cos(u)),mul(up,Math.sin(u))));quad(p,s,v,q,col);tri(a,q,p,col);tri(b,s,v,col);}}
const ISLAND_SIZE=306,flatZones=[[0,0,62,0],[-202,76,42,2],[184,82,44,3],[126,-188,46,4],[-92,-178,38,2],[8,202,38,6]];
function height(x,z){
 const r=Math.hypot(x*.96,z),shore=clamp((ISLAND_SIZE-r)/29,0,1),waves=Math.sin(x*.033)*2.4+Math.cos(z*.029)*2.1+Math.sin((x+z)*.018)*2.8;
 let y=-5+shore*(8+waves+15*Math.exp(-((x+36)**2+(z-176)**2)/3800)+11*Math.exp(-((x-188)**2+(z+122)**2)/2600)+8*Math.exp(-((x+205)**2+(z+92)**2)/2400));
 for(const [cx,cz,rad,level] of flatZones){const t=clamp(1-Math.hypot(x-cx,z-cz)/rad,0,1);y=mix(y,level,t*t*(3-2*t));}
 return y;
}
const obstacles=[],trees=[],buildings=[];
function solid(o,s,c,yaw=0){box(o,s,c,yaw);const ex=Math.abs(Math.cos(yaw))*s[0]/2+Math.abs(Math.sin(yaw))*s[2]/2,ez=Math.abs(Math.sin(yaw))*s[0]/2+Math.abs(Math.cos(yaw))*s[2]/2;obstacles.push({min:[o[0]-ex,o[1]-s[1]/2,o[2]-ez],max:[o[0]+ex,o[1]+s[1]/2,o[2]+ez]});}
// Ocean plus a broad triangulated island. The three-unit grid keeps the larger world smooth without overloading laptop GPUs.
box([0,-6,0],[760,2,760],color('3c9cbc'));
for(let x=-320;x<320;x+=3)for(let z=-320;z<320;z+=3){let a=[x,height(x,z),z],b=[x+3,height(x+3,z),z],c=[x+3,height(x+3,z+3),z+3],d=[x,height(x,z+3),z+3],r=Math.hypot(x*.96,z),base=r>282?color('d9c58d'):r>245?color('7fad55'):C.grass,tint=.88+rnd()*.2,col=base.map(v=>v*tint);tri(a,c,b,col);tri(a,d,c,col);}
box([0,.08,8],[98,.15,14],C.road);box([22,.09,-8],[12,.15,68],C.road);
for(let x=-45;x<50;x+=9)box([x,.18,8],[4,.03,.25],C.line);
for(let z=-35;z<37;z+=9)box([22,.19,z],[.25,.03,4],C.line);
function building(x,z,w,d,h,col){buildings.push({x,z,w,d});solid([x,h/2,z],[w,h,d],col);box([x,h+.2,z],[w+.5,.5,d+.5],C.cream);box([x,h+.52,z],[w-.6,.18,d-.6],C.teal);for(let i=-w/2+1.5;i<w/2;i+=2.8){box([x+i,2.5,z+d/2+.04],[1.7,2.2,.07],C.black);box([x+i,2.6,z+d/2+.09],[1.4,1.8,.07],C.blue.map(v=>v*.6));box([x+i,2.55,z+d/2+.15],[.08,2,.05],C.cream);}box([x,1.5,z+d/2+.2],[1.2,3,.16],C.teal);}
building(-9,-12,17,14,6,C.cream);building(-30,-15,11,11,4.5,C.red);building(37,-22,13,16,6,C.teal);building(-34,28,10,11,4,C.cream);
// Roadside diner: broad striped awning, tiered roof, and an oversized orange fruit sign.
for(let i=0;i<10;i++)box([-17.1+i*1.8,4.6,-3.8],[1.8,.22,3.3],i%2?C.cream:C.red,0,.14);
cone([-9,6.5,-12],9,4,2.9,C.teal,4);cone([-9,9.4,-12],4,1.6,1.3,C.cream,4);cone([-9,10.7,-12],.22,.22,2,C.black,6);gem([-9,14,-12],[2.6,2.5,2.6],color('f4a345'),10);cone([-9,16,-12],.22,.1,1,C.trunk);gem([-8.5,16.5,-12],[1.2,.25,.6],C.leaves,5);
// Forecourt.
box([39,.17,17],[22,.3,18],color('c5bfa5'));for(const x of[30,48])for(const z of[12,22]){solid([x,2.5,z],[.4,5,.4],C.red);box([x,1,z],[.7,.15,.7],C.cream);}box([39,5.1,17],[22,.6,15],C.cream);box([39,5.45,17],[22,.25,15],color('f6bd52'));for(const x of[34,43]){solid([x,1.2,17],[1.2,2.4,1],C.red);box([x,1.7,17.55],[.85,.55,.1],C.black);}
// Containers and parked cars.
for(let i=0;i<3;i++){let x=-11+i*8,z=29;solid([x,1.8,z],[6,3.6,10],i%2?C.red:C.teal);for(let k=-2.5;k<3;k+=.6)box([x+k,1.8,z+5.05],[.08,3.4,.09],C.metal);}
function car(x,z,yaw,col){const o=[x,.65,z];box(o,[2.6,1,4.8],col,yaw);box(transform([0,1.0,-.3],o,yaw),[2.2,1.15,2.4],C.black,yaw);box(transform([0,1.66,-.3],o,yaw),[2.3,.15,2.4],col,yaw);for(let a of[-1.3,1.3])for(let b of[-1.5,1.5])box(transform([a,-.1,b],o,yaw),[.35,.75,.8],C.black,yaw);obstacles.push({min:[x-1.6,0,z-2.5],max:[x+1.6,2.4,z+2.5]});}
car(7,-1,0,color('e6c667'));car(39,25,0,color('7bb7a7'));car(-27,10,Math.PI/2,color('88b8d2'));
// Named landing regions spread useful cover and recognizable landmarks across the expanded island.
const pois=[{name:'SUNCREST',x:0,z:0},{name:'HARBOR REACH',x:-202,z:76},{name:'NEON GROVE',x:184,z:82},{name:'CROWN CITADEL',x:126,z:-188},{name:'DUSTY DEPOT',x:-92,z:-178},{name:'PINEWATCH',x:8,z:202}];
function highway(a,b,width=7){const dx=b[0]-a[0],dz=b[1]-a[1],distance=Math.hypot(dx,dz),pieces=Math.ceil(distance/7),yaw=Math.atan2(dx,dz);for(let i=0;i<pieces;i++){const t=(i+.5)/pieces,x=mix(a[0],b[0],t),z=mix(a[1],b[1],t),y=height(x,z)+.13;box([x,y,z],[width,.22,distance/pieces+.25],C.road,yaw);if(i%2===0)box([x,y+.13,z],[.18,.025,distance/pieces*.55],C.line,yaw);}}
highway([-42,4],[-180,69]);highway([45,6],[161,71]);highway([28,-37],[113,-165]);highway([-21,-39],[-80,-156]);highway([7,45],[8,178]);
function cityBuilding(x,z,w,d,h,col,roof=C.cream){const y=height(x,z);buildings.push({x,z,w,d});solid([x,y+h/2,z],[w,h,d],col);box([x,y+h+.18,z],[w+.45,.36,d+.45],roof);box([x,y+h+.48,z],[w-.7,.22,d-.7],C.metal);for(let floor=2.1;floor<h-.6;floor+=2.25)for(let ix=-w/2+1.15;ix<w/2;ix+=2.1){box([x+ix,y+floor,z+d/2+.05],[1.15,1.15,.08],C.glass);box([x+ix,y+floor,z-d/2-.05],[1.15,1.15,.08],C.glass);}box([x,y+1.4,z+d/2+.12],[1.3,2.8,.18],C.black);for(let k=0;k<3;k++)box([x-1.3+k*1.3,y+h+.76,z],[.9,.55,.9],C.metal);}
// Harbor Reach: warehouses, dock fingers, gantries, containers and a beacon tower.
for(const [x,z,w,d,h,c] of [[-214,66,17,12,7,C.teal],[-190,64,15,11,9,C.cream],[-207,91,12,14,6,C.red],[-181,88,13,12,8,C.teal]])cityBuilding(x,z,w,d,h,c);
for(let i=0;i<5;i++){const x=-232+i*10,y=height(x,105);box([x,y+.15,105],[7,.3,28],C.wood);for(const side of[-1,1])for(let z=94;z<119;z+=4)box([x+side*3,y-1,z],[.3,2.2,.3],C.wood);}
for(let i=0;i<10;i++){const x=-225+(i%5)*9,z=51+Math.floor(i/5)*8,y=height(x,z);solid([x,y+1.65,z],[7.5,3.3,6.5],i%3===0?C.red:i%3===1?C.teal:C.cream);}
{const x=-245,z=76,y=height(x,z);cone([x,y,z],3.2,2.5,15,C.cream,20);box([x,y+15.4,z],[7,.7,7],C.red);ellipsoid([x,y+17,z],[2.5,1.8,2.5],C.glass,28,16);gem([x,y+20,z],[.55,1.1,.55],C.gold,8);}
// Neon Grove: taller colorful blocks, central plaza and a water tower landmark.
for(const [x,z,w,d,h,c] of [[169,72,13,14,13,C.teal],[187,67,12,12,17,C.red],[203,82,14,14,11,C.cream],[171,96,16,11,9,C.red],[194,103,12,13,15,C.teal]])cityBuilding(x,z,w,d,h,c,C.gold);
{const x=184,z=83,y=height(x,z);cone([x,y+.05,z],12,12,.35,color('b6c6ab'),48);for(let i=0;i<8;i++){const a=i/8*6.283;box([x+Math.cos(a)*9,y+.65,z+Math.sin(a)*9],[1.3,1.2,1.3],i%2?C.blue:C.gold,a);}}
{const x=214,z=107,y=height(x,z);for(const s of[-1,1])for(const q of[-1,1])beam([x+s*2,y,z+q*2],[x+s*.9,y+12,z+q*.9],.13,C.metal);ellipsoid([x,y+13,z],[4,3.2,4],C.teal,32,18);box([x,y+13,z],[8.3,.25,1],C.cream);}
// Crown Citadel: dense stone complex with a clock tower and roofline cover.
for(const [x,z,w,d,h] of [[107,-198,16,14,10],[127,-207,18,15,13],[147,-191,16,14,9],[111,-175,14,12,8],[139,-169,18,13,11]])cityBuilding(x,z,w,d,h,color('a7a397'),color('525f68'));
{const x=126,z=-188,y=height(x,z);solid([x,y+13,z],[10,26,10],color('8e938e'));box([x,y+26.5,z],[12,.9,12],C.cream);cone([x,y+27,z],7.5,.4,8,color('4e6570'),4);for(const side of[-1,1]){box([x+side*5.05,y+19,z],[.12,6,4],C.glass);box([x,y+19,z+side*5.05],[4,6,.12],C.glass);}ellipsoid([x,y+21,z-5.2],[2.1,2.1,.18],C.cream,28,16);ellipsoid([x,y+21,z-5.4],[1.55,1.55,.1],C.black,28,16);beam([x,y+21,z-5.56],[x+.1,y+22.25,z-5.56],.055,C.cream);beam([x,y+21,z-5.56],[x+1.05,y+20.35,z-5.56],.055,C.cream);}
// Dusty Depot: aircraft hangars, silos and stacked cargo.
for(const [x,z,w,d,h,c] of [[-111,-183,20,18,8,C.red],[-85,-190,21,18,8,C.teal],[-89,-161,17,14,6,C.cream]])cityBuilding(x,z,w,d,h,c,C.metal);
for(const x of[-124,-118,-67,-61]){const z=-167,y=height(x,z);cone([x,y,z],3.2,3.2,11,C.metal,24);cone([x,y+11,z],3.2,.15,3,C.cream,24);}
for(let i=0;i<12;i++){const x=-120+(i%6)*10,z=-211+Math.floor(i/6)*7,y=height(x,z);solid([x,y+1.5,z],[8.4,3,5.8],i%3===0?C.gold:i%3===1?C.red:C.teal);}
// Pinewatch: timber lodge village around a radio lookout.
for(const [x,z,w,d,h] of [[-9,194,13,11,6],[9,184,14,12,7],[25,207,12,10,6],[-19,216,15,12,7]])cityBuilding(x,z,w,d,h,C.wood,color('4e5b4f'));
{const x=8,z=202,y=height(x,z);for(const s of[-1,1])for(const q of[-1,1])beam([x+s*2.8,y,z+q*2.8],[x+s*.9,y+22,z+q*.9],.12,C.metal);for(let h=5;h<22;h+=5){beam([x-2.2,y+h,z],[x+2.2,y+h,z],.09,C.metal);beam([x,y+h,z-2.2],[x,y+h,z+2.2],.09,C.metal);}gem([x,y+24,z],[.6,1.4,.6],C.red,8);}
for(let x=-43;x<8;x+=3){let z=43,y=height(x,z);box([x,y+1,z],[.16,2,.16],C.wood);box([x+1.5,y+1.5,z],[3,.18,.16],C.wood);box([x+1.5,y+.7,z],[3,.18,.16],C.wood);}
for(let i=0;i<460;i++){const a=rnd()*6.28,r=45+rnd()*240,x=Math.cos(a)*r,z=Math.sin(a)*r;if(pois.some(p=>Math.hypot(x-p.x,z-p.z)<34))continue;const y=height(x,z),s=.7+rnd()*1.05;trees.push({x,z});shadow(x,z,3*s);cone([x,y,z],.4*s,.24*s,3*s,C.trunk,18);if(i%3===0){for(let k=0;k<3;k++)cone([x,y+(2+k*1.5)*s,z],(3-k*.6)*s,0,3.7*s,C.pine,18);}else{ellipsoid([x,y+5*s,z],[3.4*s,3*s,3.2*s],C.leaves,26,15);ellipsoid([x+1.6*s,y+5*s,z],[2*s,1.8*s,2.4*s],C.pine,22,13);}obstacles.push({min:[x-.5,y,z-.5],max:[x+.5,y+3*s,z+.5]});}
for(let i=0;i<150;i++){let x=(rnd()-.5)*575,z=(rnd()-.5)*575;if(Math.hypot(x,z)<49||pois.some(p=>Math.hypot(x-p.x,z-p.z)<30))continue;let s=1+rnd()*3;gem([x,height(x,z)+s*.3,z],[s,s*.9,s*.8],C.rock,7);}
// Small grass clusters on the overlook, batched with the terrain.
for(let i=0;i<3600;i++){let x=(rnd()-.5)*570,z=(rnd()-.5)*570;if(pois.some(p=>Math.hypot(x-p.x,z-p.z)<34))continue;let y=height(x,z),s=.3+rnd()*.65;tri([x-.12,y,z],[x+.13,y,z],[x+.1,y+s,z],i%2?C.darkGrass:C.grass);}
for(let i=0;i<34;i++){let x=(rnd()-.5)*680,z=-180-rnd()*220,y=70+rnd()*55;for(let j=0;j<3;j++)ellipsoid([x+j*7,y+(j===1?1.5:0),z],[10,3.2,5.5],color('eaf4ed'),10,7);}
for(const b of buildings){for(let i=-b.w/2+.5;i<b.w/2;i+=1.4){box([b.x+i, .5,b.z+b.d/2+.09],[1.2,.65,.15],color('cabb99'));}for(let i=0;i<3;i++){box([b.x+i*1.3-1.3,6.9,b.z],[1,.8,1],C.metal);}}
for(let i=0;i<9;i++){let x=-42+i*10;cone([x,0,18],.12,.09,5,C.black);beam([x,5,18],[x+1.2,5,18],.08,C.black);box([x+1.2,4.94,18],[.75,.16,.4],C.cream);}
for(let i=0;i<14;i++){let x=-42+i*6,z=-34;box([x,.55,z],[1.1,1.1,1.1],C.wood);for(let k of[-.45,.45])box([x+k,.55,z+.57],[.12,1.15,.08],C.black);}
const staticData=new Float32Array(geo),staticBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,staticBuffer);gl.bufferData(gl.ARRAY_BUFFER,staticData,gl.STATIC_DRAW);const dynamicBuffer=gl.createBuffer(),dynamicData=new ReusableFloatBuffer(262144);geo.length=0;
const matrixView=new Float32Array(16),matrixProjection=new Float32Array(16),matrixData=new Float32Array(16);
function matrix(eye,target,aspect,fov){let zx=eye[0]-target[0],zy=eye[1]-target[1],zz=eye[2]-target[2],zLength=Math.hypot(zx,zy,zz)||1;zx/=zLength;zy/=zLength;zz/=zLength;let xx=zz,xz=-zx,xLength=Math.hypot(xx,xz)||1;xx/=xLength;xz/=xLength;const yx=zy*xz,yy=zz*xx-zx*xz,yz=-zy*xx;matrixView[0]=xx;matrixView[1]=yx;matrixView[2]=zx;matrixView[3]=0;matrixView[4]=0;matrixView[5]=yy;matrixView[6]=zy;matrixView[7]=0;matrixView[8]=xz;matrixView[9]=yz;matrixView[10]=zz;matrixView[11]=0;matrixView[12]=-(xx*eye[0]+xz*eye[2]);matrixView[13]=-(yx*eye[0]+yy*eye[1]+yz*eye[2]);matrixView[14]=-(zx*eye[0]+zy*eye[1]+zz*eye[2]);matrixView[15]=1;matrixProjection.fill(0);const f=1/Math.tan(fov/2),near=.15,far=820;matrixProjection[0]=f/aspect;matrixProjection[5]=f;matrixProjection[10]=(far+near)/(near-far);matrixProjection[11]=-1;matrixProjection[14]=2*far*near/(near-far);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let sum=0;for(let k=0;k<4;k++)sum+=matrixProjection[k*4+r]*matrixView[c*4+k];matrixData[c*4+r]=sum;}return matrixData;}
function draw(buffer,count){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.vertexAttribPointer(ap,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(ac,3,gl.FLOAT,false,24,12);gl.drawArrays(gl.TRIANGLES,0,count);}
const keys={},player={p:[-18,height(-18,62),62],vy:0,hp:100,shield:50,yaw:0};let yaw=0,pitch=-.15,eye=[-18,19,69],forward=[0,0,-1],running=false,started=false,ended=false,aim=false,firing=false,slot=1,ammo=30,wood=150,reloading=0,cooldown=0,elapsed=0,kills=0,storm=125,noticeTime=0,hitTime=0,hurt=0,walk=0,time=0;
let bots=[],pickups=[],structures=[],skyshipData=null,skyshipRenderData=null,skyshipMotion=null,skyshipMotionRound=-1,dropSequence=null,skyshipPresentation={standBlend:0,hatchBlend:0,rearLookBlend:0},matchPhase='',matchRound=0,loadout=createLoadout(),reloadWeapon='ar',viewSlot=1,playerMotion=null,playerMotionId='',cameraPresentation=createCameraPresentation(),viewModelState=createViewModelState(),weaponPartState=createWeaponPartState();const visualPeers=new Map(),projectileVisuals=new Map(),projectileEventCache=new Map(),effectPool=createEffectPool(144),spawnEffect=data=>effectPool.activeCount<currentQuality.effects?effectPool.spawn(data):null,cameraBlendOutput=createCameraBlendOutput();let buildRotation=0,flash=0,recoil=0,recoilPitch=0,recoilYaw=0,damageNumber=0,equipTime=0,equipDuration=.34,adsBlend=0,cameraFov=1.07,sustained=0,mouseSwayX=0,mouseSwayY=0,viewShotImpulse=0,lastWeaponSlot=1,lastBuildSlot=5;
const spawns=[[-20,4],[8,-24],[34,-5],[-38,1],[4,44],[48,36],[-54,-25],[15,-53]];
const characterWeaponPartState=createWeaponPartState();
function drawWeaponLayout(profile,parts,scale,drawBox,drawOval,drawTube,detail=1){
 const model=WEAPON_MODELS[profile.id];if(!model)return;
 const palette={dark:C.black,metal:C.metal,stock:C.wood,trim:C.cream,accent:color(profile.color.slice(1)),glass:C.blue,gold:C.gold};
 for(const component of model.parts){
  const move=component.motion;let ox=0,oy=0,oz=0,rotation=component.rotation||0;
  if(move==='magazine'){
   if(parts.stage!=='idle'&&!parts.magazineVisible)continue;
   if(parts.stage!=='idle'){ox=parts.magazine[0];oy=parts.magazine[1];oz=parts.magazine[2];rotation+=parts.magazineRotation;}
  }else if(move==='freshMagazine'){
   if(!parts.freshMagazineVisible)continue;
   ox=parts.freshMagazine[0];oy=parts.freshMagazine[1];oz=parts.freshMagazine[2];rotation+=parts.freshMagazineRotation;
  }else if(move==='bolt')oz+=(parts.action||0)*.15;
  else if(move==='action')oz+=(parts.action||0)*.12;
  else if(move==='pump')oz+=(parts.action||0)*.2;
  const material=palette[component.material]||C.metal,pos=[component.position[0]+ox,component.position[1]+oy,component.position[2]+oz];
  if(component.shape==='box')drawBox(pos,component.size.map(value=>value*scale),material,rotation);
  else if(component.shape==='oval')drawOval(pos,component.size.map(value=>value*scale),material,Math.max(10,Math.round(component.sides*detail)),Math.max(8,Math.round(component.rings*detail)));
  else if(component.shape==='tube')drawTube([component.from[0]+ox,component.from[1]+oy,component.from[2]+oz],[component.to[0]+ox,component.to[1]+oy,component.to[2]+oz],component.size[0]*scale,material,Math.max(8,Math.round(component.sides*detail)));
 }
}
function reset(){Object.assign(player,{p:[-18,height(-18,62),62],vy:0,hp:100,shield:50,yaw:0,air:'landed'});visualPeers.clear();projectileVisuals.clear();projectileEventCache.clear();effectPool.clear();playerMotion=null;playerMotionId='';skyshipData=null;skyshipRenderData=null;skyshipMotion=null;skyshipMotionRound=-1;dropSequence=null;skyshipPresentation={standBlend:0,hatchBlend:0,rearLookBlend:0};shipCameraRound=-1;cameraPresentation=createCameraPresentation();viewModelState=createViewModelState();weaponPartState=createWeaponPartState();viewShotImpulse=0;matchRound=0;yaw=0;pitch=-.15;loadout=createLoadout();ammo=30;wood=150;elapsed=0;kills=0;storm=125;ended=false;slot=1;reloading=0;cooldown=0;structures=[];buildRotation=0;flash=0;recoil=0;recoilPitch=0;recoilYaw=0;equipTime=0;adsBlend=0;cameraFov=1.07;sustained=0;bots=spawns.map(([x,z],i)=>({p:[x,height(x,z),z],hp:100,yaw:0,seed:i*2.2,cool:2+i*.3,slot:1,weapon:'ar',reload:0,equip:0,aim:false}));pickups=[[-19,49,'shield'],[-3,16,'wood'],[27,26,'health'],[-39,-3,'wood'],[8,-36,'shield'],[-27,35,'health']].map(([x,z,type])=>({x,z,type}));select(1,true);updateHUD();}
function character(p,angle,phase,col,enemy=false,air='landed',deploy=1,pose='combat',anim={}){
 const airborne=['launchTransit','skyDrift','gliderOpening','gliding','gliderFolding'].includes(air),opening=air==='gliderOpening'||air==='gliderFolding',open=air==='gliding'?1:opening?clamp(deploy,0,1):0,rigPitch=airborne?(Number.isFinite(anim.airPitch)?anim.airPitch:mix(-1.34,.04,open)):0,rigRoll=airborne?(anim.airRoll||0):0,detail=enemy?currentQuality.remoteDetail*clamp(1-(length(sub(p,eye))-40)/260,.52,1):1,segments=n=>Math.max(10,Math.round(n*detail)),rig=v=>poseTransform(v,p,angle,rigPitch,rigRoll),part=(v,s,c,rx=0)=>box(rig(v),s,c,angle,rx+rigPitch),ball=(v,r,c,n=22,q=13)=>poseOvoid(v,r,c,p,angle,rigPitch,rigRoll,segments(n),segments(q)),limb=(a,b,w,c)=>tube(rig(a),rig(b),w,c,segments(18)),roundPart=(v,r,c,n=26,q=15)=>poseOvoid(v,r,c,p,angle,rigPitch,rigRoll,segments(n),segments(q));
 const sway=Math.sin(time*3.2+phase)*.14,step=Math.sin(phase)*.22,skin=C.skin;
 const weapon=WEAPON_PROFILES[anim.weapon]||WEAPON_PROFILES.ar,reloadP=anim.reload?reloadProgress(anim.reload,weapon.slot):0,equipP=clamp((anim.equip||0)/weapon.equipDuration,0,1),aimP=anim.aim?1:0;
 const poseParts=stepWeaponParts(characterWeaponPartState,weapon,anim.reload||0),reloadWave=Math.sin(Math.PI*clamp(reloadP/.92,0,1)),breath=Math.sin(time*1.65+phase*.05)*.012,localSway=anim.local?[mouseSwayX*.0015,mouseSwayY*.0012]:[0,0];
 const gunX=mix(.28,.1,aimP)+localSway[0],gunY=1.56+breath-localSway[1]-.34*equipP+.08*reloadWave,gunZ=-.7+(anim.recoil||0)*1.25+.16*equipP,gunTilt=poseParts.rootTilt+.75*equipP;
 // Rounded, fitted "trail runner" kit uses the same smooth silhouette at
 // every distance, with only its segment budget reduced for faraway players.
 const cloth=col.map(v=>v*.78),trim=col.map(v=>Math.min(1,v*1.16)),hair=color('263b44'),avatarMaterial=name=>name==='base'?col:name==='cloth'?cloth:name==='trim'?trim:name==='pants'?C.pants:name==='skin'?skin:name==='hair'?hair:name==='dark'?C.black:name==='metal'?C.metal:name==='gold'?C.gold:name==='glass'?C.glass:name==='accent'?(enemy?C.red:C.blue):C.metal;
 for(const piece of AVATAR_MODEL_PARTS){for(const side of piece.mirror?[-1,1]:[1]){const sign=piece.mirror?side:1,material=avatarMaterial(piece.material);if(piece.shape==='tube'){limb([piece.from[0]*sign,piece.from[1],piece.from[2]],[piece.to[0]*sign,piece.to[1],piece.to[2]],piece.size[0],material);}else{roundPart([piece.position[0]*sign,piece.position[1],piece.position[2]],piece.size,material,segments(piece.sides),segments(piece.rings));}}}
 // The legs trail and sway through the arcade glide.
 for(const side of[-1,1]){
  const hip=[side*.19,.96,0],neutralKnee=[side*.34,.57,.17+sway*side],glideKnee=[side*.28,.58,.15+sway*side],neutralAnkle=[side*.48,.18,.08-sway*side],glideAnkle=[side*.36,.16,.28-sway*side],knee=airborne?neutralKnee.map((v,k)=>mix(v,glideKnee[k],open)):[side*.19,.56,step*side],ankle=airborne?neutralAnkle.map((v,k)=>mix(v,glideAnkle[k],open)):[side*.18,.16,-.08-step*side];
  roundPart(hip,[.2,.22,.19],C.pants,26,16);limb(hip,knee,.177,C.pants);const thigh=hip.map((v,k)=>mix(v,knee[k],.43));roundPart([thigh[0],thigh[1],thigh[2]-.105],AVATAR_GEAR.thighPanel.size,cloth,24,14);roundPart(knee,[.18,.19,.165],C.pants,24,14);roundPart([knee[0],knee[1],knee[2]-.145],AVATAR_GEAR.kneeGuard.size,C.metal,24,14);roundPart([knee[0],knee[1],knee[2]-.208],AVATAR_GEAR.kneeGuard.inset,enemy?C.red:C.blue,20,12);limb(knee,ankle,.162,C.pants);roundPart([ankle[0],ankle[1]+.18,ankle[2]-.085],AVATAR_GEAR.shinPanel.size,cloth,22,13);roundPart(ankle,AVATAR_GEAR.boot.ankle,C.black,22,14);roundPart([ankle[0],ankle[1]-.07,ankle[2]-.13],AVATAR_GEAR.boot.toe,C.black,24,14);roundPart([ankle[0],ankle[1]-.155,ankle[2]-.13],AVATAR_GEAR.boot.sole,C.metal,22,13);roundPart([ankle[0],ankle[1]+.08,ankle[2]-.025],[.18,.045,.17],trim,18,11);
 }
 // Arms follow the equipped item, including the magazine handoff during reload and a relaxed lobby stance.
 for(const side of[-1,1]){
  const shoulder=[side*.43,1.79,-.01];let elbow,hand;
  if(airborne){const currentHand=[side*1.02,1.68,-.06+sway*.25],wingHand=[side*.48,2.72,-.04],currentElbow=[side*.73,1.79,-.02],wingElbow=[side*.6,2.25,-.06];hand=currentHand.map((v,i)=>mix(v,wingHand[i],open));elbow=currentElbow.map((v,i)=>mix(v,wingElbow[i],open));}
  else if(pose==='lobby'||pose==='ship'){const idle=Math.sin(time*1.25+side)*.018;elbow=[side*.49,1.45+idle,.025];hand=[side*.4,1.08+idle,.06];}
  else if(anim.building){elbow=[side*.48,1.62,-.27];hand=[side*.32,1.5,-.7];}
  else if(side<0){const reach=weapon.id==='shotgun'?-.98:weapon.id==='sniper'?-1.08:-.88,handOffset=poseParts.supportHand;elbow=[-.45,1.58+.12*aimP+handOffset[1]*.22,-.3+handOffset[2]*.2];hand=[gunX-.18+handOffset[0]*.55,gunY-.02+handOffset[1]*.65,reach+handOffset[2]*.55];}
  else{elbow=[.5,1.58+.1*aimP,-.23];hand=[gunX+.05,gunY-.1,gunZ+.16];}
  const wrist=elbow.map((value,index)=>mix(value,hand[index],.8));roundPart(shoulder,[.195,.215,.2],col,28,16);limb(shoulder,elbow,.165,cloth);roundPart(elbow,[.147,.16,.145],cloth,22,14);limb(elbow,hand,.13,cloth);roundPart(wrist,AVATAR_GEAR.wristCuff.size,trim,20,12);roundPart(hand,AVATAR_GEAR.glove.size,C.black,22,13);for(const knuckle of[-1,0,1])roundPart([hand[0]+knuckle*.045,hand[1]+.045,hand[2]-.08],AVATAR_GEAR.knuckle.size,C.metal,14,9);
 }
 if(!airborne&&pose!=='lobby'&&pose!=='ship'){
  if(anim.building){
   const pulse=.8+Math.sin(time*4)*.08;part([0,1.48,-.73],[.78,.56,.045],C.blue.map(v=>Math.min(1,v*pulse)));for(const x of[-.3,-.1,.1,.3])part([x,1.48,-.76],[.018,.5,.012],C.cream);for(const y of[1.28,1.48,1.68])part([0,y,-.77],[.72,.018,.012],C.cream);part([.38,1.74,-.75],[.09,.09,.03],C.gold);
  }else{
  const gunScale=.73,gunPoint=v=>{const y=v[1]*gunScale,z=v[2]*gunScale;return rig([gunX+v[0]*gunScale,gunY+y*Math.cos(gunTilt)-z*Math.sin(gunTilt),gunZ+y*Math.sin(gunTilt)+z*Math.cos(gunTilt)]);},gunBox=(v,s,c,rx=0)=>box(gunPoint(v),s,c,angle,gunTilt+rx+rigPitch),gunOval=(v,s,c,n,q)=>poseOvoid(gunPoint(v),s,c,[0,0,0],0,0,0,n,q),gunTube=(a,b,r,c,n)=>tube(gunPoint(a),gunPoint(b),r,c,n);
  drawWeaponLayout(weapon,poseParts,gunScale,(v,s,c,rx)=>gunBox(v,s,c,rx),(v,s,c,n,q)=>gunOval(v,s,c,segments(n),segments(q)),(a,b,r,c,n)=>gunTube(a,b,r,c,segments(n)),detail);
  }
 }else if(airborne){
  // Small harness anchors tie the glider panels into the outfit.
  limb([-.3,1.9,.36],[-.15,1.45,.38],.035,C.blue);limb([.3,1.9,.36],[.15,1.45,.38],.035,C.blue);roundPart([0,1.42,.39],[.21,.055,.05],C.gold,18,10);
 }
}


function ovoid(o,r,c,yaw=0,n=28,rings=16){const pt=(i,j)=>{const a=i/n*Math.PI*2,b=j/rings*Math.PI;return transform([Math.cos(a)*Math.sin(b)*r[0],Math.cos(b)*r[1],Math.sin(a)*Math.sin(b)*r[2]],o,yaw);};for(let j=0;j<rings;j++)for(let i=0;i<n;i++){const a=pt(i,j),b=pt(i+1,j),d=pt(i,j+1),e=pt(i+1,j+1);if(j>0)tri(a,b,d,c);if(j<rings-1)tri(b,e,d,c);}}
function skyshipCraft(ship,hatchBlend=0){
 if(!ship)return;const o=[ship.x,ship.y,ship.z],a=ship.yaw||0,pt=v=>transform(v,o,a),part=(v,d,c,rx=0)=>box(pt(v),d,c,a,rx),orb=(v,r,c,n=30,q=18)=>ovoid(pt(v),r,c,a,n,q),link=(v,w,r,c)=>beam(pt(v),pt(w),r,c);
 const hull=color('315565'),deck=color('243f4d'),trim=color('e6c66f'),glass=color('75c7d4'),lift=color('4c8d94'),open=clamp(hatchBlend,0,1),hingeY=-.08,hingeZ=6.2,hatchHeight=3.12,angle=open*Math.PI*.49;
 // A civilian Cloudliner: a rounded sky ferry with levitation cells and a folding aft loading hatch.
 orb([0,-.24,.15],[3.12,1.38,7.9],hull,42,24);orb([0,-.76,.05],[2.72,.66,7.1],deck,36,22);
 part([0,-1.18,.1],[1.25,.42,9.6],color('526b70'));part([0,-1.39,.1],[.48,.18,8.3],trim);
 for(const side of[-1,1])for(const z of[-3.2,2.2]){
  orb([side*3.05,-.05,z],[1.48,1.05,2.15],lift,30,18);orb([side*3.52,.04,z],[.43,.55,1.34],color('5baeb0'),24,14);
  for(let r=0;r<12;r++){const t=r/12*Math.PI*2,p0=[side*3.06+Math.cos(t)*1.18,-.05+Math.sin(t)*.78,z],p1=[side*3.06+Math.cos((r+1)/12*Math.PI*2)*1.18,-.05+Math.sin((r+1)/12*Math.PI*2)*.78,z];link(p0,p1,.026,r%3?C.cable:trim);}
 }
 // Panoramic cabin glazing, stepped deck rails, a rounded prow, and a high aft fin distinguish the ferry silhouette.
 orb([0,1.22,-.72],[2.62,1.27,3.28],color('496a76'),36,22);orb([0,1.68,-3.72],[1.72,.82,1.58],glass,32,18);
 for(const side of[-1,1]){
  for(const z of[-2.8,-.7,1.4,3.45])part([side*2.82,1.9,z],[.075,1.08,1.42],glass);
  for(const z of[-3.65,-1.75,.3,2.35,4.25])link([side*2.74,1.05,z],[side*2.74,2.7,z],.055,trim);
  link([side*2.2,2.96,-4.6],[side*2.7,3.5,-2.7],.12,trim);link([side*2.7,3.5,-2.7],[side*2.7,3.35,3.2],.12,trim);link([side*2.7,3.35,3.2],[side*2.1,2.95,5.35],.12,trim);
 }
 part([0,2.7,4.6],[4.2,.38,2.4],color('3c5963'));part([0,3.05,4.7],[2.6,.2,1.5],trim);
 // Open ramp is animated with the same hinge and angle as the cabin hatch.
 part([0,hingeY+hatchHeight*.5*Math.cos(angle),hingeZ+hatchHeight*.5*Math.sin(angle)],[3.55,hatchHeight,.18],color('58727a'),angle);
 for(const side of[-1,1]){link([side*1.72,hingeY,hingeZ],[side*1.72,hingeY+hatchHeight*.5*Math.cos(angle),hingeZ+hatchHeight*.5*Math.sin(angle)],.09,trim);}
 for(let i=0;i<6;i++)part([-1.45+i*.58,-.05,hingeZ-.12],[.36,.045,.035],i%2?C.cream:color('c37b50'));
 // Quiet lift-cell shimmer and soft cloud wakes keep the flight animated.
 for(let k=0;k<5;k++){const z=6+k*3.8-Math.min(1,(time*.55)%1)*3.8,y=-1.5-k*.38;orb([0,y,z],[2.8+k*.42,.34,1.05],color(k%2?'e4f1e9':'b7d6d8'),18,9);}
}
function skyshipInterior(ship,eye,lookYaw,sequence={}){
 if(!ship)return;const origin=[ship.x,ship.y,ship.z],shipYaw=ship.yaw||0,room=v=>cabinPoint(v,origin,shipYaw),view=v=>cabinPoint(v,eye,lookYaw),part=(v,size,c,rx=0)=>box(room(v),size,c,shipYaw,rx),line=(v,w,r,c)=>beam(room(v),room(w),r,c),viewLine=(v,w,r,c)=>beam(view(v),view(w),r,c),stand=clamp(sequence.standBlend||0,0,1),hatchBlend=clamp(sequence.hatchBlend||0,0,1),pulse=.78+Math.sin(time*2.5)*.08;
 const dark=color('203741'),wall=color('344f58'),panel=color('43616a'),edge=color('c6b777'),floor=color('344950'),seat=color('5e6a61'),hatchColor=color('5b7379');
 // Permanent craft-space walls and floor create real parallax as the first-person camera moves.
 part([0,-.18,.35],[5.55,.3,13.45],dark);part([0,.005,.35],[5.2,.07,12.95],floor);part([0,.055,.35],[.9,.035,12.3],color('536a65'));
 for(let z=-5.8;z<6.2;z+=1.15){part([0,.095,z],[.045,.018,.74],z%2?edge:C.cable);}
 part([0,4.12,.35],[5.85,.26,13.55],dark);part([0,3.96,.35],[4.8,.07,12.65],wall);
 // Window openings stay open to the sky; broad ribs and warm inset rails frame the outside view.
 for(const side of[-1,1]){
  part([side*2.83,.32,.35],[.22,.76,13.1],wall);part([side*2.83,3.45,.35],[.22,1.12,13.1],wall);
  part([side*2.83,1.04,.35],[.2,.08,13.1],edge);part([side*2.83,2.97,.35],[.2,.09,13.1],edge);
  for(const z of[-5.7,-3.4,-1.1,1.2,3.5,5.8]){line([side*2.76,-.02,z],[side*2.76,3.95,z],.095,edge);part([side*2.66,2.28,z],[.08,.12,.72],C.blue.map(v=>Math.min(1,v*pulse)));}
  for(const z of[-4.6,-2.3,0,2.3,4.6]){part([side*2.1,.52,z],[1.15,.42,1.55],seat);part([side*2.1,.79,z],[1.12,.13,1.52],color('927a59'));for(const k of[-.42,.42])line([side*2.1+k,.04,z+.55],[side*2.1+k,.48,z+.55],.035,edge);}
 }
 for(const z of[-5.8,-3.5,-1.2,1.1,3.4,5.7]){line([-2.76,3.86,z],[2.76,3.86,z],.075,edge);part([0,3.8,z],[.3,.09,.36],color('c1e3d8'));}
 // Simple front bulkhead with a broad glazed view and guided cabin lights.
 part([0,1.67,-6.23],[5.55,3.38,.22],dark);part([0,2.42,-6.08],[3.28,1.43,.055],color('68a8b5'));part([0,1.66,-6.06],[2.95,.12,.09],edge);
 for(let i=-3;i<=3;i++){part([i*.28,3.52,-6.04],[.12,.045,.06],i%2?C.blue:edge);}
 // Aft frame: the lower hatch panel swings down and outward around its bottom hinge.
 const hingeY=.02,hingeZ=6.2,hatchHeight=3.18,angle=hatchBlend*Math.PI*.49;
 part([-2.05,1.68,6.18],[.9,3.42,.28],dark);part([2.05,1.68,6.18],[.9,3.42,.28],dark);part([0,3.48,6.18],[3.65,.66,.28],dark);
 line([-1.78,.02,6.02],[-1.78,3.18,6.02],.09,edge);line([1.78,.02,6.02],[1.78,3.18,6.02],.09,edge);
 part([0,hingeY+hatchHeight*.5*Math.cos(angle),hingeZ+hatchHeight*.5*Math.sin(angle)],[3.45,hatchHeight,.2],hatchColor,angle);
 for(let side of[-1,1]){const x=side*1.52;line([x,hingeY,hingeZ],[x,hingeY+hatchHeight*.5*Math.cos(angle),hingeZ+hatchHeight*.5*Math.sin(angle)],.065,edge);}
 for(let i=0;i<8;i++){const x=-1.45+i*.41;part([x,.09,6.01],[.22,.06,.035],i%2?color('c5814c'):C.cream);}
 for(const side of[-1,1]){part([side*2.42,3.59,-.2],[.3,.06,11.5],color('b5d5c6'));part([side*2.42,.02,-.2],[.12,.05,11.5],edge);}
 // First-person hands, cuffs and seated boots move with the eye while the cabin remains fixed.
 const seated=1-stand;for(const side of[-1,1]){
  const boot=view([side*.22,-1.08+stand*.34,-.84+stand*.12]);ovoid(boot,[.18,.11,.34],color('263c48'),0,20,10);
  const forearm=view([side*.43,-.69-stand*.18,-.38]);box(forearm,[.22,.13,.48],color('577363'),lookYaw,.08);
  const hand=view([side*.44,-.69-stand*.18,-.12]);ovoid(hand,[.115,.1,.14],C.skin,0,18,9);viewLine([side*.44,-.77,-.18],[side*.44,-.77,-.04],.018,edge);
 }
 for(let i=0;i<8;i++){const x=(i-3.5)*.5;line([-2.3,-.03,-5.25],[x,-.03,-5.25+seated*.07],.009,C.blue);}
}
function gliderCanopy(p,angle,col,amount=1,bank=0){
 const open=clamp(amount,0,1),ease=open*open*(3-2*open),root=[0,2.04,.36];
 for(const side of[-1,1]){const span=3.9*ease,up=1.25*ease,hinge=poseTransform(root,p,angle,0,bank),tip=poseTransform([side*span,2.08+up,.48],p,angle,0,bank),outer=poseTransform([side*span*.77,1.35+up,.15],p,angle,0,bank),low=poseTransform([side*span*.28,1.52,.55],p,angle,0,bank);tri(hinge,tip,outer,col.map(v=>Math.min(1,v*1.2)));tri(hinge,outer,low,col.map(v=>Math.min(1,v*.96)));beam(hinge,tip,.045,C.cream);beam(tip,outer,.032,C.blue);for(let k=1;k<5;k++){const t=k/5,a=hinge.map((v,i)=>v+(tip[i]-v)*t),b=hinge.map((v,i)=>v+(outer[i]-v)*t);beam(a,b,.016,k%2?C.blue:C.cream);}}
}
function arcadeLaunchStreaks(eye,yaw,progress=0){
 const p=v=>cabinPoint(v,eye,yaw);for(let ring=0;ring<5;ring++){const z=-2.7-ring*2.1,spin=time*(1.4+ring*.13)+ring*.46,r=1.15+ring*.28;for(let i=0;i<12;i++){const t=i/12*Math.PI*2+spin,u=(i+1)/12*Math.PI*2+spin,A=[Math.cos(t)*r,Math.sin(t)*r,z],B=[Math.cos(u)*r,Math.sin(u)*r,z];beam(p(A),p(B),.025+ring*.003,i%3?C.blue:C.cream);}gem(p([0,0,z-.05]),[.035,.035,.035],C.blue,5);}for(let i=0;i<10;i++){const z=-2-i*1.05,y=Math.sin(time*3+i)*.9,x=Math.cos(time*2+i*1.9)*1.1;beam(p([x,y,z]),p([x*.75,y*.75,z-1]),.018,i%2?C.blue:C.cream);}
}
function firstPersonGlider(eye,yaw,amount=1,bank=0,speed=0){
 const open=clamp(amount,0,1),ease=open*open*(3-2*open);if(ease<.015)return;
 const cr=Math.cos(bank),sr=Math.sin(bank),p=v=>cabinPoint([v[0]*cr-v[1]*sr,v[0]*sr+v[1]*cr,v[2]],eye,yaw),speedBlend=clamp((speed-8.5)/4.5,0,1),pulse=.5+.5*Math.sin(time*5.5),seam=pulse>.5?C.cream:C.blue;
 for(const side of[-1,1]){
  const root=[side*.22,-.34,-.9],tip=[side*(.72+1.38*ease),.5+.64*ease,-2.5],outer=[side*(.82+1.7*ease),-.24+.2*ease,-2.02],low=[side*(.36+.48*ease),-.57,-1.2],inner=[side*(.48+.72*ease),.1+.23*ease,-1.95];
  tri(p(root),p(tip),p(outer),color('317c9b'));tri(p(root),p(outer),p(low),color('225675'));tri(p(root),p(inner),p(tip),color('48aabd'));
  beam(p(root),p(tip),.041,C.cream);beam(p(tip),p(outer),.032,C.blue);beam(p(root),p(low),.024,color('64b7d0'));
  for(let k=1;k<4;k++){const t=k/4,a=root.map((v,i)=>v+(tip[i]-v)*t),b=root.map((v,i)=>v+(outer[i]-v)*t);beam(p(a),p(b),.014,k===1?seam:C.blue);}
  if(speedBlend>.04)for(let k=0;k<3;k++){const phase=(time*(.55+k*.11)+k*.34)%1,z=-1.1-phase*2.5,spread=1.12+k*.17;beam(p([side*spread,-.12+k*.12,z]),p([side*(spread+.12+speedBlend*.22),-.16+k*.12,z-.48-speedBlend*.48]),.012+speedBlend*.007,k===1?C.cream:C.blue);}
 }
 if(speedBlend>.36){const z=-1.2-(time*.72%1)*1.35;beam(p([-.1,-.1,z]),p([.1,-.1,z-.5]),.012,C.cream);}
}
function allObstacles(){return obstacles.concat(structures.filter(s=>s.type===2).map(s=>{const rotated=Math.abs(Math.sin(s.angle||0))>.5;return {min:[s.x-(rotated?.3:2.3),s.y,s.z-(rotated?2.3:.3)],max:[s.x+(rotated?.3:2.3),s.y+3.7,s.z+(rotated?2.3:.3)],structure:s};}));}
function blocked(p,r=.4){return allObstacles().some(b=>p[0]>b.min[0]-r&&p[0]<b.max[0]+r&&p[2]>b.min[2]-r&&p[2]<b.max[2]+r&&p[1]<b.max[1]&&p[1]+2>b.min[1]);}
function floorAt(x,z){let h=height(x,z);for(const s of structures){const q=transform([x-s.x,0,z-s.z],[0,0,0],-(s.angle||0));if(s.type===3&&Math.abs(q[0])<2.3&&Math.abs(q[2])<2.5)h=Math.max(h,s.y+(2.5-q[2])*.72);}return h;}
function move(p,dx,dz){let next=[p[0]+dx,p[1],p[2]];if(!blocked(next))p[0]=clamp(next[0],-292,292);next=[p[0],p[1],p[2]+dz];if(!blocked(next))p[2]=clamp(next[2],-292,292);}
function rayBox(o,d,b){let lo=0,hi=500;for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-6){if(o[i]<b.min[i]||o[i]>b.max[i])return Infinity;continue;}let a=(b.min[i]-o[i])/d[i],c=(b.max[i]-o[i])/d[i];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo)return Infinity;}return lo;}
function wallDistance(o,d,limit=360){let dist=limit;for(const b of allObstacles())dist=Math.min(dist,rayBox(o,d,b));for(let t=.5;t<dist;t+=.75){const p=add(o,mul(d,t));if(p[1]<height(p[0],p[2])){dist=t;break;}}return dist;}
let audio;
function sound(freq,duration=.08,type='triangle',volume=.025){try{if(!audio)return;const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(35,freq*.35),audio.currentTime+duration);gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}catch{}}
function notify(text){$('notice').textContent=text;noticeTime=2.4;}
function select(n,instant=false){if(!isWeaponSlot(n)&&!isBuildSlot(n))return;const changed=n!==slot;slot=n;if(isWeaponSlot(n))lastWeaponSlot=n;else lastBuildSlot=n;if(changed&&!instant){equipDuration=isWeaponSlot(n)?weaponForSlot(n).equipDuration:.22;equipTime=equipDuration;reloading=0;sound(210,.08,'triangle',.018);}document.querySelectorAll('[data-slot]').forEach(e=>e.classList.toggle('selected',+e.dataset.slot===n));const profile=weaponForSlot(n);$('weaponlabel').textContent=isWeaponSlot(n)?profile.name:(BUILD_SLOTS[n]===2?'WALL BLUEPRINT · 10':'RAMP BLUEPRINT · 10');ammo=isWeaponSlot(n)?currentAmmo(loadout,n):10;$('ammotext').textContent=isWeaponSlot(n)?ammo:'10';$('ammocap').textContent=isWeaponSlot(n)?'/ '+profile.magazineCapacity:'';$('buildhelp').style.display=isBuildSlot(n)?'block':'none';$('touchfire').textContent=isWeaponSlot(n)?'FIRE':'BUILD';document.body.classList.toggle('building',isBuildSlot(n));document.body.dataset.weapon=isWeaponSlot(n)?profile.id:'build';}
function reload(){if(reloading||!isWeaponSlot(slot)||equipTime>0)return;const profile=weaponForSlot(slot),state=loadout[profile.id];if(state.ammo>=profile.magazineCapacity)return;reloading=profile.reloadDuration;reloadWeapon=profile.id;notify(`Reloading ${profile.shortName}…`);sound(330,.15);updateHUD();}
function buildSpot(){if(window.Duel?.active)return window.Duel.preview();return {x:Math.round((player.p[0]-Math.sin(yaw)*7)/5)*5,z:Math.round((player.p[2]-Math.cos(yaw)*7)/5)*5,angle:Math.round(yaw/(Math.PI/2))*Math.PI/2+buildRotation};}
function canBuild(s){if(window.Duel?.active)return window.Duel.valid(s);return !structures.some(v=>v.x===s.x&&v.z===s.z)&&!obstacles.some(b=>s.x+2>b.min[0]&&s.x-2<b.max[0]&&s.z+2>b.min[2]&&s.z-2<b.max[2]);}
function shoot(initial=false){
 if(window.Duel?.active||cooldown>0||equipTime>0||!canFireDuringPresentation(cameraPresentation))return;
 if(isBuildSlot(slot)){cooldown=.3;let s=buildSpot();if(wood<10){notify('Find a supply crate for more material');return;}if(!canBuild(s)){notify('Not enough room here');return;}structures.push({...s,y:s.y??height(s.x,s.z),type:BUILD_SLOTS[slot]});wood-=10;notify('Cover placed · −10 material');sound(160,.12,'square',.012);updateHUD();return;}
 const profile=weaponForSlot(slot);if(!profile.automatic&&!initial)return;if(reloading)return;const state=loadout[profile.id];if(!state.ammo){reload();return;}state.ammo--;ammo=state.ammo;cooldown=profile.fireInterval;flash=.085;viewShotImpulse=1;recoil=Math.max(recoil,profile.recoil[0]*5.5);recoilPitch+=profile.recoil[0];recoilYaw+=(rnd()-.5)*profile.recoil[1];sustained=Math.min(5,sustained+1);sound(profile.id==='sniper'?72:profile.id==='shotgun'?88:profile.id==='smg'?138:110,.1,'sawtooth',profile.id==='sniper'?.055:.035);
 const muzzle=transform([.24,1.59,profile.id==='sniper'?-1.95:profile.id==='shotgun'?-1.72:-1.48],player.p,yaw),moving=(keys.KeyW||keys.KeyS||keys.KeyA||keys.KeyD)?1:0,spread=shotSpread(profile,{aim,moving,sustained}),hitMap=new Map();
 for(let pellet=0;pellet<profile.pellets;pellet++){
  const dir=spreadDirection(yaw,pitch,spread,rnd),start=aim?eye:muzzle;let dist=wallDistance(start,dir,profile.range),target=null;
  for(const b of bots){if(b.hp<=0)continue;const t=rayBox(start,dir,{min:[b.p[0]-.48,b.p[1],b.p[2]-.48],max:[b.p[0]+.48,b.p[1]+2.45,b.p[2]+.48]});if(t<dist){dist=t;target=b;}}
  const endpoint=add(start,mul(dir,dist));spawnEffect({a:muzzle,b:endpoint,life:.2,maxLife:.2,col:color(profile.id==='sniper'?'fff4bf':'ffe7a0'),tracer:true});
  if(target)hitMap.set(target,(hitMap.get(target)||0)+profile.damage);
 }
 spawnEffect({p:transform([.45,1.6,-.65],player.p,yaw),v:transform([2,2,.3],[0,0,0],yaw),life:.65,col:color('e8bd68'),shell:true});
 for(const [target,damage] of hitMap){target.hp-=damage;hitTime=.35;damageNumber=.6;$('damagevalue').textContent=String(damage);sound(620,.06);for(let i=0;i<6;i++)spawnEffect({p:add(target.p,[0,1.4,0]),v:[(rnd()-.5)*5,rnd()*4,(rnd()-.5)*5],life:.3,col:C.blue});if(target.hp<=0){kills++;notify(`Bot tagged out · ${8-kills} remaining`);pickups.push({x:target.p[0],z:target.p[2],type:kills%2?'wood':'shield'});if(kills===8)finish(true);}}
 updateHUD();
}
function damage(n){if(ended)return;let s=Math.min(player.shield,n);player.shield-=s;player.hp=Math.max(0,player.hp-(n-s));hurt=.45;if(player.hp<=0)finish(false);updateHUD();}
function finish(win){ended=true;running=false;firing=false;keysClear();$('resume-control').hidden=true;$('game-settings').hidden=true;if(document.pointerLockElement)document.exitPointerLock();$('eyebrow').textContent=win?'LAST ONE STANDING':'RUN IT BACK?';$('heading').innerHTML=win?'That’s your<br>afternoon.':'Back to<br>the hill.';$('intro').textContent=win?'Suncrest is yours. All 8 bots tagged out. Drop back in for another round.':`You tagged out ${kills} of 8 bots. Collect blue shields and build cover when things get busy.`;$('play').innerHTML='PLAY AGAIN <span>→</span>';$('overlay').style.display='flex';document.body.classList.add('menu');}
function updateHUD(){$('hptext').textContent=Math.ceil(player.hp);$('shieldtext').textContent=Math.ceil(player.shield);$('hpbar').style.width=player.hp+'%';$('shieldbar').style.width=player.shield+'%';if(isWeaponSlot(slot)){const profile=weaponForSlot(slot);$('ammotext').textContent=reloading?'··':String(ammo);$('ammocap').textContent='/ '+profile.magazineCapacity;$('weaponlabel').textContent=profile.name;$('reload-progress').style.setProperty('--reload',reloading?reloadProgress(reloading,profile.slot):0);$('reload-progress').classList.toggle('active',reloading>0);}else{$('ammotext').textContent='10';$('ammocap').textContent='';$('reload-progress').classList.remove('active');}$('wood').textContent=wood;$('remaining').textContent='♟ '+(bots.filter(b=>b.hp>0).length+1);$('score').textContent='◎ '+kills;}
function keysClear(){for(const k in keys)keys[k]=false;firing=false;aim=false;}
function pause(){if(window.Duel?.active){keysClear();$('resume-control').hidden=true;$('game-settings').hidden=true;window.Duel.menu();return;}if(!running)return;running=false;keysClear();$('resume-control').hidden=true;$('game-settings').hidden=true;if(document.pointerLockElement)document.exitPointerLock();$('eyebrow').textContent='TAKE A BREATHER';$('heading').innerHTML='See you<br>on the hill.';$('intro').textContent='Your round is paused. Jump back in whenever you’re ready.';$('play').innerHTML='RESUME <span>→</span>';$('overlay').style.display='flex';document.body.classList.add('menu');}
async function captureMouse(){try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();if(!touch)await canvas.requestPointerLock();$('resume-control').hidden=true;}catch{notify('Click the game to restore mouse control');}}
$('play').onclick=async()=>{if(!started||ended){reset();started=true;}running=true;$('overlay').style.display='none';document.body.classList.remove('menu');await captureMouse();};$('pause').onclick=pause;
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===canvas){$('resume-control').hidden=true;return;}if(running&&!touch&&!window.Duel?.lobby&&!document.body.classList.contains('menu')){keysClear();$('resume-control').hidden=false;}});
document.addEventListener('keydown',e=>{if(e.target.matches?.('input,select,textarea'))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys[e.code]=true;if(e.code==='Escape')pause();if(!running)return;if(/^Digit[1-6]$/.test(e.code))select(+e.code.slice(-1));if(e.code==='KeyR'&&!e.repeat)reload();if(e.code==='KeyQ'&&!e.repeat)select(isWeaponSlot(slot)?lastBuildSlot:lastWeaponSlot);if(e.code==='KeyG'&&!e.repeat)buildRotation+=Math.PI/2;});document.addEventListener('keyup',e=>keys[e.code]=false);window.addEventListener('blur',keysClear);
let dragging=false,px=0,py=0;const touch=matchMedia('(pointer:coarse)').matches;if(touch)document.body.classList.add('touch');
function primaryDown(e){if(!running||touch||e.target.closest?.('button,input,select,textarea,#lobby,#chatbox'))return;if(e.button===0){firing=true;shoot(true);}if(e.button===2&&!isBuildSlot(slot)&&!reloading)aim=true;dragging=true;px=e.clientX;py=e.clientY;e.preventDefault();}
document.addEventListener('mousedown',primaryDown);canvas.addEventListener('pointerdown',e=>{if(!running||!touch)return;dragging=true;px=e.clientX;py=e.clientY;});window.addEventListener('mouseup',()=>{firing=false;aim=false;dragging=false;});window.addEventListener('pointerup',()=>{firing=false;aim=false;dragging=false;});window.addEventListener('pointercancel',()=>{firing=false;aim=false;dragging=false;});

window.addEventListener('pointermove',e=>{if(!running)return;const dx=document.pointerLockElement===canvas?e.movementX:e.clientX-px,dy=document.pointerLockElement===canvas?e.movementY:e.clientY-py,sensitivity=mouseSensitivity*((adsBlend>.55&&weaponForSlot(slot).scope)?scopeSensitivity:1);mouseSwayX=clamp(mouseSwayX+dx,-18,18);mouseSwayY=clamp(mouseSwayY+dy,-14,14);if(document.pointerLockElement===canvas){yaw-=dx*.0025*sensitivity;pitch=clamp(pitch-dy*.002*sensitivity,-.8,.55);}else if(dragging){yaw-=dx*.006*sensitivity;pitch=clamp(pitch-dy*.004*sensitivity,-.8,.55);px=e.clientX;py=e.clientY;}});canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('wheel',e=>{if(!running)return;e.preventDefault();const slots=[1,2,3,4,5,6],index=slots.indexOf(slot),next=(index+(e.deltaY>0?1:-1)+slots.length)%slots.length;select(slots[next]);},{passive:false});
function updateSettingsUI(){$('graphics-quality').value=graphicsSelection;$('mouse-sensitivity').value=String(mouseSensitivity);$('scope-sensitivity').value=String(scopeSensitivity);$('mouse-sensitivity-value').textContent=mouseSensitivity.toFixed(2)+'×';$('scope-sensitivity-value').textContent=scopeSensitivity.toFixed(2)+'×';}
updateSettingsUI();$('game-settings-toggle').onclick=()=>{$('game-settings').hidden=false;};$('game-settings-close').onclick=()=>{$('game-settings').hidden=true;};$('resume-control').onclick=captureMouse;
$('graphics-quality').onchange=e=>{graphicsSelection=e.target.value;writeSetting('sunny.graphicsQuality',graphicsSelection);if(graphicsSelection==='auto')autoQuality=createAutoQuality(autoQuality.level);currentQuality=qualityPreset(graphicsSelection,autoQuality);document.body.dataset.quality=graphicsSelection==='auto'?autoQuality.level:graphicsSelection;};
$('mouse-sensitivity').oninput=e=>{mouseSensitivity=clampSetting(e.target.value,.5,2,1);writeSetting('sunny.mouseSensitivity',mouseSensitivity);updateSettingsUI();};$('scope-sensitivity').oninput=e=>{scopeSensitivity=clampSetting(e.target.value,.35,1.25,.7);writeSetting('sunny.scopeSensitivity',scopeSensitivity);updateSettingsUI();};
document.querySelectorAll('[data-slot]').forEach(e=>e.onclick=()=>{if(running)select(+e.dataset.slot);});document.querySelectorAll('[data-key]').forEach(e=>{e.onpointerdown=ev=>{ev.preventDefault();e.setPointerCapture(ev.pointerId);keys[e.dataset.key]=true;};e.onpointerup=e.onpointercancel=()=>keys[e.dataset.key]=false;});$('touchjump').onpointerdown=()=>keys.Space=true;$('touchjump').onpointerup=$('touchjump').onpointercancel=()=>keys.Space=false;$('touchfire').onpointerdown=e=>{try{e.target.setPointerCapture(e.pointerId);}catch{}firing=true;shoot(true);};$('touchfire').onpointerup=$('touchfire').onpointercancel=()=>firing=false;
function update(dt){if(window.Duel?.active)return;elapsed+=dt;storm=Math.max(18,125-Math.max(0,elapsed-35)*.65);let mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),mz=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0),moving=!!(mx||mz),speed=(keys.ShiftLeft||keys.ShiftRight?10:6)*(aim?.6:1);if(moving){let l=Math.hypot(mx,mz);mx/=l;mz/=l;move(player.p,(Math.cos(yaw)*mx-Math.sin(yaw)*mz)*speed*dt,(-Math.sin(yaw)*mx-Math.cos(yaw)*mz)*speed*dt);walk+=dt*speed*1.4;}const floor=floorAt(player.p[0],player.p[2]);if(keys.Space&&player.p[1]<=floor+.04){player.vy=8;sound(210,.12,'sine',.01);}player.vy-=22*dt;player.p[1]+=player.vy*dt;if(player.p[1]<floor){player.p[1]=floor;player.vy=0;}player.yaw=yaw;
if(Math.hypot(player.p[0],player.p[2])>storm){damage(dt*5);if(noticeTime<=0)notify('Outside the circle — head toward town');}
cooldown=Math.max(0,cooldown-dt);equipTime=Math.max(0,equipTime-dt);if(reloading>0){reloading-=dt;if(reloading<=0){const profile=WEAPON_PROFILES[reloadWeapon]||weaponForSlot(slot);loadout[reloadWeapon].ammo=profile.magazineCapacity;ammo=currentAmmo(loadout,slot);notify(`${profile.shortName} ready`);updateHUD();}}if(firing)shoot(false);
for(const b of bots){if(b.hp<=0)continue;b.cool-=dt;let offset=sub(player.p,b.p),dist=Math.hypot(offset[0],offset[2]),visible=wallDistance(add(b.p,[0,1.5,0]),norm(sub(add(player.p,[0,1.2,0]),add(b.p,[0,1.5,0]))))>dist-.6;let tx,tz;if(Math.hypot(b.p[0],b.p[2])>storm-5){tx=-b.p[0];tz=-b.p[2];}else if(dist<45&&visible){tx=offset[0];tz=offset[2];if(dist<16){tx=Math.cos(time+b.seed)*5;tz=Math.sin(time+b.seed)*5;}}else{tx=Math.cos(time*.3+b.seed);tz=Math.sin(time*.3+b.seed);}let len=Math.hypot(tx,tz)||1;b.yaw=Math.atan2(-tx,-tz);move(b.p,tx/len*2.5*dt,tz/len*2.5*dt);b.p[1]=floorAt(b.p[0],b.p[2]);if(dist<42&&visible&&b.cool<=0){b.cool=1.5+rnd()*1.3;const a=add(b.p,[0,1.6,0]),end=add(player.p,[(rnd()-.5)*3,1.2,(rnd()-.5)*3]);spawnEffect({a,b:end,life:.15,maxLife:.15,col:color('ffb585'),tracer:true});if(rnd()<(moving?.23:.53))damage(7);}}
for(let i=pickups.length-1;i>=0;i--){let p=pickups[i];if(Math.hypot(p.x-player.p[0],p.z-player.p[2])<2.1){if(p.type==='shield'){if(player.shield>=100)continue;player.shield=Math.min(100,player.shield+35);notify('+35 shield');}if(p.type==='health'){if(player.hp>=100)continue;player.hp=Math.min(100,player.hp+35);notify('+35 health');}if(p.type==='wood'){wood+=50;notify('+50 building material');}pickups.splice(i,1);sound(740,.2,'sine');updateHUD();}}
$('time').textContent='◷ '+Math.floor(Math.max(0,180-elapsed)/60)+':'+String(Math.floor(Math.max(0,180-elapsed)%60)).padStart(2,'0');if(elapsed>=210&&!ended){notify('Final circle — finish the remaining bots');}
}
function structure(s,ghost=false){const valid=canBuild(s)&&wood>=10,col=ghost?color(valid?'77ddeb':'eb786e'):C.wood,origin=[s.x,s.y,s.z],angle=s.angle||0;const part=(p,d,c)=>box(transform(p,origin,angle),d,c,angle);const link=(a,b,w,c)=>beam(transform(a,origin,angle),transform(b,origin,angle),w,c);if(s.type===2){if(!ghost)for(let i=0;i<9;i++){part([-2+i*.5,1.85,0],[.43,3.7,.22],col);for(let y of[.7,2.9])part([-2+i*.5,y,.15],[.06,.06,.04],C.black);}for(const y of[.1,.7,2.9,3.65])part([0,y,.2],[4.6,.12,.18],ghost?col:C.cream);for(const x of[-2.25,0,2.25])part([x,1.85,0],[.12,3.7,.16],col);link([-2,.3,.22],[2,3.4,.22],.055,col);}else{for(let i=0;i<10;i++)part([0,.18+i*.36,2.25-i*.5],[4.5,ghost?.055:.22,ghost?.065:.57],col);for(let x of[-2,2])link([x,0,2.5],[x,3.6,-2.5],.09,col);}if(ghost){$('buildhelp').textContent=valid?'LEFT CLICK TO PLACE · G ROTATE':'BLOCKED · MOVE THE PREVIEW';$('buildhelp').style.color=valid?'#b4f6ff':'#ffafa0';}}
const ctx=$('map').getContext('2d');function minimap(){
 const scale=.275,to=x=>90+x*scale;ctx.fillStyle='#286e91';ctx.fillRect(0,0,180,180);
 ctx.fillStyle='#78ad56';ctx.beginPath();ctx.arc(90,90,84,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e2ce98';ctx.lineWidth=3;ctx.stroke();
 // Five highways radiate from Suncrest toward the named landing regions.
 ctx.strokeStyle='#bec1ae';ctx.lineWidth=3.2;ctx.beginPath();for(const [a,b] of [[[-42,4],[-180,69]],[[45,6],[161,71]],[[28,-37],[113,-165]],[[-21,-39],[-80,-156]],[[7,45],[8,178]]]){ctx.moveTo(to(a[0]),to(a[1]));ctx.lineTo(to(b[0]),to(b[1]));}ctx.stroke();
 ctx.fillStyle='#ded19f';for(const b of buildings)ctx.fillRect(to(b.x-b.w/2),to(b.z-b.d/2),Math.max(1,b.w*scale),Math.max(1,b.d*scale));
 ctx.fillStyle='#315f39';for(const t of trees){ctx.beginPath();ctx.arc(to(t.x),to(t.z),.65,0,7);ctx.fill();}
 ctx.font='700 5.5px Arial';ctx.textAlign='center';ctx.fillStyle='#f8f4df';ctx.shadowColor='#17343c';ctx.shadowBlur=2;for(const p of pois)ctx.fillText(p.name,to(p.x),to(p.z)-4);ctx.shadowBlur=0;
 if(storm<ISLAND_SIZE){ctx.fillStyle='#8b4dbb45';ctx.beginPath();ctx.rect(0,0,180,180);ctx.arc(90,90,storm*scale,0,Math.PI*2,true);ctx.fill('evenodd');ctx.strokeStyle='#e7cbff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(90,90,storm*scale,0,Math.PI*2);ctx.stroke();}
 for(const b of bots)if(b.hp>0){ctx.fillStyle='#ff886d';ctx.beginPath();ctx.arc(to(b.p[0]),to(b.p[2]),1.6,0,7);ctx.fill();}
 const px=clamp(to(player.p[0]),5,175),pz=clamp(to(player.p[2]),5,175);ctx.save();ctx.translate(px,pz);ctx.rotate(-yaw);ctx.fillStyle='white';ctx.shadowColor='#183941';ctx.shadowBlur=4;ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,5);ctx.lineTo(0,3);ctx.lineTo(-4,5);ctx.closePath();ctx.fill();ctx.restore();
 const nearest=pois.reduce((best,p)=>Math.hypot(player.p[0]-p.x,player.p[2]-p.z)<best.d?{p,d:Math.hypot(player.p[0]-p.x,player.p[2]-p.z)}:best,{p:pois[0],d:Infinity});$('mapbox').querySelector('b').textContent=player.air==='ship'?'CLOUDLINER':nearest.d<55?nearest.p.name:'WILDLANDS';
}
function drawFirstPersonArms(root,rotation,profile,parts){
 const cloth=color(window.Duel?.myColor||'577363'),trim=cloth.map(value=>Math.min(1,value*1.18)),point=v=>transform(v,root,rotation[1],rotation[0]+parts.rootTilt),support=parts.supportHand;
 const rightShoulder=point([.29,-.47,.12]),rightElbow=point([.34,-.3,-.18]),rightHand=point([.12,-.08,-.08]);
 const leftShoulder=point([-.38,-.49,.08]),leftElbow=point([-.3+support[0]*.45,-.25+support[1]*.5,-.3+support[2]*.45]),leftHand=point([-.1+support[0],-.06+support[1],-.32+support[2]]);
 tube(rightShoulder,rightElbow,.12,cloth,22);ellipsoid(rightElbow,[.125,.13,.12],cloth,22,13);tube(rightElbow,rightHand,.108,cloth,22);ellipsoid(rightHand,AVATAR_GEAR.glove.size,C.black,24,14);ellipsoid(point([.12,-.025,-.12]),[.09,.035,.045],C.metal,18,11);
 tube(leftShoulder,leftElbow,.125,cloth,22);ellipsoid(leftElbow,[.13,.13,.12],cloth,22,13);tube(leftElbow,leftHand,.11,cloth,22);const cuff=point([-.12+support[0]*.8,-.12+support[1]*.8,-.26+support[2]*.8]);ellipsoid(cuff,AVATAR_GEAR.wristCuff.size,trim,20,12);ellipsoid(leftHand,AVATAR_GEAR.glove.size,C.black,24,14);for(const offset of[-.04,0,.04])ellipsoid(point([-.1+support[0]+offset,-.01+support[1],-.4+support[2]]),AVATAR_GEAR.knuckle.size,C.metal,14,9);
}
function drawFirstPersonWeapon(profile,state,parts){
 const root=state.position,rotation=state.rotation,scale=profile.presentation.scale,point=v=>transform(v.map(n=>n*scale),root,rotation[1],rotation[0]+parts.rootTilt),drawBox=(v,s,c,rx=0)=>box(point(v),s,c,rotation[1],rotation[0]+parts.rootTilt+rx),drawOval=(v,r,c,n,q)=>ellipsoid(point(v),r,c,n,q),drawTube=(a,b,r,c,n)=>tube(point(a),point(b),r,c,n);
 drawWeaponLayout(profile,parts,scale,drawBox,drawOval,drawTube,1);
 if(flash>0){const z=profile.id==='sniper'?-1.71:profile.id==='shotgun'?-1.45:profile.id==='smg'?-0.97:-1.36,muzzle=point([0,.035,z]);ellipsoid(muzzle,[.13,.12,.18],color('fff1ad'),18,11);for(let i=0;i<7;i++){const angle=i/7*Math.PI*2;beam(muzzle,add(muzzle,[Math.cos(angle)*.15,Math.sin(angle)*.15,-.25]),.022,C.gold);}}
 drawFirstPersonArms(root,rotation,profile,parts);
}
function drawFirstPersonBlueprint(state){
 const root=state.position,rotation=state.rotation,point=v=>transform(v,root,rotation[1],rotation[0]),blue=color('5be1f2'),deep=color('176a8b');
 box(point([0,0,-.25]),[.72,.48,.035],deep,rotation[1],rotation[0]);
 for(const x of[-.3,0,.3])beam(point([x,-.2,-.29]),point([x,.2,-.29]),.012,blue);
 for(const y of[-.2,0,.2])beam(point([-.3,y,-.29]),point([.3,y,-.29]),.012,blue);
 tube(point([.32,-.14,.02]),point([.16,-.03,-.32]),.055,C.metal,14);ellipsoid(point([.34,-.16,.04]),[.09,.08,.11],C.skin,16,9);
}
function drawFirstPersonViewModel(profile){if(isBuildSlot(slot))drawFirstPersonBlueprint(viewModelState);else drawFirstPersonWeapon(profile,viewModelState,weaponPartState);}
function syncProjectileVisuals(projectiles=[]){const visible=new Set(),stamp=performance.now();for(const projectile of projectiles.slice(0,32)){if(!projectile?.id||!Array.isArray(projectile.position)||!Array.isArray(projectile.velocity))continue;visible.add(projectile.id);let visual=projectileVisuals.get(projectile.id);if(!visual){visual={p:projectile.position.slice(0,3),target:projectile.position.slice(0,3),velocity:projectile.velocity.slice(0,3),stamp};projectileVisuals.set(projectile.id,visual);}else{for(let axis=0;axis<3;axis++){visual.target[axis]=projectile.position[axis];visual.velocity[axis]=projectile.velocity[axis];}visual.stamp=stamp;}}for(const id of projectileVisuals.keys())if(!visible.has(id))projectileVisuals.delete(id);}
 let last=performance.now(),mapTimer=0,shipCameraRound=-1;function frame(now){requestAnimationFrame(frame);const frameMs=Math.min(100,Math.max(1,now-last)),dt=Math.min(frameMs/1000,.035);last=now;if(running&&graphicsSelection==='auto'&&!window.Duel?.lobby){const before=autoQuality.level;sampleAutoQuality(autoQuality,frameMs,now);if(before!==autoQuality.level){currentQuality=qualityPreset('auto',autoQuality);notify(`Graphics adjusted to ${autoQuality.level}`);}}time+=dt;window.Duel?.render(dt);if(running)update(dt);skyshipPresentation.standBlend=mix(skyshipPresentation.standBlend,dropSequence?.standBlend||0,1-Math.exp(-dt*7));skyshipPresentation.hatchBlend=mix(skyshipPresentation.hatchBlend,dropSequence?.hatchBlend||0,1-Math.exp(-dt*7));skyshipPresentation.rearLookBlend=mix(skyshipPresentation.rearLookBlend,dropSequence?.rearLookBlend||0,1-Math.exp(-dt*7));noticeTime=Math.max(0,noticeTime-dt);hitTime=Math.max(0,hitTime-dt);hurt=Math.max(0,hurt-dt);flash=Math.max(0,flash-dt);recoil=Math.max(0,recoil-dt*1.55);sustained=Math.max(0,sustained-dt*3.4);recoilPitch=mix(recoilPitch,0,1-Math.exp(-dt*13));recoilYaw=mix(recoilYaw,0,1-Math.exp(-dt*16));mouseSwayX=mix(mouseSwayX,0,1-Math.exp(-dt*8));mouseSwayY=mix(mouseSwayY,0,1-Math.exp(-dt*8));damageNumber=Math.max(0,damageNumber-dt);const moving=running&&Boolean(keys.KeyW||keys.KeyS||keys.KeyA||keys.KeyD),profile=weaponForSlot(slot),canAim=isWeaponSlot(slot)&&!reloading&&player.air==='landed',adsTarget=aim&&canAim?1:0;adsBlend=mix(adsBlend,adsTarget,1-Math.exp(-dt*12));const accuracy=shotSpread(profile,{aim:adsBlend>.45,moving:moving?1:0,sustained}),spreadPixels=3+accuracy*105+(moving?3:0)+recoil*54;$('crosshair').style.setProperty('--gap',spreadPixels.toFixed(1)+'px');$('crosshair').classList.toggle('ads',adsBlend>.45);$('crosshair').classList.toggle('shotgun',profile.id==='shotgun');$('damagevalue').style.opacity=damageNumber>0?1:0;$('damagevalue').style.marginTop=(-45-(.6-damageNumber)*35)+'px';$('notice').style.opacity=noticeTime>0?1:0;$('hitmarker').style.display=hitTime>0?'block':'none';$('damage').style.opacity=hurt;$('reload-progress').style.setProperty('--reload',reloading?reloadProgress(reloading,profile.slot):0);const spectator=Boolean(window.Duel?.spectating),scoped=profile.scope&&adsBlend>.82&&!spectator;cameraPresentation=stepCameraPresentation(cameraPresentation,{lobby:Boolean(window.Duel?.lobby),air:player.air||'landed',alive:player.hp>0,spectating:spectator,roundToken:matchRound},dt);stepViewModel(viewModelState,{weapon:profile,moving:moving?1:0,sprinting:moving&&Boolean(keys.ShiftLeft||keys.ShiftRight),aiming:adsBlend>.45,reloading,equipRemaining:equipTime,mouseX:mouseSwayX,mouseY:mouseSwayY,shotImpulse:viewShotImpulse,time},dt);stepWeaponParts(weaponPartState,profile,reloading);$('reload-stage').textContent=reloading?reloadStage(profile,reloading).toUpperCase():'READY';viewShotImpulse=0;document.body.dataset.camera=cameraPresentation.mode;document.body.dataset.quality=graphicsSelection==='auto'?autoQuality.level:graphicsSelection;document.body.classList.toggle('scoped',scoped);document.body.classList.toggle('fast-drop',player.air==='launchTransit');
if(window.Duel?.lobby){drawLobby();return;}const ratio=Math.min(devicePixelRatio,currentQuality.pixelRatio),width=Math.round(innerWidth*ratio),h=Math.round(innerHeight*ratio);if(canvas.width!==width||canvas.height!==h){canvas.width=width;canvas.height=h;gl.viewport(0,0,width,h);}
let a=yaw,cameraTarget,shipLookYaw=yaw;
if(!started)a=Math.sin(time*.09)*.1;
if(player.air==='ship'){
 const lookBlend=clamp(skyshipPresentation.rearLookBlend||0,0,1),aftYaw=(skyshipData?.yaw||0)+Math.PI,lookDelta=Math.atan2(Math.sin(aftYaw-yaw),Math.cos(aftYaw-yaw));shipLookYaw=yaw+lookDelta*lookBlend+recoilYaw;const cabinPosition=skyshipData?clampCabinWorldPosition(player.p,[skyshipData.x,skyshipData.y,skyshipData.z],skyshipData.yaw):player.p,view=skyshipFirstPersonView(cabinPosition,shipLookYaw,pitch+recoilPitch,dropSequence?.standBlend??1,player.launchProgress||0);eye=view.eye;cameraTarget=view.target;forward=view.forward;
}else{
 const viewYaw=a+recoilYaw,viewPitch=clamp(pitch+recoilPitch,-.8,.62);
 forward=[-Math.sin(viewYaw)*Math.cos(viewPitch),Math.sin(viewPitch),-Math.cos(viewYaw)*Math.cos(viewPitch)];
 const anchor=add(player.p,[0,2.15,0]),right=[Math.cos(viewYaw),0,-Math.sin(viewYaw)],airDistance=6.8,adsDistance=profile.scope?.16:3.15,distance=mix(airDistance,adsDistance,adsBlend),shoulder=mix(1.05,profile.scope?0:.56,adsBlend),desired=add(add(anchor,mul(forward,-distance)),mul(right,shoulder));
 const delta=sub(desired,anchor),len=length(delta),collision=wallDistance(anchor,norm(delta));
 let thirdEye=collision<len?add(anchor,mul(norm(delta),Math.max(.16,collision-.3))):desired;
 thirdEye[1]=Math.max(thirdEye[1],height(thirdEye[0],thirdEye[2])+.55);
 const thirdTarget=add(thirdEye,forward),firstEye=[player.p[0],player.p[1]+1.72,player.p[2]],firstTarget=add(firstEye,forward),view=blendCameraViews(thirdEye,thirdTarget,firstEye,firstTarget,cameraPresentation,cameraBlendOutput);
 eye=view.eye;cameraTarget=view.target;
}
const baseFov=player.air==='ship'?74*Math.PI/180:player.air==='launchTransit'?mix(82,75,player.launchProgress||0)*Math.PI/180:player.air==='skyDrift'?78*Math.PI/180:['gliderOpening','gliding','gliderFolding'].includes(player.air)?mix(78,72,player.deploy||0)*Math.PI/180:75*Math.PI/180,targetFov=adsTarget&&player.air==='landed'?profile.adsFov*Math.PI/180:baseFov;cameraFov=mix(cameraFov,targetFov,1-Math.exp(-dt*(adsTarget?13:7.5)));gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniformMatrix4fv(um,false,matrix(eye,cameraTarget,width/h,cameraFov));gl.uniform3fv(ue,eye);draw(staticBuffer,staticData.length/6);geo.length=0;
const avatarYaw=player.air!=='landed'&&Number.isFinite(player.yaw)?player.yaw:a,showLocalAvatar=shouldShowLocalAvatar(cameraPresentation,player.air,player.hp>0);if(skyshipData&&['launchTransit','skyDrift','gliderOpening','gliding','gliderFolding'].includes(player.air))skyshipCraft(skyshipData,dropSequence?.hatchBlend||0);if(player.air==='ship')skyshipInterior(skyshipData,eye,shipLookYaw,skyshipPresentation);if(player.air==='launchTransit')arcadeLaunchStreaks(eye,yaw+recoilYaw,player.launchProgress||0);if(['gliderOpening','gliding','gliderFolding'].includes(player.air))firstPersonGlider(eye,yaw+recoilYaw,player.air==='gliding'?1:player.deploy||0,player.airRoll||0,player.airSpeed||0);if(showLocalAvatar&&!scoped){if(player.air==='landed'&&currentQuality.shadows)shadow(player.p[0],player.p[2],.75);if(['gliderOpening','gliding','gliderFolding'].includes(player.air))gliderCanopy(player.p,avatarYaw,color(window.Duel?.myColor||'577363'),player.air==='gliding'?1:player.deploy||0,player.airRoll||0);character(player.p,avatarYaw,running&&moving?walk:0,color(window.Duel?.myColor||'577363'),false,player.air,player.deploy||0,'combat',{weapon:player.weapon||weaponIdForSlot(slot),reload:player.renderReload??reloading,equip:player.renderEquip??equipTime,aim:player.renderAim??aim,building:isBuildSlot(slot),recoil,local:true,diveBlend:player.diveBlend,airPitch:player.airPitch,airRoll:player.airRoll});}for(const b of bots)if(b.hp>0){if(b.air==='landed'&&currentQuality.shadows)shadow(b.p[0],b.p[2],.72);if(['gliderOpening','gliding','gliderFolding'].includes(b.air))gliderCanopy(b.p,b.yaw,color(b.color||'e37b58'),b.air==='gliding'?1:b.deploy||0,b.airRoll||0);character(b.p,b.yaw,b.walk||0,color(b.color||'e37b58'),true,b.air,b.deploy||0,b.air==='ship'?'ship':'combat',{weapon:b.weapon||'ar',reload:b.reload,equip:b.equip,aim:b.aim,building:b.building||isBuildSlot(b.slot),diveBlend:b.diveBlend,airPitch:b.airPitch,airRoll:b.airRoll});}for(const s of structures)structure(s);if(isBuildSlot(slot)&&running&&matchPhase==='playing'){let s=buildSpot();structure({...s,y:s.y??height(s.x,s.z),type:BUILD_SLOTS[slot]},true);}
for(const p of pickups){let y=height(p.x,p.z)+.9+Math.sin(time*2+p.x)*.15,c=p.type==='shield'?C.blue:p.type==='health'?color('f3f7df'):C.wood;box([p.x,y,p.z],[.65,.8,.65],c,time*.6);if(p.type==='health'){box([p.x,y+.42,p.z],[.43,.04,.13],C.red,time*.6);box([p.x,y+.43,p.z],[.13,.04,.43],C.red,time*.6);}gem([p.x,y+1.1,p.z],[.13,.27,.13],c,4);}
if(flash>0&&!scoped){const muzzleZ=profile.id==='sniper'?-1.95:profile.id==='shotgun'?-1.72:-1.48,m=transform([.24,1.59,muzzleZ],player.p,yaw);ellipsoid(m,[.11,.11,.11],color('fff7d5'),12,7);for(let i=0;i<7;i++){let t=i/7*6.283+time*20;beam(m,add(m,[Math.cos(t)*.28,Math.sin(t)*.28,-.2]),.022,color('ffcb67'));}}
for(const projectile of projectileVisuals.values()){const age=Math.min(.14,Math.max(0,(now-projectile.stamp)/1000)),blend=1-Math.exp(-dt*22);for(let axis=0;axis<3;axis++)projectile.p[axis]=mix(projectile.p[axis],projectile.target[axis]+projectile.velocity[axis]*age,blend);const direction=norm(projectile.velocity),tail=sub(projectile.p,mul(direction,.8)),head=add(projectile.p,mul(direction,.12));beam(tail,head,.055,color('fff3b0'));beam(tail,head,.022,color('ffffff'));}
effectPool.update(dt);effectPool.forEachActive(e=>{if(e.tracer){const delta=sub(e.b,e.a),t=clamp(1-e.life/e.maxLife,0,1),head=add(e.a,mul(delta,Math.min(1,t*2.8))),tail=add(e.a,mul(delta,Math.max(0,t*2.8-.22)));beam(tail,head,.045,e.col);beam(tail,head,.018,color('fffbe4'));}else{e.v[1]-=dt*7;e.p[0]+=e.v[0]*dt;e.p[1]+=e.v[1]*dt;e.p[2]+=e.v[2]*dt;if(e.shell)box(e.p,[.04,.04,.1],e.col,time*8);else gem(e.p,[.045,.045,.045],e.col,5);}});

// A bright segmented storm perimeter; the minimap shows the exact safe zone.
if(matchPhase==='playing'){const stormSegments=currentQuality.stormSegments;for(let i=0;i<stormSegments;i++){let t=i/stormSegments*6.283,x=Math.sin(t)*storm,z=Math.cos(t)*storm,y=height(x,z);box([x,y+6,z],[.12,12,.12],color('b5a5ed'));if(i%3===0)gem([x,y+12,z],[.2,.5,.2],color('ded4fa'),4);}}
const data=dynamicData.copy(geo);gl.bindBuffer(gl.ARRAY_BUFFER,dynamicBuffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);draw(dynamicBuffer,dynamicData.length/6);
if(player.air==='landed'&&shouldShowViewModel(cameraPresentation,player.hp>0,spectator,scoped)){
 geo.length=0;drawFirstPersonViewModel(profile);const viewData=dynamicData.copy(geo);gl.bindBuffer(gl.ARRAY_BUFFER,dynamicBuffer);gl.bufferData(gl.ARRAY_BUFFER,viewData,gl.DYNAMIC_DRAW);gl.clear(gl.DEPTH_BUFFER_BIT);gl.uniformMatrix4fv(um,false,matrix([0,0,0],[0,0,-1],width/h,62*Math.PI/180));gl.uniform3f(ue,0,0,0);draw(dynamicBuffer,dynamicData.length/6);
}
mapTimer+=dt;if(mapTimer>.1){minimap();mapTimer=0;const angle=(((-yaw*180/Math.PI)%360)+360)%360,dirs=['N','NE','E','SE','S','SW','W','NW'];$('compass').innerHTML=`${dirs[(Math.round(angle/45)+7)%8]} &nbsp; · &nbsp; <strong>${dirs[Math.round(angle/45)%8]}</strong> &nbsp; · &nbsp; ${dirs[(Math.round(angle/45)+1)%8]} <small style="font-size:10px;letter-spacing:1px">${Math.round(angle)}°</small>`;}}
function drawLobby(){
 const w=Math.round(innerWidth*Math.min(devicePixelRatio,1.5)),h=Math.round(innerHeight*Math.min(devicePixelRatio,1.5));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
 const e=[0,3.45,9.4];gl.clearColor(.025,.075,.16,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniformMatrix4fv(um,false,matrix(e,[0,1.28,.8],w/h,.66));gl.uniform3fv(ue,e);geo.length=0;
 // Original moonlit resort backdrop, kept crisp so the party models remain the visual focus.
 box([0,-.42,.5],[36,.25,27],color('173b55'));box([0,-.25,-7],[34,.06,11],color('20506b'));
 ellipsoid([6.6,7,-14],[1.7,1.7,.42],color('d8f2ec'),40,24);ellipsoid([6.15,7.35,-13.7],[.25,.21,.07],color('a8c9c8'),18,10);ellipsoid([7.05,6.65,-13.7],[.34,.28,.07],color('accdca'),18,10);
 for(const [x,y,z,s,c] of [[-8,2.2,-10,[5,4,2.5],'8f4966'],[-3.5,2.8,-11,[3.5,5.2,2.2],'be5b61'],[1.1,2.1,-11.5,[4.5,3.7,2.5],'3d7590'],[4.7,1.7,-11,[2.4,3,2],'c46a5d']]){box([x,y,z],s,color(c));box([x,y+s[1]/2+.15,z],[s[0]+.3,.3,s[2]+.3],C.cream);for(let q=-s[0]/2+.55;q<s[0]/2;q+=1.1)box([x+q,y,z+s[2]/2+.04],[.55,.7,.06],C.glass);}
 for(const x of[-10.5,10.5]){const z=-7.8;cone([x,-.25,z],.34,.22,4.7,C.trunk,20);for(let k=0;k<9;k++){const a=k/9*6.283,root=[x,4.25,z],tip=[x+Math.cos(a)*2.25,3.6+Math.sin(k)*.18,z+Math.sin(a)*2.25];beam(root,tip,.1,C.leaves);ellipsoid(tip,[.62,.16,.3],C.leaves,18,8);}}
 // Party pads use layered luminous rings instead of card-shaped blocks behind the players.
 // Slot zero is always the local player and is physically closest to the camera. Every invite slot stays behind it.
 const party=window.Duel.party||[],spots=[[0,.1,2.15],[-2.8,.03,.45],[2.8,.03,.45],[-5.05,-.02,-.95],[5.05,-.02,-.95],[-7,-.06,-2.15],[7,-.06,-2.15],[0,-.06,-2.5]];
 for(let i=0;i<8;i++){const q=spots[i],member=party[i],pulse=.03+Math.sin(time*2+i)*.025;cone([q[0],q[1]-.24,q[2]],1.18,1.18,.14,color(member?'198ab2':'173d5c'),56);cone([q[0],q[1]-.1,q[2]],.98,.98,.06,color(member?'74ddf6':'2a5570'),56);if(member){cone([q[0],q[1]-.03,q[2]],.73,.73,.035+pulse,color('b8f5ff'),48);character([q[0],q[1]+pulse*.3,q[2]],Math.PI+(i?Math.sign(q[0])*.055:0),0,color(member.color||'577363'),false,'landed',1,'lobby');}else{for(let y=.25;y<2.25;y+=.18)box([q[0],q[1]+y,q[2]],[.055,.035,.055],color('4c86a4'));gem([q[0],q[1]+2.48,q[2]],[.11,.23,.11],color('72bad8'),8);}}
 const data=dynamicData.copy(geo);gl.bindBuffer(gl.ARRAY_BUFFER,dynamicBuffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);draw(dynamicBuffer,dynamicData.length/6);gl.clearColor(.48,.77,.88,1);
}
window.Game={world:{height,obstacles},input:()=>{const aftYaw=(skyshipData?.yaw||0)+Math.PI,delta=Math.atan2(Math.sin(aftYaw-yaw),Math.cos(aftYaw-yaw)),blend=player.air==='ship'?clamp(skyshipPresentation.rearLookBlend||0,0,1):0,inputYaw=yaw+delta*blend;return {x:(keys.KeyD?1:0)-(keys.KeyA?1:0),z:(keys.KeyW?1:0)-(keys.KeyS?1:0),yaw:inputYaw,pitch,aimYaw:inputYaw+recoilYaw,aimPitch:clamp(pitch+recoilPitch,-.8,.62),rotation:buildRotation,slot,jump:!!keys.Space,sprint:!!keys.ShiftLeft,aim,fire:firing&&canFireDuringPresentation(cameraPresentation),reload:!!keys.KeyR};},clear:()=>{keysClear();$('resume-control').hidden=true;$('game-settings').hidden=true;},look:(a)=>{yaw=a;pitch=-.03;},pose:()=>player,
 apply(s,id,colors,dt=.016){
  const self=s.players.find(p=>p.id===id),watched=selectViewPlayer(s.players,id);if(!self||!watched)return;
  const motionSample=(s.phase==='ship'||s.phase==='flight')?-(Number(s.timer)||0):(Number(s.elapsed)||0),watchedAir=watched.air||'landed',watchedVelocity=['launchTransit','skyDrift','gliderOpening','gliding','gliderFolding'].includes(watchedAir)?watched.airVelocity:null;if(playerMotionId!==watched.id){playerMotion=null;playerMotionId=watched.id;}if(watchedAir==='ship'&&shipCameraRound!==(s.round||0)){yaw=Number.isFinite(watched.yaw)?watched.yaw:yaw;pitch=-.08;shipCameraRound=s.round||0;}else if(watchedAir!=='ship')shipCameraRound=-1;playerMotion=advanceMotionTrack(playerMotion,watched.p,{dt,state:watchedAir,velocity:watchedVelocity,sampleId:motionSample});player.p=playerMotion.position;player.yaw=smoothAngle(player.yaw,Number.isFinite(watched.yaw)?watched.yaw:yaw,dt);player.hp=watched.hp;player.shield=watched.shield;player.vy=watched.vy;player.air=watchedAir;player.dropState=watched.dropState||player.air;player.deploy=watched.deploy||0;player.wingsActive=Boolean(watched.wingsActive);player.airVelocity=Array.isArray(watched.airVelocity)?watched.airVelocity.slice():[0,watched.vy||0,0];player.airPitch=Number.isFinite(watched.airPitch)?watched.airPitch:0;player.airRoll=Number.isFinite(watched.airRoll)?watched.airRoll:0;player.diveBlend=clamp(watched.diveBlend||0,0,1);player.airSpeed=watched.airSpeed||Math.hypot(...player.airVelocity);player.clearance=watched.clearance||0;player.launchProgress=watched.launchProgress||0;player.weapon=watched.weapon||weaponIdForSlot(watched.slot);player.renderReload=watched.reload||0;player.renderEquip=watched.equip||0;player.renderAim=Boolean(watched.aim);viewSlot=watched.slot||1;walk=watched.walk;
  loadout=watched.weapons||loadout;if(watched.slot&&watched.slot!==slot)select(watched.slot);ammo=currentAmmo(loadout,slot);reloading=watched.reload||0;reloadWeapon=watched.reloadWeapon||weaponIdForSlot(slot);equipTime=watched.equip||0;sustained=mix(sustained,watched.sustained||0,.32);wood=s.mode==='build'?999:watched.material;structures=s.structures;pickups=s.pickups||[];const incomingSkyship=s.skyship||null;if(incomingSkyship){if(skyshipMotionRound!==(s.round||0)){skyshipMotion=null;skyshipRenderData=null;skyshipMotionRound=s.round||0;}skyshipMotion=advanceMotionTrack(skyshipMotion,[incomingSkyship.x,incomingSkyship.y,incomingSkyship.z],{dt,state:'ship',sampleId:motionSample});const renderPosition=skyshipMotion.position;skyshipRenderData={...incomingSkyship,x:renderPosition[0],y:renderPosition[1],z:renderPosition[2],yaw:smoothAngle(Number.isFinite(skyshipRenderData?.yaw)?skyshipRenderData.yaw:incomingSkyship.yaw,incomingSkyship.yaw,dt)};skyshipData=skyshipRenderData;}else{skyshipMotion=null;skyshipRenderData=null;skyshipMotionRound=-1;skyshipData=null;}dropSequence=s.sequence||null;matchPhase=s.phase;matchRound=s.round||0;syncProjectileVisuals(s.projectiles||[]);
  const visible=new Set();bots=s.players.filter(p=>p.id!==watched.id).map(p=>{visible.add(p.id);const prior=visualPeers.get(p.id),air=p.air||'landed',velocity=['launchTransit','skyDrift','gliderOpening','gliding','gliderFolding'].includes(air)?p.airVelocity:null,motion=advanceMotionTrack(prior?.motion,p.p,{dt,state:air,velocity,sampleId:motionSample}),rotation=smoothAngle(prior?.yaw,p.yaw,dt),visual={motion,yaw:rotation};visualPeers.set(p.id,visual);return {...p,p:motion.position,yaw:rotation,color:colors[p.id]};});for(const key of visualPeers.keys())if(!visible.has(key))visualPeers.delete(key);
  storm=s.mode==='town'?Math.max(18,255-s.elapsed*.58):305;started=true;running=['playing','ship','flight'].includes(s.phase)&&watched.hp>0;ended=false;window.Duel.spectating=watched.id!==id?watched.id:null;updateHUD();$('wood').textContent=s.mode==='build'?'∞':wood;const me=s.players.findIndex(v=>v.id===id),alive=s.players.filter(v=>v.hp>0).length;$('score').textContent='◎ '+(s.scores[me]||0)+'/'+(s.targetScore||5);$('remaining').textContent=alive+' LEFT';$('time').textContent=(s.phase==='ship'||s.phase==='flight'||watched.air!=='landed')?'FLIGHT':'R '+s.round;
 },
 effect(e,id){
  if(e.type==='shot'){
   const profile=WEAPON_PROFILES[e.weapon]||WEAPON_PROFILES.ar,ends=e.traces?.length?e.traces:[e.b];
   if(!e.projectileId)for(const end of ends)if(end)spawnEffect({a:e.a,b:end,life:.19,maxLife:.19,col:color('ffe7a0'),tracer:true});
   if(e.by===id){flash=.09;viewShotImpulse=1;recoil=Math.max(recoil,profile.recoil[0]*5.5);recoilPitch+=profile.recoil[0];recoilYaw+=(rnd()-.5)*profile.recoil[1];sustained=Math.min(5,sustained+1);sound(profile.id==='sniper'?72:profile.id==='shotgun'?88:profile.id==='smg'?138:110,.1,'sawtooth',profile.id==='sniper'?.055:.035);if(e.hit){hitTime=.24;damageNumber=.65;$('damagevalue').textContent=String(e.damage||profile.damage);$('damagevalue').classList.toggle('critical',Boolean(e.hits?.some(h=>h.critical)));}}
   if(e.hit===id||e.hits?.some(h=>h.id===id))hurt=.35;
  }else if(e.type==='projectile-impact'){
   if(!acceptEventId(projectileEventCache,e.projectileId))return;
   if(Array.isArray(e.point))for(let index=0;index<5;index++)spawnEffect({p:e.point,v:[(rnd()-.5)*3,rnd()*2.4,(rnd()-.5)*3],life:.28,maxLife:.28,col:e.hit?C.blue:C.gold});
   if(e.by===id&&e.hit){hitTime=.28;damageNumber=.68;$('damagevalue').textContent=String(e.damage||WEAPON_PROFILES.sniper.damage);$('damagevalue').classList.toggle('critical',Boolean(e.critical));}
   if(e.hit===id)hurt=.4;
  }else if(e.type==='projectile-expire'){
   if(!acceptEventId(projectileEventCache,e.projectileId))return;
  }else if(e.type==='reload'&&e.by===id){sound(315,.1,'triangle',.018);notify(`Reloading ${(WEAPON_PROFILES[e.weapon]||WEAPON_PROFILES.ar).shortName}…`);
  }else if(e.type==='switch'&&e.by===id){sound(205,.07,'triangle',.014);
  }else if(e.type==='cabin_exit'&&e.by===id){sound(260,.32,'sine',.03);notify('Arcade glide launched');
  }else if(e.type==='cabin_autolaunch'&&e.by===id){sound(190,.38,'sine',.028);notify('Cloudliner launched you into the glide');
  }else if(e.type==='glider_open'&&e.by===id){sound(480,.34,'triangle',.024);notify(e.forced?'Glider opened automatically':'Glider opening');
  }else if(e.type==='glider_fold'&&e.by===id){sound(300,.18,'triangle',.018);notify('Glider folded');
  }else if(e.type==='glider_fold_blocked'&&e.by===id){notify('Glider locked near the ground');
  }else if(e.type==='land'&&e.by===id){sound(130,.12,'triangle',.02);notify('Touchdown');
  }else if(e.type==='elimination'&&e.hit===id){hurt=.6;notify('Eliminated · spectating the round');}
 },startAudio(){try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();}catch{}},capture:captureMouse};
reset();requestAnimationFrame(frame);
})();
