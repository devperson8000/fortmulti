import * as THREE from 'three';
import {facilityDetailLevel} from './facility-detail.js';


/** Authored Godot TPS facility, offline indexed material chunks with tight spatial bounds. */
export function createReactorEnvironment(scene,{baseUrl='/maps/reactor/',offsetY=8,chunkSize=32,maxDistance=90,lodDistances=null}={}){
 const group=new THREE.Group();group.name='Godot TPS reactor facility';group.position.y=offsetY;scene?.add(group);
 const batches=[],geometries=[],materials=[],textures=[],loader=new THREE.TextureLoader();
 const textureCache=new Map();
 const texture=(name,color=false)=>{
  const key=name+color;if(textureCache.has(key))return textureCache.get(key);
  const promise=loader.loadAsync(baseUrl+'textures/'+name).then(t=>{t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=handle.quality==='low'?1:4;textures.push(t);return t;});textureCache.set(key,promise);return promise;
 };
 const frustum=new THREE.Frustum(),viewProjection=new THREE.Matrix4(),cameraPosition=new THREE.Vector3(),lastGroupMatrix=new THREE.Matrix4();let boundsReady=false;
 const handle={group,ready:null,quality:'high',setQuality(value){if(this.quality===value)return;this.quality=value;for(const t of textures){t.anisotropy=value==='low'?1:value==='medium'?2:4;t.needsUpdate=true;}for(const batch of batches)batch.material=value==='low'?batch.userData.simpleMaterial:value==='medium'?batch.userData.mediumMaterial:batch.userData.standardMaterial;},stats:{batches:0,instances:0,triangles:0,visibleBatches:0,visibleTriangles:0,indexUploads:0},update(camera,time=0){
  group.userData.time=time;if(!camera)return;group.updateMatrixWorld(true);camera.updateMatrixWorld(true);cameraPosition.setFromMatrixPosition(camera.matrixWorld);frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const boundsChanged=!boundsReady||!lastGroupMatrix.equals(group.matrixWorld);if(boundsChanged){lastGroupMatrix.copy(group.matrixWorld);boundsReady=true;}
  let visibleBatches=0,visibleTriangles=0;
  for(const batch of batches){const {chunks,indexAttribute}=batch.userData;let changed=false,nearest=Infinity;
   for(const chunk of chunks){if(boundsChanged)chunk.worldBox.copy(chunk.localBox).applyMatrix4(group.matrixWorld);const distance=chunk.worldBox.distanceToPoint(cameraPosition),visible=distance<=maxDistance&&frustum.intersectsBox(chunk.worldBox),level=facilityDetailLevel(distance,handle.quality,chunk.selection,lodDistances??undefined),selection=visible?Math.min(level,chunk.lods.length-1):-1;chunk.distance=distance;if(selection!==chunk.selection){chunk.selection=selection;changed=true;}if(visible&&distance<nearest)nearest=distance;for(let level=0;level<chunk.parts.length;level++)for(const part of chunk.parts[level]){if(boundsChanged)part.worldBox.copy(part.localBox).applyMatrix4(group.matrixWorld);const selected=selection===level&&frustum.intersectsBox(part.worldBox);if(selected!==part.selected){part.selected=selected;changed=true;}}}
   if(changed){chunks.sort((a,b)=>a.distance-b.distance);let count=0;for(const chunk of chunks)if(chunk.selection>=0){for(const part of chunk.parts[chunk.selection])if(part.selected){indexAttribute.array.set(part.indices,count);count+=part.indices.length;}}batch.geometry.setDrawRange(0,count);batch.visible=count>0;if(count){const range=batch.userData.updateRange;range.count=count;indexAttribute.updateRanges.length=0;indexAttribute.updateRanges.push(range);indexAttribute.needsUpdate=true;handle.stats.indexUploads++;}}
   batch.material=handle.quality==='low'?batch.userData.simpleMaterial:handle.quality==='medium'?batch.userData.mediumMaterial:batch.userData.standardMaterial;
   // Resolve nearby opaque surfaces first so hidden fragments fail early depth tests.
   batch.renderOrder=batch.material.transparent?0:Math.floor(nearest/8);
   if(batch.visible&&batch.geometry.drawRange.count){visibleBatches++;visibleTriangles+=batch.geometry.drawRange.count/3;}
  }
  handle.stats.visibleBatches=visibleBatches;handle.stats.visibleTriangles=visibleTriangles;
 },setVisible(visible){group.visible=Boolean(visible);},dispose(){group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}};
 handle.ready=(async()=>{
  const [manifest,binary]=await Promise.all([fetch(baseUrl+'environment.json').then(r=>{if(!r.ok)throw Error('Reactor manifest '+r.status);return r.json();}),fetch(baseUrl+'geometry.bin.gz').then(r=>{if(!r.ok)throw Error('Reactor geometry '+r.status);return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();})]);
  const byMaterial=new Map();
  await Promise.all(Object.entries(manifest.materials).map(async([name,spec])=>{
   const options={name,metalness:spec.metalness,roughness:spec.roughness,side:spec.doubleSided?THREE.DoubleSide:THREE.FrontSide,normalScale:new THREE.Vector2(spec.normalScale??1,spec.normalScale??1)};
   if(spec.color){options.color=new THREE.Color().setRGB(...spec.color.slice(0,3));options.opacity=spec.color[3]??1;}
   if(spec.transparent){options.transparent=true;options.depthWrite=false;}
   if(spec.emissive){options.emissive=new THREE.Color().setRGB(...spec.emissive.slice(0,3));options.emissiveIntensity=spec.emissiveIntensity??1;}
   await Promise.all(['map','normalMap','metalnessMap','roughnessMap','aoMap','emissiveMap'].map(async k=>{if(spec[k])options[k]=await texture(spec[k],k==='map'||k==='emissiveMap');}));
   const material=new THREE.MeshStandardMaterial(options),simple=new THREE.MeshLambertMaterial({name:name+' low',color:material.color,map:material.map,emissive:material.emissive,emissiveIntensity:material.emissiveIntensity,emissiveMap:material.emissiveMap,aoMap:material.aoMap,transparent:material.transparent,opacity:material.opacity,side:material.side,depthWrite:material.depthWrite});const medium=new THREE.MeshPhongMaterial({name:name+' medium',color:material.color,map:material.map,normalMap:material.normalMap,normalScale:material.normalScale,aoMap:material.aoMap,emissive:material.emissive,emissiveIntensity:material.emissiveIntensity,emissiveMap:material.emissiveMap,specular:new THREE.Color(0x303030).lerp(material.color,material.metalness*.65),shininess:4+44*(1-material.roughness)**2,transparent:material.transparent,opacity:material.opacity,side:material.side,depthWrite:material.depthWrite});for(const m of [material,simple,medium])m.forceSinglePass=true;material.userData.simple=simple;material.userData.medium=medium;materials.push(material,simple,medium);byMaterial.set(name,material);
  }));
  const fallback=new THREE.MeshStandardMaterial({color:0x76818a,metalness:.5,roughness:.7});const fallbackSimple=new THREE.MeshLambertMaterial({color:0x76818a});fallback.userData.simple=fallbackSimple;fallback.userData.medium=fallbackSimple;materials.push(fallback,fallbackSimple);
  // The shipped scene is flattened into authored material/spatial chunks. Decode
  // directly into one vertex buffer per material; only indices change with visibility.
  if(!manifest.spatialChunks)throw Error('Rebuild reactor assets into spatial chunks');
  const materialGroups=new Map();
  for(const model of manifest.models)for(const primitives of model.meshes)for(const primitive of primitives){
   const material=byMaterial.get(primitive.material)||fallback;
   if(!materialGroups.has(material))materialGroups.set(material,{material,primitives:[],vertices:0,indices:0});
   const entry=materialGroups.get(material);entry.primitives.push(primitive);entry.vertices+=primitive.position.length/3;entry.indices+=primitive.index.length;
  }
  for(const {material,primitives,vertices,indices} of materialGroups.values()){
   const positions=new Float32Array(vertices*3),normals=new Int16Array(vertices*3),uvs=new Float32Array(vertices*2),dynamicIndices=new Uint32Array(indices),chunks=[];
   let vertexOffset=0;
   for(const primitive of primitives){
    const packed=new Uint16Array(binary,primitive.position.offset,primitive.position.length),normal=new Int16Array(binary,primitive.normal.offset,primitive.normal.length),uv=new Float32Array(binary,primitive.uv.offset,primitive.uv.length);
    for(let i=0;i<packed.length;i++)positions[vertexOffset*3+i]=primitive.min[i%3]+packed[i]/65535*primitive.span[i%3];normals.set(normal,vertexOffset*3);uvs.set(uv,vertexOffset*2);
    const lods=[primitive.index,...(primitive.lods||[])].map((description,index)=>{
     const source=new (index===0?primitive.indexType===16?Uint16Array:Uint32Array:description.indexType===16?Uint16Array:Uint32Array)(binary,description.offset,description.length),rebased=new Uint32Array(source.length);
     for(let i=0;i<source.length;i++)rebased[i]=source[i]+vertexOffset;return rebased;
    });
    const localBox=new THREE.Box3(new THREE.Vector3(...primitive.min),new THREE.Vector3(...primitive.min).add(new THREE.Vector3(...primitive.span)));
    const parts=[primitive.index,...(primitive.lods||[])].map((description,level)=>(description.chunks||[{start:0,count:description.length,min:primitive.min,span:primitive.span}]).map(part=>{const box=new THREE.Box3(new THREE.Vector3(...part.min),new THREE.Vector3(...part.min).add(new THREE.Vector3(...part.span)));return {localBox:box,worldBox:box.clone(),indices:lods[level].subarray(part.start,part.start+part.count),selected:false};}));
    chunks.push({localBox,worldBox:localBox.clone(),lods,parts,selection:-2});vertexOffset+=packed.length/3;
   }
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3,true));const uv=new THREE.BufferAttribute(uvs,2);geometry.setAttribute('uv',uv);geometry.setAttribute('uv1',uv);
   const indexAttribute=new THREE.BufferAttribute(dynamicIndices,1).setUsage(THREE.DynamicDrawUsage);geometry.setIndex(indexAttribute);geometry.setDrawRange(0,0);geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries.push(geometry);
   const batch=new THREE.Mesh(geometry,material);batch.name='Reactor material '+material.name;batch.frustumCulled=false;batch.userData.standardMaterial=material;batch.userData.simpleMaterial=material.userData.simple;batch.userData.mediumMaterial=material.userData.medium;batch.userData.chunks=chunks;batch.userData.indexAttribute=indexAttribute;batch.userData.updateRange={start:0,count:0};
   group.add(batch);batches.push(batch);handle.stats.instances+=chunks.length;handle.stats.triangles+=indices/3;
  }
  handle.stats.batches=group.children.length;group.updateMatrixWorld(true);return handle;
 })();return handle;
}
