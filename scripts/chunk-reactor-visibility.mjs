import {readFile,writeFile} from 'node:fs/promises';import {gunzipSync,gzipSync} from 'node:zlib';import {pathToFileURL} from 'node:url';
export function splitVisibility(indices,positions,cellSize=8){
 const groups=new Map();
 for(let i=0;i<indices.length;i+=3){const center=[0,0,0];for(let v=0;v<3;v++)for(let axis=0;axis<3;axis++)center[axis]+=positions[indices[i+v]*3+axis]/3;const key=center.map(n=>Math.floor(n/cellSize)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
 const result=new indices.constructor(indices.length),chunks=[];let cursor=0;
 for(const triangles of groups.values()){const start=cursor,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const triangle of triangles)for(let v=0;v<3;v++){const index=indices[triangle+v];result[cursor++]=index;for(let axis=0;axis<3;axis++){const value=positions[index*3+axis];min[axis]=Math.min(min[axis],value);max[axis]=Math.max(max[axis],value);}}chunks.push({start,count:cursor-start,min,span:max.map((value,i)=>value-min[i])});}
 return {indices:result,chunks};
}
export async function chunkReactorVisibility(directory){
 const manifest=JSON.parse(await readFile(directory+'/environment.json','utf8'));if(manifest.visibilityChunks)return {alreadyChunked:true};const binary=gunzipSync(await readFile(directory+'/geometry.bin.gz'));let count=0;
 for(const model of manifest.models)for(const primitives of model.meshes)for(const p of primitives){const packed=new Uint16Array(binary.buffer,binary.byteOffset+p.position.offset,p.position.length),positions=Float32Array.from(packed,(n,i)=>p.min[i%3]+n/65535*p.span[i%3]);
 for(const description of [p.index,...p.lods]){const Type=(description.indexType??p.indexType)===16?Uint16Array:Uint32Array,source=new Type(binary.buffer,binary.byteOffset+description.offset,description.length),split=splitVisibility(source,positions);source.set(split.indices);description.chunks=split.chunks;count+=split.chunks.length;}}
 manifest.visibilityChunks=true;await writeFile(directory+'/environment.json',JSON.stringify(manifest));await writeFile(directory+'/geometry.bin.gz',gzipSync(binary,{level:9}));return {visibilityChunks:count};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(await chunkReactorVisibility(process.argv[2]||'public/maps/reactor'));
