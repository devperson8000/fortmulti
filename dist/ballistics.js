const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;

export function createProjectile({id,owner,origin,direction,speed,gravity=0,range,damage,spawnTick=0,maxAge=3}){
 const dx=finite(direction?.[0]),dy=finite(direction?.[1]),dz=finite(direction?.[2],-1);
 const length=Math.hypot(dx,dy,dz)||1,velocitySpeed=Math.max(0,finite(speed));
 const position=[finite(origin?.[0]),finite(origin?.[1]),finite(origin?.[2])];
 return {
  id:String(id),owner,position,previous:position.slice(),
  velocity:[dx/length*velocitySpeed,dy/length*velocitySpeed,dz/length*velocitySpeed],
  gravity:Math.max(0,finite(gravity)),range:Math.max(0,finite(range)),damage:Math.max(0,finite(damage)),
  spawnTick:finite(spawnTick),maxAge:Math.max(.05,finite(maxAge,3)),distance:0,age:0,expired:false
 };
}

export function advanceProjectile(projectile,dt){
 const speed=Math.hypot(...projectile.velocity),remaining=Math.max(0,projectile.range-projectile.distance);
 const step=Math.min(.05,Math.max(0,finite(dt)),Math.max(0,projectile.maxAge-projectile.age),speed>0?remaining/speed:Infinity);
 projectile.previous[0]=projectile.position[0];
 projectile.previous[1]=projectile.position[1];
 projectile.previous[2]=projectile.position[2];
 const verticalSpeed=projectile.velocity[1],gravity=projectile.gravity;
 projectile.position[0]+=projectile.velocity[0]*step;
 projectile.position[1]+=verticalSpeed*step-.5*gravity*step*step;
 projectile.position[2]+=projectile.velocity[2]*step;
 projectile.velocity[1]=verticalSpeed-gravity*step;
 const moved=Math.hypot(
  projectile.position[0]-projectile.previous[0],
  projectile.position[1]-projectile.previous[1],
  projectile.position[2]-projectile.previous[2]
 );
 projectile.distance+=moved;
 projectile.age+=step;
 projectile.expired=projectile.distance>=projectile.range-1e-8||projectile.age>=projectile.maxAge-1e-8;
 return projectile;
}

export function segmentSphereTime(from,to,center,radius){
 const dx=to[0]-from[0],dy=to[1]-from[1],dz=to[2]-from[2];
 const fx=from[0]-center[0],fy=from[1]-center[1],fz=from[2]-center[2];
 const a=dx*dx+dy*dy+dz*dz,c=fx*fx+fy*fy+fz*fz-radius*radius;
 if(c<=0)return 0;
 if(a<1e-12)return null;
 const b=2*(fx*dx+fy*dy+fz*dz),discriminant=b*b-4*a*c;
 if(discriminant<0)return null;
 const root=Math.sqrt(discriminant),near=(-b-root)/(2*a),far=(-b+root)/(2*a);
 if(near>=0&&near<=1)return near;
 if(far>=0&&far<=1)return far;
 return null;
}

export function segmentAabbTime(from,to,min,max){
 let near=0,far=1;
 for(let axis=0;axis<3;axis++){
  const delta=to[axis]-from[axis];
  if(Math.abs(delta)<1e-12){if(from[axis]<min[axis]||from[axis]>max[axis])return null;continue;}
  let a=(min[axis]-from[axis])/delta,b=(max[axis]-from[axis])/delta;
  if(a>b)[a,b]=[b,a];
  near=Math.max(near,a);far=Math.min(far,b);
  if(near>far)return null;
 }
 return near>=0&&near<=1?near:null;
}
