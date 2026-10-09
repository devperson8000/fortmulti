import * as THREE from 'three';

export function outfitColor(value){
 const hex=String(value||'').replace(/^#/,'').toLowerCase();
 return /^[0-9a-f]{6}$/.test(hex)?'#'+hex:'#408faf';
}

// Keep textures/geometry shared, but give each soldier its own reusable materials.
export function createCharacterOutfit(model){
 const copies=new Map(),materials=[],uniform=[];
 model.traverse(object=>{
  if(!object.isMesh)return;
  const copy=source=>{
   if(copies.has(source))return copies.get(source);
   const material=source.clone();copies.set(source,material);materials.push(material);
   material.userData.cinematicBase={opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite};
   if(material.color&&!/visor/i.test(source.name||''))uniform.push({material,base:material.color.clone()});
   return material;
  };
  object.material=Array.isArray(object.material)?object.material.map(copy):copy(object.material);
 });
 return {materials,uniform,color:null};
}

export function applyCharacterOutfit(outfit,value){
 const color=outfitColor(value);if(outfit.color===color)return false;
 const tint=new THREE.Color('#ffffff').lerp(new THREE.Color(color),.8);
 for(const {material,base}of outfit.uniform)material.color.copy(base).multiply(tint);
 outfit.color=color;return true;
}
