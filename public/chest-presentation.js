export const CHEST_OPEN_SECONDS=.7;
export function chestPose(chest,progress=0){
 const angle=-Math.max(0,Math.min(1,progress))*1.35,hinge=[chest.x,chest.y+.69,chest.z-.38];
 return {body:[chest.x,chest.y+.35,chest.z],lid:[hinge[0],hinge[1]+.09*Math.cos(angle)-.38*Math.sin(angle),hinge[2]+.09*Math.sin(angle)+.38*Math.cos(angle)],angle};
}
