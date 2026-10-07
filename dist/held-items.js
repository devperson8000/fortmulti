import * as THREE from 'three';
export function createHeldItem(id){
 const group=new THREE.Group(),metal=new THREE.MeshStandardMaterial({color:0x8396a2,roughness:.38,metalness:.55}),grip=new THREE.MeshStandardMaterial({color:0x243941,roughness:.85}),accent=new THREE.MeshStandardMaterial({color:id==='shockwave'?0xbba0ff:0x79e4ee,emissive:id==='shockwave'?0x493278:0x154852,emissiveIntensity:.55});
 const add=(geometry,position,material)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);group.add(mesh);return mesh;};
 const box=(s,p,m)=>add(new THREE.BoxGeometry(...s),p,m);
 const cylinder=(radius,height,p,m)=>add(new THREE.CylinderGeometry(radius,radius,height,10),p,m);
 if(id==='pickaxe'){
  cylinder(.028,.75,[0,.08,0],grip);
  for(const y of [-.25,-.18,-.11,-.04])cylinder(.031,.014,[0,y,0],metal);
  cylinder(.035,.03,[0,-.3,0],metal);cylinder(.04,.055,[0,.405,0],metal);
  // A chamfered head catches light without another texture or shadow pass.
  const shape=new THREE.Shape();shape.moveTo(-.25,-.04);shape.lineTo(.23,-.04);shape.lineTo(.25,.025);shape.lineTo(-.22,.05);shape.closePath();
  const head=new THREE.ExtrudeGeometry(shape,{depth:.11,bevelEnabled:true,bevelSize:.007,bevelThickness:.007,bevelSegments:1,steps:1});
  add(head,[0,.46,-.055],metal);box([.14,.09,.13],[-.23,.42,0],metal).rotation.z=-.4;
  box([.16,.016,.125],[.15,.48,0],accent);
 }else if(id==='shockwave'){
  add(new THREE.IcosahedronGeometry(.13,1),[0,0,0],metal);
  for(const axis of [0,1]){const ring=add(new THREE.TorusGeometry(.135,.014,6,16),[0,0,0],accent);ring.rotation.x=axis*Math.PI/2;}
  add(new THREE.IcosahedronGeometry(.043,0),[0,.12,0],accent);
 }else if(id==='shield'){
  cylinder(.075,.23,[0,.08,0],accent);cylinder(.08,.035,[0,.212,0],metal);cylinder(.08,.03,[0,-.05,0],metal);
  box([.1,.025,.016],[0,.08,.071],metal);
 }else{
  box([.3,.18,.16],[0,.08,0],grip);box([.305,.025,.165],[0,.175,0],metal);
  box([.18,.035,.014],[0,.08,.088],accent);box([.035,.115,.014],[0,.08,.088],accent);
 }
 return group;
}
