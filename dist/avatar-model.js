const oval=(id,position,size,material,options={})=>({id,shape:'oval',position,size,material,sides:options.sides||24,rings:options.rings||14,mirror:Boolean(options.mirror)});
const strap=(id,from,to,radius,material,options={})=>({id,shape:'tube',position:[0,0,0],from,to,size:[radius,radius,radius],material,sides:options.sides||20,mirror:Boolean(options.mirror)});

// A reusable, original "trail runner" outfit: fitted field jacket, compact
// chest rig, clean head silhouette, readable shoulder and pack layers.
// Coordinates are centered on the feet, facing local -Z.
export const AVATAR_MODEL_PARTS=Object.freeze([
 oval('jacket-core',[0,1.48,0],[.405,.49,.29],'cloth',{sides:30,rings:18}),
 oval('jacket-front',[0,1.53,-.265],[.345,.385,.075],'base',{sides:30,rings:18}),
 oval('lower-jacket',[0,1.13,0],[.37,.27,.275],'base'),
 oval('neck-wrap',[0,1.91,-.01],[.205,.15,.185],'trim'),
 oval('neck',[0,1.98,0],[.125,.15,.12],'skin'),
 oval('head',[0,2.21,0],[.25,.3,.235],'skin',{sides:30,rings:18}),
 oval('hair-cap',[0,2.43,.015],[.27,.14,.245],'hair'),
 oval('hair-fringe',[0,2.32,-.179],[.245,.105,.085],'hair'),
 oval('hair-side',[.235,2.28,.015],[.075,.17,.18],'hair',{mirror:true}),
 oval('ear',[.25,2.2,0],[.046,.07,.045],'skin',{mirror:true,sides:18,rings:11}),
 oval('brow',[.092,2.275,-.22],[.072,.018,.017],'hair',{mirror:true,sides:18,rings:10}),
 oval('visor-lens',[.09,2.22,-.226],[.068,.035,.018],'glass',{mirror:true,sides:20,rings:12}),
 oval('visor-bridge',[0,2.22,-.234],[.042,.032,.018],'metal',{sides:18,rings:10}),
 oval('shoulder-pad',[.415,1.79,-.015],[.225,.205,.235],'base',{mirror:true}),
 oval('shoulder-inset',[.435,1.82,-.205],[.15,.13,.05],'trim',{mirror:true,sides:20,rings:12}),
 oval('chest-rig',[0,1.61,-.317],[.3,.275,.052],'dark',{sides:28,rings:16}),
 oval('chest-plate',[0,1.62,-.357],[.23,.19,.028],'accent',{sides:28,rings:16}),
 oval('chest-emblem',[0,1.66,-.384],[.065,.052,.014],'gold',{sides:18,rings:10}),
 strap('harness-strap',[.235,1.85,-.27],[.145,1.24,-.385],.026,'trim',{mirror:true}),
 strap('chest-seam',[-.28,1.5,-.39],[.28,1.5,-.39],.012,'metal'),
 oval('utility-belt',[0,1.035,0],[.402,.105,.285],'dark',{sides:28,rings:16}),
 oval('belt-clasp',[0,1.04,-.289],[.087,.076,.025],'gold',{sides:18,rings:10}),
 oval('utility-pouch',[.285,1.29,-.145],[.11,.12,.105],'dark',{mirror:true}),
 oval('pouch-flap',[.285,1.34,-.217],[.084,.052,.025],'trim',{mirror:true,sides:18,rings:10}),
 oval('backpack',[0,1.51,.29],[.255,.36,.18],'dark',{sides:28,rings:16}),
 oval('pack-top',[0,1.79,.45],[.225,.09,.035],'metal'),
 oval('pack-side-pocket',[.235,1.5,.32],[.065,.17,.13],'base',{mirror:true}),
 strap('pack-webbing',[.17,1.8,.46],[.21,1.2,.47],.022,'trim',{mirror:true}),
 oval('hip-panel',[.32,.91,-.08],[.095,.18,.15],'cloth',{mirror:true}),
 oval('radio',[.31,1.47,-.21],[.075,.12,.045],'metal',{sides:18,rings:10})
].map(part=>Object.freeze({...part,position:Object.freeze(part.position),size:Object.freeze(part.size),...(part.from?{from:Object.freeze(part.from)}:{}),...(part.to?{to:Object.freeze(part.to)}:{})})));

export const AVATAR_GEAR=Object.freeze({
 thighPanel:Object.freeze({size:Object.freeze([.15,.2,.16]),material:'cloth',mirror:true}),
 kneeGuard:Object.freeze({size:Object.freeze([.16,.15,.075]),inset:Object.freeze([.105,.087,.025]),material:'metal',mirror:true}),
 shinPanel:Object.freeze({size:Object.freeze([.105,.19,.055]),material:'base',mirror:true}),
 boot:Object.freeze({ankle:Object.freeze([.17,.145,.16]),toe:Object.freeze([.19,.13,.29]),sole:Object.freeze([.185,.045,.245]),mirror:true}),
 wristCuff:Object.freeze({size:Object.freeze([.135,.065,.13]),material:'trim',mirror:true}),
 glove:Object.freeze({size:Object.freeze([.128,.105,.155]),material:'dark',mirror:true}),
 knuckle:Object.freeze({size:Object.freeze([.035,.023,.02]),material:'metal',mirror:true})
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
