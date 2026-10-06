import * as THREE from 'three';
const size=48,pixels=new Uint8Array(size*size*4);
for(let y=0;y<size;y++)for(let x=0;x<size;x++){const r=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1),i=(y*size+x)*4;pixels[i+3]=Math.round(Math.max(0,1-r)**2*220);}
const shadowTexture=new THREE.DataTexture(pixels,size,size);shadowTexture.needsUpdate=true;
const shadowGeometry=new THREE.PlaneGeometry(1,1);
export function createContactShadow(width=1.8,depth=1.3){const mesh=new THREE.Mesh(shadowGeometry,new THREE.MeshBasicMaterial({color:0x061426,map:shadowTexture,transparent:true,opacity:.7,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));mesh.rotation.x=-Math.PI/2;mesh.scale.set(width,depth,1);mesh.renderOrder=1;mesh.userData.width=width;mesh.userData.depth=depth;return mesh;}
