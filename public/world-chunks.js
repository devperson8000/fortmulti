// Reorder immutable world triangles once; gameplay collision geometry stays unchanged.
export function createWorldChunks(vertices,cellSize=48){const buckets=new Map();for(let i=0;i<vertices.length;i+=18){const x=(vertices[i]+vertices[i+6]+vertices[i+12])/3,z=(vertices[i+2]+vertices[i+8]+vertices[i+14])/3,key=`${Math.floor(x/cellSize)},${Math.floor(z/cellSize)}`;let bucket=buckets.get(key);if(!bucket)buckets.set(key,bucket=[]);bucket.push(i);}const data=new Float32Array(vertices.length),chunks=[];let offset=0;for(const bucket of buckets.values()){const chunk={start:offset/6,count:bucket.length*3,min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(const i of bucket){for(let j=0;j<18;j++)data[offset+j]=vertices[i+j];for(let j=0;j<18;j+=6)for(let a=0;a<3;a++){chunk.min[a]=Math.min(chunk.min[a],vertices[i+j+a]);chunk.max[a]=Math.max(chunk.max[a],vertices[i+j+a]);}offset+=18;}chunks.push(chunk);}return {data,chunks};}
export function updateFrustum(out,m){for(let axis=0;axis<3;axis++)for(let side=0;side<2;side++){const sign=side?1:-1,offset=(axis*2+side)*4;for(let component=0;component<4;component++)out[offset+component]=m[component*4+3]+sign*m[component*4+axis];}return out;}
export function chunkVisible(chunk,planes){for(let i=0;i<24;i+=4){const x=planes[i]>=0?chunk.max[0]:chunk.min[0],y=planes[i+1]>=0?chunk.max[1]:chunk.min[1],z=planes[i+2]>=0?chunk.max[2]:chunk.min[2];if(planes[i]*x+planes[i+1]*y+planes[i+2]*z+planes[i+3]<-.001)return false;}return true;}
// Keep the static upload and coalesce contiguous live ranges. Harvesting one
// tree creates a gap without redrawing its invisible mesh or rebuilding buffers.
export function drawVisibleResources(ranges,hp,eye,distance,draw){
 let start=-1,count=0;const squared=distance*distance;
 for(const range of ranges){
  const visible=(hp.get(range.id)??100)>0&&(range.x-eye[0])**2+(range.z-eye[2])**2<squared;
  if(visible){if(start>=0&&start+count===range.start)count+=range.count;else{if(start>=0)draw(start,count);start=range.start;count=range.count;}}
  else if(start>=0){draw(start,count);start=-1;count=0;}
 }
 if(start>=0)draw(start,count);
}
