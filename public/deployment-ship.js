export const DEPLOYMENT_SHIP=Object.freeze({origin:Object.freeze([0,240,0]),halfWidth:12,halfLength:18,floorY:-.22,ceilingY:8});

const podRows=[-10,-3.4,3.4,10];
export const SHIP_PODS=Object.freeze(podRows.flatMap((z,row)=>[-1,1].map((side,index)=>({
 id:`P${row*2+index+1}`,x:side*7,z,radius:1.08,entryOffset:2.35,side,row
}))));

export const SHIP_COLLIDERS=Object.freeze([
 {min:[-12,-2.4,-18],max:[12,8, -17.25]}, {min:[-12,-2.4,17.25],max:[12,8,18]},
 {min:[-12,-2.4,-17.25],max:[-11.25,8,17.25]}, {min:[11.25,-2.4,-17.25],max:[12,8,17.25]},
 {min:[-10.3,-.15,-.3],max:[-3.1,3,.9]}, {min:[3.1,-.15,-.3],max:[10.3,3,.9]},
 {min:[-1.45,-.15,-14.6],max:[1.45,2.8,-9.8]},
 {min:[-1.45,-.15,9.8],max:[1.45,2.8,14.6]}
]);

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const ease=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
export const POD_BOARDING_SECONDS=2.4;
export function podBoardingRoute(pod,start){
 const route=[start],front=[pod.x,0,pod.z+pod.entryOffset],dx=start[0]-pod.x;
 if(start[2]<pod.z+1.75){
  // Pass outside the open door wings before turning into the front corridor.
  const x=pod.x+(Math.sign(dx)||pod.side)*Math.max(2.5,Math.abs(dx));
  route.push([x,0,start[2]],[x,0,front[2]],front);
 }else if(Math.abs(dx)>.05)route.push(front);
 route.push([pod.x,0,pod.z]);
 return route;
}
export function podBoardingPose(pod,start,progress=0){
 const t=clamp(progress,0,1),walk=clamp(t/.64,0,1),route=podBoardingRoute(pod,start);
 const lengths=route.slice(1).map((point,i)=>Math.hypot(point[0]-route[i][0],point[2]-route[i][2])),distance=lengths.reduce((sum,n)=>sum+n,0);
 const sample=travel=>{
  for(let i=0;i<lengths.length;i++){if(travel<=lengths[i]||i===lengths.length-1){const q=lengths[i]>.0001?clamp(travel/lengths[i],0,1):1;return route[i].map((v,k)=>v+(route[i+1][k]-v)*q);}travel-=lengths[i];}
  return route.at(-1).slice();
 };
 const travelled=ease(walk)*distance,position=sample(travelled),look=sample(Math.min(distance,travelled+.25));
 const moveSpeed=walk<1?6*walk*(1-walk)*distance/(POD_BOARDING_SECONDS*.64):0;
 return {position,yaw:walk<1?Math.atan2(position[0]-look[0],position[2]-look[2]):0,doorOpen:1-ease((t-.64)/.36),
  animationState:walk<1?(moveSpeed>4.5?'run':'pod-enter'):'idle',moveSpeed};
}
export function podShipLaunch(sequenceTime=0){
 const t=Math.max(0,sequenceTime),flight=Math.max(0,t-.34);
 return {hatchOpen:ease((t-.1)/.22),drop:Math.min(80,flight*flight*46)};
}
export function podBoardingCamera(pod,origin=DEPLOYMENT_SHIP.origin,sequenceTime=0,{entryStart=null,aspect=16/9}={}){
 const start=entryStart||[pod.x,0,pod.z+pod.entryOffset],distance=Math.max(6.8,start[2]-pod.z+4.4);
 // Move toward the aisle to avoid placing the camera in the next capsule.
 const eye=[origin[0]+pod.x-pod.side*2.6,origin[1]+2.25,origin[2]+pod.z+distance];
 const target=[origin[0]+pod.x,origin[1]+1.84,origin[2]+pod.z];
 const normalize=a=>a.map(v=>v/Math.hypot(...a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
 const forward=normalize(target.map((v,i)=>v-eye[i])),right=normalize(cross(forward,[0,1,0])),up=cross(right,forward);
 const points=[];
 for(const x of[-2.04,2.04])for(const y of[0,3.82])for(const z of[-.98,1.12])points.push([pod.x+x,y,pod.z+z]);
 for(const point of podBoardingRoute(pod,start))for(const x of[-.5,.5])for(const y of[0,2])points.push([point[0]+x,y,point[2]]);
 let lens=Math.tan(58*Math.PI/360);
 for(const point of points){const offset=point.map((v,i)=>v+origin[i]-eye[i]),depth=dot(offset,forward);lens=Math.max(lens,Math.abs(dot(offset,up))/(depth*.9),Math.abs(dot(offset,right))/(depth*Math.max(.4,aspect)*.9));}
 target[1]-=ease((sequenceTime-.34)/.6)*1.9;
 return {eye,target,fov:2*Math.atan(lens)};
}
// Prebuilt floor rectangles leave actual launch holes; their sliding gates
// are separate geometry, so an ejected capsule cannot pass through a slab.
const deckX=[-12,-8.22,-5.78,5.78,8.22,12],deckZ=[-18,...podRows.flatMap(z=>[z-1.22,z+1.22]),18],deck=[];
for(let x=1;x<deckX.length;x++)for(let z=1;z<deckZ.length;z++){
 const center=[(deckX[x]+deckX[x-1])/2,(deckZ[z]+deckZ[z-1])/2],size=[deckX[x]-deckX[x-1],deckZ[z]-deckZ[z-1]];
 if(SHIP_PODS.some(p=>Math.abs(center[0]-p.x)<1.22&&Math.abs(center[1]-p.z)<1.22))continue;
 deck.push(Object.freeze({center:Object.freeze(center),size:Object.freeze(size)}));
}
export const SHIP_DECK_PANELS=Object.freeze(deck);
const blocked=(x,z)=>SHIP_COLLIDERS.some(box=>x>box.min[0]-.42&&x<box.max[0]+.42&&z>box.min[2]-.42&&z<box.max[2]+.42);
const insidePod=(x,z,ignorePod)=>SHIP_PODS.some(pod=>pod.id!==ignorePod&&Math.hypot(x-pod.x,z-pod.z)<pod.radius+.43);

export function clampShipPosition(local){
 const x=Number.isFinite(local?.[0])?local[0]:0,z=Number.isFinite(local?.[2])?local[2]:Number.isFinite(local?.[1])?local[1]:0;
 return [clamp(x,-8,8),0,clamp(z,-14,14)];
}

export function moveInShip(local,delta,ignorePod=null){
 let [x,,z]=clampShipPosition(local);const dx=Number.isFinite(delta?.[0])?delta[0]:0,dz=Number.isFinite(delta?.[2])?delta[2]:Number.isFinite(delta?.[1])?delta[1]:0;
 const collides=(cx,cz)=>blocked(cx,cz)||insidePod(cx,cz,ignorePod);
 const nextX=clamp(x+dx,-8,8);if(!collides(nextX,z))x=nextX;
 const nextZ=clamp(z+dz,-14,14);if(!collides(x,nextZ))z=nextZ;
 return [x,0,z];
}

export function shipWorld(local){const origin=DEPLOYMENT_SHIP.origin;return [origin[0]+local[0],origin[1]+local[1],origin[2]+local[2]];}
