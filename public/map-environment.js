// Kenney Nature Kit (CC0 1.0) low-poly GLB assets, stored locally.
// https://kenney.nl/assets/nature-kit
export const ENVIRONMENT_MODELS=Object.freeze({
 wood:Object.freeze(['tree-pinedefaulta','tree-pinetallb','tree-oak','tree-default','tree-palmtall']),
 stone:Object.freeze(['rock-largea','rock-largec'])
});
export const ENVIRONMENT_MODEL_FILES=Object.freeze(Object.values(ENVIRONMENT_MODELS).flat().map(name=>name+'.glb'));
const hash=n=>{const x=Math.sin(n*91.137+12.71)*43758.5453;return x-Math.floor(x);};
export function environmentPlacement(resource){
 if(!resource||!['wood','stone'].includes(resource.kind)||!Number.isFinite(resource.x)||!Number.isFinite(resource.y)||!Number.isFinite(resource.z))return null;
 const id=Number(resource.id?.split(':').at(-1)),index=Number.isFinite(id)?id:0;
 const a=hash(index+29),b=hash(index+73),r=Math.hypot(resource.x,resource.z);
 let name;
 if(resource.kind==='stone')name=ENVIRONMENT_MODELS.stone[index%2];
 else if(r>215&&b>.5)name='tree-palmtall';
 else if(resource.x<-35)name=index%3===0?'tree-pinetallb':'tree-pinedefaulta';
 else name=index%3===0?'tree-oak':index%3===1?'tree-default':'tree-pinedefaulta';
 return {id:resource.id,kind:resource.kind,name,x:resource.x,y:resource.y,z:resource.z,
  height:resource.kind==='stone'?1.45+a*1.5:6.8+a*4.5,
  rotation:b*Math.PI*2};
}
export function environmentPlacements(resources){
 return (resources||[]).map(environmentPlacement).filter(Boolean);
}
