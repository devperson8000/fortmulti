import {createCharacterOutfit,applyCharacterOutfit} from './character-outfit.js';
import {WEAPON_PROFILES} from './weapon-system.js';
import {inventoryWeapon} from './weapon-inventory.js';
import {WEAPON_FILES,createGroundWeapon,groundWeaponPose} from './weapon-assets.js';
import {firstPersonCalibration,PICKAXE_GRIP} from './first-person-calibration.js';
import {createContactShadow} from './character-lighting.js';
import {SALUTE_FINGER_CURLS} from './lobby-rig.js';
import {createMotionPresentation,stepMotionPresentation} from './visual-presentation.js';
import {createSoldierArms,poseSoldierArms,poseWeaponHand,supportHandPose,poseArmChain,poseLegChain} from './soldier-arms.js';
import {createHeldItem} from './held-items.js';
import {handAttachmentScale} from './view-model.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {renderFacilityPass,prepareFacilityDepth,restoreFacilityColor,warmFacilityResources} from './facility-render-pass.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {createAnimationBlend,stepAnimationBlend,characterLocomotion,characterActionPose} from './character-animation.js';


const clipState=name=>String(name||'').toLowerCase().replace(/[^a-z]/g,'');
const normBone=name=>String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Measured on the shipped Soldier mesh: helmet surface in head-bone space,
// and the actual terminal skin vertices of its two extended fingers.
const saluteForehead=[-5.12026438883,17.57254662871,11.46768078850];
const saluteTips=[['index3',[-.0972724658,3.7575946381,-.0024291103]],['middle3',[-.8392463825,3.7000995029,.0195624377]]];
const saluteHandRotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,1),new THREE.Vector3(-.866,.5,0).normalize(),new THREE.Vector3(-.5,-.866,0).normalize()));
export function poseNativeSalute(instance,amount){
 const {model,holder,bones,fingerRest}=instance,arm=bones.get('mixamorigrightarm'),fore=bones.get('mixamorigrightforearm'),hand=bones.get('mixamorigrighthand'),head=bones.get('mixamorighead');
 if(!arm||!fore||!hand||!head)return;
 const base=[arm,fore,hand].map(b=>b.quaternion.clone()),fingers=[];
 for(const [bone,rest] of fingerRest)if(/righthand(index|middle)/.test(normBone(bone.name))){fingers.push([bone,bone.quaternion.clone(),rest]);bone.quaternion.copy(rest);}
 holder.updateMatrixWorld(true);
 const target=head.localToWorld(new THREE.Vector3(...saluteForehead)),orientation=holder.getWorldQuaternion(new THREE.Quaternion()).multiply(saluteHandRotation);
 const orient=()=>{hand.quaternion.copy(hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));hand.updateWorldMatrix(false,true);};
 orient();
 const midpoint=saluteTips.map(([name,offset])=>bones.get('mixamorigrighthand'+name).localToWorld(new THREE.Vector3(...offset))).reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(.5);
 const wrist=target.clone().sub(midpoint.sub(hand.getWorldPosition(new THREE.Vector3())));
 poseArmChain(model,bones,'right',wrist,holder.localToWorld(new THREE.Vector3(.55,1.3,-.02)));orient();
 for(const [index,bone] of [arm,fore,hand].entries())bone.quaternion.copy(base[index].slerp(bone.quaternion.clone(),amount));
 for(const [bone,base,rest] of fingers)bone.quaternion.copy(base.slerp(rest,amount));
 for(const curl of SALUTE_FINGER_CURLS){const bone=bones.get(normBone(curl.name));if(bone)bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...curl.axis),curl.angle*amount));}
}

export class MatchCharacterRenderer{
 constructor(gl,canvas,{modelUrl='/models/Soldier.glb',weaponBase='/models/weapons/'}={}){
  this.canvas=canvas;this.gl=gl;this.weaponBase=weaponBase;this.instances=new Map();this.weaponTemplates=new Map();this.groundInstances=new Map();this.weaponThumbnails=new Map();this.firstPersonInstances=new Map();this.template=null;this.clips=new Map();this.ready=false;this.failed=false;this.width=0;this.height=0;
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(75,1,.15,820);
  this.scene.fog=new THREE.FogExp2(0xb1d6e3,.0036);this.scene.add(new THREE.HemisphereLight(0xc6e9ff,0x394332,1.3));
  const key=new THREE.DirectionalLight(0xffedc8,2.05);key.position.set(-18,30,14);this.scene.add(key);
  const rim=new THREE.DirectionalLight(0x91d6ff,.75);rim.position.set(13,12,-20);this.scene.add(rim);
  this.cinematicLight=new THREE.DirectionalLight(0xc9eaff,0);this.scene.add(this.cinematicLight,this.cinematicLight.target);
  this.firstPersonScene=new THREE.Scene();this.firstPersonCamera=new THREE.PerspectiveCamera(62,1,.15,820);this.firstPersonCamera.position.set(0,0,0);this.firstPersonCamera.lookAt(0,0,-1);
  this.firstPersonScene.add(new THREE.HemisphereLight(0xd5edff,0x33302a,1.65));
  const fpKey=new THREE.DirectionalLight(0xffe5bc,2.1);fpKey.position.set(-2,3,2);this.firstPersonScene.add(fpKey);
  const fpRim=new THREE.DirectionalLight(0x83d9ff,1.15);fpRim.position.set(2,1,-4);this.firstPersonScene.add(fpRim);
  this.renderer=new THREE.WebGLRenderer({canvas,context:gl,antialias:false,alpha:false,powerPreference:'high-performance'});
  this.renderer.autoClear=false;this.renderer.setPixelRatio(1);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;this.renderer.setClearColor(0x000000,0);
  this.loader=new GLTFLoader();
  this.loader.load(modelUrl,gltf=>this._loaded(gltf),undefined,error=>{this.failed=true;console.error('Horizon match character model could not load.',error);});
  for(const [id,file] of Object.entries(WEAPON_FILES))this.loader.load(`${weaponBase}${file}`,gltf=>{this.weaponTemplates.set(id,gltf.scene);const warm=()=>{this.getWeaponThumbnail(id);if(this.weaponThumbnails.size===4&&this.thumbnailRenderer){this.thumbnailRenderer.dispose();this.thumbnailRenderer=null;}};if(globalThis.requestIdleCallback)requestIdleCallback(warm);else setTimeout(warm,0);},undefined,error=>console.warn(`Horizon ${id} third-person weapon could not load.`,error));
 }
 async loadFacilityEnvironment(quality='medium'){
  if(this.facilityLoading)return this.facilityLoading;
  this.facilityLoading=(async()=>{
   const {createReactorEnvironment}=await import('./reactor-environment.js');
   this.facilityScene=new THREE.Scene();
   const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(this.renderer);this.renderer.resetState();this.facilityReflection=pmrem.fromScene(room,.04);this.facilityScene.environment=this.facilityReflection.texture;this.facilityScene.environmentIntensity=.7;room.dispose();pmrem.dispose();this.restoreRawState();
   this.facilityScene.fog=new THREE.FogExp2(0x17242c,.0025);
   this.facilityScene.add(new THREE.HemisphereLight(0x96b0bf,0x725139,1.1));
   const warm=new THREE.DirectionalLight(0xffd0a0,1.25);warm.position.set(-15,35,10);this.facilityScene.add(warm);
   const cool=new THREE.DirectionalLight(0x64c9ff,.7);cool.position.set(25,18,-12);this.facilityScene.add(cool);
   this.facilityEnvironment=createReactorEnvironment(this.facilityScene,{baseUrl:'/maps/platform23/',offsetY:0,maxDistance:220});
   await this.facilityEnvironment.ready;
   this.facilityDepthMaterials=[THREE.FrontSide,THREE.BackSide,THREE.DoubleSide].map(side=>new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true,side,fog:false,toneMapped:false}));
   const camera=new THREE.PerspectiveCamera(75,1,.15,820);camera.position.set(0,6,-18);camera.lookAt(0,2,-6);this.facilityEnvironment.update(camera);
   prepareFacilityDepth(this.facilityEnvironment.group,this.facilityDepthMaterials);this.renderer.resetState();const depthCompiled=this.renderer.compileAsync(this.facilityScene,camera);restoreFacilityColor(this.facilityEnvironment.group);this.restoreRawState();await depthCompiled;this.restoreRawState();
   for(const quality of ['low','medium','high']){this.facilityEnvironment.setQuality(quality);this.renderer.resetState();const compiled=this.renderer.compileAsync(this.facilityScene,camera);this.restoreRawState();await compiled;this.restoreRawState();}
   this.facilityEnvironment.setQuality(quality);this.renderer.resetState();try{warmFacilityResources(this.renderer,this.facilityScene,camera,this.facilityEnvironment.group);}finally{this.restoreRawState();}
   return true;
  })().catch(error=>{this.facilityEnvironment?.dispose?.();this.facilityEnvironment=null;this.facilityReflection?.dispose();this.facilityDepthMaterials?.forEach(material=>material.dispose());this.facilityScene=null;this.facilityLoading=null;throw error;});
  return this.facilityLoading;
 }
 setMap(id){this.activeMap=id;}
 _loaded(gltf){
  this.template=gltf.scene;this.template.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(this.template),size=bounds.getSize(new THREE.Vector3());
  this.modelScale=size.y>0?1.78/size.y:1;
  for(const clip of gltf.animations){const state=clipState(clip.name);if(['idle','walk','run','jump','fall','crouch'].includes(state))this.clips.set(state,clip);}
  if(!this.clips.has('idle')&&gltf.animations[0])this.clips.set('idle',gltf.animations[0]);
  if(!this.clips.has('walk')&&this.clips.has('run'))this.clips.set('walk',this.clips.get('run'));
  this.arms=createSoldierArms(this.template,this.modelScale);this.arms.outfit=createCharacterOutfit(this.arms.model);this.firstPersonScene.add(this.arms.model);this.utilities=new Map();this.supportedClips=new Set(this.clips.keys());this.ready=this.clips.has('idle');
 }
 _weaponFor(instance,weaponId){
  if(instance.weaponId===weaponId&&(!weaponId||instance.weaponMount||!this.weaponTemplates.has(weaponId)))return;
  instance.weaponId=weaponId||'';
  if(instance.weaponMount)instance.weaponMount.visible=false;
  instance.weaponMount=null;
  if(!weaponId||!this.weaponTemplates.has(weaponId)||!instance.hand)return;
  const cached=instance.weaponMounts.get(weaponId);if(cached){cached.visible=true;instance.weaponMount=cached;return;}
  const source=this.weaponTemplates.get(weaponId),model=cloneSkinned(source),c=firstPersonCalibration(weaponId),grip=new THREE.Group(),nodes=new Map();
  model.traverse(o=>nodes.set(normBone(o.name),o));model.updateMatrixWorld(true);
  const supportOffset=new THREE.Vector3(...c.support).sub(nodes.get(c.supportNode)?.getWorldPosition(new THREE.Vector3())||new THREE.Vector3(...c.support));
  model.position.copy(new THREE.Vector3(...c.grip).multiplyScalar(-c.scale));model.scale.setScalar(c.scale);grip.add(model);
  const muzzle=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),new THREE.MeshBasicMaterial({color:0xffd78a,transparent:true,opacity:.9}));muzzle.position.copy(new THREE.Vector3(...c.muzzle).sub(new THREE.Vector3(...c.grip)).multiplyScalar(c.scale));muzzle.visible=false;grip.add(muzzle);
  Object.assign(grip.userData,{muzzle,calibration:c,nodes,supportOffset,contacts:{}});
  grip.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
  instance.holder.add(grip);instance.weaponMount=grip;instance.weaponMounts.set(weaponId,grip);
 }
 updateGroundWeapons(pickups,time,eye){if(!this.groundInstances)this.groundInstances=new Map();const active=new Set();for(const item of pickups){if(!this.weaponTemplates.has(item.type))continue;active.add(item.id);let visual=this.groundInstances.get(item.id);if(!visual){visual=createGroundWeapon(this.weaponTemplates.get(item.type),item.type);this.groundInstances.set(item.id,visual);this.scene.add(visual);}visual.visible=Math.hypot(item.x-eye[0],item.z-eye[2])<90;if(!visual.visible)continue;const pose=groundWeaponPose(item,time);visual.position.set(item.x,pose.height,item.z);visual.rotation.y=pose.rotation;}for(const [id,visual]of this.groundInstances)if(!active.has(id)){this.scene.remove(visual);this.groundInstances.delete(id);}}
 getWeaponThumbnail(type){if(!this.weaponThumbnails)this.weaponThumbnails=new Map();if(this.weaponThumbnails.has(type))return this.weaponThumbnails.get(type);const template=this.weaponTemplates.get(type);if(!template)return null;if(!this.thumbnailRenderer){this.thumbnailRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true});this.thumbnailRenderer.setSize(256,144);this.thumbnailRenderer.setClearColor(0,0);this.thumbnailRenderer.outputColorSpace=THREE.SRGBColorSpace;this.thumbnailRenderer.toneMapping=THREE.ACESFilmicToneMapping;this.thumbnailRenderer.toneMappingExposure=1.18;}const scene=new THREE.Scene(),model=createGroundWeapon(template,type),bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());model.position.sub(center);scene.add(model);scene.add(new THREE.HemisphereLight(0xcceaff,0x40454b,2));const light=new THREE.DirectionalLight(0xffefd8,4);light.position.set(2,4,3);scene.add(light);const rim=new THREE.DirectionalLight(0x9bd8ff,2);rim.position.set(-2,2,-3);scene.add(rim);const camera=new THREE.PerspectiveCamera(35,256/144,.01,20),distance=Math.max(size.x,size.y,size.z)*1.15;camera.position.set(distance,.45*distance,.75*distance);camera.lookAt(0,0,0);this.thumbnailRenderer.render(scene,camera);const url=this.thumbnailRenderer.domElement.toDataURL('image/png');this.weaponThumbnails.set(type,url);return url;}
 hasFirstPersonWeapon(weaponId){return this.weaponTemplates.has(String(weaponId||''));}
 _firstPersonWeapon(weaponId){
  let instance=this.firstPersonInstances.get(weaponId);if(instance)return instance;
  const source=this.weaponTemplates.get(weaponId);if(!source)return null;
  const model=cloneSkinned(source);model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),length=size.z,c=firstPersonCalibration(weaponId),nodes=new Map();
  let trigger=null,muzzle=null,magazine=null,bolt=null,pump=null;
  model.traverse(object=>{nodes.set(normBone(object.name),object);if(!object.isBone)return;const name=normBone(object.name);if(name==='trigger')trigger=object;else if(name==='attachmuzzle')muzzle=object;else if(name==='magazine')magazine=object;else if(name==='bolt')bolt=object;else if(name==='pump')pump=object;});
  const triggerPoint=trigger?trigger.getWorldPosition(new THREE.Vector3()):bounds.getCenter(new THREE.Vector3());
  const supportOffset=new THREE.Vector3(...c.support).sub(nodes.get(c.supportNode)?.getWorldPosition(new THREE.Vector3())||new THREE.Vector3(...c.support));
  model.position.sub(new THREE.Vector3(...c.grip));
  const basis=new THREE.Group();basis.rotation.set(...c.basis);
  basis.add(model);
  const root=new THREE.Group(),mount=new THREE.Group();root.add(mount);mount.add(basis);this.firstPersonScene.add(root);
  const flashGroup=new THREE.Group(),flashMaterial=new THREE.MeshBasicMaterial({color:0xffd47b,transparent:true,opacity:.98,depthWrite:false});
  const flashCore=new THREE.Mesh(new THREE.SphereGeometry(.018,10,7),flashMaterial);flashGroup.add(flashCore);
  const flashGlow=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),new THREE.MeshBasicMaterial({color:0xff8f38,transparent:true,opacity:.52,depthWrite:false}));flashGroup.add(flashGlow);
  flashGroup.add(new THREE.PointLight(0xffb052,2.3,1.8));
  flashGroup.position.copy(new THREE.Vector3(...c.muzzle).sub(new THREE.Vector3(...c.grip)));basis.add(flashGroup);const streak=new THREE.Mesh(new THREE.ConeGeometry(.022,.13,8),flashMaterial);streak.rotation.x=-Math.PI/2;streak.position.z=-.05;flashGroup.add(streak);
  flashGroup.scale.setScalar(1);
  const bones=[magazine,bolt,pump].filter(Boolean).map(bone=>({bone,position:bone.position.clone(),rotation:bone.rotation.clone()}));
  instance={root,mount,basis,model,length,triggerPoint,weaponId,flashGroup,flashMaterial,bones,magazine,bolt,pump,c,nodes,supportOffset};
  this.firstPersonInstances.set(weaponId,instance);return instance;
 }
 renderFirstPersonWeapon(weaponId,profile,state,parts,{flash=0,dt=.016,width=this.canvas.width,height=this.canvas.height}={}){
  for(const [id,weapon] of this.firstPersonInstances)weapon.root.visible=id===weaponId;for(const utility of this.utilities?.values()||[])utility.visible=false;
  const instance=this._firstPersonWeapon(weaponId);if(!instance)return false;instance.root.visible=true;
  instance.reloadTilt=(instance.reloadTilt||0)+((parts?.rootTilt||0)-(instance.reloadTilt||0))*(1-Math.exp(-18*Math.min(.1,dt)));
  const c=instance.c,pose={position:state.position,rotation:[state.rotation[0]+instance.reloadTilt*.45,state.rotation[1],state.rotation[2]]};
  instance.root.position.set(...pose.position);instance.root.rotation.order='YXZ';instance.root.rotation.set(...pose.rotation);
  instance.mount.position.set(0,0,0);instance.basis.scale.setScalar(c.scale);
  const phase=String(parts?.stage||'idle'),progress=clamp(Number(parts?.progress??1),0,1),smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  let magazineOut=phase==='eject'?smooth((progress-.16)/.22):phase==='insert'?1-smooth((progress-.38)/.32):0;
  for(const entry of instance.bones){entry.bone.position.copy(entry.position);entry.bone.rotation.copy(entry.rotation);}
  // Convert model-space action travel to each bone's parent frame. These GLBs
  // have rotated bone axes; local Z is not the barrel direction.
  instance.root.updateMatrixWorld(true);
  const movePart=(bone,delta)=>{if(!bone)return;const worldDelta=new THREE.Vector3(...delta).transformDirection(instance.model.matrixWorld).multiplyScalar(new THREE.Vector3(...delta).length()*c.scale);const world=bone.getWorldPosition(new THREE.Vector3()).add(worldDelta);bone.position.copy(bone.parent.worldToLocal(world));instance.root.updateMatrixWorld(true);};
  movePart(instance.magazine,[0,-.16*magazineOut,0]);
  if(instance.pump){const cycle=Math.max(Number(parts?.action)||0,Math.sin(Math.PI*clamp(state.recoil||0,0,1))*.65);movePart(instance.pump,[0,0,.095*cycle]);}
  if(instance.bolt){const kick=flash>0?Math.min(1,flash/.09):Number(parts?.action)||0;movePart(instance.bolt,[0,0,.035*kick]);}
  instance.root.updateMatrixWorld(true);
  if(this.arms){
   const relative=point=>new THREE.Vector3(...point).sub(new THREE.Vector3(...c.grip)).multiplyScalar(c.scale).toArray();
   let support=relative(c.support),supportNode=instance.nodes.get(c.supportNode);
   if(supportNode){const point=instance.root.worldToLocal(supportNode.getWorldPosition(new THREE.Vector3()));point.addScaledVector(instance.supportOffset,c.scale);support=point.toArray();}
   const reach=phase==='idle'?0:phase==='release'?smooth(progress/.16):phase==='eject'?1:phase==='insert'?1-smooth((progress-.58)/.12):0;
   const reloadNode=instance.nodes.get(c.reloadNode),magazine=reloadNode?instance.root.worldToLocal(reloadNode.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(...c.reloadPalmOffset).multiplyScalar(c.scale)).toArray():relative(c.grip);
   support=support.map((v,i)=>v+(magazine[i]-v)*reach);
   poseSoldierArms(this.arms,{origin:pose.position,rotation:pose.rotation,ads:state.ads||0,hands:{right:{palm:relative(c.rightPalm),rotation:c.rightRotation,fingers:c.rightFingers,splay:c.rightSplay,thumbOpposition:c.rightThumbOpposition},left:{palm:support,...supportHandPose(c,reach)}}});
  }
  this.activeFirstPerson=instance;
  instance.flashGroup.visible=flash>0;
  if(instance.flashGroup.visible){const pulse=clamp(flash/.09,.25,1);instance.flashGroup.scale.setScalar(.72+pulse*.52);instance.flashMaterial.opacity=.72+pulse*.26;}
  if(width!==this.width||height!==this.height){this.width=width;this.height=height;this.renderer.setSize(width,height,false);}
  this.firstPersonCamera.aspect=Math.max(.1,width/Math.max(1,height));instance.viewFov=c.fov+(c.adsViewFov-c.fov)*clamp(state.ads||0,0,1);this.firstPersonCamera.fov=instance.viewFov;this.firstPersonCamera.updateProjectionMatrix();
  this.renderer.resetState();this.renderer.render(this.firstPersonScene,this.firstPersonCamera);this.restoreRawState();return true;
 }
 firstPersonMuzzleWorld(eye,forward,worldFov,weaponId){
  const instance=this.activeFirstPerson;if(!instance?.root.visible||(weaponId&&instance.weaponId!==weaponId))return null;
  instance.root.updateMatrixWorld(true);const p=instance.flashGroup.getWorldPosition(new THREE.Vector3()),f=new THREE.Vector3(...forward).normalize(),right=new THREE.Vector3().crossVectors(f,new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(right,f),ratio=Math.tan(worldFov/2)/Math.tan((instance.viewFov||instance.c.fov)*Math.PI/360);
  return new THREE.Vector3(...eye).addScaledVector(right,p.x*ratio).addScaledVector(up,p.y*ratio).addScaledVector(f,-p.z).toArray();
 }
 renderFirstPersonItem(id,state,player,{width=this.canvas.width,height=this.canvas.height}={}){
  if(!this.arms)return false;for(const weapon of this.firstPersonInstances.values())weapon.root.visible=false;
  let item=this.utilities.get(id);if(!item){item=createHeldItem(id);this.utilities.set(id,item);this.firstPersonScene.add(item);}for(const [key,value] of this.utilities)value.visible=key===id;
  const pose=characterActionPose(player),swing=pose.swing+pose.throw,use=pose.consume,bob=Math.sin(state.bobPhase||0)*.012*(player.moveSpeed>0?1:0);
  item.scale.setScalar(id==='pickaxe'?.68:1);item.position.set(.28-swing*.18+(state.swayX||0),(id==='pickaxe'?-.28:-.38)+use*.2+bob,-.78+swing*.16);item.rotation.set(-.15-swing*1.5+use*.65,.1,-.2-swing*.3);item.updateMatrixWorld(true);
  const right=item.localToWorld(new THREE.Vector3(0,-.04,.06)),left=id==='pickaxe'?new THREE.Vector3(-.38,-.65,-.38):item.localToWorld(new THREE.Vector3(-.12,-.1,.04));
  if(id==='pickaxe'){
   const fingers=PICKAXE_GRIP.fingers,q=item.getWorldQuaternion(new THREE.Quaternion()),rotation=new THREE.Euler().setFromQuaternion(q,'YXZ'),free=item.worldToLocal(left.clone());
   poseSoldierArms(this.arms,{origin:item.position.toArray(),rotation:[rotation.x,rotation.y,rotation.z],scale:item.scale.x,utility:true,hands:{right:PICKAXE_GRIP,left:{palm:free.toArray(),rotation:[-.8,0,-.2],fingers}}});
  }else poseSoldierArms(this.arms,{right:right.toArray(),left:left.toArray(),utility:true});
  this.firstPersonCamera.aspect=width/height;this.firstPersonCamera.fov=62;this.firstPersonCamera.updateProjectionMatrix();this.renderer.resetState();this.renderer.render(this.firstPersonScene,this.firstPersonCamera);this.restoreRawState();return true;
 }
 _create(id,source){
  const model=cloneSkinned(this.template),holder=new THREE.Group(),mixer=new THREE.AnimationMixer(model),actions=new Map(),bones=new Map();
  for(const state of this.clips.keys()){const action=mixer.clipAction(this.clips.get(state));action.setEffectiveWeight(0);action.play();actions.set(state,action);}
  let hand=null,rightArm=null,rightForeArm=null,leftArm=null,leftForeArm=null;
  model.traverse(object=>{if(object.isBone){bones.set(normBone(object.name),object);if(normBone(object.name)==='mixamorigrighthand')hand=object;}});
  rightArm=bones.get('mixamorigrightarm');rightForeArm=bones.get('mixamorigrightforearm');leftArm=bones.get('mixamorigleftarm');leftForeArm=bones.get('mixamorigleftforearm');
  model.scale.setScalar(this.modelScale);model.traverse(object=>{if(object.isMesh){object.castShadow=false;object.receiveShadow=true;object.frustumCulled=false;}});
  holder.add(model);this.scene.add(holder);const contactShadow=createContactShadow();this.scene.add(contactShadow);
  const animatedPose=new Map([...bones.values()].map(bone=>[bone,bone.quaternion.clone()])),fingerRest=new Map([...bones].filter(([name])=>/hand.*[123]$/.test(name)).map(([,bone])=>[bone,bone.quaternion.clone()]));
  const instance={id,holder,model,contactShadow,motion:createMotionPresentation(),mixer,actions,bones,animatedPose,fingerRest,hand,rightArm,rightForeArm,leftArm,leftForeArm,weaponId:'',weaponMount:null,weaponMounts:new Map(),utilityCache:new Map(),blend:createAnimationBlend('idle'),sequenceState:'',fireTime:0,crouchBlend:0,slideBlend:0,color:source.color||'#6f8470'};
  this._tint(instance,instance.color);return instance;
 }
 _tint(instance,value){
  instance.outfit??=createCharacterOutfit(instance.model);instance.bodyMaterials=instance.outfit.materials;applyCharacterOutfit(instance.outfit,value);instance.color=instance.outfit.color;
 }
 update(players=[],{localId='',hideId='',phase='playing',dt=.016}={}){
  if(!this.ready)return;
  if(this.arms)applyCharacterOutfit(this.arms.outfit,players.find(p=>String(p.id)===String(localId))?.color);
  const active=new Set();
  for(const p of players){
   if(!p?.id||p.hp<=0)continue;
   const id=String(p.id);active.add(id);let instance=this.instances.get(id);
   if(!instance){instance=this._create(id,p);this.instances.set(id,instance);}
   this._tint(instance,p.color);
   instance.holder.visible=id!==String(hideId);instance.holder.position.set(p.p?.[0]||0,p.p?.[1]||0,p.p?.[2]||0);instance.holder.rotation.y=Number.isFinite(p.yaw)?p.yaw:0;
   if(!instance.holder.visible){instance.contactShadow.visible=false;continue;}
   const opacity=Number.isFinite(p.cinematicOpacity)?clamp(p.cinematicOpacity,0,1):1;if(instance.cinematicOpacity!==opacity){for(const material of instance.bodyMaterials){const base=material.userData.cinematicBase;material.opacity=base.opacity*opacity;material.transparent=base.transparent||opacity<.999;material.depthWrite=base.depthWrite&&opacity>.99;}instance.cinematicOpacity=opacity;}
   const animation=characterLocomotion(p),motion=stepMotionPresentation(instance.motion,p,dt);instance.model.rotation.x=motion.lean;instance.model.rotation.z=-motion.strafe-motion.turn;
   const altitude=Math.max(0,p.p[1]-(p.groundY??p.p[1]));instance.contactShadow.visible=p.showShadow!==false&&instance.holder.visible&&p.air==='landed';instance.contactShadow.position.set(p.p[0],(p.groundY??p.p[1])+.025,p.p[2]);instance.contactShadow.material.opacity=.72/(1+altitude*.65);instance.contactShadow.scale.set(1.8+Math.min(altitude,4)*.18,1.3+Math.min(altitude,4)*.12,1);
   const blendState=animation.state==='slide'?'idle':animation.state==='crouch'&&animation.speed<.18?'idle':animation.state;
   instance.blend=stepAnimationBlend(instance.blend,{state:blendState,supported:this.supportedClips},dt);
   for(const [state,action] of instance.actions){action.setEffectiveWeight(instance.blend.weights[state]||0);if(state==='walk'||state==='run')action.setEffectiveTimeScale(clamp((p.moveSpeed||animation.speed)/(state==='run'?6.8:3.2),.65,1.4));}
   // Restore the last mixer pose before applying it again. Constant animation
   // tracks may skip writes, so additive layers must never become their input.
   for(const [bone,q] of instance.animatedPose)bone.quaternion.copy(q);
   instance.mixer.update(clamp(dt,0,.06));
   for(const [bone,q] of instance.animatedPose)q.copy(bone.quaternion);
   const poseBlend=1-Math.exp(-clamp(dt,0,.06)*13);instance.slideBlend+=(Number(Boolean(p.sliding))-instance.slideBlend)*poseBlend;instance.crouchBlend+=(Number(Boolean(p.crouching&&!p.sliding))-instance.crouchBlend)*poseBlend;
   const activeMatch=phase==='playing'&&p.deploymentState==='match_active',armed=activeMatch&&Boolean(inventoryWeapon(p.inventory,p.slot));
   this._weaponFor(instance,armed?inventoryWeapon(p.inventory,p.slot).type:null);
   instance.fireTime=Math.max(0,instance.fireTime-clamp(dt,0,.06));

   const aim=armed?(p.aim?.25:.07):0,run=instance.blend.weights.run||0,reload=armed?clamp((Number(p.reload)||0)/2.5,0,1):0,airborne=!animation.grounded;
   if(instance.rightArm){instance.rightArm.rotation.x-=aim+run*.08+reload*.3;instance.rightArm.rotation.z-=.08+run*.035;}
   if(instance.rightForeArm){instance.rightForeArm.rotation.x+=aim*.28+reload*.22;}
   if(instance.leftArm&&armed){instance.leftArm.rotation.x-=aim+.7;instance.leftArm.rotation.z+=.24;}
   if(instance.leftForeArm&&armed)instance.leftForeArm.rotation.x+=.26;
   if(airborne){if(instance.rightArm)instance.rightArm.rotation.x-=.23;if(instance.leftArm)instance.leftArm.rotation.x-=.2;for(const side of ['left','right']){const thigh=instance.bones.get(`mixamorig${side}upleg`),leg=instance.bones.get(`mixamorig${side}leg`);if(thigh)thigh.rotation.x-=p.vy>0?.24:.12;if(leg)leg.rotation.x+=p.vy>0?.38:.2;}}
   const utilityId=activeMatch&&!armed&&!p.building?(p.slot===7?'shield':p.slot===8?'health':p.slot===9?'shockwave':p.allowPickaxe===false?null:'pickaxe'):null;
   if(instance.utilityId!==utilityId){
    if(instance.utility)instance.utility.visible=false;
    instance.utility=utilityId?instance.utilityCache.get(utilityId):null;instance.utilityId=utilityId;
    if(utilityId&&!instance.utility&&instance.hand){instance.utility=createHeldItem(utilityId);instance.holder.updateMatrixWorld(true);const handScale=instance.hand.getWorldScale(new THREE.Vector3()).x;instance.utility.scale.setScalar(handAttachmentScale(handScale));instance.utility.position.set(0,.08/handScale,0);instance.hand.add(instance.utility);instance.utilityCache.set(utilityId,instance.utility);}
    if(instance.utility)instance.utility.visible=true;
   }

   const actionPose=characterActionPose(p),swing=actionPose.swing,throwing=actionPose.throw,consuming=actionPose.consume;
   if(instance.rightArm){instance.rightArm.rotation.x-=swing*1.45+throwing*1.7+consuming*.9;instance.rightArm.rotation.z-=swing*.18;}
   if(instance.rightForeArm)instance.rightForeArm.rotation.x-=swing*.45+throwing*.65+consuming*.75;
   if(instance.leftArm&&consuming)instance.leftArm.rotation.x-=consuming*.9;

   if(motion.landing>.001){for(const side of ['left','right']){const thigh=instance.bones.get(`mixamorig${side}upleg`),leg=instance.bones.get(`mixamorig${side}leg`);if(thigh)thigh.rotation.x-=motion.landing*.18;if(leg)leg.rotation.x+=motion.landing*.36;}instance.model.position.y=-motion.landing*.07;}else instance.model.position.y=0;
   const spine=instance.bones.get('mixamorigspine');if(spine)spine.rotation.y+=motion.turn*1.5;
   const crouch=instance.crouchBlend,slide=instance.slideBlend,crouchStep=Math.sin((Number(p.walk)||0)*2.15)*Math.min(1,(Number(p.moveSpeed)||0)/3.5)*crouch;
   instance.holder.position.y-=crouch*.16+slide*.42;instance.model.rotation.x+=slide*.12;
   const leftThigh=instance.bones.get('mixamorigleftupleg'),rightThigh=instance.bones.get('mixamorigrightupleg'),leftLeg=instance.bones.get('mixamorigleftleg'),rightLeg=instance.bones.get('mixamorigrightleg');
   if(leftThigh)leftThigh.rotation.x-=crouch*.36+crouchStep*.17;if(rightThigh)rightThigh.rotation.x-=crouch*.36-crouchStep*.17;
   if(leftLeg)leftLeg.rotation.x+=crouch*.68-crouchStep*.14;if(rightLeg)rightLeg.rotation.x+=crouch*.68+crouchStep*.14;
   const hips=instance.bones.get('mixamorighips'),slideSpine=instance.bones.get('mixamorigspine');if(hips)hips.rotation.x+=slide*.09;if(slideSpine)slideSpine.rotation.x+=slide*.16;
   // Solve the native legs against ground contacts rather than assuming bone axes.
   if(slide>.001){for(const [side,x,z,kneeZ] of [['left',-.13,-.58,-.6],['right',.13,.48,-.25]]){
    const thigh=instance.bones.get('mixamorig'+side+'upleg'),leg=instance.bones.get('mixamorig'+side+'leg'),foot=instance.bones.get('mixamorig'+side+'foot');if(!thigh||!leg||!foot)continue;
    instance.holder.updateMatrixWorld(true);const footOrientation=foot.getWorldQuaternion(new THREE.Quaternion()),base=[thigh,leg,foot].map(b=>b.quaternion.clone()),target=new THREE.Vector3(x,.13,z).applyAxisAngle(new THREE.Vector3(0,1,0),instance.holder.rotation.y).add(new THREE.Vector3(...p.p)),pole=new THREE.Vector3(x,side==='left'?.65:.08,kneeZ).applyAxisAngle(new THREE.Vector3(0,1,0),instance.holder.rotation.y).add(new THREE.Vector3(...p.p));
    poseLegChain(instance.model,instance.bones,side,target,pole);
    foot.quaternion.copy(foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(footOrientation));
    for(const [n,bone]of [thigh,leg,foot].entries())bone.quaternion.copy(base[n].slerp(bone.quaternion.clone(),slide));
   }}
   // Cinematic exit salute uses the native Soldier arm/finger rig. Apply
   // after mixer.update() so Idle cannot overwrite the gesture.
   const salute=clamp(Number(p.saluteProgress)||0,0,1);
   if(salute>.001)poseNativeSalute(instance,salute);
   if(armed&&instance.weaponMount)this._poseRemoteWeapon(instance,p,dt);
  }
  for(const [id,instance] of this.instances)if(!active.has(id)){this._disposeInstance(instance);this.instances.delete(id);}
 }
 _poseRemoteWeapon(instance,p,dt){
  const mount=instance.weaponMount,c=mount.userData.calibration,progress=p.reload?clamp(1-p.reload/(WEAPON_PROFILES[instance.weaponId]?.reloadDuration||2.5),0,1):1,reach=p.reload?Math.sin(Math.PI*progress):0;
  const desired=clamp(Number(p.pitch)||0,-.9,.7)+(p.reload?reach*.12:0);mount.userData.pitch=(mount.userData.pitch||0)+(desired-(mount.userData.pitch||0))*(1-Math.exp(-15*Math.min(.06,dt)));
  instance.holder.updateMatrixWorld(true);const shoulders=['right','left'].map(side=>instance.holder.worldToLocal(instance.bones.get(`mixamorig${side}arm`).getWorldPosition(new THREE.Vector3()))),center=shoulders[0].add(shoulders[1]).multiplyScalar(.5);
  mount.position.set(center.x+.16,center.y-.16+(p.aim?.03:0)+Math.max(0,-mount.userData.pitch)*.03,center.z-.16+instance.fireTime*.2);mount.rotation.set(mount.userData.pitch,0,0);mount.userData.muzzle.visible=instance.fireTime>.01;instance.holder.updateMatrixWorld(true);
  const point=v=>mount.localToWorld(new THREE.Vector3(...v).sub(new THREE.Vector3(...c.grip)).multiplyScalar(c.scale));
  const right=point(c.rightPalm),node=mount.userData.nodes.get(c.supportNode);let left=node?node.getWorldPosition(new THREE.Vector3()).add(mount.userData.supportOffset.clone().multiplyScalar(c.scale).applyQuaternion(mount.getWorldQuaternion(new THREE.Quaternion()))):point(c.support);
  // The native third-person arms are shorter than the camera rig's reach;
  // support the receiver/fore-end near its rear instead of stretching to its tip.
  const support=mount.worldToLocal(left);support.z=Math.max(-.09,support.z);left=mount.localToWorld(support);
  const magazine=mount.userData.nodes.get(c.reloadNode);if(magazine&&reach>0)left.lerp(magazine.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...c.reloadPalmOffset).multiplyScalar(c.scale).applyQuaternion(mount.getWorldQuaternion(new THREE.Quaternion()))),reach);
  const rotation=mount.getWorldQuaternion(new THREE.Quaternion());
  for(const [side,palm,spec,sign]of [['right',right,{rotation:c.rightRotation,fingers:c.rightFingers,splay:c.rightSplay,thumbOpposition:c.rightThumbOpposition},1],['left',left,supportHandPose(c,reach),-1]]){
   const orientation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...spec.rotation,'XYZ')).premultiply(rotation),pole=instance.holder.localToWorld(new THREE.Vector3(sign*.5,1.05,.1));poseWeaponHand(instance.model,instance.bones,side,palm,orientation,{...spec,rest:instance.fingerRest},pole);
  }
  mount.userData.contacts.right=right;mount.userData.contacts.left=left;
 }
 _disposeInstance(instance){
  instance.mixer.stopAllAction();this.scene.remove(instance.holder);this.scene.remove(instance.contactShadow);instance.contactShadow?.material.dispose();
  const materials=new Set(),geometries=new Set();
  for(const utility of instance.utilityCache.values())utility.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  for(const mount of instance.weaponMounts.values()){const muzzle=mount.userData.muzzle;if(muzzle){geometries.add(muzzle.geometry);materials.add(muzzle.material);}}
  // Body materials are per-player tints; shared asset geometry/textures stay alive.
  instance.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});
  for(const material of instance.bodyMaterials||[])materials.add(material);
  for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
 }
 pulse(id,type='fire'){const instance=this.instances.get(String(id));if(instance&&type==='fire')instance.fireTime=.11;}
 render({eye,target,aspect,fov,cinematic=false,quality='high',dt=.016,width=this.canvas.width,height=this.canvas.height}={}){
  if(!this.ready||!eye||!target)return;
  if(width!==this.width||height!==this.height){this.width=width;this.height=height;this.renderer.setSize(width,height,false);}
  this.camera.aspect=Math.max(.1,aspect||width/Math.max(1,height));this.camera.fov=Number.isFinite(fov)?fov*180/Math.PI:75;this.camera.position.set(...eye);this.camera.lookAt(...target);this.camera.updateProjectionMatrix();
  this.cinematicLight.intensity=cinematic?1.15:0;if(cinematic){this.cinematicLight.position.set(eye[0],eye[1]+.8,eye[2]);this.cinematicLight.target.position.set(...target);}
  this.renderer.resetState();
  if(this.activeMap==='facility'&&this.facilityEnvironment){this.facilityEnvironment.setQuality(quality);this.facilityEnvironment.update(this.camera,performance.now()/1000);renderFacilityPass(this.renderer,this.facilityScene,this.camera,this.facilityEnvironment.group,this.facilityDepthMaterials,{depth:false});this.facilityRenderStats={calls:this.renderer.info.render.calls+(this.facilityEnvironment.group.userData.depthCalls||0),colorCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles+(this.facilityEnvironment.group.userData.depthTriangles||0)};}
  this.renderer.render(this.scene,this.camera);
  // Restore the raw renderer's state before it draws the view model in its own pass.
  this.restoreRawState();
 }
 bindRawProgram(program,positionAttribute,colorAttribute){this.rawProgram=program;this.rawPosition=positionAttribute;this.rawColor=colorAttribute;}
 restoreRawState(){
  if(!this.rawProgram)return;
  // Raw attribute pointers must never modify the last Three mesh's cached VAO.
  // resetState detaches it and invalidates Three's texture/program state cache.
  this.renderer.resetState();
  const gl=this.gl;gl.useProgram(this.rawProgram);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.clearColor(.48,.77,.88,1);gl.enableVertexAttribArray(this.rawPosition);gl.enableVertexAttribArray(this.rawColor);
 }
}
