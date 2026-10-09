import {WEAPON_TYPES} from './weapon-system.js';
import {ITEMS} from './items.js';
import {segmentColliderTime,boundsIntersectCollider} from './collision-shapes.js';
export function seededRandom(key){let n=2166136261;for(const c of String(key))n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function supportedLootPosition(item,chest,world,placed,obstacles){
 const valid=(x,z)=>{const y=world.supportHeight(x,z,chest.y||0,.05);if(!Number.isFinite(y)||y<(chest.y||0)-1.2||y>(chest.y||0)+.05||Math.hypot(x-chest.x,z-chest.z)>3.2)return null;
 if(obstacles.some(b=>boundsIntersectCollider({min:[x-.36,y+.15,z-.36],max:[x+.36,y+1.78,z+.36]},b)))return null;
 const from=[chest.x,(chest.y||0)+1.4,chest.z],to=[x,y+.9,z],distance=Math.hypot(...to.map((v,k)=>v-from[k])),limit=1-.25/Math.max(distance,.25);if(obstacles.some(b=>{const t=b.blocksShots===false?null:segmentColliderTime(from,to,b);return t!==null&&t<limit;}))return null;
 return {x,y,z};};
 const original=valid(item.x,item.z);if(original)return original;
 const candidates=[];for(const radius of [.45,.8,1.2,1.6,2,2.5])for(let step=0;step<16;step++){const angle=step*Math.PI/8,p=valid(chest.x+Math.cos(angle)*radius,chest.z+Math.sin(angle)*radius);if(p)candidates.push(p);}
 candidates.sort((a,b)=>{const score=p=>Math.hypot(p.x-item.x,p.z-item.z)+(placed.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<.45)?4:0);return score(a)-score(b);});
 return candidates[0]||valid(chest.x,chest.z)||{x:chest.x,y:chest.y||0,z:chest.z};
}
export function chestLoot(chest,round=1,world){const random=seededRandom(`${round}:${chest.id}`),first=Math.floor(random()*WEAPON_TYPES.length),types=[WEAPON_TYPES[first]];if(random()<.65)types.push(WEAPON_TYPES[(first+1+Math.floor(random()*(WEAPON_TYPES.length-1)))%WEAPON_TYPES.length]);const roll=random();types.push(world?.rules?.shockwave===false?(roll<.75?'shield':'health'):roll<.6?'shield':roll<.78?'health':'shockwave');const loot=types.map((type,i)=>({id:`${round}:${chest.id}:${i}`,type,count:ITEMS[type]?.stack||1,x:chest.x+(i-(types.length-1)/2)*1.05,y:chest.y||0,z:chest.z+1.1}));if(!world?.supportHeight)return loot;const baseY=chest.y||0,obstacles=(world.obstacles||[]).filter(b=>b.max[0]>=chest.x-3.6&&b.min[0]<=chest.x+3.6&&b.max[2]>=chest.z-3.6&&b.min[2]<=chest.z+3.6&&b.max[1]>=baseY-1.2&&b.min[1]<=baseY+1.83),placed=[];return loot.map(item=>{const result={...item,...supportedLootPosition(item,chest,world,placed,obstacles)};placed.push(result);return result;});}
