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
 const vA=new THREE.Vector3(),vB=new THREE.Vector3(),vC=new THREE.Vector3(),vD=new THREE.Vector3(),targetElbow=new THREE.Vector3(),targetHand=new THREE.Vector3();
 const qA=new THREE.Quaternion(),qB=new THREE.Quaternion(),qC=new THREE.Quaternion();
 let template=null,idleClip=null,walkClip=null,saluteFingerClip=null,started=false;

 const clamp01=value=>Math.max(0,Math.min(1,value));
 const smooth=value=>{value=clamp01(value);return value*value*(3-2*value);};
 const easeOut=value=>1-Math.pow(1-clamp01(value),3);
 const hash=value=>{let h=2166136261;for(const char of String(value)){h^=char.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
 const rand01=instance=>{let x=instance.randomState||1;x^=x<<13;x^=x>>>17;x^=x<<5;instance.randomState=x>>>0;return instance.randomState/4294967296;};

 function setCamera(preview,width,height){
  camera.aspect=width/Math.max(1,height);
  if(preview){camera.fov=.54*180/Math.PI;camera.position.set(.62,2.08,6.25);camera.lookAt(.62,1.16,0);}
  else{camera.fov=.66*180/Math.PI;camera.position.set(0,3.45,9.4);camera.lookAt(0,1.28,.8);}
  camera.updateProjectionMatrix();
 }
 function findRig(model){
  const bone=name=>model.getObjectByName(`mixamorig:${name}`)||null;
  return {
   hips:bone('Hips'),spine:bone('Spine'),spine1:bone('Spine1'),spine2:bone('Spine2'),neck:bone('Neck'),head:bone('Head'),
   rightArm:bone('RightArm'),rightForeArm:bone('RightForeArm'),rightHand:bone('RightHand'),
   rightIndex1:bone('RightHandIndex1'),rightMiddle1:bone('RightHandMiddle1'),rightRing1:bone('RightHandRing1'),rightPinky1:bone('RightHandPinky1'),
   leftFoot:bone('LeftFoot'),rightFoot:bone('RightFoot'),leftToe:bone('LeftToeBase'),rightToe:bone('RightToeBase')
  };
 }
 function disposeInstance(instance){instance.mixer.stopAllAction();scene.remove(instance.holder);}
 function createInstance(member,index){
  const model=cloneSkinned(template),holder=new THREE.Group(),rig=findRig(model);
  model.traverse(object=>{if(object.isMesh){object.frustumCulled=false;object.castShadow=false;object.receiveShadow=false;}});
  holder.add(model);scene.add(holder);
  const mixer=new THREE.AnimationMixer(model);
  const idleAction=mixer.clipAction(idleClip);idleAction.enabled=true;idleAction.setEffectiveWeight(.95);idleAction.play();
  const walkAction=walkClip?mixer.clipAction(walkClip):null;
  if(walkAction){walkAction.enabled=true;walkAction.setEffectiveWeight(.05);walkAction.setEffectiveTimeScale(.16);walkAction.play();}
  const fingerAction=saluteFingerClip?mixer.clipAction(saluteFingerClip):null;
  if(fingerAction){fingerAction.enabled=true;fingerAction.setEffectiveWeight(0);fingerAction.play();fingerAction.paused=true;fingerAction.time=Math.min(.25,saluteFingerClip.duration*.25);}
  const phase=(index*.91+(String(member.id||'').length*.37))%(idleClip.duration||1),now=performance.now()/1000;
  idleAction.time=phase;
  if(walkAction)walkAction.time=(phase*1.73)%(walkClip.duration||1);
  return {
   id:member.id,holder,model,mixer,idleAction,walkAction,fingerAction,rig,phase,slot:index,
   randomState:hash(`${member.id||index}:horizon-lobby`)||1,
   saluteActive:false,saluteStarted:0,nextSaluteAt:now+1.15+index*.16
  };
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
  if(!instance.saluteActive)return {amount:0,flick:0};
  const elapsed=time-instance.saluteStarted;
  if(elapsed<.34)return {amount:easeOut(elapsed/.34),flick:0};
  if(elapsed<1.04)return {amount:1,flick:0};
  if(elapsed<1.20){const t=smooth((elapsed-1.04)/.16);return {amount:1,flick:t};}
  if(elapsed<1.62){const t=smooth((elapsed-1.20)/.42);return {amount:1-t,flick:1-t};}
  instance.saluteActive=false;
  instance.nextSaluteAt=time+16+rand01(instance)*18;
  return {amount:0,flick:0};
 }
 function rotateBoneToward(bone,child,target,amount){
  if(!bone||!child||amount<=0)return;
  bone.updateWorldMatrix(true,true);
  child.updateWorldMatrix(true,true);
  bone.getWorldPosition(vA);child.getWorldPosition(vB);
  vC.copy(vB).sub(vA).normalize();vD.copy(target).sub(vA).normalize();
  if(vC.lengthSq()<1e-8||vD.lengthSq()<1e-8)return;
  qA.setFromUnitVectors(vC,vD);
  bone.getWorldQuaternion(qB);qC.copy(qA).multiply(qB);
  if(bone.parent){bone.parent.getWorldQuaternion(qA).invert();qC.premultiply(qA);}
  bone.quaternion.slerp(qC,clamp01(amount));
  bone.updateWorldMatrix(false,true);
 }
 function additiveRotate(bone,x=0,y=0,z=0,weight=1){
  if(!bone||weight<=0)return;
  qA.setFromEuler(new THREE.Euler(x*weight,y*weight,z*weight,'XYZ'));
  bone.quaternion.multiply(qA);
 }
 function applySalute(instance,state){
  const {rightArm,rightForeArm,rightHand}=instance.rig,amount=state.amount;
  if(instance.fingerAction)instance.fingerAction.setEffectiveWeight(amount*.92);
  if(amount<=.001||!rightArm||!rightForeArm||!rightHand)return;
  targetElbow.set(-.42,1.37,-.18);instance.model.localToWorld(targetElbow);
  targetHand.set(-.22-state.flick*.16,1.69+state.flick*.025,-.205-state.flick*.055);instance.model.localToWorld(targetHand);
  rotateBoneToward(rightArm,rightForeArm,targetElbow,amount);
  instance.model.updateMatrixWorld(true);
  rotateBoneToward(rightForeArm,rightHand,targetHand,amount);
  additiveRotate(rightHand,-.10-state.flick*.12,.08,.16+state.flick*.18,amount);
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
   applySalute(instance,salute);
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
   template=gltf.scene;
   idleClip=gltf.animations.find(clip=>clip.name==='Idle')||gltf.animations[0];
   walkClip=gltf.animations.find(clip=>clip.name==='Walk')||null;
   const tPose=gltf.animations.find(clip=>clip.name==='TPose')||null;
   if(tPose){
    const tracks=tPose.tracks.filter(track=>track.name.includes('mixamorig:RightHandIndex')||track.name.includes('mixamorig:RightHandMiddle'));
    if(tracks.length)saluteFingerClip=new THREE.AnimationClip('HorizonTwoFingerSalute',tPose.duration,tracks);
   }
   if(!idleClip){console.error('Horizon lobby Soldier is missing its Idle animation.');return;}
   if(!started){started=true;frame();}
  },
  undefined,
  error=>console.error('Horizon could not load the lobby Soldier model.',error)
 );
}
