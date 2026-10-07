import * as THREE from 'three';
// Measure the visible trigger mesh, not its hinge bone above the finger guard.
export function triggerSurfaceContact(model,rotation,scale){
 const points=[];model.updateMatrixWorld(true);
 model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const bone=mesh.skeleton.bones.findIndex(b=>b.name.toLowerCase()==='trigger'),indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  for(let i=0;i<indices.count;i++){let weight=0;for(let k=0;k<4;k++)if(indices.getComponent(i,k)===bone)weight+=weights.getComponent(i,k);if(weight>.5)points.push(mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));}
 });
 if(!points.length)throw Error('Weapon has no trigger vertices');
 return new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3()).add(new THREE.Vector3(.008*scale,0,-.002*scale).applyQuaternion(rotation));
}
export function weaponPartTriangles(model,name){
 const triangles=[];model.updateMatrixWorld(true);
 model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const bone=mesh.skeleton.bones.findIndex(b=>b.name.toLowerCase()===name),skin=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight,index=mesh.geometry.index;
  const belongs=i=>{let w=0;for(let k=0;k<4;k++)if(skin.getComponent(i,k)===bone)w+=weights.getComponent(i,k);return w>.5;};
  for(let i=0;i<index.count;i+=3){const ids=[0,1,2].map(k=>index.getX(i+k));if(ids.every(belongs))triangles.push(new THREE.Triangle(...ids.map(i=>mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld))));}
 });return triangles;
}
