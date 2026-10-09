// Native brushes are intersections of outward halfspaces n·p <= d.
// Their bounds are a broad phase only: tilted faces leave large empty corners.
const EPS=1e-8;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const cache=new WeakMap();
function boxPlanes(b){return [[1,0,0,b.max[0]],[-1,0,0,-b.min[0]],[0,1,0,b.max[1]],[0,-1,0,-b.min[1]],[0,0,1,b.max[2]],[0,0,-1,-b.min[2]]];}
function rayInterval(origin,direction,planes,near=0,far=Infinity){
 for(const p of planes){const distance=p[3]-dot(p,origin),speed=dot(p,direction);
  if(Math.abs(speed)<1e-12){if(distance<-EPS)return null;continue;}
  const t=distance/speed;if(speed<0)near=Math.max(near,t);else far=Math.min(far,t);
  if(near>far+EPS)return null;
 }
 return [near,far];
}
export function rayCollider(origin,direction,shape){
 // Reject distant boxes without allocating six plane arrays per camera/bullet ray.
 let near=0,far=Infinity;
 for(let axis=0;axis<3;axis++){
  const speed=direction[axis],point=origin[axis];
  if(Math.abs(speed)<1e-12){if(point<shape.min[axis]-EPS||point>shape.max[axis]+EPS)return Infinity;continue;}
  let enter=(shape.min[axis]-point)/speed,leave=(shape.max[axis]-point)/speed;if(enter>leave)[enter,leave]=[leave,enter];
  near=Math.max(near,enter);far=Math.min(far,leave);if(near>far+EPS)return Infinity;
 }
 if(!shape.planes?.length)return near;
 const hit=rayInterval(origin,direction,shape.planes,near,far);
 return hit?Math.max(0,hit[0]):Infinity;
}
export function segmentColliderTime(from,to,shape){
 const direction=to.map((v,i)=>v-from[i]),hit=rayCollider(from,direction,shape);
 return hit<=1+EPS?Math.min(1,hit):null;
}
function geometry(shape){
 const cached=cache.get(shape.planes);if(cached)return cached;
 const planes=[...shape.planes,...boxPlanes(shape)],vertices=[];
 for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){
  const a=planes[i],b=planes[j],c=planes[k],bc=cross(b,c),det=dot(a,bc);if(Math.abs(det)<1e-10)continue;
  const ca=cross(c,a),ab=cross(a,b),v=bc.map((n,m)=>(n*a[3]+ca[m]*b[3]+ab[m]*c[3])/det);
  if(planes.every(p=>dot(p,v)<=p[3]+1e-6)&&!vertices.some(w=>Math.hypot(...v.map((n,m)=>n-w[m]))<1e-6))vertices.push(v);
 }
 const axes=[];
 function addAxis(a){const length=Math.hypot(...a);if(length<1e-9)return;const n=a.map(v=>v/length);if(!axes.some(v=>Math.abs(dot(n,v))>1-1e-8))axes.push(n);}
 for(const p of planes)addAxis(p.slice(0,3));
 // Only vertex pairs on two common faces are brush edges. Edge × box-axis
 // normals complete SAT; expanding only face planes is conservative at corners.
 for(let i=0;i<vertices.length;i++)for(let j=i+1;j<vertices.length;j++){
  const a=vertices[i],b=vertices[j];if(planes.filter(p=>Math.abs(dot(p,a)-p[3])<1e-6&&Math.abs(dot(p,b)-p[3])<1e-6).length<2)continue;
  const edge=b.map((v,k)=>v-a[k]);for(const axis of [[1,0,0],[0,1,0],[0,0,1]])addAxis(cross(edge,axis));
 }
 const result=axes.map(axis=>({axis,min:Math.min(...vertices.map(v=>dot(axis,v))),max:Math.max(...vertices.map(v=>dot(axis,v)))}));
 cache.set(shape.planes,result);return result;
}
function projection(bounds,axis){let min=0,max=0;for(let i=0;i<3;i++){min+=axis[i]*(axis[i]<0?bounds.max[i]:bounds.min[i]);max+=axis[i]*(axis[i]<0?bounds.min[i]:bounds.max[i]);}return [min,max];}
export function boundsIntersectCollider(bounds,shape){
 if(!bounds.min.every((v,i)=>v<shape.max[i]-EPS&&bounds.max[i]>shape.min[i]+EPS))return false;
 if(!shape.planes?.length)return true;
 return geometry(shape).every(({axis,min,max})=>{const [lo,hi]=projection(bounds,axis);return hi>min+EPS&&lo<max-EPS;});
}
export function sweepBoundsCollider(bounds,delta,shape){
 const swept={min:bounds.min.map((v,i)=>Math.min(v,v+delta[i])),max:bounds.max.map((v,i)=>Math.max(v,v+delta[i]))};
 if(!swept.min.every((v,i)=>v<shape.max[i]+EPS&&swept.max[i]>shape.min[i]-EPS))return null;
 const axes=shape.planes?.length?geometry(shape):[[1,0,0],[0,1,0],[0,0,1]].map((axis,i)=>({axis,min:shape.min[i],max:shape.max[i]}));
 let near=-Infinity,far=Infinity;
 for(const {axis,min,max} of axes){const [lo,hi]=projection(bounds,axis),speed=dot(axis,delta);
  if(Math.abs(speed)<1e-12){if(hi<=min+EPS||lo>=max-EPS)return null;continue;}
  let enter=(min-hi)/speed,leave=(max-lo)/speed;if(enter>leave)[enter,leave]=[leave,enter];
  near=Math.max(near,enter);far=Math.min(far,leave);if(near>far+EPS)return null;
 }
 // Preserve legacy behavior for already embedded players, and let touching
 // players move away from a wall rather than pinning them to the contact.
 return near>=-EPS&&near<=1&&far>EPS?Math.max(0,near):null;
}
export function nativeSupportHeight(shape,x,z,footY,maxRise=.38){
 if(x<shape.min[0]-EPS||x>shape.max[0]+EPS||z<shape.min[2]-EPS||z>shape.max[2]+EPS)return null;
 if(!shape.planes?.length)return shape.max[1]<=footY+maxRise+EPS?shape.max[1]:null;
 let bottom=shape.min[1],top=shape.max[1],walkable=false;
 for(const p of shape.planes){const remainder=p[3]-p[0]*x-p[2]*z;
  if(Math.abs(p[1])<1e-12){if(remainder<-EPS)return null;continue;}
  const y=remainder/p[1];if(p[1]<0)bottom=Math.max(bottom,y);else if(y<top+EPS){if(y<top-EPS)walkable=false;top=Math.min(top,y);if(p[1]/Math.hypot(p[0],p[1],p[2])>=.55)walkable=true;}
 }
 return walkable&&top>=bottom-EPS&&top<=footY+maxRise+EPS?top:null;
}

// Curved source patches remain their tessellated triangles. A thin symmetric
// prism gives their two-sided surface a volume for the same SAT/body sweeps as
// brushes, without substituting the patch's large enclosing bounding box.
export function patchColliders(patches,thickness=.01){
 const result=[],half=Math.max(1e-5,thickness/2);
 for(const patch of patches||[]){
  if(patch.blocksShots===false||patch.type==='nonsolid')continue;
  const positions=patch.positions||[];
  for(let offset=0;offset+8<positions.length;offset+=9){
   const vertices=[positions.slice(offset,offset+3),positions.slice(offset+3,offset+6),positions.slice(offset+6,offset+9)];
   if(!vertices.flat().every(Number.isFinite))continue;
   const [a,b,c]=vertices,ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]),normal=cross(ab,ac),length=Math.hypot(...normal);
   if(length<1e-10)continue;
   const n=normal.map(v=>v/length),distance=dot(n,a),planes=[[...n,distance+half],[...n.map(v=>-v),-distance+half]];
   for(let edge=0;edge<3;edge++){
    const start=vertices[edge],end=vertices[(edge+1)%3],outward=cross(end.map((v,i)=>v-start[i]),n),scale=Math.hypot(...outward),axis=outward.map(v=>v/scale);
    planes.push([...axis,dot(axis,start)]);
   }
   result.push({source:patch.source,patchTriangle:offset/9,flags:patch.flags,type:'solid',blocksShots:true,supportOnlyNative:true,
    min:[0,1,2].map(i=>Math.min(...vertices.map(v=>v[i]))-Math.abs(n[i])*half),
    max:[0,1,2].map(i=>Math.max(...vertices.map(v=>v[i]))+Math.abs(n[i])*half),planes});
  }
 }
 return result;
}
