export const DEPLOYMENT_SHIP=Object.freeze({origin:Object.freeze([0,240,0]),halfWidth:12,halfLength:18,floorY:-.22,ceilingY:8});

// All offsets are measured from the beginning of the shared launch sequence.
// The pods physically clear the deck BEFORE blackout and the music onset.
export const DEPLOYMENT_LAUNCH=Object.freeze({
 seal:1.12,hatchStart:1.20,hatchSeconds:.48,dropStart:1.85,dropSeconds:.68,
 fadeStart:2.78,fadeSeconds:.38,dropDistance:15
});
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function shipLaunchAt(sequenceTime=0){
 const t=Math.max(0,Number(sequenceTime)||0),c=DEPLOYMENT_LAUNCH;
 const hatchOpen=ease((t-c.hatchStart)/c.hatchSeconds);
 const dropProgress=ease((t-c.dropStart)/c.dropSeconds);
 const exhaust=ease((t-c.dropStart)/.1)*(1-ease((t-c.dropStart-c.dropSeconds+.2)/.3));
 return {hatchOpen,dropProgress,drop:dropProgress*c.dropDistance,exhaust};
}
export function shipBoardingCamera(pod,origin=DEPLOYMENT_SHIP.origin,sequenceTime=null){
 if(!pod)return null;
 const launch=sequenceTime===null?{drop:0,dropProgress:0}:shipLaunchAt(sequenceTime);
 const base=[origin[0]+pod.x,origin[1],origin[2]+pod.z],side=pod.side||1;
 return {
  eye:[base[0]-side*2.85,base[1]+2.85-launch.dropProgress*.3,base[2]+3.55],
  target:[base[0],base[1]+1.87-launch.drop*.78,base[2]+.22]
 };
}

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
