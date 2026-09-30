export const DEPLOYMENT_SHIP=Object.freeze({origin:Object.freeze([0,240,0]),halfWidth:12,halfLength:18,floorY:-.22,ceilingY:8});

const podRows=[-10,-3.4,3.4,10];
export const SHIP_PODS=Object.freeze(podRows.flatMap((z,row)=>[-1,1].map((side,index)=>({
 id:`P${row*2+index+1}`,x:side*7,z,radius:1.08,entryOffset:2.35,side,row
}))));

export const SHIP_COLLIDERS=Object.freeze([
 {min:[-12,-2.4,-18],max:[12,8, -17.25]}, {min:[-12,-2.4,17.25],max:[12,8,18]},
 {min:[-12,-2.4,-17.25],max:[-11.25,8,17.25]}, {min:[11.25,-2.4,-17.25],max:[12,8,17.25]},
 {min:[-10,-.15,-1.6],max:[-3.1,2.5,1.6]}, {min:[3.1,-.15,-1.6],max:[10,2.5,1.6]},
 {min:[-1.45,-.15,-14.6],max:[1.45,2.8,-9.8]},
 {min:[-1.45,-.15,9.8],max:[1.45,2.8,14.6]}
]);

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const blocked=(x,z)=>SHIP_COLLIDERS.some(box=>x>box.min[0]-.42&&x<box.max[0]+.42&&z>box.min[2]-.42&&z<box.max[2]+.42);

export function clampShipPosition(local){
 const x=Number.isFinite(local?.[0])?local[0]:0,z=Number.isFinite(local?.[2])?local[2]:Number.isFinite(local?.[1])?local[1]:0;
 return [clamp(x,-8,8),0,clamp(z,-14,14)];
}

export function moveInShip(local,delta,ignorePod=null){
 let [x,,z]=clampShipPosition(local);const dx=Number.isFinite(delta?.[0])?delta[0]:0,dz=Number.isFinite(delta?.[2])?delta[2]:Number.isFinite(delta?.[1])?delta[1]:0;
 const candidates=[[x+dx,z],[x,z+dz]];
 for(const pod of SHIP_PODS){if(pod.id===ignorePod)continue;const ox=candidates[0][0]-pod.x,oz=candidates[0][1]-pod.z,d=Math.hypot(ox,oz),minimum=pod.radius+.43;if(d<minimum&&d>0){candidates[0][0]=pod.x+ox/d*minimum;candidates[0][1]=pod.z+oz/d*minimum;}}
 for(const [cx,cz] of candidates){const nx=clamp(cx,-8,8),nz=clamp(cz,-14,14);if(!blocked(nx,nz)&&!SHIP_PODS.some(pod=>pod.id!==ignorePod&&Math.hypot(nx-pod.x,nz-pod.z)<pod.radius+.43)){x=nx;z=nz;}}
 return [x,0,z];
}

export function shipWorld(local){const origin=DEPLOYMENT_SHIP.origin;return [origin[0]+local[0],origin[1]+local[1],origin[2]+local[2]];}
