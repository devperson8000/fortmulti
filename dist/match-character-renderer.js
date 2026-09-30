import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {createAnimationBlend,resolveCharacterAnimation,stepAnimationBlend} from './character-animation.js';
import {createFirstPersonAssetPose} from './view-model.js';

const WEAPON_FILES=Object.freeze({ar:'Rifle_Assault_East.glb',shotgun:'Shotgun_Pump_East.glb',smg:'SMG_Compact_East.glb',sniper:'Sniper_Rifle_East.glb'});
const clipState=name=>String(name||'').toLowerCase().replace(/[^a-z]/g,'');
const normBone=name=>String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export class MatchCharacterRenderer{
 constructor(gl,canvas,{modelUrl='/models/Soldier.glb',weaponBase='/models/weapons/'}={}){
  this.canvas=canvas;this.gl=gl;this.weaponBase=weaponBase;this.instances=new Map();this.weaponTemplates=new Map();this.firstPersonInstances=new Map();this.template=null;this.clips=new Map();this.ready=false;this.failed=false;this.width=0;this.height=0;
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(75,1,.15,820);
  this.scene.add(new THREE.HemisphereLight(0xc6e9ff,0x30372d,1.7));
  const key=new THREE.DirectionalLight(0xfff1d4,2.35);key.position.set(-18,30,14);this.scene.add(key);
  const rim=new THREE.DirectionalLight(0x85ddff,1.1);rim.position.set(13,12,-20);this.scene.add(rim);
  this.firstPersonScene=new THREE.Scene();this.firstPersonCamera=new THREE.PerspectiveCamera(62,1,.15,820);this.firstPersonCamera.position.set(0,0,0);this.firstPersonCamera.lookAt(0,0,-1);
  this.firstPersonScene.add(new THREE.HemisphereLight(0xd5edff,0x33302a,1.65));
  const fpKey=new THREE.DirectionalLight(0xffe5bc,2.1);fpKey.position.set(-2,3,2);this.firstPersonScene.add(fpKey);
  const fpRim=new THREE.DirectionalLight(0x83d9ff,1.15);fpRim.position.set(2,1,-4);this.firstPersonScene.add(fpRim);
  this.renderer=new THREE.WebGLRenderer({canvas,context:gl,antialias:false,alpha:false,powerPreference:'high-performance'});
  this.renderer.autoClear=false;this.renderer.setPixelRatio(1);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.NoToneMapping;this.renderer.setClearColor(0x000000,0);
  this.loader=new GLTFLoader();
  this.loader.load(modelUrl,gltf=>this._loaded(gltf),undefined,error=>{this.failed=true;console.error('Horizon match character model could not load.',error);});
  for(const [id,file] of Object.entries(WEAPON_FILES))this.loader.load(`${weaponBase}${file}`,gltf=>this.weaponTemplates.set(id,gltf.scene),undefined,error=>console.warn(`Horizon ${id} third-person weapon could not load.`,error));
 }
 _loaded(gltf){
  this.template=gltf.scene;this.template.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(this.template),size=bounds.getSize(new THREE.Vector3());
  this.modelScale=size.y>0?1.78/size.y:1;
  for(const clip of gltf.animations){const state=clipState(clip.name);if(['idle','walk','run','jump','fall','crouch'].includes(state))this.clips.set(state,clip);}
  if(!this.clips.has('idle')&&gltf.animations[0])this.clips.set('idle',gltf.animations[0]);
  if(!this.clips.has('walk')&&this.clips.has('run'))this.clips.set('walk',this.clips.get('run'));
  this.ready=this.clips.has('idle');
 }
 _weaponFor(instance,weaponId){
  if(instance.weaponId===weaponId&&(!weaponId||instance.weaponMount||!this.weaponTemplates.has(weaponId)))return;
  instance.weaponId=weaponId||'';
  if(instance.weaponMount)instance.hand?.remove(instance.weaponMount);
  instance.weaponMount=null;
  if(!weaponId||!this.weaponTemplates.has(weaponId)||!instance.hand)return;
  const source=this.weaponTemplates.get(weaponId),model=source.clone(true),bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const dimensions=[size.x,size.y,size.z],longest=dimensions.indexOf(Math.max(...dimensions));
  const grip=new THREE.Group();model.position.sub(center);grip.add(model);
  const length=Math.max(...dimensions)||1;grip.scale.setScalar(.82/length);
  if(longest===0)grip.rotation.y=Math.PI/2;else if(longest===1)grip.rotation.x=Math.PI/2;
  grip.position.set(.04,-.055,-.08);grip.userData.basePosition=grip.position.clone();grip.userData.baseRotation=grip.rotation.clone();
  const muzzle=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:0xffd78a,transparent:true,opacity:.9}));muzzle.position.set(0,.005,-.51);muzzle.visible=false;grip.add(muzzle);grip.userData.muzzle=muzzle;
  grip.traverse(object=>{if(object.isMesh){object.castShadow=false;object.receiveShadow=false;object.frustumCulled=false;}});
  instance.hand.add(grip);instance.weaponMount=grip;
 }
 hasFirstPersonWeapon(weaponId){return this.weaponTemplates.has(String(weaponId||''));}
 _firstPersonWeapon(weaponId){
  let instance=this.firstPersonInstances.get(weaponId);if(instance)return instance;
  const source=this.weaponTemplates.get(weaponId);if(!source)return null;
  const model=cloneSkinned(source);model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),dims=[size.x,size.y,size.z],longest=dims.indexOf(Math.max(...dims)),length=Math.max(...dims)||1;
  let trigger=null,muzzle=null,magazine=null,bolt=null,pump=null;
  model.traverse(object=>{if(!object.isBone)return;const name=normBone(object.name);if(name==='trigger')trigger=object;else if(name==='attachmuzzle')muzzle=object;else if(name==='magazine')magazine=object;else if(name==='bolt')bolt=object;else if(name==='pump')pump=object;});
  const triggerPoint=trigger?trigger.getWorldPosition(new THREE.Vector3()):bounds.getCenter(new THREE.Vector3());
  model.position.sub(triggerPoint);
  const basis=new THREE.Group();if(longest===0)basis.rotation.y=Math.PI/2;else if(longest===1)basis.rotation.x=Math.PI/2;
  basis.add(model);
  const root=new THREE.Group(),mount=new THREE.Group();root.add(mount);mount.add(basis);this.firstPersonScene.add(root);
  const flashGroup=new THREE.Group(),flashMaterial=new THREE.MeshBasicMaterial({color:0xffd47b,transparent:true,opacity:.98,depthWrite:false});
  const flashCore=new THREE.Mesh(new THREE.SphereGeometry(.075,10,7),flashMaterial);flashGroup.add(flashCore);
  const flashGlow=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),new THREE.MeshBasicMaterial({color:0xff8f38,transparent:true,opacity:.52,depthWrite:false}));flashGroup.add(flashGlow);
  flashGroup.add(new THREE.PointLight(0xffb052,2.3,1.8));
  if(muzzle)muzzle.add(flashGroup);else{flashGroup.position.set(0,0,-length*.46);basis.add(flashGroup);}
  flashGroup.scale.setScalar(1);
  const bones=[magazine,bolt,pump].filter(Boolean).map(bone=>({bone,position:bone.position.clone(),rotation:bone.rotation.clone()}));
  instance={root,mount,basis,model,length,triggerPoint,longest,weaponId,flashGroup,flashMaterial,bones,magazine,bolt,pump};
  this.firstPersonInstances.set(weaponId,instance);return instance;
 }
 renderFirstPersonWeapon(weaponId,profile,state,parts,{flash=0,dt=.016,width=this.canvas.width,height=this.canvas.height}={}){
  const instance=this._firstPersonWeapon(weaponId);if(!instance)return false;
  const pose=createFirstPersonAssetPose(profile,state,parts,instance.length),unit=profile.presentation.scale;
  instance.root.position.set(...pose.position);instance.root.rotation.order='YXZ';instance.root.rotation.set(...pose.rotation);
  instance.mount.position.set(pose.trigger[0]*unit,pose.trigger[1]*unit,pose.trigger[2]*unit);
  instance.basis.scale.setScalar(pose.scale);
  const phase=String(parts?.stage||'idle'),progress=clamp(Number(parts?.progress??1),0,1),smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  let magazineOut=phase==='eject'?smooth((progress-.16)/.22):phase==='insert'?1-smooth((progress-.38)/.32):0;
  for(const entry of instance.bones){entry.bone.position.copy(entry.position);entry.bone.rotation.copy(entry.rotation);}
  if(instance.magazine)instance.magazine.position.z-=.16*magazineOut;
  if(instance.pump){const cycle=Math.max(Number(parts?.action)||0,phase==='action'?smooth((progress-.7)/.2):0);instance.pump.position.z-=.095*cycle;}
  if(instance.bolt){const kick=flash>0?Math.min(1,flash/.09):Number(parts?.action)||0;instance.bolt.position.z-=.06*kick;}
  instance.flashGroup.visible=flash>0;
  if(instance.flashGroup.visible){const pulse=clamp(flash/.09,.25,1);instance.flashGroup.scale.setScalar(.72+pulse*.52);instance.flashMaterial.opacity=.72+pulse*.26;}
  if(width!==this.width||height!==this.height){this.width=width;this.height=height;this.renderer.setSize(width,height,false);}
  this.firstPersonCamera.aspect=Math.max(.1,width/Math.max(1,height));this.firstPersonCamera.fov=62;this.firstPersonCamera.updateProjectionMatrix();
  this.renderer.resetState();this.renderer.render(this.firstPersonScene,this.firstPersonCamera);this.restoreRawState();return true;
 }
 _create(id,source){
  const model=cloneSkinned(this.template),holder=new THREE.Group(),mixer=new THREE.AnimationMixer(model),actions=new Map(),bones=new Map();
  for(const state of this.clips.keys()){const action=mixer.clipAction(this.clips.get(state));action.setEffectiveWeight(0);action.play();actions.set(state,action);}
  let hand=null,rightArm=null,rightForeArm=null,leftArm=null,leftForeArm=null;
  model.traverse(object=>{if(object.isBone){bones.set(normBone(object.name),object);if(normBone(object.name)==='mixamorigrighthand')hand=object;}});
  rightArm=bones.get('mixamorigrightarm');rightForeArm=bones.get('mixamorigrightforearm');leftArm=bones.get('mixamorigleftarm');leftForeArm=bones.get('mixamorigleftforearm');
  model.scale.setScalar(this.modelScale);model.traverse(object=>{if(object.isMesh){object.castShadow=false;object.receiveShadow=true;object.frustumCulled=false;}});
  holder.add(model);this.scene.add(holder);
  const instance={id,holder,model,mixer,actions,bones,hand,rightArm,rightForeArm,leftArm,leftForeArm,weaponId:'',weaponMount:null,blend:createAnimationBlend('idle'),sequenceState:'',fireTime:0,color:source.color||'#6f8470'};
  this._tint(instance,instance.color);return instance;
 }
 _tint(instance,value){
  const tint=new THREE.Color(value||'#6f8470');
  instance.model.traverse(object=>{if(!object.isMesh)return;const source=object.material,colorMat=sourceMaterial=>{const material=sourceMaterial.clone();if(material.color)material.color.lerp(tint,.075);return material;};object.material=Array.isArray(source)?source.map(colorMat):colorMat(source);});
 }
 update(players=[],{localId='',hideId='',phase='playing',dt=.016}={}){
  if(!this.ready)return;
  const active=new Set();
  for(const p of players){
   if(!p?.id||p.hp<=0)continue;
   const id=String(p.id);active.add(id);let instance=this.instances.get(id);
   if(!instance){instance=this._create(id,p);this.instances.set(id,instance);}
   instance.holder.visible=id!==String(hideId);instance.holder.position.set(p.p?.[0]||0,p.p?.[1]||0,p.p?.[2]||0);instance.holder.rotation.y=Number.isFinite(p.yaw)?p.yaw:0;
   const animation=resolveCharacterAnimation({grounded:p.air==='landed'||p.air==='ship'||p.air==='pod',speed:p.animationState==='run'?5.4:p.animationState==='walk'?2.2:0,velocity:Number(p.vy)||0,sprinting:p.animationState==='run'||p.sprinting,crouching:p.crouching,deploymentState:p.animationState==='pod-enter'?'entering_pod':p.animationState==='pod-exit'?'exiting':'',aiming:p.aim,reloading:p.reload>0,weapon:p.slot});
   const supported=new Set(this.clips.keys());instance.blend=stepAnimationBlend(instance.blend,{state:p.animationState||animation.state,supported},dt);
   for(const [state,action] of instance.actions)action.setEffectiveWeight(instance.blend.weights[state]||0);
   instance.mixer.update(clamp(dt,0,.06));
   const armed=phase==='playing'&&p.deploymentState==='match_active'&&p.slot>0&&p.slot<5;
   this._weaponFor(instance,armed?(['','ar','shotgun','smg','sniper'][p.slot]||''):null);
   instance.fireTime=Math.max(0,instance.fireTime-clamp(dt,0,.06));
   if(instance.weaponMount){const base=instance.weaponMount.userData.basePosition,reload=armed?clamp((Number(p.reload)||0)/2.5,0,1):0,fire=instance.fireTime/.11;instance.weaponMount.position.set(base.x,base.y+Math.sin(reload*Math.PI)*.065,base.z+fire*.065);instance.weaponMount.rotation.copy(instance.weaponMount.userData.baseRotation);instance.weaponMount.rotation.x+=Math.sin(reload*Math.PI)*.36-fire*.11;instance.weaponMount.userData.muzzle.visible=fire>.04;}
   const aim=armed?(p.aim?.25:.07):0,run=instance.blend.weights.run||0,reload=armed?clamp((Number(p.reload)||0)/2.5,0,1):0,airborne=['jump','fall'].includes(p.animationState);
   if(instance.rightArm){instance.rightArm.rotation.x-=aim+run*.08+reload*.3;instance.rightArm.rotation.z-=.08+run*.035;}
   if(instance.rightForeArm){instance.rightForeArm.rotation.x+=aim*.28+reload*.22;}
   if(instance.leftArm&&armed){instance.leftArm.rotation.x-=aim+.7;instance.leftArm.rotation.z+=.24;}
   if(instance.leftForeArm&&armed)instance.leftForeArm.rotation.x+=.26;
   if(airborne){if(instance.rightArm)instance.rightArm.rotation.x-=.23;if(instance.leftArm)instance.leftArm.rotation.x-=.2;}
   if(p.crouching){instance.holder.position.y-=.16;for(const key of['mixamorigleftupleg','mixamorigrightupleg']){const bone=instance.bones.get(key);if(bone)bone.rotation.x-=.36;}for(const key of['mixamorigleftleg','mixamorigrightleg']){const bone=instance.bones.get(key);if(bone)bone.rotation.x+=.68;}}
  }
  for(const [id,instance] of this.instances)if(!active.has(id)){instance.mixer.stopAllAction();this.scene.remove(instance.holder);this.instances.delete(id);}
 }
 pulse(id,type='fire'){const instance=this.instances.get(String(id));if(instance&&type==='fire')instance.fireTime=.11;}
 render({eye,target,aspect,fov,dt=.016,width=this.canvas.width,height=this.canvas.height}={}){
  if(!this.ready||!eye||!target)return;
  if(width!==this.width||height!==this.height){this.width=width;this.height=height;this.renderer.setSize(width,height,false);}
  this.camera.aspect=Math.max(.1,aspect||width/Math.max(1,height));this.camera.fov=Number.isFinite(fov)?fov*180/Math.PI:75;this.camera.position.set(...eye);this.camera.lookAt(...target);this.camera.updateProjectionMatrix();
  this.renderer.resetState();this.renderer.render(this.scene,this.camera);
  // Restore the raw renderer's state before it draws the view model in its own pass.
  this.restoreRawState();
 }
 bindRawProgram(program,positionAttribute,colorAttribute){this.rawProgram=program;this.rawPosition=positionAttribute;this.rawColor=colorAttribute;}
 restoreRawState(){
  if(!this.rawProgram)return;const gl=this.gl;gl.useProgram(this.rawProgram);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.enableVertexAttribArray(this.rawPosition);gl.enableVertexAttribArray(this.rawColor);
 }
}
