const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const CABIN_LIMITS=Object.freeze({minX:-2.1,maxX:2.1,minZ:-5.1,maxZ:5.05});

export function clampCabinPosition(local){
 const x=Number.isFinite(local?.[0])?local[0]:0,y=Number.isFinite(local?.[1])?local[1]:0,z=Number.isFinite(local?.[2])?local[2]:0;
 return [clamp(x,CABIN_LIMITS.minX,CABIN_LIMITS.maxX),y,clamp(z,CABIN_LIMITS.minZ,CABIN_LIMITS.maxZ)];
}

export function clampCabinWorldPosition(position,origin,yaw=0){
 const angle=Number.isFinite(yaw)?yaw:0,c=Math.cos(angle),s=Math.sin(angle),dx=position[0]-origin[0],dz=position[2]-origin[2];
 const local=clampCabinPosition([dx*c-dz*s,position[1]-origin[1],dx*s+dz*c]);
 return [origin[0]+local[0]*c+local[2]*s,origin[1]+local[1],origin[2]-local[0]*s+local[2]*c];
}

export function skyshipFirstPersonView(position,yaw=0,pitch=0,standBlend=1,launchProgress=0){
 const y=Number.isFinite(yaw)?yaw:0,p=clamp(Number.isFinite(pitch)?pitch:0,-.75,.6),blend=clamp(Number.isFinite(standBlend)?standBlend:0,0,1),launch=clamp(Number.isFinite(launchProgress)?launchProgress:0,0,1),height=1.08+blend*.62+launch*.12;
 const eye=[position[0],position[1]+height,position[2]],forward=[-Math.sin(y)*Math.cos(p),Math.sin(p),-Math.cos(y)*Math.cos(p)];
 return {eye,target:[eye[0]+forward[0],eye[1]+forward[1],eye[2]+forward[2]],forward,height};
}

// Cabin geometry is anchored to the craft origin. Mouse yaw only changes the view.
export function cabinPoint(local,origin,yaw=0){
 const angle=Number.isFinite(yaw)?yaw:0,c=Math.cos(angle),s=Math.sin(angle),x=local[0],y=local[1],z=local[2];
 return [origin[0]+x*c+z*s,origin[1]+y,origin[2]-x*s+z*c];
}
