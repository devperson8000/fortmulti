const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function skyshipFirstPersonView(position,yaw=0,pitch=0,standBlend=1,launchProgress=0){
 const y=Number.isFinite(yaw)?yaw:0,p=clamp(Number.isFinite(pitch)?pitch:0,-.75,.6),blend=clamp(Number.isFinite(standBlend)?standBlend:0,0,1),launch=clamp(Number.isFinite(launchProgress)?launchProgress:0,0,1),height=1.08+blend*.62+launch*.12;
 const eye=[position[0],position[1]+height,position[2]],forward=[-Math.sin(y)*Math.cos(p),Math.sin(p),-Math.cos(y)*Math.cos(p)];
 return {eye,target:[eye[0]+forward[0],eye[1]+forward[1],eye[2]+forward[2]],forward,height};
}
export function cabinPoint(local,eye,yaw=0){
 const angle=Number.isFinite(yaw)?yaw:0,c=Math.cos(angle),s=Math.sin(angle),x=local[0],y=local[1],z=local[2];
 return [eye[0]+x*c-z*s,eye[1]+y,eye[2]+x*s+z*c];
}
