import {WEAPON_ORDER} from './weapon-system.js';
import {ITEMS} from './items.js';
export function seededRandom(key){let n=2166136261;for(const c of String(key))n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export function chestLoot(chest,round=1){const random=seededRandom(`${round}:${chest.id}`),first=Math.floor(random()*4),types=[WEAPON_ORDER[first]];if(random()<.65)types.push(WEAPON_ORDER[(first+1+Math.floor(random()*3))%4]);const roll=random();types.push(roll<.6?'shield':roll<.78?'health':'shockwave');return types.map((type,i)=>({id:`${round}:${chest.id}:${i}`,type,count:ITEMS[type]?.stack||1,x:chest.x+(i-(types.length-1)/2)*1.05,y:chest.y||0,z:chest.z+1.1}));}
