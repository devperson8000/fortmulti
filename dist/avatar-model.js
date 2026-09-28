const oval=(id,position,size,material,options={})=>({id,shape:'oval',position,size,material,sides:options.sides||20,rings:options.rings||12,mirror:Boolean(options.mirror)});
const strap=(id,from,to,radius,material,options={})=>({id,shape:'tube',position:[0,0,0],from,to,size:[radius,radius,radius],material,sides:options.sides||14,mirror:Boolean(options.mirror)});

// Compact modern infantry kit. Coordinates are centered on the feet and face
// local -Z; large clean forms stay readable while small details remain muted.
export const AVATAR_MODEL_PARTS=Object.freeze([
 oval('uniform-torso',[0,1.49,0],[.39,.48,.285],'cloth',{sides:26,rings:16}),
 oval('shirt-front',[0,1.51,-.237],[.31,.37,.08],'base',{sides:24,rings:14}),
 oval('lower-shirt',[0,1.12,0],[.36,.25,.26],'cloth'),
 oval('neck',[0,1.96,0],[.13,.17,.125],'skin'),
 oval('face',[0,2.2,0],[.235,.285,.22],'skin',{sides:26,rings:16}),
 oval('stubble',[0,2.045,-.174],[.15,.085,.057],'face-detail'),
 oval('nose',[0,2.16,-.212],[.045,.075,.047],'skin',{sides:16,rings:10}),
 oval('eye',[.083,2.235,-.203],[.025,.019,.012],'face-detail',{mirror:true,sides:14,rings:9}),
 oval('brow',[.087,2.268,-.207],[.058,.016,.014],'face-detail',{mirror:true,sides:16,rings:9}),
 oval('helmet-shell',[0,2.465,.005],[.285,.17,.255],'helmet',{sides:28,rings:16}),
 oval('helmet-brim',[0,2.405,-.137],[.296,.045,.188],'helmet',{sides:24,rings:12}),
 oval('helmet-front-mount',[0,2.42,-.255],[.075,.065,.045],'dark',{sides:16,rings:10}),
 oval('helmet-rail',[.238,2.405,-.025],[.047,.145,.12],'dark',{mirror:true,sides:16,rings:10}),
 oval('headset-cup',[.26,2.205,.012],[.065,.105,.092],'dark',{mirror:true,sides:18,rings:11}),
 strap('headset-mic',[.25,2.18,-.03],[.155,2.095,-.17],.012,'dark'),
 oval('mic-tip',[.155,2.095,-.17],[.026,.022,.024],'dark',{sides:14,rings:9}),
 oval('sleeve-shoulder',[.405,1.78,0],[.17,.19,.18],'cloth',{mirror:true}),
 oval('carrier-body',[0,1.61,-.292],[.36,.315,.095],'carrier',{sides:26,rings:16}),
 oval('carrier-front-panel',[0,1.63,-.371],[.285,.245,.035],'pouch',{sides:24,rings:14}),
 oval('carrier-cummerbund',[.332,1.59,-.015],[.08,.265,.21],'carrier',{mirror:true}),
 strap('carrier-shoulder-strap',[.22,1.86,-.405],[.145,1.34,-.405],.03,'webbing',{mirror:true}),
 oval('magazine-pouch',[.145,1.49,-.414],[.115,.145,.055],'pouch',{mirror:true,sides:18,rings:11}),
 oval('utility-belt',[0,1.035,0],[.385,.095,.265],'webbing',{sides:26,rings:16}),
 oval('utility-pouch',[.295,1.13,-.17],[.105,.13,.105],'pouch',{mirror:true}),
 oval('radio',[.255,1.755,-.414],[.065,.115,.035],'dark',{sides:16,rings:10}),
 oval('backpack',[0,1.53,.285],[.24,.355,.16],'dark',{sides:24,rings:14}),
 oval('pack-pocket',[.15,1.47,.405],[.09,.19,.09],'pouch',{mirror:true}),
 strap('pack-strap',[.17,1.86,.29],[.21,1.25,.38],.023,'webbing',{mirror:true})
].map(part=>Object.freeze({...part,position:Object.freeze(part.position),size:Object.freeze(part.size),...(part.from?{from:Object.freeze(part.from)}:{}),...(part.to?{to:Object.freeze(part.to)}:{})})));

export const AVATAR_GEAR=Object.freeze({
 thighPanel:Object.freeze({size:Object.freeze([.14,.18,.145]),material:'cloth',mirror:true}),
 kneeGuard:Object.freeze({size:Object.freeze([.15,.135,.065]),inset:Object.freeze([.105,.085,.025]),material:'dark',mirror:true}),
 shinPanel:Object.freeze({size:Object.freeze([.095,.145,.045]),material:'cloth',mirror:true}),
 boot:Object.freeze({ankle:Object.freeze([.16,.15,.15]),toe:Object.freeze([.175,.125,.255]),sole:Object.freeze([.18,.038,.225]),mirror:true}),
 wristCuff:Object.freeze({size:Object.freeze([.12,.05,.115]),material:'webbing',mirror:true}),
 glove:Object.freeze({size:Object.freeze([.12,.095,.14]),material:'dark',mirror:true})
});

export const AVATAR_GEAR_FEATURES=Object.freeze(Object.keys(AVATAR_GEAR));

export function estimateAvatarTriangles(){
 let total=0;
 for(const part of AVATAR_MODEL_PARTS){
  const copies=part.mirror?2:1;
  total+=part.shape==='tube'?part.sides*4*copies:part.sides*2*(part.rings-1)*copies;
 }
 return total;
}
