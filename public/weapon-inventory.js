import {WEAPON_PROFILES} from './weapon-system.js';
export const INVENTORY_SIZE=5;
export const createInventory=()=>Array(INVENTORY_SIZE).fill(null);
export function createWeaponItem(id,type,ammo=WEAPON_PROFILES[type]?.magazineCapacity){const profile=WEAPON_PROFILES[type];if(!profile||typeof id!=='string'||!id)throw Error('Invalid weapon instance');return {id,type,ammo:Math.max(0,Math.min(profile.magazineCapacity,Math.floor(Number(ammo)||0))),reserve:null};}
export function inventoryWeapon(inventory,slot){return Number.isInteger(slot)&&slot>=1&&slot<=INVENTORY_SIZE?inventory?.[slot-1]||null:null;}
export const cloneInventory=inventory=>Array.from({length:INVENTORY_SIZE},(_,i)=>inventory?.[i]?{...inventory[i]}:null);
export function applyInventoryMove(inventory,op={}){const source=inventoryWeapon(inventory,op.from),target=inventoryWeapon(inventory,op.to);if(!source||op.from===op.to||!Number.isInteger(op.to)||op.to<1||op.to>INVENTORY_SIZE||source.id!==op.sourceId||(target?.id||null)!==(op.targetId??null))return {accepted:false,inventory};const next=inventory.slice();next[op.to-1]=source;next[op.from-1]=target;return {accepted:true,inventory:next};}
export function movedSelection(before,after,slot){const id=inventoryWeapon(before,slot)?.id;if(!id)return slot;const index=after.findIndex(w=>w?.id===id);return index<0?0:index+1;}
