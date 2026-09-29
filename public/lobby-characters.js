import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';

const canvas=document.getElementById('lobby-characters');
if(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
 renderer.setClearColor(0x000000,0);
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=.9;

 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(37.815,1,.15,100);
 scene.add(new THREE.HemisphereLight(0xbdeaff,0x1d2730,2.1));
 const key=new THREE.DirectionalLight(0xfff2d8,4.2);key.position.set(-3.5,7,7);scene.add(key);
 const rim=new THREE.DirectionalLight(0x70d9ff,2.4);rim.position.set(5,4,-4);scene.add(rim);
 const fill=new THREE.DirectionalLight(0x9bbdff,1.25);fill.position.set(-5,2,1);scene.add(fill);

 const regularSpots=[[0,.1,2.15],[-2.8,.03,.45],[2.8,.03,.45],[-5.05,-.02,-.95],[5.05,-.02,-.95],[-7,-.06,-2.15],[7,-.06,-2.15],[0,-.06,-2.5]];
 const instances=new Map(),clock=new THREE.Clock();
 let template=null,idleClip=null,started=false;

 function setCamera(preview,width,height){
  camera.aspect=width/Math.max(1,height);
  if(preview){camera.fov=.54*180/Math.PI;camera.position.set(.62,2.08,6.25);camera.lookAt(.62,1.16,0);}
  else{camera.fov=.66*180/Math.PI;camera.position.set(0,3.45,9.4);camera.lookAt(0,1.28,.8);}
  camera.updateProjectionMatrix();
 }
 function disposeInstance(instance){instance.mixer.stopAllAction();scene.remove(instance.holder);}
 function createInstance(member,index){
  const model=cloneSkinned(template),holder=new THREE.Group();
  model.traverse(object=>{if(object.isMesh){object.frustumCulled=false;object.castShadow=false;object.receiveShadow=false;}});
  holder.add(model);scene.add(holder);
  const mixer=new THREE.AnimationMixer(model),action=mixer.clipAction(idleClip);action.reset().play();
  const phase=(index*.91+(String(member.id||'').length*.37))%(idleClip.duration||1);action.time=phase;
  return {id:member.id,holder,model,mixer,phase,slot:index};
 }
 function ensureInstances(party){
  const active=new Set();
  party.forEach((member,index)=>{
   if(!member||index>=8)return;
   const id=String(member.id||('slot-'+index));active.add(id);
   let instance=instances.get(id);
   if(!instance){instance=createInstance({...member,id},index);instances.set(id,instance);}
   instance.slot=index;
  });
  for(const [id,instance] of instances)if(!active.has(id)){disposeInstance(instance);instances.delete(id);}
 }
 function poseInstances(party,preview,time){
  for(const instance of instances.values()){
   const index=instance.slot,local=index===0;
   instance.holder.visible=preview?local:index<party.length;
   if(!instance.holder.visible)continue;
   const base=preview?[.78,.06,0]:regularSpots[index];
   const scale=preview?1.78:(local?1.62:1.46);
   const drift=Math.sin(time*.85+instance.phase)*.012;
   instance.holder.position.set(base[0],base[1]+drift,base[2]);
   instance.holder.scale.setScalar(scale);
   // Object3D.lookAt points +Z at the target, while Soldier.glb's chest/front faces -Z.
   // Aim at the lobby camera, then flip 180° so the soldier's FACE/CHEST points at the camera.
   instance.holder.lookAt(camera.position.x,instance.holder.position.y,camera.position.z);
   instance.holder.rotateY(Math.PI);
   instance.model.rotation.z=Math.sin(time*.52+instance.phase)*.008;
  }
 }
 function resize(){
  const lobby=document.getElementById('lobby'),width=lobby?.clientWidth||innerWidth,height=lobby?.clientHeight||innerHeight;
  const pixelRatio=Math.min(window.devicePixelRatio||1,1.5),rw=Math.max(1,Math.round(width*pixelRatio)),rh=Math.max(1,Math.round(height*pixelRatio));
  if(canvas.width!==rw||canvas.height!==rh){renderer.setPixelRatio(pixelRatio);renderer.setSize(width,height,false);}
  return [width,height];
 }
 function frame(){
  requestAnimationFrame(frame);
  const party=Array.isArray(window.Duel?.party)?window.Duel.party:[];
  ensureInstances(party);
  const preview=Boolean(window.Duel?.characterPreview),[width,height]=resize();setCamera(preview,width,height);
  const dt=Math.min(clock.getDelta(),.05),time=performance.now()/1000;
  for(const instance of instances.values())instance.mixer.update(dt);
  poseInstances(party,preview,time);
  renderer.render(scene,camera);
 }
 new GLTFLoader().load(
  'https://raw.githubusercontent.com/mrdoob/three.js/ec28dfc233171c29a0c95a75ecebf23bf0de5794/examples/models/gltf/Soldier.glb',
  gltf=>{
   template=gltf.scene;idleClip=gltf.animations.find(clip=>clip.name==='Idle')||gltf.animations[0];
   if(!idleClip){console.error('Horizon lobby Soldier is missing its Idle animation.');return;}
   if(!started){started=true;frame();}
  },
  undefined,
  error=>console.error('Horizon could not load the lobby Soldier model.',error)
 );
}
