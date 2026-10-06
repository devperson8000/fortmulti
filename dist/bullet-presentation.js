// Cosmetic paths terminate at the authoritative pellet endpoint. They never
// change raycasts, damage, spread, or network projectile physics.
export function createBulletTracer(start,end,color){
 const distance=Math.hypot(...end.map((v,i)=>v-start[i])),speed=Math.max(900,distance/.4),life=Math.max(.065,distance/speed+.025);
 return {a:start.slice(),b:end.slice(),life,maxLife:life,speed,col:color,tracer:true};
}
export function bulletTracerSegment(effect){
 const delta=effect.b.map((v,i)=>v-effect.a[i]),distance=Math.hypot(...delta),travel=Math.min(distance,Math.max(0,effect.maxLife-effect.life)*(effect.speed||900)),tail=Math.max(0,travel-1.5),at=d=>effect.a.map((v,i)=>v+delta[i]*d/(distance||1));
 return {tail:at(tail),head:at(travel)};
}
export function bulletVisualOrigin(eyeOrigin,displayedMuzzle,end,forward){
 if(!displayedMuzzle)return eyeOrigin;
 // Close cover can lie behind the cosmetic muzzle. Never draw a backwards
 // streak from a barrel that visually penetrates that cover.
 const advance=end.reduce((sum,v,i)=>sum+(v-displayedMuzzle[i])*forward[i],0);
 return advance>.01?displayedMuzzle:eyeOrigin;
}
