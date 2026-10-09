import {boundsIntersectCollider,sweepBoundsCollider} from './collision-shapes.js';
// Axis sweeps retain wall sliding and stepping without skipping thin cover at
// shockwave speeds. Bounds use the Soldier's standing/crouching body height.
export const PLAYER_BODY=Object.freeze({radius:.36,height:1.78,crouchHeight:1.35,step:.38});
export function moveHorizontal(position,dx,dz,colliders,{crouching=false}={}){
 const height=crouching?PLAYER_BODY.crouchHeight:PLAYER_BODY.height,r=PLAYER_BODY.radius;
 for(const [axis,delta] of [[0,dx],[2,dz]]){
  if(!delta)continue;
  const cross=axis===0?2:0,start=position[axis];let target=start+delta;
  for(const box of colliders){
   if(box.planes?.length){
    const bounds={min:[position[0]-r,position[1]+PLAYER_BODY.step,position[2]-r],max:[position[0]+r,position[1]+height,position[2]+r]},motion=[0,0,0];motion[axis]=target-start;
    const t=sweepBoundsCollider(bounds,motion,box);if(t!==null)target=start+motion[axis]*t;
    continue;
   }
   if(box.max[1]<=position[1]+PLAYER_BODY.step||box.min[1]>=position[1]+height||position[cross]+r<=box.min[cross]||position[cross]-r>=box.max[cross])continue;
   if(delta>0){const contact=box.min[axis]-r;if(start<=contact+.0001&&target>contact)target=Math.max(start,contact);}
   else{const contact=box.max[axis]+r;if(start>=contact-.0001&&target<contact)target=Math.min(start,contact);}
  }
  position[axis]=target;
 }
 return position;
}
export function upwardLimit(position,nextY,colliders,{crouching=false,rampCeilings=[]}={}){
 const height=crouching?PLAYER_BODY.crouchHeight:PLAYER_BODY.height,r=PLAYER_BODY.radius,head=position[1]+height;
 let limit=nextY;
 if(nextY<=position[1])return limit;
 for(const box of colliders){
  if(box.planes?.length){
   const bounds={min:[position[0]-r,position[1],position[2]-r],max:[position[0]+r,head,position[2]+r]},motion=[0,limit-position[1],0];
   const t=sweepBoundsCollider(bounds,motion,box);if(t!==null)limit=position[1]+motion[1]*t;
   continue;
  }
  if(position[0]+r<=box.min[0]||position[0]-r>=box.max[0]||position[2]+r<=box.min[2]||position[2]-r>=box.max[2])continue;
  if(head<=box.min[1]+.0001&&limit+height>box.min[1])limit=Math.min(limit,box.min[1]-height);
 }
 for(const surface of rampCeilings)if(surface!==null&&head<=surface+.0001&&limit+height>surface)limit=Math.min(limit,surface-height);
 return limit;
}
export function canStandAt(position,colliders,rampCeilings=[]){
 const r=PLAYER_BODY.radius;
 if(rampCeilings.some(surface=>surface!==null&&surface>position[1]+PLAYER_BODY.crouchHeight&&surface<position[1]+PLAYER_BODY.height))return false;
 return !colliders.some(b=>b.planes?.length?boundsIntersectCollider({min:[position[0]-r,position[1]+PLAYER_BODY.crouchHeight,position[2]-r],max:[position[0]+r,position[1]+PLAYER_BODY.height,position[2]+r]},b):position[0]+r>b.min[0]&&position[0]-r<b.max[0]&&position[2]+r>b.min[2]&&position[2]-r<b.max[2]&&b.min[1]<position[1]+PLAYER_BODY.height&&b.max[1]>position[1]+PLAYER_BODY.crouchHeight);
}
