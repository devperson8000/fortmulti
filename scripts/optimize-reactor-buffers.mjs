import {MeshoptEncoder} from 'meshoptimizer';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';

// Preserve every triangle and attribute; only change storage and submission order.
export function reorderPrimitive(streams,indices,lods=[]){
 const reordered=Uint32Array.from(indices),[remap,count]=MeshoptEncoder.reorderMesh(reordered,true,false);
 const attributes=streams.map(({array,size})=>{const result=new array.constructor(count*size);for(let old=0;old<remap.length;old++)if(remap[old]!==0xffffffff)for(let axis=0;axis<size;axis++)result[remap[old]*size+axis]=array[old*size+axis];return result;});
 const levels=lods.map(source=>{
  const result=Uint32Array.from(source,index=>remap[index]);
  // Optimize triangle order while keeping this level in the shared vertex pool.
  const [local]=MeshoptEncoder.reorderMesh(result,true,false),inverse=new Uint32Array(local.length);
  for(let old=0;old<local.length;old++)if(local[old]!==0xffffffff)inverse[local[old]]=old;
  for(let i=0;i<result.length;i++)result[i]=inverse[result[i]];
  return result;
 });
 return {attributes,indices:reordered,lods:levels};
}
export async function optimizeReactorBuffers(directory){
 await MeshoptEncoder.ready;
 const manifest=JSON.parse(await readFile(directory+'/environment.json','utf8'));
 if(manifest.cacheOptimized)return {alreadyOptimized:true};
 const binary=gunzipSync(await readFile(directory+'/geometry.bin.gz')),chunks=[];let offset=0;
 const pack=array=>{const pad=(-offset)&3;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}const result={offset,length:array.length};chunks.push(Buffer.from(array.buffer,array.byteOffset,array.byteLength));offset+=array.byteLength;return result;};
 for(const model of manifest.models)for(const primitives of model.meshes)for(const primitive of primitives){
  const read=(description,Type)=>new Type(binary.buffer,binary.byteOffset+description.offset,description.length);
  const streams=[{array:read(primitive.position,Uint16Array),size:3},{array:read(primitive.normal,Int16Array),size:3},{array:read(primitive.uv,Float32Array),size:2}];
  const readIndex=description=>read(description,(description.indexType??primitive.indexType)===16?Uint16Array:Uint32Array);
  const optimized=reorderPrimitive(streams,readIndex(primitive.index),(primitive.lods||[]).map(readIndex));
  for(const [i,key] of ['position','normal','uv'].entries())primitive[key]=pack(optimized.attributes[i]);
  primitive.index=pack(primitive.indexType===16?Uint16Array.from(optimized.indices):optimized.indices);
  primitive.lods=(primitive.lods||[]).map((level,i)=>({...level,...pack(level.indexType===16?Uint16Array.from(optimized.lods[i]):optimized.lods[i])}));
 }
 manifest.cacheOptimized=true;const packed=gzipSync(Buffer.concat(chunks),{level:9});
 await writeFile(directory+'/geometry.bin.gz',packed);await writeFile(directory+'/environment.json',JSON.stringify(manifest));return {beforeBytes:binary.length,geometryBytes:offset,downloadBytes:packed.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(await optimizeReactorBuffers(process.argv[2]||'public/maps/reactor'));
