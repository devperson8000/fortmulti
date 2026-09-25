const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// A small client-side orbit camera keeps the moving transport in view while
// mouse yaw and pitch remain independent from the server-owned player pose.
export function busOrbitCamera(bus={},yaw=0,pitch=-.12,distance=19.5){
 const angle=Number.isFinite(yaw)?yaw:0,elevation=clamp(Number.isFinite(pitch)?pitch:-.12,-.58,.52),radius=clamp(Number.isFinite(distance)?distance:19.5,14,26),cosPitch=Math.cos(elevation);
 const target=[Number(bus.x)||0,(Number(bus.y)||0)+2.6,Number(bus.z)||0],forward=[-Math.sin(angle)*cosPitch,Math.sin(elevation),-Math.cos(angle)*cosPitch];
 return {target,forward,eye:[target[0]-forward[0]*radius,target[1]-forward[1]*radius,target[2]-forward[2]*radius]};
}
