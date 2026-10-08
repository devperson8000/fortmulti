// Resolve opaque visibility before sampling the detailed material textures.
// Glass keeps its color-pass transparency and does not occlude the rooms behind it.
export function prepareFacilityDepth(group,depthMaterials){for(const mesh of group.children){mesh.userData.colorMaterial=mesh.material;mesh.userData.colorVisibility=mesh.visible;if(mesh.material.transparent)mesh.visible=false;else mesh.material=depthMaterials[mesh.material.side];}}
export function restoreFacilityColor(group){for(const mesh of group.children){mesh.material=mesh.userData.colorMaterial;mesh.visible=mesh.userData.colorVisibility;}}
export function renderFacilityPass(renderer,scene,camera,group,depthMaterials,{depth=true}={}){if(!depth){group.userData.depthCalls=0;group.userData.depthTriangles=0;renderer.render(scene,camera);return;}prepareFacilityDepth(group,depthMaterials);try{renderer.render(scene,camera);}finally{restoreFacilityColor(group);}group.userData.depthCalls=renderer.info?.render.calls||0;group.userData.depthTriangles=renderer.info?.render.triangles||0;renderer.render(scene,camera);}

// Shader compilation alone leaves texture and vertex uploads until first visibility.
// Initialize those resources while the lobby still reports that the map is loading.
export function warmFacilityResources(renderer,scene,camera,group){
 const uploaded=new Set();
 for(const mesh of group.children)for(const material of [mesh.material,mesh.userData.standardMaterial,mesh.userData.simpleMaterial]){
  if(!material)continue;
  for(const value of Object.values(material))if(value?.isTexture&&!uploaded.has(value)){renderer.initTexture(value);uploaded.add(value);}
 }
 renderer.render(scene,camera);
}
