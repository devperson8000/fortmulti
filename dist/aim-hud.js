import {rayCollider} from './collision-shapes.js';
import {gridBounds,rayRamp} from './build-grid.js';
const directions=['N','NE','E','SE','S','SW','W','NW'];
const wrap=value=>((value%360)+360)%360;
export function compassHeading(direction){
 if(Math.hypot(direction[0],direction[2])<1e-9)return 0;
 return wrap(Math.atan2(direction[0],-direction[2])*180/Math.PI);
}
export function compassMarks(heading){
 const sector=Math.round(heading/45);
 return Array.from({length:9},(_,i)=>{const index=sector+i-4;return {label:directions[((index%8)+8)%8],offset:index*45-heading};});
}
export function scopeRange(origin,direction,{obstacles=[],structures=[],players=[],localId='',terrainHeight,limit=360}={}){
 const length=Math.hypot(...direction);if(!length||!origin.every(Number.isFinite))return null;
 const d=direction.map(v=>v/length);let nearest=Infinity;
 for(const b of obstacles)if(b.blocksShots!==false)nearest=Math.min(nearest,rayCollider(origin,d,b));
 for(const s of structures)nearest=Math.min(nearest,s.type===2?rayCollider(origin,d,gridBounds(s)):rayRamp(origin,d,s));
 for(const p of players){
  if(String(p.id)===String(localId)||p.hp<=0||!p.p)continue;
  const height=p.sliding?.95:p.crouching?1.25:1.78;
  nearest=Math.min(nearest,rayCollider(origin,d,{min:[p.p[0]-.43,p.p[1],p.p[2]-.43],max:[p.p[0]+.43,p.p[1]+height,p.p[2]+.43]}));
 }
 // Cheap bounded sampling, followed by refinement, uses the map's shot terrain.
 if(terrainHeight){
  const below=t=>origin[1]+d[1]*t<=terrainHeight(origin[0]+d[0]*t,origin[2]+d[2]*t);
  for(let t=.5;t<=Math.min(nearest,limit);t+=.5)if(below(t)){
   let lo=Math.max(0,t-.5),hi=t;for(let i=0;i<8;i++){const mid=(lo+hi)/2;if(below(mid))hi=mid;else lo=mid;}nearest=hi;break;
  }
 }
 return Number.isFinite(nearest)&&nearest<=limit?nearest:null;
}

export function createAimHud(document){
 const compass=document.getElementById('compass'),range=document.getElementById('scope-range');
 compass.replaceChildren();const tape=document.createElement('span');tape.className='compass-tape';
 const marks=Array.from({length:9},()=>{const mark=document.createElement('span');mark.className='compass-mark';tape.append(mark);return mark;});
 const pointer=document.createElement('span');pointer.className='compass-pointer';pointer.textContent='▾';
 const bearing=document.createElement('span');bearing.className='compass-bearing';compass.append(tape,pointer,bearing);
 let lastRangeAt=-Infinity,wasScoped=false;
 return {update({direction,eye,scoped,now,world,structures,players,localId}){
  const heading=compassHeading(direction),layout=compassMarks(heading);
  marks.forEach((mark,i)=>{if(mark.textContent!==layout[i].label)mark.textContent=layout[i].label;mark.style.transform=`translateX(${(layout[i].offset*1.8).toFixed(3)}px)`;});
  const text=`${Math.round(heading)%360}°`;if(bearing.textContent!==text)bearing.textContent=text;
  if(scoped&&(!wasScoped||now-lastRangeAt>=50)){
   const distance=scopeRange(eye,direction,{obstacles:world.obstacles,terrainHeight:world.terrainHeight||world.height,structures,players,localId});
   const value=distance===null?'RANGE · —':'RANGE · '+Math.max(1,Math.round(distance))+' m';if(range.textContent!==value)range.textContent=value;
   range.dataset.distance=distance===null?'':String(distance);lastRangeAt=now;
  }else if(!scoped&&wasScoped){range.textContent='RANGE · —';range.dataset.distance='';lastRangeAt=-Infinity;}
  wasScoped=scoped;
 }};
}
