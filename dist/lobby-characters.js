import {createContactShadow} from './character-lighting.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {resolveLobbyRig,sampleRightHandFingerPose} from './lobby-rig.js';
import {firstPersonCalibration} from './first-person-calibration.js';
import {poseLobbyRifle} from './lobby-rifle.js';
import {poseNativeSalute} from './match-character-renderer.js';

export const lobbyDiagnostics={snapshot:()=>[]};
const canvas=document.getElementById('lobby-characters');
if(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
 renderer.setClearColor(0x000000,0);
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.02;

 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(37.815,1,.15,100);
 scene.add(new THREE.HemisphereLight(0xbdeaff,0x1d2730,2.1));
 const key=new THREE.DirectionalLight(0xffecd1,3.3);key.position.set(-3.5,7,7);scene.add(key);
 const rim=new THREE.DirectionalLight(0x70d9ff,1.8);rim.position.set(5,4,-4);scene.add(rim);
 const fill=new THREE.DirectionalLight(0x9bbdff,1.25);fill.position.set(-5,2,1);scene.add(fill);

 const regularSpots=[[0,.1,1.5],[-1.65,.03,.5],[1.65,.03,.5],[-3.05,0,-1.1],[3.05,0,-1.1],[-1.25,0,-2.4],[1.25,0,-2.4],[0,0,-3.7]];
 const instances=new Map(),clock=new THREE.Clock();
 let template=null,idleClip=null,walkClip=null,saluteFingerPose=[],rifleTemplate=null,started=false,rigWarningShown=false;
 const rifleCalibration=firstPersonCalibration('ar');

 const clamp01=value=>Math.max(0,Math.min(1,value));
 const smooth=value=>{value=clamp01(value);return value*value*(3-2*value);};
 const hash=value=>{let h=2166136261;for(const char of String(value)){h^=char.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
 const rand01=instance=>{let x=instance.randomState||1;x^=x<<13;x^=x>>>17;x^=x<<5;instance.randomState=x>>>0;return instance.randomState/4294967296;};

 function setCamera(preview,width,height,count=1){
  camera.aspect=width/Math.max(1,height);
  if(preview){camera.fov=.60*180/Math.PI;camera.position.set(.62,2.5,8);camera.lookAt(.62,1.65,0);}
  else{camera.fov=.66*180/Math.PI;camera.position.set(0,3.45,9.4);camera.lookAt(0,1.28,.8);}
  if(!preview){const compact=width<1100,distance=9.4+Math.max(0,count-3)*.28+(compact?2.5:0);camera.position.set(0,count>3?4.4:3.45,distance);camera.lookAt(0,1.4,.1);if(width<=760){camera.position.z=22+Math.max(0,count-3)*.28;camera.lookAt(0,1.4,.1);camera.setViewOffset(width,height,0,height*.30,width,height);}else if(compact)camera.setViewOffset(width,height,-width*.1,0,width,height);else camera.clearViewOffset();}else camera.clearViewOffset();
  camera.updateProjectionMatrix();
 }
 function findRig(model){
  return resolveLobbyRig(model);
 }
 function disposeInstance(instance){instance.mixer.stopAllAction();scene.remove(instance.holder);instance.contactShadow.material.dispose();const skeletons=new Set();instance.holder.traverse(object=>{if(object.isSkinnedMesh)skeletons.add(object.skeleton);});for(const skeleton of skeletons)skeleton.dispose();}
 const normBone=name=>String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 function createRifleMount(instance){
  if(!rifleTemplate||instance.rifleMount)return;
  const model=cloneSkinned(rifleTemplate),mount=new THREE.Group(),nodes=new Map();
  model.traverse(object=>nodes.set(normBone(object.name),object));model.updateMatrixWorld(true);
  const supportOffset=new THREE.Vector3(...rifleCalibration.support).sub(nodes.get(rifleCalibration.supportNode)?.getWorldPosition(new THREE.Vector3())||new THREE.Vector3(...rifleCalibration.support));
  model.position.copy(new THREE.Vector3(...rifleCalibration.grip).multiplyScalar(-rifleCalibration.scale));model.scale.setScalar(rifleCalibration.scale);mount.add(model);
  Object.assign(mount.userData,{calibration:rifleCalibration,nodes,supportOffset});
  mount.traverse(object=>{if(object.isMesh){object.castShadow=false;object.receiveShadow=false;}});
  instance.holder.add(mount);instance.rifleMount=mount;
 }
 function createInstance(member,index){
  const model=cloneSkinned(template),holder=new THREE.Group(),rig=findRig(model);
  const bones=new Map();
  model.traverse(object=>{if(object.isBone)bones.set(normBone(object.name),object);});
  const fingerRest=new Map([...bones].filter(([name])=>/hand.*[1234]$/.test(name)).map(([,bone])=>[bone,bone.quaternion.clone()]));for(const {name,quaternion}of saluteFingerPose){const bone=bones.get(normBone(name));if(bone)fingerRest.set(bone,quaternion.clone());}
  if(!rigWarningShown){
   const missing=['rightShoulder','rightArm','rightForeArm','rightHand',...['Thumb','Index','Middle','Ring','Pinky'].flatMap(digit=>[1,2,3,4].map(joint=>`right${digit}${joint}`))].filter(name=>!rig[name]);
   if(missing.length){console.error('Horizon lobby Soldier rig is missing runtime bones:',missing);rigWarningShown=true;}
  }
  model.traverse(object=>{if(object.isMesh){object.frustumCulled=false;object.castShadow=false;object.receiveShadow=false;}});
  const contactShadow=createContactShadow(1.0,.7);contactShadow.position.y=-.025;holder.add(contactShadow);holder.add(model);scene.add(holder);
  const mixer=new THREE.AnimationMixer(model);
  const idleAction=mixer.clipAction(idleClip);idleAction.enabled=true;idleAction.setEffectiveWeight(.95);idleAction.play();
  const walkAction=walkClip?mixer.clipAction(walkClip):null;
  if(walkAction){walkAction.enabled=true;walkAction.setEffectiveWeight(.05);walkAction.setEffectiveTimeScale(.16);walkAction.play();}
  const phase=(index*.91+(String(member.id||'').length*.37))%(idleClip.duration||1),now=performance.now()/1000;
  idleAction.time=phase;
  if(walkAction)walkAction.time=(phase*1.73)%(walkClip.duration||1);
  const instance={
   id:member.id,holder,model,contactShadow,mixer,idleAction,walkAction,animatedPose:new Map([...bones.values()].map(bone=>[bone,bone.quaternion.clone()])),bones,fingerRest,rig,phase,slot:index,
   randomState:hash(`${member.id||index}:horizon-lobby`)||1,
   saluteActive:false,saluteStarted:0,nextSaluteAt:now+10+index*2.1
  };
  createRifleMount(instance);
  return instance;
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
 function saluteState(instance,time){
  if(!instance.saluteActive&&time>=instance.nextSaluteAt){instance.saluteActive=true;instance.saluteStarted=time;}
  if(!instance.saluteActive)return {amount:0};
  const elapsed=time-instance.saluteStarted;
  if(elapsed<2)return {amount:Math.min(smooth(elapsed/.46),smooth((2-elapsed)/.46))};
  instance.saluteActive=false;
  instance.nextSaluteAt=time+16+rand01(instance)*18;
  return {amount:0};
 }
 const idleRotation=new THREE.Quaternion();
 function additiveRotate(bone,x=0,y=0,z=0,weight=1){
  if(!bone||weight<=0)return;
  idleRotation.setFromEuler(new THREE.Euler(x*weight,y*weight,z*weight,'XYZ'));
  bone.quaternion.multiply(idleRotation);
 }
 function applyIdleLayers(instance,time,salute){
  const rig=instance.rig,phase=instance.phase;
  const slow=Math.sin(time*.72+phase),counter=Math.sin(time*.72+phase+Math.PI),breath=Math.sin(time*1.42+phase*.6);
  const saluteMute=1-salute.amount*.82;
  additiveRotate(rig.spine1,breath*.004,slow*.006,slow*.010,saluteMute);
  additiveRotate(rig.spine2,breath*.006,-slow*.005,-slow*.012,saluteMute);
  additiveRotate(rig.neck,-breath*.003,Math.sin(time*.33+phase)*.010,-slow*.004,saluteMute);
  additiveRotate(rig.head,Math.sin(time*.39+phase)*.006,Math.sin(time*.31+phase*.7)*.014,-slow*.006,saluteMute);
  additiveRotate(rig.leftFoot,0,0,slow*.014,saluteMute);
  additiveRotate(rig.rightFoot,0,0,counter*.014,saluteMute);
  additiveRotate(rig.leftToe,slow*.010,0,0,saluteMute);
  additiveRotate(rig.rightToe,counter*.010,0,0,saluteMute);
 }
 function poseInstances(party,preview,time){
  for(const instance of instances.values()){
   const index=instance.slot,local=index===0;
   instance.holder.visible=preview?local:index<party.length;
   if(!instance.holder.visible)continue;
   const base=preview?[.78,.06,0]:regularSpots[index];
   const scale=preview?1.78:(local?1.62:1.46);
   const sway=Math.sin(time*.72+instance.phase),breath=Math.sin(time*1.42+instance.phase*.6);
   instance.holder.position.set(base[0]+sway*.006,base[1]+breath*.003,base[2]);
   instance.holder.scale.setScalar(scale);
   instance.holder.lookAt(camera.position.x,instance.holder.position.y,camera.position.z);
   instance.holder.rotateY(Math.PI);
   instance.model.rotation.z=sway*.008;
   instance.holder.updateMatrixWorld(true);

   const salute=saluteState(instance,time);
   const walkWeight=salute.amount>.05?.012:.035+.018*(.5+.5*Math.sin(time*.46+instance.phase));
   instance.idleAction.setEffectiveWeight(1-walkWeight);
   if(instance.walkAction)instance.walkAction.setEffectiveWeight(walkWeight);
   applyIdleLayers(instance,time,salute);
   // Keep the calibrated AR in both hands; the native deployment salute then
   // releases the trigger hand while the support hand stays on the rifle.
   poseLobbyRifle(instance);
   if(salute.amount>.001)poseNativeSalute(instance,salute.amount);
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
  const dt=Math.min(clock.getDelta(),.05);
  if(document.hidden||!window.Duel?.lobby)return;
  const party=Array.isArray(window.Duel?.party)?window.Duel.party:[];
  ensureInstances(party);
  const preview=Boolean(window.Duel?.characterPreview),[width,height]=resize();setCamera(preview,width,height,party.length);
  const time=performance.now()/1000;
  for(const instance of instances.values()){for(const [bone,q] of instance.animatedPose)bone.quaternion.copy(q);instance.mixer.update(dt);for(const [bone,q] of instance.animatedPose)q.copy(bone.quaternion);}
  poseInstances(party,preview,time);
  renderer.render(scene,camera);
 }
 lobbyDiagnostics.snapshot=()=>[...instances.values()].map(i=>{i.holder.updateMatrixWorld(true);const point=name=>i.bones.get('mixamorig'+name).getWorldPosition(new THREE.Vector3()).project(camera).toArray();return {id:i.id,visible:i.holder.visible,rifle:Boolean(i.rifleMount),saluting:i.saluteActive,head:point('head'),leftFoot:point('leftfoot'),rightFoot:point('rightfoot')};});
 const loader=new GLTFLoader();
 loader.load(
  '/models/Soldier.glb',
  gltf=>{
   template=gltf.scene;
   idleClip=gltf.animations.find(clip=>clip.name==='Idle')||gltf.animations[0];
   walkClip=gltf.animations.find(clip=>clip.name==='Walk')||null;
   const tPose=gltf.animations.find(clip=>clip.name==='TPose')||null;
   if(tPose){
    const sampleTime=Math.min(.25,tPose.duration*.25);
    saluteFingerPose=sampleRightHandFingerPose(tPose,sampleTime).map(({name,quaternion})=>({
     name,quaternion:new THREE.Quaternion().fromArray(quaternion).normalize()
    }));
    if(!saluteFingerPose.length)console.error('Horizon lobby Soldier TPose is missing sanitized right-hand finger rotations.');
   }
   if(!idleClip){console.error('Horizon lobby Soldier is missing its Idle animation.');return;}
   if(!started){started=true;frame();}
  },
  undefined,
  error=>console.error('Horizon could not load the lobby Soldier model.',error)
 );
 loader.load('/models/weapons/Rifle_Assault_East.glb',gltf=>{
  rifleTemplate=gltf.scene;
  for(const instance of instances.values())createRifleMount(instance);
 },undefined,error=>console.error('Horizon could not load the lobby assault rifle model.',error));
}
