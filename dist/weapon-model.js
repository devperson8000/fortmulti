const box=(id,position,size,material,options={})=>({id,shape:'box',position,size,material,rotation:options.rotation||0,motion:options.motion||null});
const oval=(id,position,size,material,options={})=>({id,shape:'oval',position,size,material,sides:options.sides||22,rings:options.rings||13,motion:options.motion||null});
const tube=(id,from,to,radius,material,options={})=>({id,shape:'tube',position:[0,0,0],from,to,size:[radius,radius,radius],material,sides:options.sides||20,motion:options.motion||null});
const mirror=(id,x,y,z,radius,material)=>oval(id,[x,y,z],[radius,radius,radius],material,{sides:18,rings:11});
const freeze=parts=>Object.freeze(parts.flatMap(part=>{
 const entries=part.motion==='magazine'?[part,{...part,id:`fresh-${part.id}`,motion:'freshMagazine'}]:[part];
 return entries.map(entry=>Object.freeze({...entry,position:Object.freeze(entry.position),size:Object.freeze(entry.size),...(entry.from?{from:Object.freeze(entry.from)}:{}),...(entry.to?{to:Object.freeze(entry.to)}:{})}));
}));

// Custom game prop designs. The shared layouts feed both the remote avatar
// renderer and the first-person viewmodel so details and reload motion agree.
export const WEAPON_MODELS=Object.freeze({
 ar:Object.freeze({parts:freeze([
  box('receiver',[0,0,0],[.24,.22,.52],'metal'),box('upper-receiver',[0,.105,-.09],[.205,.085,.49],'dark'),
  box('stock',[0,.02,.48],[.22,.205,.49],'stock'),box('stock-cheek',[0,.133,.45],[.205,.055,.31],'trim'),
  box('handguard',[0,.015,-.48],[.215,.17,.43],'dark'),tube('barrel',[0,.02,-.62],[0,.02,-1.27],.049,'metal',{sides:28}),
  tube('muzzle',[0,.02,-1.22],[0,.02,-1.36],.078,'accent',{sides:28}),
  box('grip',[0,-.19,.16],[.13,.32,.18],'dark',{rotation:-.18}),box('grip-panel',[0,-.21,.17],[.135,.17,.185],'trim',{rotation:-.18}),
  box('mag-well',[0,-.16,-.05],[.16,.2,.18],'dark'),box('magazine',[0,-.32,-.02],[.155,.37,.2],'accent',{motion:'magazine'}),
  box('mag-floor',[0,-.51,-.02],[.17,.035,.22],'metal',{motion:'magazine'}),
  box('top-rail',[0,.18,-.26],[.115,.045,.52],'metal'),box('rail-left',[-.125,.015,-.42],[.035,.065,.34],'metal'),box('rail-right',[.125,.015,-.42],[.035,.065,.34],'metal'),
  box('optic-foot',[0,.225,-.23],[.11,.07,.13],'dark'),tube('optic-body',[0,.29,-.17],[0,.29,-.47],.095,'metal',{sides:24}),
  oval('optic-glass',[0,.29,-.48],[.075,.075,.018],'glass',{sides:24,rings:14}),
  box('front-sight',[0,.195,-.99],[.06,.13,.075],'accent'),box('rear-sight',[0,.205,.02],[.07,.1,.08],'accent'),
  box('charging-handle',[0,.17,.005],[.15,.035,.12],'metal',{motion:'action'}),
  box('bolt',[0,.115,-.14],[.07,.035,.18],'accent',{motion:'bolt'}),
  tube('trigger-guard-left',[-.075,-.09,.02],[-.075,-.235,.12],.016,'metal',{sides:12}),tube('trigger-guard-right',[.075,-.09,.02],[.075,-.235,.12],.016,'metal',{sides:12}),tube('trigger-guard-base',[-.075,-.235,.12],[.075,-.235,.12],.016,'metal',{sides:12}),
  box('ejection-cover',[.128,.045,-.08],[.018,.09,.2],'trim'),box('selector',[.15,-.045,.1],[.06,.025,.11],'gold'),
  ...Array.from({length:7},(_,index)=>box(`handguard-vent-${index}`,[0,.105,-.35+index*.055],[.228,.018,.025],index%2?'accent':'metal')),
  mirror('receiver-pin-left',-.132,-.025,.03,.026,'gold'),mirror('receiver-pin-right',.132,-.025,.03,.026,'gold')
 ])}),
 shotgun:Object.freeze({parts:freeze([
  box('receiver',[0,0,0],[.29,.24,.48],'dark'),box('receiver-cap',[0,.13,.01],[.27,.06,.33],'metal'),
  box('stock',[0,.015,.46],[.25,.23,.56],'stock'),oval('stock-pad',[0,0,.72],[.14,.18,.035],'dark',{sides:20,rings:12}),
  box('fore-end',[0,-.035,-.47],[.29,.19,.32],'accent',{motion:'pump'}),box('pump-grip',[0,-.04,-.48],[.3,.1,.25],'trim',{motion:'pump'}),
  box('grip',[0,-.18,.19],[.16,.31,.18],'dark',{rotation:-.16}),
  ...Array.from({length:6},(_,index)=>box(`pump-rib-${index}`,[0,.018,-.57+index*.04],[.306,.022,.014],'metal',{motion:'pump'})),
  tube('barrel',[0,.055,-.59],[0,.055,-1.38],.065,'metal',{sides:28}),tube('muzzle',[0,.055,-1.33],[0,.055,-1.45],.088,'accent',{sides:28}),
  tube('shell-tube',[0,-.15,-.53],[0,-.15,-1.18],.062,'dark',{sides:22}),
  box('mag-well',[0,-.14,-.11],[.2,.15,.2],'dark'),box('magazine',[0,-.3,-.08],[.19,.29,.17],'accent',{motion:'magazine'}),
  box('mag-floor',[0,-.45,-.08],[.2,.035,.18],'metal',{motion:'magazine'}),
  box('rail',[0,.18,-.34],[.11,.04,.48],'metal'),box('front-sight',[0,.18,-1.19],[.055,.09,.06],'gold'),
  box('rear-sight',[0,.19,.01],[.06,.075,.07],'gold'),box('bolt',[0,.12,-.1],[.065,.04,.18],'accent',{motion:'bolt'}),
  tube('trigger-guard-left',[-.08,-.1,.04],[-.08,-.22,.13],.016,'metal',{sides:12}),tube('trigger-guard-right',[.08,-.1,.04],[.08,-.22,.13],.016,'metal',{sides:12}),tube('trigger-guard-base',[-.08,-.22,.13],[.08,-.22,.13],.016,'metal',{sides:12}),
  ...Array.from({length:4},(_,index)=>oval(`shell-${index}`,[.17,-.08+index*.075,.31],[.035,.03,.055],'gold',{sides:14,rings:9})),
  box('receiver-mark',[0,.025,-.251],[.12,.07,.018],'accent'),oval('pump-bolt',[0,-.025,-.64],[.11,.055,.06],'gold',{sides:18,rings:10})
 ])}),
 smg:Object.freeze({parts:freeze([
  box('receiver',[0,0,0],[.25,.24,.42],'dark'),box('upper-receiver',[0,.112,-.06],[.2,.07,.35],'metal'),
  box('stock',[0,.01,.38],[.2,.19,.37],'trim'),box('stock-end',[0,.005,.56],[.23,.21,.08],'dark'),
  box('handguard',[0,.005,-.36],[.22,.16,.32],'accent'),tube('barrel',[0,.02,-.48],[0,.02,-.87],.043,'metal',{sides:26}),
  tube('muzzle',[0,.02,-.83],[0,.02,-.97],.072,'gold',{sides:26}),
  box('grip',[0,-.19,.1],[.13,.3,.16],'dark',{rotation:-.14}),box('grip-panel',[0,-.22,.11],[.137,.16,.17],'metal',{rotation:-.14}),
  box('mag-well',[0,-.13,-.04],[.17,.15,.18],'dark'),box('magazine',[0,-.32,-.025],[.16,.42,.18],'accent',{motion:'magazine'}),
  box('mag-floor',[0,-.535,-.025],[.17,.035,.19],'metal',{motion:'magazine'}),
  box('top-rail',[0,.17,-.25],[.11,.04,.44],'metal'),box('optic-foot',[0,.21,-.18],[.09,.055,.1],'dark'),tube('optic-body',[0,.26,-.17],[0,.26,-.34],.07,'accent',{sides:20}),
  oval('optic-glass',[0,.26,-.345],[.052,.052,.016],'glass',{sides:20,rings:12}),
  box('front-sight',[0,.18,-.76],[.05,.1,.06],'gold'),box('rear-sight',[0,.18,.025],[.055,.08,.06],'gold'),
  box('bolt',[0,.108,-.12],[.055,.035,.14],'gold',{motion:'bolt'}),box('charging-handle',[0,.15,.02],[.12,.035,.08],'metal',{motion:'action'}),
  ...Array.from({length:5},(_,index)=>box(`vent-${index}`,[0,.095,-.4+index*.055],[.228,.018,.025],index%2?'metal':'trim')),
  tube('trigger-guard-left',[-.07,-.08,.06],[-.07,-.205,.14],.014,'metal',{sides:12}),tube('trigger-guard-right',[.07,-.08,.06],[.07,-.205,.14],.014,'metal',{sides:12}),tube('trigger-guard-base',[-.07,-.205,.14],[.07,-.205,.14],.014,'metal',{sides:12}),
  mirror('receiver-pin-left',-.135,-.02,.04,.022,'gold'),mirror('receiver-pin-right',.135,-.02,.04,.022,'gold'),
  oval('rear-lamp',[0,.095,.18],[.07,.045,.04],'glass',{sides:16,rings:10})
 ])}),
 sniper:Object.freeze({parts:freeze([
  box('receiver',[0,0,0],[.25,.25,.55],'dark'),box('upper-receiver',[0,.125,-.08],[.2,.075,.5],'metal'),
  box('stock',[0,.02,.56],[.26,.24,.72],'stock'),oval('stock-pad',[0,.02,.9],[.145,.19,.04],'accent',{sides:20,rings:12}),
  box('cheek-rest',[0,.19,.48],[.18,.075,.4],'trim'),box('handguard',[0,.025,-.49],[.2,.15,.42],'dark'),box('grip',[0,-.19,.2],[.15,.31,.19],'dark',{rotation:-.16}),
  tube('barrel',[0,.035,-.65],[0,.035,-1.61],.052,'metal',{sides:30}),tube('muzzle',[0,.035,-1.55],[0,.035,-1.71],.09,'accent',{sides:30}),
  box('mag-well',[0,-.16,-.08],[.17,.18,.19],'dark'),box('magazine',[0,-.32,-.06],[.16,.33,.18],'accent',{motion:'magazine'}),
  box('mag-floor',[0,-.495,-.06],[.17,.035,.19],'metal',{motion:'magazine'}),
  box('top-rail',[0,.2,-.39],[.115,.045,.72],'metal'),tube('optic-body',[0,.34,-.23],[0,.34,-.78],.115,'dark',{sides:28}),
  oval('optic-glass',[0,.34,-.795],[.09,.09,.02],'glass',{sides:26,rings:16}),oval('optic-eye',[0,.34,.055],[.1,.1,.02],'glass',{sides:24,rings:14}),
  tube('optic-ring-front',[-.13,.34,-.68],[.13,.34,-.68],.045,'accent',{sides:16}),tube('optic-ring-rear',[-.13,.34,-.31],[.13,.34,-.31],.045,'accent',{sides:16}),
  oval('optic-turret',[0,.48,-.5],[.08,.08,.09],'gold',{sides:20,rings:12}),oval('optic-knob-left',[-.14,.34,-.5],[.06,.06,.09],'metal',{sides:18,rings:11}),
  box('front-sight',[0,.16,-1.32],[.055,.1,.06],'gold'),box('rear-sight',[0,.19,.07],[.06,.08,.08],'gold'),
  box('bolt-handle',[.18,.045,.06],[.12,.045,.08],'accent',{motion:'bolt'}),box('bolt',[0,.12,-.02],[.055,.04,.18],'gold',{motion:'action'}),
  box('bipod-hub',[0,-.09,-.72],[.14,.09,.13],'metal'),tube('bipod-left',[-.06,-.1,-.72],[-.19,-.43,-1.13],.022,'dark',{sides:16}),tube('bipod-right',[.06,-.1,-.72],[.19,-.43,-1.13],.022,'dark',{sides:16}),
  box('cheek-mark',[0,.235,.34],[.1,.02,.18],'gold'),
  tube('trigger-guard-left',[-.075,-.09,.12],[-.075,-.22,.22],.015,'metal',{sides:12}),tube('trigger-guard-right',[.075,-.09,.12],[.075,-.22,.22],.015,'metal',{sides:12}),tube('trigger-guard-base',[-.075,-.22,.22],[.075,-.22,.22],.015,'metal',{sides:12}),
  mirror('receiver-pin-left',-.14,-.035,.07,.024,'gold'),mirror('receiver-pin-right',.14,-.035,.07,.024,'gold')
 ])})
});

export function weaponModelStats(id){
 const parts=WEAPON_MODELS[id]?.parts||[];
 const triangles=parts.reduce((sum,part)=>sum+(part.shape==='box'?12:part.shape==='tube'?part.sides*4:part.sides*2*(part.rings-1)),0);
 return {parts:parts.length,triangles};
}
