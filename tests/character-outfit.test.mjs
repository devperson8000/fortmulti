import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCharacterOutfit,applyCharacterOutfit,outfitColor} from '../public/character-outfit.js';

function soldier(){
 const model=new THREE.Group(),body=new THREE.MeshStandardMaterial({color:0xe7e7e7,map:new THREE.Texture()}),visor=body.clone();
 body.name='VanguardBodyMat';visor.name='Vanguard_VisorMat';
 model.add(new THREE.Mesh(new THREE.BoxGeometry(),body),new THREE.Mesh(new THREE.BoxGeometry(),visor));return model;
}
test('outfit colors accept saved and network hex values without CSS color warnings',()=>{
 assert.equal(outfitColor('557959'),'#557959');assert.equal(outfitColor('#DC8255'),'#dc8255');assert.equal(outfitColor('invalid'),'#408faf');
});
test('uniform presets are visible, deterministic and independent for each player',()=>{
 const template=soldier(),a=template.clone(true),b=template.clone(true),oa=createCharacterOutfit(a),ob=createCharacterOutfit(b),original=template.children[0].material.color.clone();
 applyCharacterOutfit(oa,'408faf');applyCharacterOutfit(ob,'557959');const azure=a.children[0].material.color.clone(),forest=b.children[0].material.color.clone();
 assert.ok(Math.hypot(azure.r-forest.r,azure.g-forest.g,azure.b-forest.b)>.1);assert.equal(a.children[0].material.map,template.children[0].material.map);assert.equal(a.children[0].geometry,template.children[0].geometry);
 const material=a.children[0].material;applyCharacterOutfit(oa,'dc8255');applyCharacterOutfit(oa,'408faf');assert.ok(material.color.equals(azure));assert.equal(a.children[0].material,material);
 assert.ok(b.children[0].material.color.equals(forest));assert.ok(template.children[0].material.color.equals(original));assert.ok(a.children[1].material.color.equals(original));assert.equal(applyCharacterOutfit(oa,'#408faf'),false);
});
test('outfit changes preserve cinematic fade state and clone a shared material only once',()=>{
 const model=soldier();model.add(new THREE.Mesh(model.children[0].geometry,model.children[0].material));const o=createCharacterOutfit(model);
 assert.equal(o.materials.length,2);assert.equal(model.children[0].material,model.children[2].material);const m=o.materials[0];m.opacity=.4;m.transparent=true;m.depthWrite=false;
 applyCharacterOutfit(o,'8668bb');assert.equal(m.opacity,.4);assert.equal(m.transparent,true);assert.equal(m.depthWrite,false);assert.deepEqual(m.userData.cinematicBase,{opacity:1,transparent:false,depthWrite:true});
});
test('native match soldier and first-person sleeves apply the local preset and update without material churn',async()=>{
 const {readFile}=await import('node:fs/promises'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{MatchCharacterRenderer}=await import('../public/match-character-renderer.js');
 const loader=new GLTFLoader().register(()=>({name:'TestTextures',loadTexture:()=>Promise.resolve(new THREE.Texture())})),bytes=await readFile(new URL('../public/models/Soldier.glb',import.meta.url)),asset=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const r=Object.create(MatchCharacterRenderer.prototype);Object.assign(r,{scene:new THREE.Scene(),firstPersonScene:new THREE.Scene(),instances:new Map(),weaponTemplates:new Map(),clips:new Map()});r._loaded(asset);
 const player={id:'local',hp:100,p:[0,0,0],grounded:true,animationState:'idle',color:'408faf'};
 r.update([player],{localId:'local',hideId:'local'});const instance=r.instances.get('local'),materials=[...instance.bodyMaterials];assert.equal(instance.outfit.color,'#408faf');assert.equal(r.arms.outfit.color,'#408faf');
 const base=instance.outfit.uniform[0].material.color.clone();player.color='dc8255';r.update([player],{localId:'local',hideId:'local'});assert.equal(instance.outfit.color,'#dc8255');assert.ok(!base.equals(instance.outfit.uniform[0].material.color));assert.deepEqual(instance.bodyMaterials,materials);assert.ok(instance.outfit.uniform[0].material.color.equals(r.arms.outfit.uniform[0].material.color));
});
