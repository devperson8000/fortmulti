import {createDeploymentAudio} from './deployment-audio.js';
import {deploymentCinematic,cinematicCamera,cinematicPodPosition,cinematicFov,MUSIC_START,DEPLOYMENT_CUES,DEPLOYMENT_MUSIC_END,podLandingBurst,stepPodLandingParticle,podLandingParticleSize,podImpactOffset} from './deployment-cinematic.js';
import {createWeaponAudio} from './weapon-audio.js';
import {createWorldChunks,updateFrustum,chunkVisible} from './world-chunks.js';
import {createInventory,inventoryWeapon,movedSelection} from './weapon-inventory.js';
import {createInventoryPrediction,predictInventoryMove,reconcileInventory,clearInventoryPrediction} from './inventory-prediction.js';
import {createInventoryMenu} from './inventory-menu.js';
import {createBulletTracer,bulletTracerSegment,bulletVisualOrigin} from './bullet-presentation.js';
import {terrainColor,surfaceAtPoint,litColor,buildPresentation,createMotionPresentation,stepMotionPresentation,WORLD_VERTEX,WORLD_FRAGMENT,SKY_VERTEX,SKY_FRAGMENT} from './visual-presentation.js';
import {buildingLayout,roadRibbon,OUTPOSTS} from './world-layout.js';
import {ITEMS,ITEM_SLOTS,validSlot,MATERIALS} from './items.js';
import {aimedEntity} from './resource-system.js';
import {gridBounds,gridPlacement,gridBaseY,rayRamp} from './build-grid.js';
import {WEAPON_PROFILES,WEAPON_ORDER,BUILD_SLOTS,createLoadout,weaponForSlot,weaponIdForSlot,isWeaponSlot,isBuildSlot,currentAmmo,shotSpread,spreadDirection,reloadProgress} from './weapon-system.js';
import {advanceMotionTrack,smoothAngle,selectViewPlayer} from './network-tuning.js';
import {ReusableFloatBuffer} from './render-buffer.js';
import {createCameraPresentation,stepCameraPresentation,canFireDuringPresentation,createCameraBlendOutput,blendCameraViews,shouldShowLocalAvatar,shouldShowViewModel} from './first-person-system.js';
import {createViewModelState,stepViewModel,createWeaponPartState,stepWeaponParts,reloadStage,createFirstPersonHandPose} from './view-model.js';
import {createEffectPool} from './effect-pool.js';
import {acceptEventId} from './multiplayer-runtime.js';
import {createAutoQuality,sampleAutoQuality,qualityPreset,renderDimensions,graphicsContextOptions} from './quality-system.js';
import {DEPLOYMENT_SHIP,SHIP_PODS,shipWorld,shipLaunchAt,shipBoardingCamera} from './deployment-ship.js';
import {DEPLOYMENT_TIMELINE,createDeploymentClock,stepDeploymentClock,deploymentStageAt,deploymentPresentation,deploymentActorPose} from './deployment-sequence.js';
import {AVATAR_MODEL_PARTS,AVATAR_GEAR} from './avatar-model.js';
import {WEAPON_MODELS} from './weapon-model.js';
import {MatchCharacterRenderer} from './match-character-renderer.js';

'use strict';
(()=>{
const $=id=>document.getElementById(id),canvas=$('game');const contextOptions=graphicsContextOptions(),gl=canvas.getContext('webgl2',contextOptions)||canvas.getContext('webgl',contextOptions);
if(!gl){$('heading').textContent='WebGL is unavailable';$('intro').textContent='Enable hardware acceleration in your browser, then reopen the game.';$('play').style.display='none';return;}
document.body.classList.add('menu');
const readSetting=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}},writeSetting=(key,value)=>{try{localStorage.setItem(key,String(value));}catch{}},clampSetting=(value,min,max,fallback)=>{const number=Number(value);return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback;};
let graphicsSelection=['auto','low','medium','high'].includes(readSetting('sunny.graphicsQuality','auto'))?readSetting('sunny.graphicsQuality','auto'):'auto',mouseSensitivity=clampSetting(readSetting('sunny.mouseSensitivity','1'),.5,2,1),scopeSensitivity=clampSetting(readSetting('sunny.scopeSensitivity','.7'),.35,1.25,.7),autoQuality=createAutoQuality('medium'),currentQuality=qualityPreset(graphicsSelection,autoQuality);
const V=(x=0,y=0,z=0)=>[x,y,z],add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=a=>Math.hypot(...a),norm=a=>mul(a,1/(length(a)||1)),clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
let seed=428;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const color=h=>[parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255];
const C={grass:color('78b84f'),darkGrass:color('488747'),rock:color('a9b2ad'),trunk:color('785943'),leaves:color('338c61'),pine:color('42986a'),cream:color('f5e3af'),teal:color('408f90'),red:color('e37b58'),road:color('667780'),line:color('eee4b8'),skin:color('d69e72'),vest:color('414c40'),pants:color('54574c'),black:color('2d3933'),metal:color('4d6670'),blue:color('58d6ed'),wood:color('bf9058'),gold:color('e9c95f'),glass:color('80d7ee'),cable:color('b9c8cf')};
const AVATAR_COLORS={helmet:color('303a35'),pouch:color('4b5347'),webbing:color('666d59'),faceDetail:color('40362f'),sole:color('202824')};
const vertex=WORLD_VERTEX,fragment=WORLD_FRAGMENT;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Renderer could not start');gl.useProgram(program);
const ap=gl.getAttribLocation(program,'aPosition'),ac=gl.getAttribLocation(program,'aColor'),um=gl.getUniformLocation(program,'uMatrix'),ue=gl.getUniformLocation(program,'uEye');gl.enableVertexAttribArray(ap);gl.enableVertexAttribArray(ac);gl.enable(gl.DEPTH_TEST);gl.clearColor(.48,.77,.88,1);
let matchCharacterRenderer=null;try{matchCharacterRenderer=new MatchCharacterRenderer(gl,canvas);matchCharacterRenderer.bindRawProgram(program,ap,ac);gl.useProgram(program);gl.enableVertexAttribArray(ap);gl.enableVertexAttribArray(ac);}catch(error){console.warn('Horizon is using the built-in character fallback.',error);}
const light=norm([-.6,1,.4]);let geo=[];
const skyProgram=gl.createProgram();gl.attachShader(skyProgram,shader(gl.VERTEX_SHADER,SKY_VERTEX));gl.attachShader(skyProgram,shader(gl.FRAGMENT_SHADER,SKY_FRAGMENT));gl.linkProgram(skyProgram);if(!gl.getProgramParameter(skyProgram,gl.LINK_STATUS))throw Error('Sky renderer could not start');
const skyClip=gl.getAttribLocation(skyProgram,'aClip'),skyUniforms=Object.fromEntries(['uForward','uRight','uUp','uLens','uTime'].map(name=>[name,gl.getUniformLocation(skyProgram,name)])),skyBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,skyBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
function drawSky(eye,target,aspect,fov){const f=norm(sub(target,eye)),r=norm(cross(f,[0,1,0])),u=cross(r,f);gl.useProgram(skyProgram);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.bindBuffer(gl.ARRAY_BUFFER,skyBuffer);gl.enableVertexAttribArray(skyClip);gl.vertexAttribPointer(skyClip,2,gl.FLOAT,false,0,0);gl.uniform3fv(skyUniforms.uForward,f);gl.uniform3fv(skyUniforms.uRight,r);gl.uniform3fv(skyUniforms.uUp,u);gl.uniform2f(skyUniforms.uLens,Math.tan(fov/2)*aspect,Math.tan(fov/2));gl.uniform1f(skyUniforms.uTime,time);gl.drawArrays(gl.TRIANGLES,0,3);if(skyClip!==ap&&skyClip!==ac)gl.disableVertexAttribArray(skyClip);gl.useProgram(program);gl.enableVertexAttribArray(ap);gl.enableVertexAttribArray(ac);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);}


function triCoordinates(ax,ay,az,bx,by,bz,cx,cy,cz,col){const abx=bx-ax,aby=by-ay,abz=bz-az,acx=cx-ax,acy=cy-ay,acz=cz-az,nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx,length=Math.hypot(nx,ny,nz)||1,direct=Math.max(0,(nx*light[0]+ny*light[1]+nz*light[2])/length),hemi=(ny/length*.5+.5)*.22,r=col[0]*(.43+hemi+direct*.4),g=col[1]*(.49+hemi+direct*.34),b=col[2]*(.6+hemi+direct*.25);geo.push(ax,ay,az,r,g,b,bx,by,bz,r,g,b,cx,cy,cz,r,g,b);}
function tri(a,b,c,col){triCoordinates(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2],col);}
function quad(a,b,c,d,col){tri(a,b,c,col);tri(a,c,d,col);}
function gradientQuad(a,b,c,d,outer,inner){const normal=norm(cross(sub(b,a),sub(c,a))),shade=col=>litColor(col,normal,light),ca=shade(outer),cb=shade(outer),cc=shade(inner),cd=shade(inner);for(const [p,col] of [[a,ca],[b,cb],[c,cc],[a,ca],[c,cc],[d,cd]])geo.push(...p,...col);}
function transform(p,o,yaw=0,rx=0){let [x,y,z]=p;[y,z]=[y*Math.cos(rx)-z*Math.sin(rx),y*Math.sin(rx)+z*Math.cos(rx)];return [o[0]+x*Math.cos(yaw)+z*Math.sin(yaw),o[1]+y,o[2]-x*Math.sin(yaw)+z*Math.cos(yaw)];}
function poseTransform(p,o,yaw=0,pitch=0,roll=0,pivot=[0,1.25,0]){let x=p[0]-pivot[0],y=p[1]-pivot[1],z=p[2]-pivot[2];[x,y]=[x*Math.cos(roll)-y*Math.sin(roll),x*Math.sin(roll)+y*Math.cos(roll)];[y,z]=[y*Math.cos(pitch)-z*Math.sin(pitch),y*Math.sin(pitch)+z*Math.cos(pitch)];return transform([x+pivot[0],y+pivot[1],z+pivot[2]],o,yaw);}

function lobbySoldierVertex(source,index,out,origin,scale,cy,sy,cr,sr,pivot,bob,breath){
 let x=source[index]*scale,y=source[index+1]*scale,z=source[index+2]*scale;
 y+=bob+Math.max(0,y-pivot*.64)*breath;
 const py=y-pivot,nx=x*cr-py*sr,ny=x*sr+py*cr+pivot;
 x=nx;y=ny;
 out[0]=origin[0]+x*cy+z*sy;out[1]=origin[1]+y;out[2]=origin[2]-x*sy+z*cy;
}
function drawLobbySoldier(origin,yaw,scale=1.48,phase=0,showcase=false){
 const model=lobbySoldier;if(!model)return false;
 const breathe=Math.sin(time*1.45+phase),bob=breathe*.012,sway=Math.sin(time*.58+phase)*(showcase?.045:.026),lean=Math.sin(time*.72+phase*.7)*.012;
 const turn=yaw+sway,cy=Math.cos(turn),sy=Math.sin(turn),cr=Math.cos(lean),sr=Math.sin(lean),pivot=.9*scale,breath=breathe*.0022;
 const positions=model.positions,colors=model.colors;
 for(let triangle=0;triangle<model.count;triangle++){
  const p=triangle*9,c=triangle*3;
  lobbySoldierVertex(positions,p,lobbySoldierA,origin,scale,cy,sy,cr,sr,pivot,bob,breath);
  lobbySoldierVertex(positions,p+3,lobbySoldierB,origin,scale,cy,sy,cr,sr,pivot,bob,breath);
  lobbySoldierVertex(positions,p+6,lobbySoldierC,origin,scale,cy,sy,cr,sr,pivot,bob,breath);
  lobbySoldierColor[0]=Math.min(1,colors[c]*1.1);lobbySoldierColor[1]=Math.min(1,colors[c+1]*1.1);lobbySoldierColor[2]=Math.min(1,colors[c+2]*1.1);
  tri(lobbySoldierA,lobbySoldierB,lobbySoldierC,lobbySoldierColor);
 }
 return true;
}

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
function beam(a,b,width,col){const axis=sub(b,a),side=mul(norm(cross(axis,Math.abs(axis[1])>Math.hypot(axis[0],axis[2])*4?[1,0,0]:[0,1,0])),width);const up=mul(norm(cross(side,axis)),width);let p=[add(add(a,side),up),add(sub(a,side),up),sub(sub(a,side),up),sub(add(a,side),up)],q=p.map(v=>add(v,axis));for(let i=0;i<4;i++)quad(p[i],q[i],q[(i+1)%4],p[(i+1)%4],col);}
function tube(a,b,r,col,n=16){const axis=norm(sub(b,a)),guide=Math.abs(axis[1])>.92?[1,0,0]:[0,1,0],side=mul(norm(cross(axis,guide)),r),up=mul(norm(cross(side,axis)),r);for(let i=0;i<n;i++){const t=i/n*Math.PI*2,u=(i+1)/n*Math.PI*2,p=add(a,add(mul(side,Math.cos(t)),mul(up,Math.sin(t)))),q=add(a,add(mul(side,Math.cos(u)),mul(up,Math.sin(u)))),s=add(b,add(mul(side,Math.cos(t)),mul(up,Math.sin(t)))),v=add(b,add(mul(side,Math.cos(u)),mul(up,Math.sin(u))));quad(p,s,v,q,col);tri(a,q,p,col);tri(b,s,v,col);}}
const ISLAND_SIZE=306,flatZones=[[0,0,62,0],[-202,76,42,2],[184,82,44,3],[126,-188,46,4],[-92,-178,38,2],[8,202,38,6]];
function height(x,z){
 const r=Math.hypot(x*.96,z),shore=clamp((ISLAND_SIZE-r)/29,0,1),waves=Math.sin(x*.033)*2.4+Math.cos(z*.029)*2.1+Math.sin((x+z)*.018)*2.8;
 let y=-5+shore*(8+waves+15*Math.exp(-((x+36)**2+(z-176)**2)/3800)+11*Math.exp(-((x-188)**2+(z+122)**2)/2600)+8*Math.exp(-((x+205)**2+(z+92)**2)/2400));
 for(const [cx,cz,rad,level] of flatZones){const t=clamp(1-Math.hypot(x-cx,z-cz)/rad,0,1);y=mix(y,level,t*t*(3-2*t));}
 return y;
}
const obstacles=[],trees=[],buildings=[],resources=[],chestSpawns=[],resourceRanges=[];let resourceVertices=[];
function solid(o,s,c,yaw=0){box(o,s,c,yaw);const ex=Math.abs(Math.cos(yaw))*s[0]/2+Math.abs(Math.sin(yaw))*s[2]/2,ez=Math.abs(Math.sin(yaw))*s[0]/2+Math.abs(Math.cos(yaw))*s[2]/2;obstacles.push({surface:c===C.wood||c===C.trunk?'wood':c===C.metal?'metal':'stone',min:[o[0]-ex,o[1]-s[1]/2,o[2]-ez],max:[o[0]+ex,o[1]+s[1]/2,o[2]+ez]});}
// Ocean plus a broad triangulated island. The three-unit grid keeps the larger world smooth without overloading laptop GPUs.
box([0,-6,0],[760,2,760],color('3c9cbc'));
for(let x=-320;x<320;x+=3)for(let z=-320;z<320;z+=3){const a=[x,height(x,z),z],b=[x+3,height(x+3,z),z],c=[x+3,height(x+3,z+3),z+3],d=[x,height(x,z+3),z+3],col=terrainColor(x+1.5,z+1.5);tri(a,c,b,col);tri(a,d,c,col);}

function groundShade(x,z,rx,rz,opacity=.3){const rings=2,segments=12;for(let ring=0;ring<rings;ring++){const r0=ring/rings,r1=(ring+1)/rings;for(let i=0;i<segments;i++){const vertex=(r,a)=>{const px=x+Math.cos(a)*rx*r,pz=z+Math.sin(a)*rz*r,base=terrainColor(px,pz),shade=opacity*(1-r)*(1-r),col=litColor(base.map((v,k)=>mix(v,[.12,.22,.22][k],shade)),[0,1,0],light);return {p:[px,height(px,pz)+.025,pz],col};},a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2,v=[vertex(r0,a),vertex(r1,a),vertex(r1,b),vertex(r0,b)];for(const index of [0,1,2,0,2,3])geo.push(...v[index].p,...v[index].col);}}}
function modularBuilding(x,z,w,d,h,col){const layout=buildingLayout(x,z,w,d,h,height);groundShade(x+1,z-1,w*.72,d*.74,.45);buildings.push({x,z,w,d});for(const part of layout.parts)solid(part.position,part.size,part.kind==='roof'?C.teal:part.kind==='stairs'||part.kind==='floor'?color('b2b9ae'):col);for(const point of layout.chests)chestSpawns.push({...point,id:`chest:${chestSpawns.length}`});for(let floor=0;floor<layout.floors;floor++)for(const side of [-1,1]){const y=layout.y+floor*3.6+1.8;for(let k=0;k<3;k++){const wx=x+side*(2.5+k*1.9);if(Math.abs(wx-x)<w/2-.8){box([wx,y,z+d/2+.125],[1.24,1.49,.025],color('526a72'));box([wx,y,z+d/2+.15],[1.1,1.35,.04],C.glass);box([wx,y,z+d/2+.177],[.045,1.35,.012],C.cream);box([wx,y-.75,z+d/2+.17],[1.3,.12,.12],C.cream);}}}box([x,layout.y+2.8,z+d/2+.25],[2.6,.14,.7],C.teal);for(const side of [-1,1]){box([x,layout.y+.12,z+side*(d/2+.025)],[w,.24,.055],color('687a76'));box([x,layout.y+layout.floors*3.6-.1,z+side*(d/2+.04)],[w+.12,.2,.08],C.cream);box([x+side*(w/2+.025),layout.y+.12,z],[.055,.24,d],color('687a76'));} }
function building(x,z,w,d,h,col){modularBuilding(x,z,w,d,h,col);}
building(-9,-12,17,14,6,C.cream);building(-30,-15,11,11,4.5,C.red);building(37,-22,13,16,6,C.teal);building(-34,28,10,11,4,C.cream);
// Roadside diner: broad striped awning, tiered roof, and an oversized orange fruit sign.
for(let i=0;i<10;i++)box([-17.1+i*1.8,4.6,-3.8],[1.8,.22,3.3],i%2?C.cream:C.red,0,.14);
cone([-9,6.5,-12],9,4,2.9,C.teal,4);cone([-9,9.4,-12],4,1.6,1.3,C.cream,4);cone([-9,10.7,-12],.22,.22,2,C.black,6);gem([-9,14,-12],[2.6,2.5,2.6],color('f4a345'),10);cone([-9,16,-12],.22,.1,1,C.trunk);gem([-8.5,16.5,-12],[1.2,.25,.6],C.leaves,5);
// Forecourt.
box([39,.17,17],[22,.3,18],color('c5bfa5'));for(const x of[30,48])for(const z of[12,22]){solid([x,2.5,z],[.4,5,.4],C.red);box([x,1,z],[.7,.15,.7],C.cream);}box([39,5.1,17],[22,.6,15],C.cream);box([39,5.45,17],[22,.25,15],color('f6bd52'));for(const x of[34,43]){solid([x,1.2,17],[1.2,2.4,1],C.red);box([x,1.7,17.55],[.85,.55,.1],C.black);}
// Containers and parked cars.
for(let i=0;i<3;i++){let x=-11+i*8,z=29;solid([x,1.8,z],[6,3.6,10],i%2?C.red:C.teal);for(let k=-2.5;k<3;k+=.6)box([x+k,1.8,z+5.05],[.08,3.4,.09],C.metal);}
function car(x,z,yaw,col){const o=[x,.65,z];box(o,[2.6,1,4.8],col,yaw);box(transform([0,1.0,-.3],o,yaw),[2.2,1.15,2.4],C.black,yaw);box(transform([0,1.66,-.3],o,yaw),[2.3,.15,2.4],col,yaw);for(let a of[-1.3,1.3])for(let b of[-1.5,1.5])box(transform([a,-.1,b],o,yaw),[.35,.75,.8],C.black,yaw);obstacles.push({surface:'metal',min:[x-1.6,0,z-2.5],max:[x+1.6,2.4,z+2.5]});}
car(7,-1,0,color('e6c667'));car(39,25,0,color('7bb7a7'));car(-27,10,Math.PI/2,color('88b8d2'));
// Named landing regions spread useful cover and recognizable landmarks across the expanded island.
const pois=[{name:'SUNCREST',x:0,z:0},{name:'HARBOR REACH',x:-202,z:76},{name:'NEON GROVE',x:184,z:82},{name:'CROWN CITADEL',x:126,z:-188},{name:'DUSTY DEPOT',x:-92,z:-178},{name:'PINEWATCH',x:8,z:202}];
function highway(a,b,width=7){const strip=roadRibbon(a,b,width,height),verge=roadRibbon(a,b,width+2.2,height);for(let i=1;i<strip.length;i++){const p=strip[i-1],q=strip[i],v=verge[i-1],u=verge[i];gradientQuad(v.left,u.left,q.left,p.left,terrainColor(v.left[0],v.left[2]),color('95a279'));gradientQuad(u.right,v.right,p.right,q.right,terrainColor(v.right[0],v.right[2]),color('95a279'));quad(p.left,q.left,q.right,p.right,C.road);if(i%6<3){const a=p.center,b=q.center,dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz)||1,nx=-dz/len*.07,nz=dx/len*.07;quad([a[0]+nx,a[1],a[2]+nz],[b[0]+nx,b[1],b[2]+nz],[b[0]-nx,b[1],b[2]-nz],[a[0]-nx,a[1],a[2]-nz],C.line);}}}
highway([-49,8],[49,8],12);highway([22,-42],[22,35],10);
highway([-42,4],[-180,69]);highway([45,6],[161,71]);highway([28,-37],[113,-165]);highway([-21,-39],[-80,-156]);highway([7,45],[8,178]);
function cityBuilding(x,z,w,d,h,col){modularBuilding(x,z,w,d,h,col);}
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
// Dusty Depot: industrial hangars, silos and stacked cargo.
for(const [x,z,w,d,h,c] of [[-111,-183,20,18,8,C.red],[-85,-190,21,18,8,C.teal],[-89,-161,17,14,6,C.cream]])cityBuilding(x,z,w,d,h,c,C.metal);
for(const x of[-124,-118,-67,-61]){const z=-167,y=height(x,z);cone([x,y,z],3.2,3.2,11,C.metal,24);cone([x,y+11,z],3.2,.15,3,C.cream,24);}
for(let i=0;i<12;i++){const x=-120+(i%6)*10,z=-211+Math.floor(i/6)*7,y=height(x,z);solid([x,y+1.5,z],[8.4,3,5.8],i%3===0?C.gold:i%3===1?C.red:C.teal);}
// Pinewatch: timber lodge village around a radio lookout.
for(const [x,z,w,d,h] of [[-9,194,13,11,6],[9,184,14,12,7],[25,207,12,10,6],[-19,216,15,12,7]])cityBuilding(x,z,w,d,h,C.wood,color('4e5b4f'));
{const x=8,z=202,y=height(x,z);for(const s of[-1,1])for(const q of[-1,1])beam([x+s*2.8,y,z+q*2.8],[x+s*.9,y+22,z+q*.9],.12,C.metal);for(let h=5;h<22;h+=5){beam([x-2.2,y+h,z],[x+2.2,y+h,z],.09,C.metal);beam([x,y+h,z-2.2],[x,y+h,z+2.2],.09,C.metal);}gem([x,y+24,z],[.6,1.4,.6],C.red,8);}
for(let x=-43;x<8;x+=3){let z=43,y=height(x,z);box([x,y+1,z],[.16,2,.16],C.wood);box([x+1.5,y+1.5,z],[3,.18,.16],C.wood);box([x+1.5,y+.7,z],[3,.18,.16],C.wood);}
for(const [x,z,w,d,h] of OUTPOSTS)modularBuilding(x,z,w,d,h,C.cream);
// Resource geometry is uploaded once; destroyed nodes and distant nodes skip their draw ranges.
const terrainVertices=geo;geo=resourceVertices;
for(let i=0;i<340;i++){const a=rnd()*6.28,r=45+rnd()*230,x=Math.cos(a)*r,z=Math.sin(a)*r;if(pois.some(p=>Math.hypot(x-p.x,z-p.z)<34)||buildings.some(b=>Math.abs(x-b.x)<b.w/2+4&&Math.abs(z-b.z)<b.d/2+4))continue;const y=height(x,z),s=.7+rnd()*.8,id=`tree:${i}`,start=geo.length/6;trees.push({x,z});resources.push({id,kind:'wood',x,y,z,hp:100});groundShade(x+.35,z-.25,2.7*s,1.9*s,.34);cone([x,y,z],.35*s,.2*s,3*s,C.trunk,8);for(let k=0;k<3;k++)cone([x,y+(2+k*1.25)*s,z],(2.7-k*.6)*s,.05,3*s,k%2?C.leaves:C.pine,9);resourceRanges.push({id,x,z,start,count:geo.length/6-start});if(i%18===0)chestSpawns.push({id:`chest:tree:${i}`,x:x+2,y:height(x+2,z),z});}
for(let i=0;i<125;i++){const x=(rnd()-.5)*550,z=(rnd()-.5)*550;if(Math.hypot(x,z)<49||Math.hypot(x,z)>270||buildings.some(b=>Math.abs(x-b.x)<b.w/2+4&&Math.abs(z-b.z)<b.d/2+4))continue;const size=1+rnd()*1.8,y=height(x,z),id=`rock:${i}`,start=geo.length/6;resources.push({id,kind:'stone',x,y,z,hp:100});groundShade(x,z,size*1.3,size,.34);gem([x,y+size*.3,z],[size,size*.9,size*.8],C.rock,7);resourceRanges.push({id,x,z,start,count:geo.length/6-start});}
geo=terrainVertices;const resourceBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,resourceBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(resourceVertices),gl.STATIC_DRAW);resourceVertices=[];
// Small grass clusters on the overlook, batched with the terrain.
for(let i=0;i<3600;i++){let x=(rnd()-.5)*570,z=(rnd()-.5)*570;if(pois.some(p=>Math.hypot(x-p.x,z-p.z)<34))continue;let y=height(x,z),s=.3+rnd()*.65;tri([x-.12,y,z],[x+.13,y,z],[x+.1,y+s,z],i%2?C.darkGrass:C.grass);}

for(let i=0;i<9;i++){let x=-42+i*10;cone([x,0,18],.12,.09,5,C.black);beam([x,5,18],[x+1.2,5,18],.08,C.black);box([x+1.2,4.94,18],[.75,.16,.4],C.cream);}
for(let i=0;i<14;i++){let x=-42+i*6,z=-34;box([x,.55,z],[1.1,1.1,1.1],C.wood);for(let k of[-.45,.45])box([x+k,.55,z+.57],[.12,1.15,.08],C.black);}
const {data:staticData,chunks:worldChunks}=createWorldChunks(geo),worldFrustum=new Float32Array(24),staticBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,staticBuffer);gl.bufferData(gl.ARRAY_BUFFER,staticData,gl.STATIC_DRAW);const dynamicBuffer=gl.createBuffer(),dynamicData=new ReusableFloatBuffer(262144);geo.length=0;
const matrixView=new Float32Array(16),matrixProjection=new Float32Array(16),matrixData=new Float32Array(16);
function matrix(eye,target,aspect,fov){let zx=eye[0]-target[0],zy=eye[1]-target[1],zz=eye[2]-target[2],zLength=Math.hypot(zx,zy,zz)||1;zx/=zLength;zy/=zLength;zz/=zLength;let xx=zz,xz=-zx,xLength=Math.hypot(xx,xz)||1;xx/=xLength;xz/=xLength;const yx=zy*xz,yy=zz*xx-zx*xz,yz=-zy*xx;matrixView[0]=xx;matrixView[1]=yx;matrixView[2]=zx;matrixView[3]=0;matrixView[4]=0;matrixView[5]=yy;matrixView[6]=zy;matrixView[7]=0;matrixView[8]=xz;matrixView[9]=yz;matrixView[10]=zz;matrixView[11]=0;matrixView[12]=-(xx*eye[0]+xz*eye[2]);matrixView[13]=-(yx*eye[0]+yy*eye[1]+yz*eye[2]);matrixView[14]=-(zx*eye[0]+zy*eye[1]+zz*eye[2]);matrixView[15]=1;matrixProjection.fill(0);const f=1/Math.tan(fov/2),near=.15,far=820;matrixProjection[0]=f/aspect;matrixProjection[5]=f;matrixProjection[10]=(far+near)/(near-far);matrixProjection[11]=-1;matrixProjection[14]=2*far*near/(near-far);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let sum=0;for(let k=0;k<4;k++)sum+=matrixProjection[k*4+r]*matrixView[c*4+k];matrixData[c*4+r]=sum;}return matrixData;}
function draw(buffer,count){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.vertexAttribPointer(ap,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(ac,3,gl.FLOAT,false,24,12);gl.drawArrays(gl.TRIANGLES,0,count);}
const keys={},player={p:[-18,height(-18,62),62],vy:0,hp:100,shield:50,yaw:0};let yaw=0,pitch=-.15,eye=[-18,19,69],forward=[0,0,-1],running=false,started=false,ended=false,aim=false,firing=false,slot=1,ammo=30,wood=150,reloading=0,cooldown=0,elapsed=0,kills=0,storm=125,noticeTime=0,hitTime=0,hurt=0,walk=0,time=0,cameraCrouch=0;
let motionFeel=createMotionPresentation(),buildVisuals=new Map();let resourceHP=new Map(),openedChests=new Set(),grenades=[],selectedMaterial='wood';let bots=[],pickups=[],structures=[],shipData={origin:DEPLOYMENT_SHIP.origin},deploymentData=null,deploymentSnapshot=null,deploymentClock=createDeploymentClock(),cinematicLock=false,cinematicPodAnchor=null,landingChoice=null,matchPhase='',matchRound=0,loadout=createInventory(),reloadWeapon='ar',viewSlot=1,playerMotion=null,playerMotionId='',cameraPresentation=createCameraPresentation(),viewModelState=createViewModelState(),weaponPartState=createWeaponPartState();const visualPeers=new Map(),projectileVisuals=new Map(),projectileEventCache=new Map(),effectPool=createEffectPool(144),spawnEffect=data=>effectPool.activeCount<currentQuality.effects?effectPool.spawn(data):null,cameraBlendOutput=createCameraBlendOutput();let impactSequence='',buildRotation=0,flash=0,recoil=0,recoilPitch=0,recoilYaw=0,damageNumber=0,equipTime=0,equipDuration=.34,adsBlend=0,cameraFov=1.07,sustained=0,mouseSwayX=0,mouseSwayY=0,viewShotImpulse=0,lastWeaponSlot=1,lastWeaponItem=null,lastBuildSlot=6;
const inventoryPrediction=createInventoryPrediction(),hudSlots=[...document.querySelectorAll('[data-slot]')];let desiredItem=null,desiredUtility=null,inventorySequence=0,inventoryContext='',lastInventorySend=0;
const inventoryMenu=createInventoryMenu({root:$('inventory-menu'),getState:()=>({inventory:loadout,slot,utilities:player.items,materials:player.materials,alive:running&&player.hp>0&&!window.Duel?.spectating,phase:matchPhase}),onMove:(from,to)=>window.Game.moveInventory(from,to),onSelect:n=>{select(n);updateHUD();updateInventoryHUD();},onOpen:()=>{keysClear();document.exitPointerLock?.();},onClose:()=>{keysClear();if(running&&!touch)$('resume-control').hidden=false;},getThumbnail:type=>matchCharacterRenderer?.getWeaponThumbnail(type)});
function sendInventoryOperation(){const op=inventoryPrediction.pending[0];if(op&&performance.now()-lastInventorySend>350){lastInventorySend=performance.now();window.Duel?.moveInventory({...op});}}
function presentInventory(){loadout=inventoryPrediction.inventory;const index=desiredItem?loadout.findIndex(w=>w?.id===desiredItem):-1;if(desiredItem&&index<0){desiredItem=null;desiredUtility=0;}const chosen=index>=0?index+1:desiredUtility??inventoryPrediction.slot;select(chosen,true,true);player.inventory=loadout;player.slot=slot;player.weapon=weaponIdForSlot(slot,loadout);ammo=currentAmmo(loadout,slot);updateHUD();updateInventoryHUD();}
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
function reset(){motionFeel=createMotionPresentation();buildVisuals.clear();Object.assign(player,{p:[-18,height(-18,62),62],vy:0,hp:100,shield:50,yaw:0,air:'landed'});visualPeers.clear();projectileVisuals.clear();projectileEventCache.clear();effectPool.clear();playerMotion=null;playerMotionId='';shipData={origin:DEPLOYMENT_SHIP.origin};deploymentData=null;deploymentSnapshot=null;deploymentClock=createDeploymentClock();cinematicLock=false;landingChoice=null;deploymentCameraRound=-1;impactSequence='';cinematicPodAnchor=null;cameraPresentation=createCameraPresentation();viewModelState=createViewModelState();weaponPartState=createWeaponPartState();viewShotImpulse=0;matchRound=0;yaw=0;pitch=-.15;cameraCrouch=0;loadout=createInventory();ammo=0;wood=0;elapsed=0;kills=0;storm=125;ended=false;slot=0;reloading=0;cooldown=0;structures=[];buildRotation=0;flash=0;recoil=0;recoilPitch=0;recoilYaw=0;equipTime=0;adsBlend=0;cameraFov=1.07;sustained=0;bots=spawns.map(([x,z],i)=>({p:[x,height(x,z),z],hp:100,yaw:0,seed:i*2.2,cool:2+i*.3,slot:1,weapon:'ar',reload:0,equip:0,aim:false}));pickups=[];select(0,true);updateHUD();}
function character(p,angle,phase,col,enemy=false,air='landed',deploy=1,pose='combat',anim={}){
 const airborne=Math.abs(Number(anim.velocity)||0)>.65,open=0,rigPitch=airborne?clamp(-(Number(anim.velocity)||0)*.035,-.24,.16):0,rigRoll=0,detail=enemy?currentQuality.remoteDetail*clamp(1-(length(sub(p,eye))-40)/260,.52,1):1,segments=n=>Math.max(10,Math.round(n*detail)),rig=v=>poseTransform(v,p,angle,rigPitch,rigRoll),part=(v,s,c,rx=0)=>box(rig(v),s,c,angle,rx+rigPitch),ball=(v,r,c,n=22,q=13)=>poseOvoid(v,r,c,p,angle,rigPitch,rigRoll,segments(n),segments(q)),limb=(a,b,w,c)=>tube(rig(a),rig(b),w,c,segments(18)),roundPart=(v,r,c,n=26,q=15)=>poseOvoid(v,r,c,p,angle,rigPitch,rigRoll,segments(n),segments(q));
 const sway=Math.sin(time*3.2+phase)*.14,step=Math.sin(phase)*.22,skin=C.skin;
 const weapon=WEAPON_PROFILES[anim.weapon]||WEAPON_PROFILES.ar,reloadP=anim.reload?reloadProgress(anim.reload,weapon.slot):0,equipP=clamp((anim.equip||0)/weapon.equipDuration,0,1),aimP=anim.aim?1:0;
 const poseParts=stepWeaponParts(characterWeaponPartState,weapon,anim.reload||0),reloadWave=Math.sin(Math.PI*clamp(reloadP/.92,0,1)),breath=Math.sin(time*1.65+phase*.05)*.012,localSway=anim.local?[mouseSwayX*.0015,mouseSwayY*.0012]:[0,0];
 const gunX=mix(.28,.1,aimP)+localSway[0],gunY=1.56+breath-localSway[1]-.34*equipP+.08*reloadWave,gunZ=-.7+(anim.recoil||0)*1.25+.16*equipP,gunTilt=poseParts.rootTilt+.75*equipP;
 // Restrained field colors keep the recognizable soldier silhouette clean at
 // every distance while the selected uniform color remains player-specific.
 const cloth=col.map(v=>v*.78),trim=AVATAR_COLORS.webbing,avatarMaterial=name=>name==='base'?col:name==='cloth'?cloth:name==='trim'?trim:name==='pants'?C.pants:name==='skin'?skin:name==='face-detail'?AVATAR_COLORS.faceDetail:name==='helmet'?AVATAR_COLORS.helmet:name==='carrier'?C.vest:name==='pouch'?AVATAR_COLORS.pouch:name==='webbing'?AVATAR_COLORS.webbing:name==='dark'?C.black:name==='metal'?C.metal:C.metal;
 for(const piece of AVATAR_MODEL_PARTS){for(const side of piece.mirror?[-1,1]:[1]){const sign=piece.mirror?side:1,material=avatarMaterial(piece.material);if(piece.shape==='tube'){limb([piece.from[0]*sign,piece.from[1],piece.from[2]],[piece.to[0]*sign,piece.to[1],piece.to[2]],piece.size[0],material);}else{roundPart([piece.position[0]*sign,piece.position[1],piece.position[2]],piece.size,material,segments(piece.sides),segments(piece.rings));}}}
 // The Soldier silhouette settles into a small airborne brace when jumping.
 for(const side of[-1,1]){
  const hip=[side*.19,.96,0],knee=airborne?[side*.29,.64,.13+sway*side]:[side*.19,.56,step*side],ankle=airborne?[side*.26,.22,.06-sway*side]:[side*.18,.16,-.08-step*side];
  roundPart(hip,[.2,.22,.19],C.pants,24,14);limb(hip,knee,.167,C.pants);const thigh=hip.map((v,k)=>mix(v,knee[k],.43));roundPart([thigh[0],thigh[1],thigh[2]-.095],AVATAR_GEAR.thighPanel.size,cloth,20,12);roundPart(knee,[.18,.18,.16],C.pants,20,12);roundPart([knee[0],knee[1],knee[2]-.135],AVATAR_GEAR.kneeGuard.size,C.black,20,12);roundPart([knee[0],knee[1],knee[2]-.18],AVATAR_GEAR.kneeGuard.inset,AVATAR_COLORS.pouch,16,10);limb(knee,ankle,.15,C.pants);roundPart([ankle[0],ankle[1]+.17,ankle[2]-.075],AVATAR_GEAR.shinPanel.size,cloth,18,11);roundPart(ankle,AVATAR_GEAR.boot.ankle,C.black,20,12);roundPart([ankle[0],ankle[1]-.065,ankle[2]-.12],AVATAR_GEAR.boot.toe,C.black,20,12);roundPart([ankle[0],ankle[1]-.145,ankle[2]-.12],AVATAR_GEAR.boot.sole,AVATAR_COLORS.sole,18,10);
 }
 // Arms follow the equipped item, including the magazine handoff during reload and a relaxed lobby stance.
 for(const side of[-1,1]){
  const shoulder=[side*.43,1.79,-.01];let elbow,hand;
  if(airborne){elbow=[side*.52,1.62,-.06];hand=[side*.42,1.31,.04];}
  else if(pose==='lobby'||pose==='ship'){const idle=Math.sin(time*1.25+side)*.018;elbow=[side*.49,1.45+idle,.025];hand=[side*.4,1.08+idle,.06];}
  else if(anim.building){elbow=[side*.48,1.62,-.27];hand=[side*.32,1.5,-.7];}
  else if(side<0){const reach=weapon.id==='shotgun'?-.98:weapon.id==='sniper'?-1.08:-.88,handOffset=poseParts.supportHand;elbow=[-.45,1.58+.12*aimP+handOffset[1]*.22,-.3+handOffset[2]*.2];hand=[gunX-.18+handOffset[0]*.55,gunY-.02+handOffset[1]*.65,reach+handOffset[2]*.55];}
  else{elbow=[.5,1.58+.1*aimP,-.23];hand=[gunX+.05,gunY-.1,gunZ+.16];}
  const wrist=elbow.map((value,index)=>mix(value,hand[index],.8));roundPart(shoulder,[.185,.195,.18],cloth,22,13);limb(shoulder,elbow,.155,cloth);roundPart(elbow,[.14,.15,.135],cloth,18,11);limb(elbow,hand,.125,cloth);roundPart(wrist,AVATAR_GEAR.wristCuff.size,AVATAR_COLORS.webbing,16,10);roundPart(hand,AVATAR_GEAR.glove.size,C.black,18,11);
 }
 if(!airborne&&pose!=='lobby'&&pose!=='ship'&&pose!=='pod'){
  if(anim.building){
   const pulse=.8+Math.sin(time*4)*.08;part([0,1.48,-.73],[.78,.56,.045],C.blue.map(v=>Math.min(1,v*pulse)));for(const x of[-.3,-.1,.1,.3])part([x,1.48,-.76],[.018,.5,.012],C.cream);for(const y of[1.28,1.48,1.68])part([0,y,-.77],[.72,.018,.012],C.cream);part([.38,1.74,-.75],[.09,.09,.03],C.gold);
  }else{
  const gunScale=.73,gunPoint=v=>{const y=v[1]*gunScale,z=v[2]*gunScale;return rig([gunX+v[0]*gunScale,gunY+y*Math.cos(gunTilt)-z*Math.sin(gunTilt),gunZ+y*Math.sin(gunTilt)+z*Math.cos(gunTilt)]);},gunBox=(v,s,c,rx=0)=>box(gunPoint(v),s,c,angle,gunTilt+rx+rigPitch),gunOval=(v,s,c,n,q)=>poseOvoid(gunPoint(v),s,c,[0,0,0],0,0,0,n,q),gunTube=(a,b,r,c,n)=>tube(gunPoint(a),gunPoint(b),r,c,n);
  drawWeaponLayout(weapon,poseParts,gunScale,(v,s,c,rx)=>gunBox(v,s,c,rx),(v,s,c,n,q)=>gunOval(v,s,c,segments(n),segments(q)),(a,b,r,c,n)=>gunTube(a,b,r,c,segments(n)),detail);
  }
 }
}


function ovoid(o,r,c,yaw=0,n=28,rings=16){const pt=(i,j)=>{const a=i/n*Math.PI*2,b=j/rings*Math.PI;return transform([Math.cos(a)*Math.sin(b)*r[0],Math.cos(b)*r[1],Math.sin(a)*Math.sin(b)*r[2]],o,yaw);};for(let j=0;j<rings;j++)for(let i=0;i<n;i++){const a=pt(i,j),b=pt(i+1,j),d=pt(i,j+1),e=pt(i+1,j+1);if(j>0)tri(a,b,d,c);if(j<rings-1)tri(b,e,d,c);}}
function deploymentPodGeometry(origin,yaw=0,doorOpen=0,signal=0){
 const at=v=>transform(v,origin,yaw),part=(v,size,tint,rx=0)=>box(at(v),size,tint,yaw,rx),line=(a,b,r,tint)=>beam(at(a),at(b),r,tint),shell=color('314852'),rim=color('80959a'),glow=color('5bd8ef'),glass=color('317c91');
 const pulse=.72+Math.sin(time*3.3+signal)*.12;
 // Keep the rear armor behind the operator, with continuous side/roof plates.
 // The shell stays opaque; only the two front doors slide aside.
 ovoid(at([0,1.92,-.76]),[1.02,1.88,.22],shell,yaw,30,18);
 for(const side of[-1,1]){
  part([side*.89,1.86,.03],[.24,3.46,1.8],shell);
  part([side*.95,1.87,.32],[.055,2.7,.68],color('405d66'));
  line([side*.84,.22,.68],[side*.84,3.36,.68],.07,rim);
 }
 part([0,3.53,.06],[1.82,.25,1.95],shell);
 part([0,.13,.06],[1.82,.24,1.95],shell);
 part([0,1.85,-.85],[1.82,3.52,.16],color('263a42'));
 for(const side of[-1,1]){
  line([side*.86,.14,-.05],[side*.86,3.15,-.05],.075,rim);
  line([side*.72,.24,.72],[side*.72,3.02,.72],.045,glow.map(v=>Math.min(1,v*pulse)));
  const spread=Math.max(0,Math.min(1,doorOpen))*.98,x=side*(.49+spread);
  part([x,1.83,.96],[1.01,3.32,.24],color('253b43'));
  part([x,1.87,1.096],[.69,1.24,.035],color('182b36'));
  for(const y of[.34,3.3])part([x,y,1.098],[.89,.075,.036],rim);
  line([x-side*.43,.3,1.1],[x-side*.43,3.28,1.1],.025,glow.map(v=>v*pulse));
  for(let y=.55;y<3.2;y+=.42)part([side*.9,y,-.02],[.06,.035,.08],y<2.2?glow:rim);
 }
 for(const y of[.22,3.24]){for(let i=0;i<14;i++){const a=i/14*Math.PI*2;line([Math.sin(a)*.88,y,Math.cos(a)*.8],[Math.sin((i+1)/14*Math.PI*2)*.88,y,Math.cos((i+1)/14*Math.PI*2)*.8],.045,rim);}}
 part([0,.11,0],[1.62,.18,1.55],color('263a42'));
 for(const side of[-1,1])part([side*.91,1.88,1.12],[.12,3.18,.13],glow.map(v=>Math.min(1,v*pulse)));
}
function deploymentShipInterior(ship,players=[],sequenceTime=null){
 if(!ship)return;const origin=ship.origin||DEPLOYMENT_SHIP.origin,room=v=>[origin[0]+v[0],origin[1]+v[1],origin[2]+v[2]],part=(v,size,c,rx=0)=>box(room(v),size,c,0,rx),line=(a,b,r,c)=>beam(room(a),room(b),r,c);
 const hull=color('1e323b'),wall=color('2d4650'),floor=color('273b43'),panel=color('3d5961'),edge=color('9aab9e'),pulse=.84+Math.sin(time*2.15)*.08;
 // A broad fixed pressure hull gives the party room to move between the pod rows.
 // Segmented deck provides actual launch holes under every capsule.
  part([0,-.25,0],[10.9,.58,36],hull);part([0,.04,0],[10.9,.09,34.8],floor);
  for(const side of[-1,1]){
   part([side*10.28,-.25,0],[3.44,.58,36],hull);
   part([side*10.28,.04,0],[3.44,.09,34.8],floor);
   let edgeZ=-18;
   for(const podZ of [-10,-3.4,3.4,10,19.55]){
    const end=Math.min(18,podZ-1.55),length=end-edgeZ;
    if(length>.01){part([side*7,-.25,(edgeZ+end)/2],[3.1,.58,length],hull);part([side*7,.04,(edgeZ+end)/2],[3.1,.09,length],floor);}
    edgeZ=podZ+1.55;
   }
  }
  part([0,8.05,0],[24,.38,36],hull);part([0,7.83,0],[22.8,.08,34.5],wall);
 for(const side of[-1,1]){
  part([side*11.72,1.2,0],[.56,2.6,36],wall);part([side*11.72,6.0,0],[.56,3.8,36],wall);
  // Reinforced viewport panels, separated into readable bays by broad structural ribs.
  for(const z of[-14,-9,-4,1,6,11,16]){
   part([side*11.38,3.78,z],[.12,2.3,4.45],color('2d6574'));
   part([side*11.29,2.56,z],[.08,.08,4.5],color('8fe1e3'));
   line([side*11.16,2.58,z-2.15],[side*11.16,5.02,z-2.15],.13,edge);
   line([side*11.16,2.58,z+2.15],[side*11.16,5.02,z+2.15],.13,edge);
   part([side*11.09,5.45,z],[.18,.11,.72],color('54cada').map(v=>Math.min(1,v*pulse)));
  }
  for(const z of[-16,-12,-8,-4,0,4,8,12,16]){line([side*10.7,.12,z],[side*10.7,7.8,z],.12,edge);part([side*10.46,.16,z],[.22,.11,.55],color('4cb6c7'));}
  part([side*8.5,.42,-1.6],[3.6,.72,5.5],color('344b4e'));
  part([side*8.5,.84,-1.6],[3.2,.12,5],color('927954'));
 }
 // Deck armor ribs and warm practical lights add scale without a moving exterior craft.
 for(let z=-16;z<=16;z+=4){line([-11.05,7.58,z],[11.05,7.58,z],.16,edge);part([0,7.47,z],[.72,.18,.42],color('b6dad1'));part([0,.11,z],[.12,.035,.8],z%8?color('c4b584'):color('5dcfe0'));}
 for(const side of[-1,1]){
  part([side*3.9,1.0,-.35],[5.8,1.75,4.3],color('263c43'));part([side*3.9,1.94,-.35],[5.5,.14,4.0],panel);
  for(let k=0;k<6;k++)part([side*(1.55+k*.88),2.12,-.35],[.56,.035,1.4],k%2?edge:color('51cee0'));
  part([side*4.0,2.82,-.35],[4.1,.05,2.25],color('436b70'));
 }
 part([0,1.75,-17.55],[21.3,3.5,.48],hull);part([0,3.9,-17.25],[16.5,.25,.4],edge);part([0,5.5,17.55],[21.3,5,.48],hull);
 // Lit routes connect the free movement deck to eight one-person drop pods.
 for(let x=-1.4;x<=1.4;x+=.7)part([x,.105,0],[.035,.035,32],x===0?color('d0c58e'):color('4ea6b6'));
 for(const pod of SHIP_PODS){
   const owner=players.find(p=>p.pod===pod.id);
   const launch=owner&&sequenceTime!==null?shipLaunchAt(sequenceTime):{hatchOpen:0,drop:0,exhaust:0};
   const closing=owner?.deploymentState==='entering_pod'?Math.max(0,Math.min(1,((owner.podProgress||0)-.56)/.44)):1;
   const open=owner?1-closing*closing*(3-2*closing):1;
   // Two deck plates retract before the sealed capsule shoots through the floor.
   for(const side of[-1,1]){
    part([pod.x+side*(.77+launch.hatchOpen*1.52),-.16,pod.z],[1.55,.34,3.12],hull);
    part([pod.x+side*(.77+launch.hatchOpen*1.52),.045,pod.z],[1.5,.045,2.9],panel);
    line([pod.x+side*1.54,-.06,pod.z-1.55],[pod.x+side*1.54,-.06,pod.z+1.55],.065,edge);
    if(launch.hatchOpen>.03)line([pod.x+side*1.52,-.58,pod.z-1.4],[pod.x+side*1.52,-.58,pod.z+1.4],.08,color('5bd8ef'));
   }
   // Shaft ribs and a bounded exhaust trail make downward acceleration visible.
   for(const side of[-1,1])part([pod.x+side*1.62,-1.85,pod.z],[.12,3.5,3.13],wall);
   if(launch.exhaust>.02)for(const offset of[-.48,0,.48])
    beam(room([pod.x+offset,-launch.drop-.1,pod.z]),room([pod.x+offset,-launch.drop-1.8*launch.exhaust,pod.z]),.07*launch.exhaust,color('7ddcf7'));
   deploymentPodGeometry(room([pod.x,-launch.drop,pod.z]),0,open,pod.row*2+pod.side);
  }
 // Small wayfinding consoles pulse while the player chooses a landing zone.
 for(const side of[-1,1]){part([side*4.2,1.36,0],[.38,1.12,2.5],color('273c45'));part([side*4.2,1.96,0],[.42,.08,2.65],color('5bd8e4'));for(let i=0;i<7;i++)part([side*4.2,2.04,-.95+i*.3],[.24,.025,.035],i%3?color('66dbea').map(v=>Math.min(1,v*pulse)):color('d2c487'));}
}
function deploymentPodInterior(position,yaw=0,open=0,shake=0,portrait=false){
 const at=v=>transform(v,position,yaw),part=(v,size,c,rx=0)=>box(at(v),size,c,yaw,rx),line=(a,b,r,c)=>beam(at(a),at(b),r,c),metal=color('314850'),rim=color('91a8a9'),glass=color('286578');
 if(portrait){
   // Exterior shot only. No inspection cutaway and no visible interior.
   deploymentPodGeometry(position,yaw,open,11);
   return;
  }
  // The sealed capsule surrounds the first-person eye before the title reveal.
 for(const side of[-1,1]){part([side*.86,1.72,0],[.2,3.5,.28],metal);part([side*.74,1.72,.44],[.08,3.25,.06],color('4ccbe2'));part([side*(.46+open*.95),1.74,.78],[.68,3.35,.13],metal);}
 part([0,3.42,.12],[1.9,.2,1.9],metal);part([0,-.09,.12],[1.9,.18,1.9],metal);for(const side of [-1,1]){part([side*(.42+open*.95),1.8,-.84],[.84,3.1,.2],metal);part([side*(.3+open*.95),2.18,-.72],[.55,.68,.05],glass);}
 for(let i=0;i<4;i++){const x=-.45+i*.3;line([x,3.12,.25],[x,3.12,.72],.025,i%2?rim:color('59d8e7'));}
 if(shake>0){const pulse=.75+Math.sin(time*35)*.2;part([0,2.95,.63],[.16,.055,.04],color('f3b95c').map(v=>Math.min(1,v*pulse)));}
}
function allObstacles(){return obstacles.concat(structures.filter(s=>s.type===2).map(s=>({...gridBounds(s),structure:s})));}
function blocked(p,r=.4){return allObstacles().some(b=>p[0]>b.min[0]-r&&p[0]<b.max[0]+r&&p[2]>b.min[2]-r&&p[2]<b.max[2]+r&&p[1]<b.max[1]&&p[1]+2>b.min[1]);}
function floorAt(x,z){let h=height(x,z);for(const s of structures){const q=transform([x-s.x,0,z-s.z],[0,0,0],-(s.angle||0));if(s.type===3&&Math.abs(q[0])<2.3&&Math.abs(q[2])<2.5)h=Math.max(h,s.y+(2.5-q[2])*.72);}return h;}
function move(p,dx,dz){let next=[p[0]+dx,p[1],p[2]];if(!blocked(next))p[0]=clamp(next[0],-292,292);next=[p[0],p[1],p[2]+dz];if(!blocked(next))p[2]=clamp(next[2],-292,292);}
function rayBox(o,d,b){let lo=0,hi=500;for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-6){if(o[i]<b.min[i]||o[i]>b.max[i])return Infinity;continue;}let a=(b.min[i]-o[i])/d[i],c=(b.max[i]-o[i])/d[i];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo)return Infinity;}return lo;}
function wallDistance(o,d,limit=360){let dist=limit;for(const b of allObstacles())dist=Math.min(dist,rayBox(o,d,b));for(const s of structures)if(s.type===3)dist=Math.min(dist,rayRamp(o,d,s));for(let t=.5;t<dist;t+=.75){const p=add(o,mul(d,t));if(p[1]<height(p[0],p[2])){dist=t;break;}}return dist;}
let audio,noiseBuffer;const weaponAudio=createWeaponAudio(),deploymentAudio=createDeploymentAudio();
function spawnPodLandingBurst(point){
 if(!point)return;
 const budget=Math.max(0,currentQuality.effects-effectPool.activeCount);
 for(const effect of podLandingBurst(point,budget,rnd))spawnEffect(effect);
 // Hit sounds follow this client's audible cue, rather than a later snapshot.
 sound(64,.85,'sawtooth',.073);sound(36,.95,'sine',.06);
 noiseSound('stone',.28,.068);sweepSound(240,55,.68,'triangle',.024);
}
function drawLandingShockwave(point,age){
 if(!point||age<0||age>1.45)return;
 const power=Math.pow(1-age/1.45,2);
 for(let ring=0;ring<2;ring++){
  const radius=1.1+age*(ring?15:10),segments=36,shade=ring?color('d7c6a3'):color('e5cb95');
  for(let i=0;i<segments;i++){
   const a=i/segments*2*Math.PI,b=(i+1)/segments*2*Math.PI;
   const fx=point.x+Math.cos(a)*radius,fz=point.z+Math.sin(a)*radius;
   const tx=point.x+Math.cos(b)*radius,tz=point.z+Math.sin(b)*radius;
   const ground=terrainColor(fx,fz),tint=shade.map((v,k)=>mix(ground[k],v,power));beam([fx,height(fx,fz)+.06,fz],[tx,height(tx,tz)+.06,tz],.015+power*.055,tint);
  }
 }
}
function noiseSound(surface='stone',duration=.08,volume=.02){try{if(!audio)return;if(!noiseBuffer){noiseBuffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*.3),audio.sampleRate);const data=noiseBuffer.getChannelData(0);let value=42;for(let n=0;n<data.length;n++){value=(Math.imul(value,1664525)+1013904223)>>>0;data[n]=value/4294967296*2-1;}}const now=audio.currentTime,source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=noiseBuffer;filter.type=surface==='metal'?'highpass':'lowpass';filter.frequency.value=surface==='wood'?850:surface==='grass'?500:surface==='metal'?2400:1600;gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start(now);source.stop(now+duration);}catch{}}
function weaponSound(profile){if(weaponAudio.play(audio,profile.id))return;noiseSound('metal',profile.id==='sniper'?.18:.1,profile.id==='shotgun'?.065:.045);sound(profile.id==='sniper'?72:profile.id==='shotgun'?88:profile.id==='smg'?138:110,profile.id==='sniper'?.18:.09,'triangle',profile.id==='sniper'?.065:.04);}
function surfaceAt(point){return surfaceAtPoint(point,structures,obstacles,height);}

function impactAt(point,from,hit=false){if(!Array.isArray(point))return;const target=hit===player.id?player:bots.find(p=>p.id===hit),surface=hit?(target?.shield>0?'shield':'character'):surfaceAt(point);if(!surface)return;const direction=norm(sub(from||add(point,[0,1,0]),point)),col=surface==='character'?color('f3f5d8'):surface==='shield'?C.blue:surface==='wood'?C.wood:surface==='grass'?color('a6b58a'):surface==='metal'?C.gold:C.rock,count=surface==='character'?4:surface==='shield'?7:surface==='metal'?6:4;for(let n=0;n<count;n++){const spark=surface==='metal'||surface==='shield'||surface==='character';spawnEffect({kind:spark?'spark':'dust',p:point,v:[direction[0]*(2+rnd()*2)+(rnd()-.5)*2,direction[1]*2+rnd()*2,direction[2]*(2+rnd()*2)+(rnd()-.5)*2],life:spark?.18:.38,maxLife:spark?.18:.38,col,radius:spark?.023:.075,gravity:spark?4:1.2});}if(Math.hypot(point[0]-player.p[0],point[2]-player.p[2])<30)noiseSound(surface,.055,hit?.013:.006);}

function sound(freq,duration=.08,type='triangle',volume=.025){try{if(!audio)return;const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(35,freq*.35),audio.currentTime+duration);gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}catch{}}
function sweepSound(from,to,duration,type='sine',volume=.02){try{if(!audio)return;const now=audio.currentTime,osc=audio.createOscillator(),filter=audio.createBiquadFilter(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(Math.max(30,from),now);osc.frequency.exponentialRampToValueAtTime(Math.max(30,to),now+duration);filter.type='lowpass';filter.frequency.setValueAtTime(Math.max(140,from*3),now);filter.frequency.exponentialRampToValueAtTime(Math.max(140,to*2.2),now+duration);gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);osc.connect(filter);filter.connect(gain);gain.connect(audio.destination);osc.start(now);osc.stop(now+duration);}catch{}}
function notify(text){$('notice').textContent=text;noticeTime=2.4;}
function select(n,instant=false,authoritative=false){if(!validSlot(n)||isWeaponSlot(n)&&!inventoryWeapon(loadout,n))return;const changed=n!==slot;slot=n;if(!authoritative){desiredItem=inventoryWeapon(loadout,n)?.id||null;desiredUtility=isWeaponSlot(n)?null:n;}if(isWeaponSlot(n)){lastWeaponSlot=n;lastWeaponItem=inventoryWeapon(loadout,n)?.id||null;}else if(isBuildSlot(n))lastBuildSlot=n;if(changed&&!authoritative)weaponAudio.stopReload(audio);if(changed&&!instant){equipDuration=isWeaponSlot(n)?weaponForSlot(n,loadout).equipDuration:.22;equipTime=equipDuration;reloading=0;sound(210,.08,'triangle',.018);}document.querySelectorAll('[data-slot]').forEach(e=>e.classList.toggle('selected',+e.dataset.slot===n));const profile=weaponForSlot(n,loadout);$('weaponlabel').textContent=isWeaponSlot(n)?profile.name:(BUILD_SLOTS[n]===2?'WALL BLUEPRINT · 10':'RAMP BLUEPRINT · 10');ammo=isWeaponSlot(n)?currentAmmo(loadout,n):10;$('ammotext').textContent=isWeaponSlot(n)?ammo:'10';$('ammocap').textContent=isWeaponSlot(n)?'/ '+profile.magazineCapacity:'';$('buildhelp').style.display=isBuildSlot(n)?'block':'none';$('touchfire').textContent=isWeaponSlot(n)?'FIRE':'BUILD';document.body.classList.toggle('building',isBuildSlot(n));document.body.dataset.weapon=isWeaponSlot(n)?profile.id:'build';}
function reload(){if(reloading||!isWeaponSlot(slot)||equipTime>0)return;const profile=weaponForSlot(slot,loadout),state=inventoryWeapon(loadout,slot);if(!state||state.ammo>=profile.magazineCapacity)return;reloading=profile.reloadDuration;reloadWeapon=profile.id;notify(`Reloading ${profile.shortName}…`);if(profile.id!=='shotgun')sound(330,.15);updateHUD();}
function buildSpot(){if(window.Duel?.active)return window.Duel.preview();return {x:Math.round((player.p[0]-Math.sin(yaw)*7)/5)*5,z:Math.round((player.p[2]-Math.cos(yaw)*7)/5)*5,angle:Math.round(yaw/(Math.PI/2))*Math.PI/2+buildRotation};}
function canBuild(s){if(window.Duel?.active)return window.Duel.valid(s);return !structures.some(v=>v.x===s.x&&v.z===s.z)&&!obstacles.some(b=>s.x+2>b.min[0]&&s.x-2<b.max[0]&&s.z+2>b.min[2]&&s.z-2<b.max[2]);}
function shoot(){/* Input is consumed by the authoritative Match. */}
function damage(n){if(ended)return;let s=Math.min(player.shield,n);player.shield-=s;player.hp=Math.max(0,player.hp-(n-s));hurt=.45;if(player.hp<=0)finish(false);updateHUD();}
function finish(win){ended=true;running=false;firing=false;keysClear();$('resume-control').hidden=true;$('game-settings').hidden=true;if(document.pointerLockElement)document.exitPointerLock();$('eyebrow').textContent=win?'LAST ONE STANDING':'RUN IT BACK?';$('heading').innerHTML=win?'That’s your<br>afternoon.':'Back to<br>the hill.';$('intro').textContent=win?'Suncrest is yours. All 8 bots tagged out. Drop back in for another round.':`You tagged out ${kills} of 8 bots. Collect blue shields and build cover when things get busy.`;$('play').innerHTML='PLAY AGAIN <span>→</span>';$('overlay').style.display='flex';document.body.classList.add('menu');}
function updateHUD(){$('hptext').textContent=Math.ceil(player.hp);$('shieldtext').textContent=Math.ceil(player.shield);$('hpbar').style.width=player.hp+'%';$('shieldbar').style.width=player.shield+'%';if(isWeaponSlot(slot)){const profile=weaponForSlot(slot,loadout);$('ammotext').textContent=reloading?'··':String(ammo);$('ammocap').textContent='/ '+profile.magazineCapacity;$('weaponlabel').textContent=profile.name;$('reload-progress').style.setProperty('--reload',reloading?reloadProgress(reloading,profile.slot):0);$('reload-progress').classList.toggle('active',reloading>0);}else{$('ammotext').textContent='10';$('ammocap').textContent='';$('reload-progress').classList.remove('active');}$('wood').textContent=wood;$('remaining').textContent='♟ '+(bots.filter(b=>b.hp>0).length+1);$('score').textContent='◎ '+kills;}
function updateInventoryHUD(){const held=ITEM_SLOTS[slot];if(slot===0||held){$('weaponlabel').textContent=held?ITEMS[held].name:'FIELD PICKAXE';$('ammotext').textContent=held?String(player.items?.[held]||0):'∞';$('ammocap').textContent='';}for(const el of hudSlots){const n=Number(el.dataset.slot),weapon=inventoryWeapon(loadout,n),profile=WEAPON_PROFILES[weapon?.type],item=ITEM_SLOTS[n],owned=n===0||isBuildSlot(n)||(isWeaponSlot(n)?Boolean(weapon):Boolean(player.items?.[item]));el.classList.toggle('empty',!owned);el.classList.toggle('selected',n===slot);if(isWeaponSlot(n)){
 // Peek only at warmed thumbnails: generating a preview inside a frame stalls gameplay.
 const art=el.querySelector('span'),thumbnail=matchCharacterRenderer?.weaponThumbnails?.get(profile?.id),key=`${weapon?.type||'empty'}:${Boolean(thumbnail)}`;
 if(el.dataset.weaponArt!==key){el.dataset.weaponArt=key;art.replaceChildren();if(thumbnail){const image=document.createElement('img');image.src=thumbnail;image.alt='';image.draggable=false;art.append(image);}else art.textContent=profile?.icon||'＋';}
 const label=profile?`Slot ${n}: ${profile.name}, ${weapon.ammo} rounds`:`Slot ${n}: empty`;if(el.getAttribute('aria-label')!==label)el.setAttribute('aria-label',label);
 el.querySelector('small').textContent=profile?.shortName||'EMPTY';el.style.setProperty('--rarity',profile?.color||'#618aa2');}else if(item)el.querySelector('small').textContent=`${item.toUpperCase()} ${player.items?.[item]||0}`;}const stone=$('stone');if(stone)stone.textContent=player.materials?.stone||0;const prompt=$('interact-prompt'),loot=aimedEntity(player,{yaw},pickups),chest=aimedEntity(player,{yaw},chestSpawns.filter(c=>!openedChests.has(c.id)));prompt.textContent=matchPhase==='playing'?(loot?`E · PICK UP ${WEAPON_PROFILES[loot.type]?.name||ITEMS[loot.type]?.name||loot.type}`:chest?'HOLD E · OPEN CHEST · 3.5s':''):'';const use=$('use-indicator');use.hidden=!player.use&&!player.chestHold;if(player.chestHold){const h=player.chestHold;use.textContent=`OPENING CHEST · ${Math.max(0,h.duration-h.elapsed).toFixed(1)}s`;use.style.setProperty('--progress',`${Math.min(100,h.elapsed/h.duration*100)}%`);}else if(player.use){use.textContent=`${ITEMS[player.use.id].name} · ${Math.max(0,player.use.remaining).toFixed(1)}s`;use.style.setProperty('--progress',`${(1-player.use.remaining/player.use.duration)*100}%`);}inventoryMenu.update();}
let crouchRevision=0,slideRevision=0;
function keysClear(){for(const k in keys)keys[k]=false;firing=false;aim=false;}
function pause(){if(window.Duel?.active){keysClear();$('resume-control').hidden=true;$('game-settings').hidden=true;window.Duel.menu();return;}if(!running)return;running=false;keysClear();$('resume-control').hidden=true;$('game-settings').hidden=true;if(document.pointerLockElement)document.exitPointerLock();$('eyebrow').textContent='TAKE A BREATHER';$('heading').innerHTML='See you<br>on the hill.';$('intro').textContent='Your round is paused. Jump back in whenever you’re ready.';$('play').innerHTML='RESUME <span>→</span>';$('overlay').style.display='flex';document.body.classList.add('menu');}
async function captureMouse(){try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();void weaponAudio.load(audio);if(!touch)await canvas.requestPointerLock();$('resume-control').hidden=true;}catch{notify('Click the game to restore mouse control');}}
$('play').onclick=async()=>{if(!started||ended){reset();started=true;}running=true;$('overlay').style.display='none';document.body.classList.remove('menu');await captureMouse();};$('pause').onclick=pause;
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===canvas){$('resume-control').hidden=true;return;}if(running&&!touch&&!window.Duel?.lobby&&!document.body.classList.contains('menu')){keysClear();$('resume-control').hidden=false;}});
document.addEventListener('keydown',e=>{if(e.target.matches?.('input,select,textarea'))return;if(e.code==='Tab'&&running&&matchPhase==='playing'&&!cinematicLock){e.preventDefault();if(!e.repeat)inventoryMenu.toggle();return;}if(e.code==='Escape'&&inventoryMenu.isOpen){e.preventDefault();inventoryMenu.close();return;}if(inventoryMenu.isOpen)return;if(['Space','ControlLeft','ControlRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys[e.code]=true;if(e.code==='Escape'){pause();return;}if(!running||cinematicLock||matchPhase!=='playing')return;if(!e.repeat&&['ControlLeft','ControlRight','KeyC'].includes(e.code))crouchRevision++;if(!e.repeat&&['ShiftLeft','ShiftRight'].includes(e.code))slideRevision++;if(/^Digit[0-9]$/.test(e.code)&&e.code!=='Digit6')select(+e.code.slice(-1));if(e.code==='KeyZ')select(6);if(e.code==='KeyV')select(10);if(e.code==='KeyR'&&!e.repeat)reload();if(e.code==='KeyQ'&&!e.repeat)select(isWeaponSlot(slot)?lastBuildSlot:(loadout.findIndex(w=>w?.id===lastWeaponItem)+1||lastWeaponSlot));if(e.code==='KeyG'&&!e.repeat)buildRotation+=Math.PI/2;if(e.code==='KeyB'&&!e.repeat)selectedMaterial=selectedMaterial==='wood'?'stone':'wood';});document.addEventListener('keyup',e=>keys[e.code]=false);window.addEventListener('blur',()=>{keysClear();if(inventoryMenu.isOpen)inventoryMenu.close();});
let dragging=false,px=0,py=0;const touch=matchMedia('(pointer:coarse)').matches;if(touch)document.body.classList.add('touch');
function primaryDown(e){if(inventoryMenu.isOpen||!running||cinematicLock||touch||e.target.closest?.('button,input,select,textarea,#lobby,#chatbox,#deployment-ui'))return;if(e.button===0&&matchPhase==='playing'){firing=true;shoot(true);}if(e.button===2&&matchPhase==='playing'&&!isBuildSlot(slot)&&!reloading)aim=true;dragging=true;px=e.clientX;py=e.clientY;e.preventDefault();}
document.addEventListener('mousedown',primaryDown);canvas.addEventListener('pointerdown',e=>{if(!running||!touch)return;dragging=true;px=e.clientX;py=e.clientY;});window.addEventListener('mouseup',()=>{firing=false;aim=false;dragging=false;});window.addEventListener('pointerup',()=>{firing=false;aim=false;dragging=false;});window.addEventListener('pointercancel',()=>{firing=false;aim=false;dragging=false;});

window.addEventListener('pointermove',e=>{if(inventoryMenu.isOpen||!running||cinematicLock)return;const dx=document.pointerLockElement===canvas?e.movementX:e.clientX-px,dy=document.pointerLockElement===canvas?e.movementY:e.clientY-py,sensitivity=mouseSensitivity*((adsBlend>.55&&weaponForSlot(slot,loadout).scope)?scopeSensitivity:1);mouseSwayX=clamp(mouseSwayX+dx,-18,18);mouseSwayY=clamp(mouseSwayY+dy,-14,14);if(document.pointerLockElement===canvas){yaw-=dx*.0025*sensitivity;pitch=clamp(pitch-dy*.002*sensitivity,-.8,.55);}else if(dragging){yaw-=dx*.006*sensitivity;pitch=clamp(pitch-dy*.004*sensitivity,-.8,.55);px=e.clientX;py=e.clientY;}});canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('wheel',e=>{if(inventoryMenu.isOpen||!running||matchPhase!=='playing'||cinematicLock)return;e.preventDefault();const slots=[0,1,2,3,4,5].filter(n=>!isWeaponSlot(n)||inventoryWeapon(loadout,n)),index=slots.indexOf(slot),next=(index+(e.deltaY>0?1:-1)+slots.length)%slots.length;select(slots[next]);},{passive:false});
function updateSettingsUI(){$('graphics-quality').value=graphicsSelection;$('mouse-sensitivity').value=String(mouseSensitivity);$('scope-sensitivity').value=String(scopeSensitivity);$('mouse-sensitivity-value').textContent=mouseSensitivity.toFixed(2)+'×';$('scope-sensitivity-value').textContent=scopeSensitivity.toFixed(2)+'×';}
updateSettingsUI();$('game-settings-toggle').onclick=()=>{$('game-settings').hidden=false;};$('game-settings-close').onclick=()=>{$('game-settings').hidden=true;};$('resume-control').onclick=captureMouse;
$('graphics-quality').onchange=e=>{graphicsSelection=e.target.value;writeSetting('sunny.graphicsQuality',graphicsSelection);if(graphicsSelection==='auto')autoQuality=createAutoQuality(autoQuality.level);currentQuality=qualityPreset(graphicsSelection,autoQuality);document.body.dataset.quality=graphicsSelection==='auto'?autoQuality.level:graphicsSelection;};
$('mouse-sensitivity').oninput=e=>{mouseSensitivity=clampSetting(e.target.value,.5,2,1);writeSetting('sunny.mouseSensitivity',mouseSensitivity);updateSettingsUI();};$('scope-sensitivity').oninput=e=>{scopeSensitivity=clampSetting(e.target.value,.35,1.25,.7);writeSetting('sunny.scopeSensitivity',scopeSensitivity);updateSettingsUI();};
document.querySelectorAll('[data-slot]').forEach(e=>e.onclick=()=>{if(running&&matchPhase==='playing'&&!cinematicLock)select(+e.dataset.slot);});document.querySelectorAll('[data-key]').forEach(e=>{e.onpointerdown=ev=>{ev.preventDefault();e.setPointerCapture(ev.pointerId);keys[e.dataset.key]=true;};e.onpointerup=e.onpointercancel=()=>keys[e.dataset.key]=false;});$('touchjump').onpointerdown=()=>keys.Space=true;$('touchjump').onpointerup=$('touchjump').onpointercancel=()=>keys.Space=false;$('touchfire').onpointerdown=e=>{try{e.target.setPointerCapture(e.pointerId);}catch{}if(matchPhase==='playing'&&!cinematicLock){firing=true;shoot(true);}};$('touchfire').onpointerup=$('touchfire').onpointercancel=()=>firing=false;
function update(){/* Match snapshots own movement, combat and interactions. */}
function structure(s,ghost=false){
 const material=s.material||selectedMaterial,enough=(player.materials?.[selectedMaterial]||0)>=10,valid=canBuild(s)&&enough,visual=buildVisuals.get(s.id),presentation=buildPresentation(visual?time-visual.born:1,s.hp??MATERIALS[material].hp,MATERIALS[material].hp),base=color(MATERIALS[material].color.slice(1)),outline=color(valid?'7fefff':'ff817c'),col=ghost?outline:base.map((v,i)=>mix(v*(1-presentation.damage*.27),[.72,.92,1][i],Math.max(presentation.reveal*.38,visual?clamp(1-(time-visual.hit)/.16,0,1)*.3:0))),origin=[s.x,s.type===2?gridBaseY(s):s.y,s.z],angle=s.angle||0,point=p=>transform([p[0],p[1]*(ghost?1:presentation.scale),p[2]],origin,angle),part=(p,d,c)=>box(point(p),[d[0],d[1]*(ghost?1:presentation.scale),d[2]],c,angle);
 if(s.type===2){
  if(!ghost)part([0,1.8,0],[5,3.6,.22],col);
  for(const y of [0,3.6])beam(point([-2.5,y,.14]),point([2.5,y,.14]),ghost?.028:.055,ghost?outline:C.cream);
  for(const x of [-2.5,2.5])beam(point([x,0,.14]),point([x,3.6,.14]),ghost?.028:.045,ghost?outline:C.trunk);
  if(ghost){for(let y=.6;y<3.6;y+=.6)beam(point([-2.5,y,0]),point([2.5,y,0]),.009,outline);for(let x=-1.5;x<2;x++)beam(point([x,0,0]),point([x,3.6,0]),.009,outline);}
  else if(material==='stone'){for(let row=0;row<6;row++){part([0,row*.6,.13],[5,.018,.015],C.metal);for(let x=-2;x<2.5;x++)part([x+(row%2)*.5,row*.6+.3,.13],[.018,.6,.015],C.metal);}}
  else{for(let x=-2.25;x<2.5;x+=.5)part([x,1.8,.14],[.035,3.6,.025],C.trunk);for(const side of [-1,1])beam(point([-2.35,.2,side*.14]),point([2.35,3.4,side*.14]),.06,base.map(v=>v*.8));}
  if(!ghost&&presentation.damage>.2){const crack=color('3f4a49');beam(point([-.7,2.8,.145]),point([.15,1.95,.145]),.023,crack);beam(point([.15,1.95,.145]),point([-.15,1.2,.145]),.023,crack);if(presentation.damage>.55)beam(point([.15,1.95,.145]),point([1.25,1.45,.145]),.026,crack);}
 }else{
  if(!ghost)quad(point([-2.5,0,2.5]),point([-2.5,3.6,-2.5]),point([2.5,3.6,-2.5]),point([2.5,0,2.5]),col);
  for(let i=0;i<=10;i++){const z=2.5-i*.5,y=i*.36;beam(point([-2.5,y+.018,z]),point([2.5,y+.018,z]),ghost?.012:.025,ghost?outline:material==='stone'?C.cream:C.trunk);}
  for(const x of [-2.5,2.5])beam(point([x,0,2.5]),point([x,3.6,-2.5]),ghost?.028:.07,ghost?outline:col);
 }
 if(ghost){$('buildhelp').textContent=`${selectedMaterial.toUpperCase()} · ${s.type===2?'WALL':'RAMP'} · 10  |  B MATERIAL · G ROTATE · ${valid?'CLICK BUILD':enough?'BLOCKED':'HARVEST MATERIAL'}`;$('buildhelp').style.color=valid?'#b4f6ff':'#ffafa0';}
}

const ctx=$('map').getContext('2d');function minimap(){
 const scale=.275,to=x=>90+x*scale;ctx.fillStyle='#286e91';ctx.fillRect(0,0,180,180);
 ctx.fillStyle='#78ad56';ctx.beginPath();ctx.arc(90,90,84,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e2ce98';ctx.lineWidth=3;ctx.stroke();
 // Five highways radiate from Suncrest toward the named landing regions.
 ctx.strokeStyle='#bec1ae';ctx.lineWidth=3.2;ctx.beginPath();for(const [a,b] of [[[-42,4],[-180,69]],[[45,6],[161,71]],[[28,-37],[113,-165]],[[-21,-39],[-80,-156]],[[7,45],[8,178]]]){ctx.moveTo(to(a[0]),to(a[1]));ctx.lineTo(to(b[0]),to(b[1]));}ctx.stroke();
 ctx.fillStyle='#ded19f';for(const b of buildings)ctx.fillRect(to(b.x-b.w/2),to(b.z-b.d/2),Math.max(1,b.w*scale),Math.max(1,b.d*scale));
 ctx.fillStyle='#315f39';for(const t of trees){ctx.beginPath();ctx.arc(to(t.x),to(t.z),.65,0,7);ctx.fill();}
 ctx.font='700 5.5px Arial';ctx.textAlign='center';ctx.fillStyle='#f8f4df';ctx.shadowColor='#17343c';ctx.shadowBlur=2;for(const p of pois)ctx.fillText(p.name,to(p.x),to(p.z)-4);ctx.shadowBlur=0;
 if(storm<ISLAND_SIZE){ctx.fillStyle='#8b4dbb45';ctx.beginPath();ctx.rect(0,0,180,180);ctx.arc(90,90,storm*scale,0,Math.PI*2,true);ctx.fill('evenodd');ctx.strokeStyle='#e7cbff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(90,90,storm*scale,0,Math.PI*2);ctx.stroke();}
 const px=clamp(to(player.p[0]),5,175),pz=clamp(to(player.p[2]),5,175);ctx.save();ctx.translate(px,pz);ctx.rotate(-yaw);ctx.fillStyle='white';ctx.shadowColor='#183941';ctx.shadowBlur=4;ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,5);ctx.lineTo(0,3);ctx.lineTo(-4,5);ctx.closePath();ctx.fill();ctx.restore();
 const nearest=pois.reduce((best,p)=>Math.hypot(player.p[0]-p.x,player.p[2]-p.z)<best.d?{p,d:Math.hypot(player.p[0]-p.x,player.p[2]-p.z)}:best,{p:pois[0],d:Infinity});$('mapbox').querySelector('b').textContent=player.air==='ship'?'STAGING SHIP':player.air==='pod'?'DEPLOYMENT POD':nearest.d<55?nearest.p.name:'WILDLANDS';
}
function drawFirstPersonWeapon(profile,state,parts,armsOnly=false){
 const root=state.position,rotation=state.rotation,scale=profile.presentation.scale,point=v=>transform(v.map(n=>n*scale),root,rotation[1],rotation[0]+parts.rootTilt),drawBox=(v,s,c,rx=0)=>box(point(v),s,c,rotation[1],rotation[0]+parts.rootTilt+rx),drawOval=(v,r,c,n,q)=>ellipsoid(point(v),r,c,n,q),drawTube=(a,b,r,c,n)=>tube(point(a),point(b),r,c,n);
 if(!armsOnly){drawWeaponLayout(profile,parts,scale,drawBox,drawOval,drawTube,1);
  if(flash>0){const z=profile.id==='sniper'?-1.71:profile.id==='shotgun'?-1.45:profile.id==='smg'?-0.97:-1.36,muzzle=point([0,.035,z]);ellipsoid(muzzle,[.13,.12,.18],color('fff1ad'),18,11);for(let i=0;i<7;i++){const angle=i/7*Math.PI*2;beam(muzzle,add(muzzle,[Math.cos(angle)*.15,Math.sin(angle)*.15,-.25]),.022,C.gold);}}
 }

}
function drawFirstPersonBlueprint(state){
 const root=state.position,rotation=state.rotation,point=v=>transform(v,root,rotation[1],rotation[0]),blue=color('5be1f2'),deep=color('176a8b');
 box(point([0,0,-.25]),[.72,.48,.035],deep,rotation[1],rotation[0]);
 for(const x of[-.3,0,.3])beam(point([x,-.2,-.29]),point([x,.2,-.29]),.012,blue);
 for(const y of[-.2,0,.2])beam(point([-.3,y,-.29]),point([.3,y,-.29]),.012,blue);
 tube(point([.32,-.14,.02]),point([.16,-.03,-.32]),.025,C.metal,10);
}
function drawFirstPersonViewModel(profile,useAsset=false){if(isBuildSlot(slot))drawFirstPersonBlueprint(viewModelState);else if(isWeaponSlot(slot)&&inventoryWeapon(loadout,slot)&&!useAsset)drawFirstPersonWeapon(profile,viewModelState,weaponPartState);}
function syncProjectileVisuals(projectiles=[]){const visible=new Set(),stamp=performance.now();for(const projectile of projectiles.slice(0,32)){if(!projectile?.id||!Array.isArray(projectile.position)||!Array.isArray(projectile.velocity))continue;visible.add(projectile.id);let visual=projectileVisuals.get(projectile.id);if(!visual){visual={p:projectile.position.slice(0,3),target:projectile.position.slice(0,3),velocity:projectile.velocity.slice(0,3),stamp};projectileVisuals.set(projectile.id,visual);}else{for(let axis=0;axis<3;axis++){visual.target[axis]=projectile.position[axis];visual.velocity[axis]=projectile.velocity[axis];}visual.stamp=stamp;}}for(const id of projectileVisuals.keys())if(!visible.has(id))projectileVisuals.delete(id);}
let last=performance.now(),mapTimer=0,deploymentCameraRound=-1;function frame(now){sendInventoryOperation();requestAnimationFrame(frame);const frameMs=Math.min(100,Math.max(1,now-last)),dt=Math.min(frameMs/1000,.035);last=now;if(running&&graphicsSelection==='auto'&&!window.Duel?.lobby){const before=autoQuality.level;sampleAutoQuality(autoQuality,frameMs,now);if(before!==autoQuality.level){currentQuality=qualityPreset('auto',autoQuality);notify(`Graphics adjusted to ${autoQuality.level}`);}}time+=dt;window.Duel?.render(dt);const sequenceStages=['both_ready','pod_sealing','launching','transition','landed','pod_opening','exiting','saluting'],audibleMusicTime=deploymentAudio.time(audio,deploymentSnapshot?.sequenceId),finishingAudio=matchPhase==='playing'&&deploymentClock.sequenceId===deploymentSnapshot?.sequenceId&&audibleMusicTime!==null&&audibleMusicTime<DEPLOYMENT_MUSIC_END,sequenceActive=!window.Duel?.lobby&&((matchPhase==='deployment'&&sequenceStages.includes(deploymentSnapshot?.stage||''))||finishingAudio);deploymentClock=stepDeploymentClock(deploymentClock,{sequenceId:deploymentSnapshot?.sequenceId||'',serverElapsed:deploymentSnapshot?.elapsed||0,active:sequenceActive},dt);if(sequenceActive){deploymentAudio.load(audio);const musicClock=deploymentAudio.update(audio,deploymentSnapshot.sequenceId,deploymentClock.elapsed-DEPLOYMENT_TIMELINE.readyBeat-MUSIC_START);if(musicClock!==null)deploymentClock.elapsed=musicClock+MUSIC_START+DEPLOYMENT_TIMELINE.readyBeat;const sequenceElapsed=Math.max(0,deploymentClock.elapsed-DEPLOYMENT_TIMELINE.readyBeat),stage=deploymentClock.elapsed<DEPLOYMENT_TIMELINE.readyBeat?'both_ready':deploymentStageAt(sequenceElapsed);deploymentData={...deploymentSnapshot,elapsed:deploymentClock.elapsed,sequenceElapsed,stage,stageElapsed:deploymentClock.elapsed};
 if(player.destination&&sequenceElapsed>=DEPLOYMENT_TIMELINE.sealSeconds+DEPLOYMENT_TIMELINE.launchSeconds&&sequenceElapsed<DEPLOYMENT_TIMELINE.sealSeconds+DEPLOYMENT_TIMELINE.launchSeconds+1.3&&impactSequence!==deploymentSnapshot.sequenceId){
  impactSequence=deploymentSnapshot.sequenceId;spawnPodLandingBurst(player.destination);
 }
 const lockedStates=['entering_pod','pod_ready','both_ready','pod_sealing','launching','transition','landed','pod_opening','exiting','saluting'];cinematicLock=lockedStates.includes(player.deploymentState)||lockedStates.includes(stage);}else{deploymentData=deploymentSnapshot;deploymentAudio.stop(audio);}
 // The host broadcasts snapshots at a lower rate than the rendered music
 // timeline. Sample the shared pose on each frame to eliminate stuttering
 // during the opening hatch, walk-out and native two-finger salute. Match
 // remains authoritative for every combat/gameplay position afterwards.
 if(sequenceActive&&['pod_opening','exiting','saluting'].includes(deploymentData?.stage)){
  const sequenceElapsed=deploymentData.sequenceElapsed;
  const poseActor=actor=>{
   if(!actor?.destination||actor.hp<=0)return;
   const yaw=Number.isFinite(actor.podYaw)?actor.podYaw:actor.yaw;
   const side=SHIP_PODS.find(pod=>pod.id===actor.pod)?.side||Math.sign((actor.p[0]-actor.destination.x)*Math.cos(yaw)-(actor.p[2]-actor.destination.z)*Math.sin(yaw))||1;
   const pose=deploymentActorPose(actor.destination,yaw,side,sequenceElapsed,height);
   if(!pose)return;
   actor.p=pose.position;actor.yaw=pose.yaw;
   actor.animationState=actor.locomotionState=pose.animationState;actor.moveSpeed=pose.moveSpeed;actor.grounded=true;actor.vy=0;
   actor.saluteProgress=pose.saluteProgress;actor.air='pod';actor.deploymentState=deploymentData.stage;
  };
  poseActor(player);for(const actor of bots)poseActor(actor);
 }
 if(running)update(dt);stepMotionPresentation(motionFeel,player,dt);const deploymentFade=deploymentPresentation(deploymentData?.stage||'',deploymentData?.sequenceElapsed||0);const cinematicFrame=deploymentCinematic(deploymentData?.sequenceElapsed||0),cinematicActive=sequenceActive&&deploymentData?.stage!=='both_ready';document.body.classList.toggle('deployment-cinematic',cinematicActive);$('deployment-cinematic').style.opacity=String(cinematicActive?cinematicFrame.logo:0);$('deployment-cinematic').style.setProperty('--logo-scale',String(cinematicFrame.logoScale));$('deployment-fade').style.opacity=String(deploymentFade.fade);const portrait=cinematicActive&&cinematicFrame.portrait;cinematicPodAnchor=portrait&&player.destination?cinematicPodPosition(player.destination,deploymentData.sequenceElapsed):null;if(cinematicPodAnchor&&!['exiting','saluting','match_active'].includes(deploymentData?.stage))player.p=cinematicPodAnchor.slice();if(portrait&&cinematicFrame.returnProgress>.98){yaw=player.yaw;pitch=-.04;}noticeTime=Math.max(0,noticeTime-dt);hitTime=Math.max(0,hitTime-dt);hurt=Math.max(0,hurt-dt);flash=Math.max(0,flash-dt);recoil=Math.max(0,recoil-dt*1.55);sustained=Math.max(0,sustained-dt*3.4);recoilPitch=mix(recoilPitch,0,1-Math.exp(-dt*13));recoilYaw=mix(recoilYaw,0,1-Math.exp(-dt*16));mouseSwayX=mix(mouseSwayX,0,1-Math.exp(-dt*8));mouseSwayY=mix(mouseSwayY,0,1-Math.exp(-dt*8));cameraCrouch=mix(cameraCrouch,player.crouching ? .62 : 0,1-Math.exp(-dt*11));damageNumber=Math.max(0,damageNumber-dt);const moving=running&&Boolean(keys.KeyW||keys.KeyS||keys.KeyA||keys.KeyD),profile=weaponForSlot(slot,loadout),canAim=isWeaponSlot(slot)&&Boolean(inventoryWeapon(loadout,slot))&&!reloading&&player.air==='landed'&&matchPhase==='playing',adsTarget=aim&&canAim?1:0;adsBlend=mix(adsBlend,adsTarget,1-Math.exp(-dt*12));const accuracy=shotSpread(profile,{aim:adsBlend>.45,moving:moving?1:0,sustained}),spreadPixels=3+accuracy*105+(moving?3:0)+recoil*54;$('crosshair').style.setProperty('--gap',spreadPixels.toFixed(1)+'px');$('crosshair').classList.toggle('ads',adsBlend>.45);$('crosshair').classList.toggle('shotgun',profile.id==='shotgun');$('damagevalue').style.opacity=damageNumber>0?1:0;$('damagevalue').style.marginTop=(-45-(.6-damageNumber)*35)+'px';$('notice').style.opacity=noticeTime>0?1:0;$('hitmarker').style.display=hitTime>0?'block':'none';$('damage').style.opacity=hurt;$('reload-progress').style.setProperty('--reload',reloading?reloadProgress(reloading,profile.slot):0);const spectator=Boolean(window.Duel?.spectating),scoped=profile.scope&&adsBlend>.82&&!spectator;cameraPresentation=stepCameraPresentation(cameraPresentation,{lobby:Boolean(window.Duel?.lobby),air:player.air||'landed',alive:player.hp>0,spectating:spectator,roundToken:matchRound},dt);const firstPersonVisible=player.air==='landed'&&shouldShowViewModel(cameraPresentation,player.hp>0,spectator,scoped),useFirstPersonGLB=firstPersonVisible&&isWeaponSlot(slot)&&Boolean(inventoryWeapon(loadout,slot))&&Boolean(matchCharacterRenderer?.hasFirstPersonWeapon(profile.id));stepViewModel(viewModelState,{weapon:profile,moving:clamp(motionFeel.speed/6.8,0,1),sprinting:player.sprinting,grounded:player.grounded,verticalVelocity:player.vy,landing:motionFeel.landing,aiming:adsBlend>.45,ads:adsBlend,strafe:(keys.KeyD?1:0)-(keys.KeyA?1:0),reloading,equipRemaining:equipTime,mouseX:mouseSwayX,mouseY:mouseSwayY,shotImpulse:viewShotImpulse,time},dt);stepWeaponParts(weaponPartState,profile,reloading);$('reload-stage').textContent=reloading?reloadStage(profile,reloading).toUpperCase():'READY';viewShotImpulse=0;document.body.dataset.camera=cameraPresentation.mode;document.body.dataset.quality=graphicsSelection==='auto'?autoQuality.level:graphicsSelection;document.body.classList.toggle('scoped',scoped);
if(window.Duel?.lobby){drawLobby();return;}if(cinematicActive&&cinematicFrame.black>=.999)return;const dimensions=renderDimensions(innerWidth,innerHeight,devicePixelRatio,currentQuality),width=dimensions.width,h=dimensions.height;if(canvas.width!==width||canvas.height!==h){canvas.width=width;canvas.height=h;gl.viewport(0,0,width,h);}
const sequenceElapsed=deploymentData?.sequenceElapsed||0;
 let a=yaw,cameraTarget,shipLookYaw=yaw;
if(!started)a=Math.sin(time*.09)*.1;
const boardingPod=player.air==='ship'&&player.pod&&SHIP_PODS.find(pod=>pod.id===player.pod);
 const boardingView=boardingPod?shipBoardingCamera(boardingPod,shipData.origin||DEPLOYMENT_SHIP.origin,sequenceActive?sequenceElapsed:null):null;
 document.body.classList.toggle('pod-exterior',Boolean(boardingView&&!portrait));
 if(boardingView&&!portrait){
  eye=boardingView.eye;cameraTarget=boardingView.target;forward=norm(sub(cameraTarget,eye));
  const launch=sequenceActive?shipLaunchAt(sequenceElapsed):null;
  if(launch?.exhaust&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
   eye[0]+=Math.sin(time*61)*launch.exhaust*.028;eye[1]+=Math.sin(time*75)*launch.exhaust*.042;
  }
 }else if(portrait){
 const exterior=['exiting','saluting'].includes(deploymentData?.stage);
 const podCenter=exterior&&cinematicPodAnchor?cinematicPodAnchor:player.p;
 const podHeading=Number.isFinite(player.podYaw)?player.podYaw:player.yaw;
 const view=cinematicCamera(podCenter,podHeading,cinematicFrame,{groundHeight:height,wallDistance,
  subjectPosition:player.p,returnYaw:player.yaw,
  reducedMotion:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches});
 eye=view.eye;cameraTarget=view.target;forward=norm(sub(cameraTarget,eye));
}
else if(player.air==='ship'||player.air==='pod'){
 const viewYaw=(cinematicLock?player.yaw: a)+recoilYaw,viewPitch=cinematicLock?-.04:clamp(pitch+recoilPitch,-.72,.58);forward=[-Math.sin(viewYaw)*Math.cos(viewPitch),Math.sin(viewPitch),-Math.cos(viewYaw)*Math.cos(viewPitch)];const sequence=deploymentData?.stage||'',launching=cinematicLock&&['pod_sealing','launching','transition'].includes(sequence),progress=deploymentPresentation(sequence,deploymentData?.sequenceElapsed||0).launchProgress,shake=launching?.012+progress*.055:0;eye=[player.p[0]+Math.sin(time*31)*shake,player.p[1]+1.72-cameraCrouch+Math.sin(time*43)*shake*.58,player.p[2]+Math.cos(time*35)*shake];cameraTarget=add(eye,forward);shipLookYaw=viewYaw;
}else{
 const viewYaw=a+recoilYaw,viewPitch=clamp(pitch+recoilPitch,-.8,.62);
 forward=[-Math.sin(viewYaw)*Math.cos(viewPitch),Math.sin(viewPitch),-Math.cos(viewYaw)*Math.cos(viewPitch)];
 const anchor=add(player.p,[0,2.15,0]),right=[Math.cos(viewYaw),0,-Math.sin(viewYaw)],airDistance=6.8,adsDistance=profile.scope?.16:3.15,distance=mix(airDistance,adsDistance,adsBlend),shoulder=mix(1.05,profile.scope?0:.56,adsBlend),desired=add(add(anchor,mul(forward,-distance)),mul(right,shoulder));
 const delta=sub(desired,anchor),len=length(delta),collision=wallDistance(anchor,norm(delta));
 let thirdEye=collision<len?add(anchor,mul(norm(delta),Math.max(.16,collision-.3))):desired;
 thirdEye[1]=Math.max(thirdEye[1],height(thirdEye[0],thirdEye[2])+.55);
 const thirdTarget=add(thirdEye,forward),firstEye=[player.p[0],player.p[1]+1.72-cameraCrouch+motionFeel.cameraY*(1-adsBlend*.9),player.p[2]],firstTarget=add(firstEye,forward),view=blendCameraViews(thirdEye,thirdTarget,firstEye,firstTarget,cameraPresentation,cameraBlendOutput);
 eye=view.eye;cameraTarget=view.target;
}
const sequence=deploymentData?.stage||'',launchFov=cinematicLock&&['pod_sealing','launching','transition'].includes(sequence)?deploymentPresentation(sequence,sequenceElapsed).launchProgress*10:0,baseFov=portrait?mix(cinematicFov(width/h),75*Math.PI/180,cinematicFrame.returnProgress)+(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:cinematicFrame.impact*4*Math.PI/180):player.air==='ship'?(73+launchFov+Math.sin(time*2)*.35)*Math.PI/180:player.air==='pod'&&['pod_sealing','launching','transition'].includes(sequence)?(71+Math.sin(sequenceElapsed*5)*1.2)*Math.PI/180:(75+(player.sprinting?clamp(motionFeel.speed/10,0,1)*2.5:0))*Math.PI/180,targetFov=adsTarget&&player.air==='landed'?profile.adsFov*Math.PI/180:baseFov;cameraFov=mix(cameraFov,targetFov,1-Math.exp(-dt*(adsTarget?13:7.5)));gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);drawSky(eye,cameraTarget,width/h,cameraFov);gl.uniformMatrix4fv(um,false,matrix(eye,cameraTarget,width/h,cameraFov));gl.uniform3fv(ue,eye);updateFrustum(worldFrustum,matrix(eye,cameraTarget,width/h,cameraFov));gl.bindBuffer(gl.ARRAY_BUFFER,staticBuffer);gl.vertexAttribPointer(ap,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(ac,3,gl.FLOAT,false,24,12);for(const chunk of worldChunks)if(chunkVisible(chunk,worldFrustum))gl.drawArrays(gl.TRIANGLES,chunk.start,chunk.count);gl.bindBuffer(gl.ARRAY_BUFFER,resourceBuffer);gl.vertexAttribPointer(ap,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(ac,3,gl.FLOAT,false,24,12);for(const range of resourceRanges)if((resourceHP.get(range.id)??100)>0&&Math.hypot(range.x-eye[0],range.z-eye[2])<(currentQuality.remoteDetail>.7?190:135))gl.drawArrays(gl.TRIANGLES,range.start,range.count);geo.length=0;
const avatarYaw=Number.isFinite(player.yaw)?player.yaw:a,showLocalAvatar=(Boolean(boardingView)&&player.deploymentState==='entering_pod'&&player.podProgress<.98)||(portrait&&cinematicFrame.operatorOpacity>.001&&cinematicFrame.returnProgress<.88)||(!boardingView&&!portrait&&shouldShowLocalAvatar(cameraPresentation,player.air,player.hp>0)),cinematic=['pod_sealing','launching','transition','landed','pod_opening','exiting','saluting'].includes(sequence);if(player.air==='ship'&&!portrait){deploymentShipInterior(shipData,[player,...bots],sequenceActive?sequenceElapsed:null);if(!boardingView&&(cinematic||['entering_pod','pod_ready','both_ready'].includes(player.deploymentState)))deploymentPodInterior(player.p,player.yaw,sequence==='pod_opening'?1-deploymentFade.fade:['exiting','saluting'].includes(sequence)?1:0,cinematic?1:0);}if(player.air==='pod'||portrait)deploymentPodInterior(portrait&&cinematicPodAnchor?add(cinematicPodAnchor,[0,window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:podImpactOffset(cinematicFrame.musicTime-DEPLOYMENT_CUES.impact),0]):cinematicPodAnchor||player.p,Number.isFinite(player.podYaw)?player.podYaw:player.yaw,sequence==='pod_opening'?clamp((sequenceElapsed-DEPLOYMENT_TIMELINE.sealSeconds-DEPLOYMENT_TIMELINE.launchSeconds-DEPLOYMENT_TIMELINE.landedSeconds)/DEPLOYMENT_TIMELINE.openingSeconds,0,1):['exiting','saluting','match_active'].includes(sequence)?1:0,cinematic?1:0,portrait);if(!matchCharacterRenderer?.ready){if(showLocalAvatar&&!scoped){if(player.air==='landed'&&currentQuality.shadows)shadow(player.p[0],player.p[2],.75);character(player.p,avatarYaw,running&&moving?walk:0,color(window.Duel?.myColor||'577363'),false,player.air,0,player.deploymentState==='landing_selection'||player.deploymentState==='pod_available'?'ship':'combat',{weapon:player.weapon||weaponIdForSlot(slot,loadout),reload:player.renderReload??reloading,equip:player.renderEquip??equipTime,aim:player.renderAim??aim,building:isBuildSlot(slot),recoil,local:true});}for(const b of bots)if(b.hp>0){if(b.air==='landed'&&currentQuality.shadows)shadow(b.p[0],b.p[2],.72);character(b.p,b.yaw,b.walk||0,color(b.color||'e37b58'),true,b.air,0,b.air==='ship'?'ship':'combat',{weapon:b.weapon||'ar',reload:b.reload,equip:b.equip,aim:b.aim,building:b.building||isBuildSlot(b.slot),crouch:b.crouching,velocity:b.vy});}}for(const s of structures)structure(s);if(isBuildSlot(slot)&&running&&matchPhase==='playing'){let s=buildSpot();structure({...s,y:s.y??height(s.x,s.z),type:BUILD_SLOTS[slot]},true);}
for(const chest of chestSpawns){if(Math.hypot(chest.x-eye[0],chest.z-eye[2])>95)continue;const open=openedChests.has(chest.id),y=chest.y+.36;box([chest.x,y,chest.z],[1.15,.65,.72],C.wood);for(const dx of [-.4,.4])box([chest.x+dx,y,chest.z],[.09,.69,.76],C.gold);box([chest.x,y+.39,chest.z-(open?.28:0)],[1.18,.18,.76],open?C.trunk:C.gold,0,open?-1.1:0);if(!open){box([chest.x,y,chest.z+.39],[.18,.22,.035],C.blue);gem([chest.x,y+1.05,chest.z],[.08,.16,.08],C.gold,4);}}
for(const p of pickups){if(Math.hypot(p.x-eye[0],p.z-eye[2])>90)continue;const y=(p.y??height(p.x,p.z))+.45+Math.sin(time*2+p.x)*.08,c=WEAPON_PROFILES[p.type]?color(WEAPON_PROFILES[p.type].color.slice(1)):p.type==='shield'?C.blue:p.type==='shockwave'?color('b18dff'):C.cream;if(WEAPON_PROFILES[p.type]){/* Real GLB pickups render in the shared Three scene. */}else if(p.type==='shockwave')gem([p.x,y,p.z],[.18,.18,.18],c,8);else box([p.x,y,p.z],[.28,.4,.28],c,time*.25);beam([p.x,p.y+.08,p.z],[p.x,p.y+.17,p.z],.2,c);}
for(const g of grenades)gem(g.position,[.16,.16,.16],color('b49bff'),8);
 if(cinematicActive&&player.destination){
  const touchdown=DEPLOYMENT_TIMELINE.sealSeconds+DEPLOYMENT_TIMELINE.launchSeconds;
  const shockAge=sequenceElapsed-touchdown;
  if(shockAge>=0&&shockAge<1.45)drawLandingShockwave(player.destination,shockAge);
 }
if(flash>0&&!scoped&&!useFirstPersonGLB){const muzzleZ=profile.id==='sniper'?-1.95:profile.id==='shotgun'?-1.72:-1.48,m=transform([.24,1.59,muzzleZ],player.p,yaw);ellipsoid(m,[.11,.11,.11],color('fff7d5'),12,7);for(let i=0;i<7;i++){let t=i/7*6.283+time*20;beam(m,add(m,[Math.cos(t)*.28,Math.sin(t)*.28,-.2]),.022,color('ffcb67'));}}
for(const projectile of projectileVisuals.values()){const age=Math.min(.14,Math.max(0,(now-projectile.stamp)/1000)),blend=1-Math.exp(-dt*22);for(let axis=0;axis<3;axis++)projectile.p[axis]=mix(projectile.p[axis],projectile.target[axis]+projectile.velocity[axis]*age,blend);const direction=norm(projectile.velocity),tail=sub(projectile.p,mul(direction,.8)),head=add(projectile.p,mul(direction,.12));beam(tail,head,.014,color('ffd690'));beam(tail,head,.005,color('ffffff'));}
effectPool.update(dt);effectPool.forEachActive(e=>{if(e.tracer){const {head,tail}=bulletTracerSegment(e);beam(tail,head,.012,e.col);beam(tail,head,.004,color('fffbe4'));}else if(e.kind==='pod-debris'||e.kind==='pod-dust'){stepPodLandingParticle(e,dt,height);const r=podLandingParticleSize(e);if(e.kind==='pod-debris')box(e.p,[r*1.7,r,r*1.3],e.col,time*2.7+e.v[0]*.15,time*3.2);else gem(e.p,[r,r*.55,r],e.col,6);}else{e.v[1]-=dt*e.gravity;e.p[0]+=e.v[0]*dt;e.p[1]+=e.v[1]*dt;e.p[2]+=e.v[2]*dt;if(e.shell)box(e.p,[.04,.04,.1],e.col,time*8);else{const fade=clamp(e.life/e.maxLife,0,1),r=e.radius*fade;if(e.kind==='spark')beam(e.p,sub(e.p,mul(e.v,.025)),Math.max(.002,r),e.col);else gem(e.p,[r,r,r],e.col,5);}}});

// A bright segmented storm perimeter; the minimap shows the exact safe zone.
if(matchPhase==='playing'){const stormSegments=currentQuality.stormSegments;for(let i=0;i<stormSegments;i++){let t=i/stormSegments*6.283,x=Math.sin(t)*storm,z=Math.cos(t)*storm,y=height(x,z);box([x,y+6,z],[.12,12,.12],color('b5a5ed'));if(i%3===0)gem([x,y+12,z],[.2,.5,.2],color('ded4fa'),4);}}
const data=dynamicData.copy(geo);gl.bindBuffer(gl.ARRAY_BUFFER,dynamicBuffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);draw(dynamicBuffer,dynamicData.length/6);
if(matchCharacterRenderer?.ready){
 matchCharacterRenderer.updateGroundWeapons(pickups,time,eye);
 const saluteElapsed=sequenceElapsed-DEPLOYMENT_TIMELINE.sealSeconds-DEPLOYMENT_TIMELINE.launchSeconds-DEPLOYMENT_TIMELINE.landedSeconds-DEPLOYMENT_TIMELINE.openingSeconds-DEPLOYMENT_TIMELINE.exitSeconds;
 const saluteRatio=clamp(saluteElapsed/DEPLOYMENT_TIMELINE.saluteSeconds,0,1),saluteUp=clamp(saluteRatio/.23,0,1),saluteDown=clamp((1-saluteRatio)/.23,0,1);
 const saluteSmooth=v=>v*v*(3-2*v);
 const entities=[{...player,saluteProgress:sequence==='saluting'?Math.min(saluteSmooth(saluteUp),saluteSmooth(saluteDown)):0,color:window.Duel?.myColor||'#64796b',cinematicOpacity:portrait?cinematicFrame.operatorOpacity:player.pod&&player.deploymentState!=='entering_pod'?0:1},...bots.map(p=>({...p,cinematicOpacity:portrait?cinematicFrame.operatorOpacity:p.pod&&p.deploymentState!=='entering_pod'?0:1}))].map(p=>({...p,groundY:p.grounded===false?height(p.p[0],p.p[2]):p.p[1],showShadow:currentQuality.shadows}));
 matchCharacterRenderer.update(entities,{localId:window.Duel?.spectating?null:player.id,hideId:showLocalAvatar?'':player.id,phase:matchPhase,dt});
 matchCharacterRenderer.render({eye,target:cameraTarget,aspect:width/h,fov:cameraFov,dt,width,height:h,cinematic:portrait});
}
if(firstPersonVisible){
 geo.length=0;drawFirstPersonViewModel(profile,useFirstPersonGLB);const viewData=dynamicData.copy(geo);gl.bindBuffer(gl.ARRAY_BUFFER,dynamicBuffer);gl.bufferData(gl.ARRAY_BUFFER,viewData,gl.DYNAMIC_DRAW);gl.clear(gl.DEPTH_BUFFER_BIT);gl.uniformMatrix4fv(um,false,matrix([0,0,0],[0,0,-1],width/h,62*Math.PI/180));gl.uniform3f(ue,0,0,0);draw(dynamicBuffer,dynamicData.length/6);
 if(useFirstPersonGLB)matchCharacterRenderer.renderFirstPersonWeapon(profile.id,profile,viewModelState,weaponPartState,{flash,width,height:h,dt});else if(!isBuildSlot(slot)&&!isWeaponSlot(slot))matchCharacterRenderer?.renderFirstPersonItem(ITEM_SLOTS[slot]||'pickaxe',viewModelState,player,{width,height:h,dt});
}
mapTimer+=dt;if(mapTimer>.1){minimap();mapTimer=0;const angle=(((-yaw*180/Math.PI)%360)+360)%360,dirs=['N','NE','E','SE','S','SW','W','NW'];$('compass').innerHTML=`${dirs[(Math.round(angle/45)+7)%8]} &nbsp; · &nbsp; <strong>${dirs[Math.round(angle/45)%8]}</strong> &nbsp; · &nbsp; ${dirs[(Math.round(angle/45)+1)%8]} <small style="font-size:10px;letter-spacing:1px">${Math.round(angle)}°</small>`;}}
function drawLobby(){
 const w=Math.round(innerWidth*Math.min(devicePixelRatio,1.5)),h=Math.round(innerHeight*Math.min(devicePixelRatio,1.5));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
 if(window.Duel.characterPreview){drawCharacterShowcase(w,h);return;}
 const e=[0,3.45,9.4];gl.clearColor(.025,.075,.16,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniformMatrix4fv(um,false,matrix(e,[0,1.28,.8],w/h,.66));gl.uniform3fv(ue,e);geo.length=0;
 // Original moonlit resort backdrop, kept crisp so the party models remain the visual focus.
 box([0,-.42,.5],[36,.25,27],color('173b55'));box([0,-.25,-7],[34,.06,11],color('20506b'));
 ellipsoid([6.6,7,-14],[1.7,1.7,.42],color('d8f2ec'),40,24);ellipsoid([6.15,7.35,-13.7],[.25,.21,.07],color('a8c9c8'),18,10);ellipsoid([7.05,6.65,-13.7],[.34,.28,.07],color('accdca'),18,10);
 for(const [x,y,z,s,c] of [[-8,2.2,-10,[5,4,2.5],'8f4966'],[-3.5,2.8,-11,[3.5,5.2,2.2],'be5b61'],[1.1,2.1,-11.5,[4.5,3.7,2.5],'3d7590'],[4.7,1.7,-11,[2.4,3,2],'c46a5d']]){box([x,y,z],s,color(c));box([x,y+s[1]/2+.15,z],[s[0]+.3,.3,s[2]+.3],C.cream);for(let q=-s[0]/2+.55;q<s[0]/2;q+=1.1)box([x+q,y,z+s[2]/2+.04],[.55,.7,.06],C.glass);}
 for(const x of[-10.5,10.5]){const z=-7.8;cone([x,-.25,z],.34,.22,4.7,C.trunk,20);for(let k=0;k<9;k++){const a=k/9*6.283,root=[x,4.25,z],tip=[x+Math.cos(a)*2.25,3.6+Math.sin(k)*.18,z+Math.sin(a)*2.25];beam(root,tip,.1,C.leaves);ellipsoid(tip,[.62,.16,.3],C.leaves,18,8);}}
 // Party pads use layered luminous rings instead of card-shaped blocks behind the players.
 // Slot zero is always the local player and is physically closest to the camera. Every invite slot stays behind it.
 const party=window.Duel.party||[],spots=[[0,.1,2.15],[-2.8,.03,.45],[2.8,.03,.45],[-5.05,-.02,-.95],[5.05,-.02,-.95],[-7,-.06,-2.15],[7,-.06,-2.15],[0,-.06,-2.5]];
 for(let i=0;i<8;i++){const q=spots[i],member=party[i],pulse=.03+Math.sin(time*2+i)*.025;cone([q[0],q[1]-.24,q[2]],1.18,1.18,.14,color(member?'198ab2':'173d5c'),56);cone([q[0],q[1]-.1,q[2]],.98,.98,.06,color(member?'74ddf6':'2a5570'),56);if(member){cone([q[0],q[1]-.03,q[2]],.73,.73,.035+pulse,color('b8f5ff'),48);}else{for(let y=.25;y<2.25;y+=.18)box([q[0],q[1]+y,q[2]],[.055,.035,.055],color('4c86a4'));gem([q[0],q[1]+2.48,q[2]],[.11,.23,.11],color('72bad8'),8);}}
 const data=dynamicData.copy(geo);gl.bindBuffer(gl.ARRAY_BUFFER,dynamicBuffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);draw(dynamicBuffer,dynamicData.length/6);gl.clearColor(.48,.77,.88,1);
}
function drawCharacterShowcase(w,h){
 const target=[.62,1.16,0],eye=[.62,2.08,6.25];gl.clearColor(.018,.047,.083,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniformMatrix4fv(um,false,matrix(eye,target,w/h,.54));gl.uniform3fv(ue,eye);geo.length=0;
 box([.6,-.34,-.8],[20,.18,17],color('10283d'));box([.6,3.65,-5.45],[15,8,.3],color('10243a'));
 cone([.78,-.16,0],1.42,1.42,.22,color('16364d'),64);cone([.78,-.025,0],1.28,1.28,.055,color('5bc9dd'),64);cone([.78,.015,0],1.08,1.08,.05,color('20536b'),64);
 // The CHARACTER tab uses the same animated Soldier.glb overlay as the main lobby.
 const data=dynamicData.copy(geo);gl.bindBuffer(gl.ARRAY_BUFFER,dynamicBuffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);draw(dynamicBuffer,dynamicData.length/6);
}
window.Game={world:{height,obstacles,resources,chests:chestSpawns},input:()=>({x:cinematicLock?0:(keys.KeyD?1:0)-(keys.KeyA?1:0),z:cinematicLock?0:(keys.KeyW?1:0)-(keys.KeyS?1:0),yaw,pitch,aimYaw:yaw+recoilYaw,aimPitch:clamp(pitch+recoilPitch,-.8,.62),rotation:buildRotation,inventoryRevision:Math.max(0,inventoryPrediction.revision+inventoryPrediction.pending.length),material:selectedMaterial,drop:!cinematicLock&&!!keys.KeyX,slot:matchPhase==='playing'&&!cinematicLock?slot:0,jump:!cinematicLock&&!!keys.Space,interact:!cinematicLock&&!!keys.KeyE,crouchRevision,slideRevision,crouch:!cinematicLock&&(!!keys.ControlLeft||!!keys.ControlRight||!!keys.KeyC),sprint:!cinematicLock&&(!!keys.ShiftLeft||!!keys.ShiftRight),aim:aim&&matchPhase==='playing'&&!cinematicLock,fire:firing&&matchPhase==='playing'&&!cinematicLock&&player.air==='landed'&&canFireDuringPresentation(cameraPresentation),reload:!!keys.KeyR&&matchPhase==='playing'&&!cinematicLock,landing:landingChoice}),setLanding:(x,z)=>{if(matchPhase!=='deployment'||!Number.isFinite(x)||!Number.isFinite(z))return false;landingChoice={x:clamp(x,-292,292),z:clamp(z,-292,292)};return true;},landingChoice:()=>landingChoice,audioDeploymentElapsed(sequence){const music=deploymentAudio.time(audio,sequence);return music===null?null:music+MUSIC_START+DEPLOYMENT_TIMELINE.readyBeat;},deploymentView:()=>({stage:deploymentData?.stage,sequenceElapsed:deploymentData?.sequenceElapsed,...deploymentCinematic(deploymentData?.sequenceElapsed||0),eye:eye.slice(),podPosition:cinematicPodAnchor?.slice()||null,cameraFov,localVisible:Boolean(matchCharacterRenderer?.instances.get(String(player.id))?.holder.visible)}),moveInventory(from,to){if(matchPhase!=='playing'||player.hp<=0||window.Duel?.spectating)return false;const op={id:`${inventoryContext}:${++inventorySequence}`,from,to};if(!predictInventoryMove(inventoryPrediction,op))return false;presentInventory();lastInventorySend=-Infinity;sendInventoryOperation();return true;},inventoryState:()=>({inventory:loadout,slot,pending:inventoryPrediction.pending}),ackInventory(ack){if(!inventoryPrediction.pending.some(op=>op.id===ack.id))return;reconcileInventory(inventoryPrediction,{inventory:ack.inventory,revision:ack.revision,slot:ack.slot,acknowledgements:[ack]});presentInventory();lastInventorySend=-Infinity;sendInventoryOperation();},clear:({resetInventory=false}={})=>{if(resetInventory){deploymentAudio.reset(audio);deploymentSnapshot=null;deploymentData=null;deploymentClock=createDeploymentClock();matchPhase='';document.body.classList.remove('deployment-cinematic','pod-exterior');$('deployment-cinematic').style.opacity='0';$('deployment-fade').style.opacity='0';}weaponAudio.stopReload(audio);inventoryMenu.close();if(resetInventory){clearInventoryPrediction(inventoryPrediction);desiredItem=null;desiredUtility=null;lastWeaponItem=null;inventoryContext='';}keysClear();$('resume-control').hidden=true;$('game-settings').hidden=true;},look:(a,b=-.03)=>{yaw=a;pitch=clamp(b,-.8,.62);},pose:()=>player,
 apply(s,id,colors,dt=.016){
  const self=s.players.find(p=>p.id===id),watched=selectViewPlayer(s.players,id);if(!self||!watched)return;
  const motionSample=s.phase==='deployment'?-(Number(s.deployment?.elapsed)||0):Number(s.elapsed)||0,watchedAir=watched.air||'landed',playerIdChanged=playerMotionId!==watched.id;if(playerIdChanged){playerMotion=null;playerMotionId=watched.id;}
  if(watchedAir==='ship'&&deploymentCameraRound!==(s.round||0)){yaw=Number.isFinite(watched.yaw)?watched.yaw:yaw;pitch=-.04;deploymentCameraRound=s.round||0;}else if(watchedAir!=='ship')deploymentCameraRound=-1;
  player.id=watched.id;const targetPosition=watchedAir==='ship'&&Array.isArray(watched.shipLocal)?shipWorld(watched.shipLocal):watched.p;
  playerMotion=advanceMotionTrack(playerMotion,targetPosition,{dt,state:watchedAir,sampleId:motionSample,snapDistance:24});player.p=playerMotion.position;
  player.yaw=smoothAngle(player.yaw,Number.isFinite(watched.yaw)?watched.yaw:yaw,dt);player.hp=watched.hp;player.shield=watched.shield;player.vy=watched.vy;player.air=watchedAir;player.dropState=watched.dropState||player.air;player.deploymentState=watched.deploymentState||'match_active';player.saluteProgress=watched.saluteProgress||0;player.podYaw=Number.isFinite(watched.podYaw)?watched.podYaw:null;player.destination=watched.destination||null;player.pod=watched.pod||null;player.podProgress=watched.podProgress||0;player.crouching=Boolean(watched.crouching);player.sliding=Boolean(watched.sliding);player.slideSpeed=Number(watched.slideSpeed)||0;player.sprinting=Boolean(watched.sprinting);player.animationState=watched.animationState||'idle';player.slot=watched.slot||0;player.weapon=watched.weapon;player.aim=Boolean(watched.aim);player.reload=Number(watched.reload)||0;player.walk=watched.walk||0;player.deployment=s.deployment;
  if(watched.destination&&s.phase==='deployment')landingChoice={x:watched.destination.x,z:watched.destination.z};else if(s.phase!=='deployment')landingChoice=null;
  const context=`${id}:${s.round}`;if(context!==inventoryContext){inventoryContext=context;clearInventoryPrediction(inventoryPrediction);desiredItem=null;desiredUtility=null;inventoryMenu.close();}if(self.hp<=0||s.phase!=='playing'){inventoryMenu.close();inventoryPrediction.pending=[];desiredItem=null;desiredUtility=null;}reconcileInventory(inventoryPrediction,{inventory:self.inventory,revision:self.inventoryRevision,slot:self.slot,acknowledgements:self.inventoryAcks});loadout=watched.id===id?inventoryPrediction.inventory:watched.inventory||createInventory();const desiredIndex=desiredItem?loadout.findIndex(w=>w?.id===desiredItem):-1;if(desiredItem&&desiredIndex<0){desiredItem=null;desiredUtility=0;}const selected=watched.id===id&&s.phase==='playing'?(desiredIndex>=0?desiredIndex+1:desiredUtility??inventoryPrediction.slot):watched.slot;if(s.phase==='deployment'){select(0,true);viewSlot=0;}else{if(validSlot(selected)&&selected!==slot)select(selected,true,true);viewSlot=selected??0;}
  ammo=currentAmmo(loadout,slot);reloading=watched.reload||0;if(!reloading||watched.hp<=0||watched.id!==id||s.phase!=='playing')weaponAudio.stopReload(audio);reloadWeapon=watched.reloadWeapon||weaponIdForSlot(slot,loadout);equipTime=watched.equip||0;sustained=mix(sustained,watched.sustained||0,.32);wood=watched.materials?.wood||0;player.materials=watched.materials||{wood:0,stone:0};player.items=watched.items||{};player.inventory=loadout;player.chestHold=watched.chestHold;player.use=watched.use;player.actionTime=watched.actionTime||0;player.action=watched.action;player.moveSpeed=watched.moveSpeed||0;player.grounded=watched.grounded;player.locomotionState=watched.locomotionState;const activeBuilds=new Set((s.structures||[]).map(b=>b.id));for(const [key,visual] of buildVisuals)if(!activeBuilds.has(key)){if(s.phase==='playing'&&s.round===matchRound&&visual.structure&&Math.hypot(visual.structure.x-player.p[0],visual.structure.z-player.p[2])<70){for(let n=0;n<6;n++)spawnEffect({kind:'dust',p:[visual.structure.x,visual.structure.y+1.8,visual.structure.z],v:[(rnd()-.5)*5,rnd()*3,(rnd()-.5)*5],life:.45,maxLife:.45,col:visual.structure.material==='stone'?C.rock:C.wood,radius:.12});}buildVisuals.delete(key);}for(const b of s.structures||[]){let visual=buildVisuals.get(b.id);if(!visual){visual={born:structures.length?time:time-1,hp:b.hp,hit:-1,structure:b};buildVisuals.set(b.id,visual);}if(b.hp<visual.hp)visual.hit=time;visual.hp=b.hp;visual.structure=b;}structures=s.structures||[];pickups=s.pickups||[];resourceHP=new Map(s.resourceHP||[]);openedChests=new Set(s.openedChests||[]);grenades=s.grenades||[];
  shipData=s.ship||{origin:DEPLOYMENT_SHIP.origin};deploymentSnapshot=s.deployment||{stage:'',elapsed:0,sequenceElapsed:0};deploymentData=deploymentSnapshot;matchPhase=s.phase;matchRound=s.round||0;
  const stage=deploymentData.stage||'',lockedStates=['entering_pod','pod_ready','both_ready','pod_sealing','launching','transition','landed','pod_opening','exiting','saluting'];cinematicLock=s.phase==='deployment'&&(lockedStates.includes(watched.deploymentState)||lockedStates.includes(stage));
  syncProjectileVisuals(s.projectiles||[]);
  const visible=new Set();bots=s.players.filter(p=>p.id!==watched.id).map(p=>{visible.add(p.id);const prior=visualPeers.get(p.id),air=p.air||'landed',target=p.air==='ship'&&Array.isArray(p.shipLocal)?shipWorld(p.shipLocal):p.p,motion=advanceMotionTrack(prior?.motion,target,{dt,state:air,sampleId:motionSample,snapDistance:24}),rotation=smoothAngle(prior?.yaw,p.yaw,dt),visual={motion,yaw:rotation};visualPeers.set(p.id,visual);return {...p,p:motion.position,yaw:rotation,color:colors[p.id]};});for(const key of visualPeers.keys())if(!visible.has(key))visualPeers.delete(key);
  storm=s.mode==='town'?Math.max(18,255-s.elapsed*.58):305;started=true;running=['playing','deployment'].includes(s.phase)&&watched.hp>0;ended=false;window.Duel.spectating=watched.id!==id?watched.id:null;updateHUD();updateInventoryHUD();$('wood').textContent=wood;const me=s.players.findIndex(v=>v.id===id),alive=s.players.filter(v=>v.hp>0).length;$('score').textContent='◎ '+(s.scores[me]||0)+'/'+(s.targetScore||5);$('remaining').textContent=alive+' LEFT';$('time').textContent=s.phase==='deployment'?String(stage||'LANDING').replaceAll('_',' ').toUpperCase():'R '+s.round;
 },
 effect(e,id,snapshot){
  if(e.type==='build'){if(e.structure?.id)buildVisuals.set(e.structure.id,{born:time,hp:e.structure.hp,hit:-1,structure:e.structure});if(e.by===id){sound(175,.09,'triangle',.018);noiseSound('wood',.08,.015);}
  }else if(e.type==='harvest_swing'||e.type==='throw'){matchCharacterRenderer?.pulse(e.by,e.type);if(e.by===id)sound(180,.1,'triangle',.014);
  }else if(e.type==='harvest'){if(e.by===id){sound(e.kind==='stone'?390:150,.1,'square',.012);notify(`+${MATERIALS[e.kind].yield} ${e.kind.toUpperCase()}`);}for(let n=0;n<5;n++)spawnEffect({p:e.point.slice(),v:[(rnd()-.5)*3,rnd()*3,(rnd()-.5)*3],life:.3,maxLife:.3,col:e.kind==='stone'?C.rock:C.wood});
  }else if(e.type==='inventory_full'&&e.by===id){notify('Loadout full · drop a weapon with X');}else if(e.type==='chest'||e.type==='pickup'){if(e.by===id)sound(e.type==='chest'?550:720,.22,'sine',.018);
  }else if(e.type==='shockwave'){sound(65,.35,'sine',.04);for(let n=0;n<30;n++){const angle=n/30*Math.PI*2;spawnEffect({p:e.point.slice(),v:[Math.cos(angle)*18,3,Math.sin(angle)*18],life:.42,maxLife:.42,col:color('bf9cff')});}
  }else if(e.type==='shot'){
   matchCharacterRenderer?.pulse(e.by,'fire');
   const profile=WEAPON_PROFILES[e.weapon]||WEAPON_PROFILES.ar,ends=e.traces?.length?e.traces:[e.b];
   if(!e.projectileId)for(const [index,end] of ends.entries())if(end){spawnEffect(createBulletTracer(e.by===id&&!profile.scope?bulletVisualOrigin(e.a,matchCharacterRenderer?.firstPersonMuzzleWorld(eye,forward,cameraFov,e.weapon),end,forward):e.a,end,color('ffc875')));impactAt(end,e.a,e.traceHits?.[index]);}
   if(e.by===id){flash=.09;viewShotImpulse=1;recoil=Math.max(recoil,profile.recoil[0]*5.5);recoilPitch+=profile.recoil[0];recoilYaw+=(rnd()-.5)*profile.recoil[1];sustained=Math.min(5,sustained+1);weaponSound(profile);if(e.hit){sound(920,.045,'sine',.012);$('hitmarker').classList.toggle('critical',Boolean(e.hits?.some(h=>h.critical)));}if(e.hit){hitTime=.24;damageNumber=.65;$('damagevalue').animate([{opacity:1,scale:'1.18'},{opacity:1,scale:'1'}],{duration:180});$('damagevalue').textContent=String(e.damage||profile.damage);$('damagevalue').classList.toggle('critical',Boolean(e.hits?.some(h=>h.critical)));}}
   if(e.hit===id||e.hits?.some(h=>h.id===id))hurt=.35;
  }else if(e.type==='projectile-impact'){
   if(!acceptEventId(projectileEventCache,e.projectileId))return;
   impactAt(e.point,null,e.hit);
   if(e.by===id&&e.hit){sound(920,.045,'sine',.012);$('hitmarker').classList.toggle('critical',Boolean(e.critical));hitTime=.28;damageNumber=.68;$('damagevalue').textContent=String(e.damage||WEAPON_PROFILES.sniper.damage);$('damagevalue').classList.toggle('critical',Boolean(e.critical));}
   if(e.hit===id)hurt=.4;
  }else if(e.type==='projectile-expire'){
   if(!acceptEventId(projectileEventCache,e.projectileId))return;
  }else if(e.type==='deployment_stage'&&e.stage==='pod_sealing'){sweepSound(150,78,.55,'square',.026);sweepSound(890,510,.62,'sine',.011);
  }else if(e.type==='deployment_stage'&&e.stage==='launching'){sweepSound(54,105,1.48,'sawtooth',.047);sweepSound(118,510,1.32,'sine',.027);sweepSound(760,250,.72,'triangle',.009);
  }else if(e.type==='deployment_stage'&&e.stage==='transition'){sweepSound(480,165,.54,'sawtooth',.017);
  }else if(e.type==='deployment_stage'&&e.stage==='pod_opening'){sweepSound(205,75,.4,'square',.023);sweepSound(1180,390,.18,'triangle',.013);
  }else if(e.type==='deployment_stage'&&e.stage==='exiting'){sweepSound(240,440,.35,'triangle',.015);
  }else if(e.type==='deployment_stage'&&e.stage==='saluting'){sound(430,.16,'sine',.012);
  }else if(e.type==='reload'&&e.by===id){
   // Accepted events precede the next rendered frame; use their snapshot actor.
   const profile=WEAPON_PROFILES[e.weapon]||WEAPON_PROFILES.ar,actor=snapshot?.players?.find(p=>p.id===id)||(player.id===id?player:null);
   if((snapshot&&snapshot.phase!=='playing')||(actor&&(actor.reload<=0||actor.weapon!==profile.id||actor.hp<=0)))return;
   // An older host selection must not revive audio after a local weapon switch.
   const currentContext=!snapshot||inventoryContext===`${id}:${snapshot.round}`;
   if(currentContext&&(desiredUtility!==null||(desiredItem&&(actor?.reloadItem?desiredItem!==actor.reloadItem:inventoryWeapon(loadout,slot)?.type!==profile.id))))return;
   const duration=e.duration||profile.reloadDuration,elapsed=actor?.reload>0?Math.max(0,duration-actor.reload):0;
   if(!weaponAudio.playReload(audio,profile.id,duration,elapsed))sound(315,.1,'triangle',.018);
   notify(`Reloading ${profile.shortName}…`);
  }else if(e.type==='switch'&&e.by===id){sound(205,.07,'triangle',.014);
  }else if(e.type==='deployment_start'){sound(74,.58,'sine',.012);
  }else if(e.type==='pod_reserved'&&e.by===id){sound(245,.16,'triangle',.025);sound(520,.12,'sine',.012);notify(`POD ${e.pod} RESERVED`);
  }else if(e.type==='pod_ready'&&e.by===id){sound(410,.16,'triangle',.024);sound(610,.22,'sine',.012);notify('POD SEALED · WAITING FOR SQUAD');
  }else if(e.type==='both_pods_ready'){sound(112,.45,'sawtooth',.014);sound(228,.48,'sine',.018);
  }else if(e.type==='deployment_landed'){notify('IMPACT · POD SECURED');
  }else if(e.type==='match_active'){sound(490,.26,'triangle',.024);notify('DEPLOYED · FIGHT FOR THE ISLAND');
  }else if(e.type==='land'&&e.by===id){sound(130,.12,'triangle',.02);notify('Touchdown');
  }else if(e.type==='elimination'&&e.hit===id){hurt=.6;notify('Eliminated · spectating the round');}
 },startAudio({deployment=false}={}){try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();return deployment?Promise.all([weaponAudio.load(audio),deploymentAudio.load(audio)]):weaponAudio.load(audio);}catch{return Promise.resolve(false);}},capture:captureMouse};
reset();requestAnimationFrame(frame);
})();
