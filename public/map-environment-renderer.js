import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ENVIRONMENT_MODELS,environmentPlacements} from './map-environment.js';

// Draw Kenney's CC0 meshes as instanced batches, not hundreds of separate
// Three.js draw calls. The existing heightfield, collision and harvesting
// state remain authoritative. If a GLB fails to load, the raw engine retains
// its original procedural resource geometry.
export class MapEnvironmentRenderer{
 constructor(scene,{base='/models/environment/'}={}){
  this.root=new THREE.Group();this.root.name='Kenney CC0 island environment';scene.add(this.root);
  this.models=new Map();this.placements=null;this.kinds=new Set();this.batches=new Map();
  const loader=new GLTFLoader();
  for(const name of new Set(Object.values(ENVIRONMENT_MODELS).flat()))
   loader.load(base+name+'.glb',gltf=>{this.models.set(name,gltf.scene);this.install();},undefined,
    error=>console.warn('Horizon retains fallback terrain prop for '+name,error));
 }
 setResources(resources){
  this.placements=environmentPlacements(resources);
  this.install();
 }
 readyKind(kind){return this.kinds.has(kind);}
 install(){
  if(!this.placements)return;
  const up=new THREE.Vector3(0,1,0),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion(),matrix=new THREE.Matrix4();
  for(const [kind,names]of Object.entries(ENVIRONMENT_MODELS)){
   if(this.kinds.has(kind)||!names.every(name=>this.models.has(name)))continue;
   const batches=[];
   for(const name of names){
    const source=this.models.get(name);source.updateMatrixWorld(true);
    const places=this.placements.filter(p=>p.kind===kind&&p.name===name);
    if(!places.length)continue;
    const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3());
    if(!Number.isFinite(size.y)||size.y<=.0001)continue;
    const transforms=places.map(place=>{
     const ratio=place.height/size.y;
     position.set(place.x,place.y-bounds.min.y*ratio,place.z);
     rotation.setFromAxisAngle(up,place.rotation);
     scale.setScalar(ratio);return matrix.compose(position,rotation,scale).clone();
    });
    const meshes=[];
    source.traverse(part=>{
     if(!part.isMesh||!part.geometry)return;
     // Preserve the GLB hierarchy transforms, then batch identical shapes.
     const geometry=part.geometry.clone().applyMatrix4(part.matrixWorld);
     const material=(Array.isArray(part.material)?part.material.map(m=>m.clone()):part.material.clone());
     for(const m of Array.isArray(material)?material:[material]){if('metalness'in m)m.metalness=0;if('roughness'in m)m.roughness=1;}
     const mesh=new THREE.InstancedMesh(geometry,material,transforms.length);
     mesh.name='Kenney '+name;
     mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;
     mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
     transforms.forEach((transform,index)=>mesh.setMatrixAt(index,transform));
     mesh.instanceMatrix.needsUpdate=true;
     this.root.add(mesh);meshes.push(mesh);
    });
    if(meshes.length)batches.push({name,places,meshes,transforms,alive:places.map(()=>true)});
   }
   // Never suppress procedural fallback until every source model is ready.
   if(batches.length){this.batches.set(kind,batches);this.kinds.add(kind);}
  }
 }
 update(resourceHP){
  for(const groups of this.batches.values())for(const batch of groups)
   for(let i=0;i<batch.places.length;i++){
    const alive=(resourceHP?.get(batch.places[i].id)??100)>0;
    if(alive===batch.alive[i])continue;
    batch.alive[i]=alive;
    for(const mesh of batch.meshes){
     mesh.setMatrixAt(i,alive?batch.transforms[i]:new THREE.Matrix4().makeScale(0,0,0));
     mesh.instanceMatrix.needsUpdate=true;
    }
   }
 }
 getStats(){return {readyKinds:[...this.kinds],count:[...this.batches.values()].flat().reduce((sum,b)=>sum+b.places.length,0),drawBatches:[...this.batches.values()].flat().reduce((sum,b)=>sum+b.meshes.length,0)};}
}
