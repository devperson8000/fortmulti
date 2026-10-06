export const MATERIALS=Object.freeze({wood:Object.freeze({cost:10,hp:150,yield:10,color:'#bf9058'}),stone:Object.freeze({cost:10,hp:360,yield:8,color:'#929eae'})});
export const ITEMS=Object.freeze({shield:Object.freeze({slot:7,name:'SHIELD CELL',stack:3,max:6,duration:3,amount:25}),health:Object.freeze({slot:8,name:'MED KIT',stack:1,max:2,duration:5,amount:100}),shockwave:Object.freeze({slot:9,name:'SHOCKWAVE',stack:2,max:6,duration:0})});
export const ITEM_SLOTS=Object.freeze({7:'shield',8:'health',9:'shockwave'});
export const LIMITS=Object.freeze({loot:192,grenades:24,structures:260,material:999,interaction:3.2,harvest:3.6,harvestDamage:25,harvestInterval:.48});
export const validSlot=n=>Number.isInteger(n)&&n>=0&&n<=10;
export function beginUse(p){const id=ITEM_SLOTS[p.slot],item=ITEMS[id];if(!item?.duration||p.use||!p.items[id]||(id==='shield'?p.shield>=100:p.hp>=100))return false;p.use={id,slot:p.slot,remaining:item.duration,duration:item.duration};return true;}
export function advanceUse(p,dt){if(!p.use)return false;const use=p.use;if(p.hp<=0||p.slot!==use.slot||!p.items[use.id]){p.use=null;return false;}use.remaining=Math.max(0,use.remaining-dt);if(use.remaining>1e-7)return false;if(use.id==='shield')p.shield=Math.min(100,p.shield+25);else p.hp=100;p.items[use.id]--;p.use=null;return true;}
