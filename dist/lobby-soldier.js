const MAGIC='HSLD';

async function gunzip(bytes){
 if(typeof DecompressionStream!=='function')throw new Error('This browser does not support the lobby model decoder.');
 const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
 return new Uint8Array(await new Response(stream).arrayBuffer());
}
function decode(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let magic='';for(let i=0;i<4;i++)magic+=String.fromCharCode(view.getUint8(i));
 if(magic!==MAGIC)throw new Error('Invalid Horizon lobby soldier asset.');
 const count=view.getUint32(4,true),mins=[view.getFloat32(8,true),view.getFloat32(12,true),view.getFloat32(16,true)],spans=[view.getFloat32(20,true),view.getFloat32(24,true),view.getFloat32(28,true)];
 const positions=new Float32Array(count*9),colors=new Float32Array(count*3);let offset=32;
 for(let triangle=0;triangle<count;triangle++){
  const p=triangle*9,c=triangle*3;
  for(let vertex=0;vertex<3;vertex++)for(let axis=0;axis<3;axis++)positions[p+vertex*3+axis]=mins[axis]+view.getUint16(offset,true)/65535*spans[axis],offset+=2;
  colors[c]=view.getUint8(offset++)/255;colors[c+1]=view.getUint8(offset++)/255;colors[c+2]=view.getUint8(offset++)/255;
 }
 return Object.freeze({count,positions,colors});
}
export async function loadLobbySoldier(){
 const response=await fetch(new URL('./soldier-lobby.bin.gz',import.meta.url),{cache:'force-cache'});
 if(!response.ok)throw new Error('Could not load the Horizon soldier.');
 return decode(await gunzip(new Uint8Array(await response.arrayBuffer())));
}
