import {nativeSupportHeight,boundsIntersectCollider,patchColliders} from './collision-shapes.js';
export const PLATFORM_SOURCE=Object.freeze({id:'facility',name:'Platform 23',author:'EmperorJack / Unvanquished',license:'CC BY-SA 3.0',url:'https://github.com/UnvanquishedAssets/map-plat23_src.dpkdir'});
export const PLATFORM_CINEMATIC_RADIUS=3.3;
export const PLATFORM_POIS=Object.freeze([
 ['Landing Deck',0,-10,-.125],['Forward Deck',0,-2,-.125],['West Courtyard',-35,17,1.5],['East Courtyard',35,17,1.5],['West Dock',-74,-14,4],['East Dock',74,-14,4],['West Gantry',-9,23,1.5],['East Gantry',9,23,1.5]
].map(([name,x,z,y])=>Object.freeze({name,x,z,y,radius:4,angle:0})));
let data=null,loading=null,layout=null,nativeColliders=[];const supportCells=new Map(),size=8,key=(x,z)=>`${Math.floor(x/size)},${Math.floor(z/size)}`;
function index(entry){for(let x=Math.floor(entry.min[0]/size);x<=Math.floor(entry.max[0]/size);x++)for(let z=Math.floor(entry.min[2]/size);z<=Math.floor(entry.max[2]/size);z++){const k=`${x},${z}`;if(!supportCells.has(k))supportCells.set(k,[]);supportCells.get(k).push(entry);}}
function triangleHeight(p,x,z){const ax=p[0],az=p[2],bx=p[3],bz=p[5],cx=p[6],cz=p[8],den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(den)<1e-10)return null;const a=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den,b=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den,c=1-a-b;return a>=-1e-6&&b>=-1e-6&&c>=-1e-6?a*p[1]+b*p[4]+c*p[7]:null;}
export function initializePlatformMap(collision){if(data)return;data=collision;nativeColliders=[...data.brushes,...patchColliders(data.patches)];for(const brush of nativeColliders)if(brush.type==='solid')index(brush);const p=data.walkable.positions;for(let i=0;i<p.length;i+=9){const triangle=p.slice(i,i+9),min=[0,1,2].map(k=>Math.min(triangle[k],triangle[k+3],triangle[k+6])),max=[0,1,2].map(k=>Math.max(triangle[k],triangle[k+3],triangle[k+6]));index({triangle,min,max});}}
export async function loadPlatformMap(){if(!loading)loading=import('./maps/platform23/collision-data.js').then(({PLATFORM_COLLISION})=>{initializePlatformMap(PLATFORM_COLLISION);return platformLayout();}).catch(error=>{loading=null;throw error;});return loading;}
export function platformSupportHeight(x,z,footY,maxRise=.38){let best=-50;for(const entry of supportCells.get(key(x,z))||[]){const y=entry.triangle?triangleHeight(entry.triangle,x,z):nativeSupportHeight(entry,x,z,footY,maxRise);if(y!==null&&y<=footY+maxRise+.001&&y>best)best=y;}return best;}
export function platformHeight(x,z){return platformSupportHeight(x,z,4.05,0);}
export function isPlatformLandingAllowed(x,z){return PLATFORM_POIS.some(p=>Math.hypot(x-p.x,z-p.z)<=p.radius);}
function blockers(box){return nativeColliders.filter(b=>b.type==='solid'&&boundsIntersectCollider(box,b));}
export function platformLandingClear(x,z,y,radius=PLATFORM_CINEMATIC_RADIUS){if(blockers({min:[x-radius-.1,y+.035,z-radius-.1],max:[x+radius+.1,y+4.4,z+radius+.1]}).length)return false;for(let i=0;i<16;i++){const a=i*Math.PI/8,h=platformSupportHeight(x+Math.cos(a)*2.9,z+Math.sin(a)*2.9,y,.05);if(Math.abs(h-y)>.3)return false;}return true;}
export function platformLayout(){if(!data)throw Error('Platform 23 collision data must finish loading before activation.');if(layout)return layout;
 const obstacles=nativeColliders.map(b=>({...b,surface:'metal',supportOnlyNative:true})),chests=[],resources=[],candidates=[];
 for(let x=-84;x<=84;x+=4)for(let z=-48;z<=48;z+=4){const y=platformHeight(x,z);if(y<-1||y>4.05||blockers({min:[x-.55,y+.08,z-.55],max:[x+.55,y+1.85,z+.55]}).length)continue;if(PLATFORM_POIS.some(p=>Math.hypot(x-p.x,z-p.z)<4.5))continue;candidates.push({x,y,z});}
 // Sample distributed supported source floors; source walls are never replaced
 // by a fabricated flat floor, including under the lowest service passages.
 while(chests.length<24&&candidates.length){let at=0,score=-Infinity;for(let i=0;i<candidates.length;i++){const p=candidates[i],d=chests.length?Math.min(...chests.map(q=>Math.hypot(p.x-q.x,p.z-q.z))):Math.hypot(p.x,p.z);if(d>score){score=d;at=i;}}const p=candidates.splice(at,1)[0];chests.push({...p,id:`chest:platform23:${chests.length}`});}
 for(const chest of chests.slice(0,16))for(const [dx,dz]of[[2,0],[-2,0],[0,2],[0,-2]]){const x=chest.x+dx,z=chest.z+dz,y=platformSupportHeight(x,z,chest.y,.05);if(Math.abs(y-chest.y)>.1||blockers({min:[x-.9,y+.02,z-.8],max:[x+.9,y+1.4,z+.8]}).length)continue;resources.push({id:`resource:platform23:${resources.length}`,kind:resources.length%2?'stone':'wood',x,y,z,hp:100});break;}
 layout={parts:[],obstacles,chests,resources,pois:PLATFORM_POIS,height:platformHeight,supportHeight:platformSupportHeight,terrainHeight:()=>-50,minLandingHeight:-1,landingPoints:PLATFORM_POIS,isLandingAllowed:isPlatformLandingAllowed,isLandingClear:platformLandingClear,cinematicRadius:PLATFORM_CINEMATIC_RADIUS,map:PLATFORM_SOURCE};return layout;
}
export function drawPlatformMap(ctx,x,y,width,height){ctx.save();ctx.translate(x+width/2,y+height/2);ctx.scale(width/640,height/640);ctx.fillStyle='#101d29';ctx.fillRect(-320,-320,640,640);ctx.strokeStyle='#5c778a';ctx.lineWidth=8;
 // Source corridors and two outer bases, centered in the same world coordinates.
 for(const side of[-1,1]){ctx.strokeRect(side<0?-83:48,-28,35,65);ctx.beginPath();ctx.moveTo(side*48,18);ctx.lineTo(side*32,18);ctx.lineTo(side*14,4);ctx.lineTo(side*14,-14);ctx.stroke();}ctx.fillStyle='#344e60';ctx.fillRect(-13,-22,26,29);ctx.strokeRect(-13,-22,26,29);ctx.fillStyle='#bdcad0';for(const p of PLATFORM_POIS)ctx.fillRect(p.x-2,p.z-2,4,4);ctx.restore();}
