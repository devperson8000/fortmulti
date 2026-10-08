import {HEIGHT_SAMPLES} from './maps/ironwood/height-data.js';
import {FOREST_TREES} from './maps/ironwood/forest-data.js';
import {buildingLayout,roadRibbon} from './world-layout.js';

export const MAP_SOURCE=Object.freeze({name:'IRONWOOD ISLAND',license:'MIT',url:'https://github.com/TokisanGames/Terrain3D',revision:'854a4575ef0f6db8f3e2c051d352181da75236a2'});
export const MAP_GRID=Object.freeze({size:161,min:-320,step:4});
export const ISLAND_POIS=Object.freeze([
 {name:'COMMAND BASE',x:0,z:0},{name:'HARBOR POST',x:-202,z:76},
 {name:'EAST GARRISON',x:184,z:82},{name:'RIDGE STATION',x:126,z:-188},
 {name:'SUPPLY DEPOT',x:-92,z:-178},{name:'PINEWATCH',x:8,z:202}
]);
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
export function createHeightField(values,size,min,step){
 if(!Number.isInteger(size)||size<2||values.length!==size*size||!Number.isFinite(min)||!Number.isFinite(step)||step<=0||Array.from(values).some(v=>!Number.isFinite(v)))throw new Error('Invalid island height field');
 return (x,z)=>{
  const gx=clamp((x-min)/step,0,size-1),gz=clamp((z-min)/step,0,size-1),ix=Math.min(size-2,Math.floor(gx)),iz=Math.min(size-2,Math.floor(gz)),tx=gx-ix,tz=gz-iz;
  const a=values[iz*size+ix],b=values[iz*size+ix+1],c=values[(iz+1)*size+ix+1],d=values[(iz+1)*size+ix];
  // Same a-c diagonal as the terrain triangles used by the raw renderer.
  return tx>=tz?a+(b-a)*tx+(c-b)*tz:a+(c-d)*tx+(d-a)*tz;
 };
}
export const islandHeight=createHeightField(Float32Array.from(HEIGHT_SAMPLES,v=>v/100),MAP_GRID.size,MAP_GRID.min,MAP_GRID.step);
export function forestTreePlacements(x,z,scale,yaw){
 const cs=Math.cos(yaw),sn=Math.sin(yaw);
 return FOREST_TREES.map(tree=>{
  const lx=tree.offset[0]*scale,lz=tree.offset[1]*scale,px=x+lx*cs+lz*sn,pz=z-lx*sn+lz*cs;
  return {x:px,y:islandHeight(px,pz),z:pz,vertices:tree.vertices};
 });
}
const rgb=hex=>[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255);
export function islandTerrainColor(x,z){
 const h=islandHeight(x,z),beach=clamp((2-h)/5),rock=clamp((h-24)/18),shade=1+Math.sin(x*.04+z*.015)*.05;
 const grass=rgb('617b4d'),stone=rgb('929a90'),sand=rgb('c4b68f');
 return grass.map((v,i)=>((v*(1-rock)+stone[i]*rock)*(1-beach)+sand[i]*beach)*shade);
}

// One layout supplies visible geometry, solid colliders, map footprints and loot.
export function militaryLayout(){
 const parts=[],buildings=[],chests=[],roads=[];
 const add=(position,size,color,solid=true)=>parts.push({position,size,color,solid});
 for(const [index,poi] of ISLAND_POIS.entries()){
  const level=islandHeight(poi.x,poi.z),tint=index%2?'7e8870':'909984';
  for(const [dx,dz,w,d,h] of [[-24,-12,14,12,3.6],[23,-16,16,12,7.2],[-23,21,12,10,3.6]]){
   const x=poi.x+dx,z=poi.z+dz,layout=buildingLayout(x,z,w,d,h,islandHeight);buildings.push({x,z,w,d});
   for(const p of layout.parts)add(p.position,p.size,p.kind==='roof'?'46554e':p.kind==='stairs'||p.kind==='floor'?'92978c':tint);
   for(const chest of layout.chests)chests.push({...chest,id:`chest:ironwood:${chests.length}`});
   // Trim, slit windows and roof ventilation keep the compounds readable.
   for(const side of [-1,1]){
    add([x+side*w/2,layout.y+h*.55,z],[.25,.24,d+.1],'bac0a9',false);
    add([x+side*(w/2+.13),layout.y+1.7,z-1],[.06,.7,3.5],'466775',false);
   }
   add([x,layout.y+h+.7,z-2],[2.2,1,1.4],'63716b');
  }
  // Separate container bays leave the middle clear for pod landings and building.
  for(let k=0;k<3;k++){
   const x=poi.x+20+k*6,z=poi.z+20,y=islandHeight(x,z);add([x,y+1.45,z],[5,2.9,9],k%2?'6d755e':'687e80');buildings.push({x,z,w:5,d:9});
   for(let q=-2;q<=2;q++)add([x+q,y+1.45,z+4.53],[.065,2.7,.045],'9aa994',false);
   if(k===0)chests.push({id:`chest:ironwood:${chests.length}`,x:x-4,y:islandHeight(x-4,z),z});
  }
  // Perimeter segments with broad north/south gates; no invisible solid fence.
  for(const side of [-1,1]){
   for(const dz of [-26,0,26])add([poi.x+side*42,level+1,poi.z+dz],[.35,2,22],'6c7668');
   for(const dx of [-26,26])add([poi.x+dx,level+.65,poi.z+side*39],[22,1.3,.7],'788276');
  }
  // A radio mast is visible from the tree line and supplies cover at its base.
  const tx=poi.x-33,tz=poi.z-29,ty=islandHeight(tx,tz);add([tx,ty+.6,tz],[3.4,1.2,3.4],'747e75');
  add([tx,ty+8,tz],[.3,15,.3],'5a6865');add([tx,ty+14,tz],[5,.18,.18],'c0c6b3',false);
  add([tx,ty+15.7,tz],[.35,.35,.35],'cf7c55',false);
  if(index){
   const side=Math.sign(poi.z)||1,waypoints=[[0,0],[0,side*56],[poi.x,poi.z+side*54],[poi.x,poi.z]];
   for(let k=1;k<waypoints.length;k++)roads.push({a:waypoints[k-1],b:waypoints[k],width:7});
  }
 }
 return {parts,buildings,chests,roads};
}
export const islandRoadRibbon=(road)=>roadRibbon(road.a,road.b,road.width,islandHeight);

export function islandMapPixels(size=161){
 const pixels=new Uint8ClampedArray(size*size*4);
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  const wx=-320+x*640/(size-1),wz=-320+z*640/(size-1),height=islandHeight(wx,wz),color=height<-.1?[40,86,105]:islandTerrainColor(wx,wz).map(v=>Math.round(v*255));
  pixels.set([...color,255],(z*size+x)*4);
 }
 return pixels;
}
let mapImage=null;
export function drawIslandMap(ctx,x,y,width,height){
 if(!mapImage){mapImage=document.createElement('canvas');mapImage.width=mapImage.height=161;const target=mapImage.getContext('2d'),image=target.createImageData(161,161);image.data.set(islandMapPixels());target.putImageData(image,0,0);}
 ctx.drawImage(mapImage,x,y,width,height);
}
