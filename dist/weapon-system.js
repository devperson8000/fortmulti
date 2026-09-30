export const WEAPON_ORDER=['ar','shotgun','smg','sniper'];

const presentation=({anchor,adsAnchor,scale,recoil,sway,bob,sprint,model})=>Object.freeze({
 anchor:Object.freeze(anchor),adsAnchor:Object.freeze(adsAnchor),scale,
 recoil:Object.freeze(recoil),sway,bob,sprint:Object.freeze(sprint),model
});

export const WEAPON_PROFILES=Object.freeze({
 ar:Object.freeze({
  id:'ar',slot:1,name:'STRIKER AR',shortName:'AR',rarity:'rare',color:'#4c9df0',icon:'⌁',
  damage:31,fireInterval:.118,recoil:[.017,.007],spread:{hip:.024,ads:.0065,move:.014,max:.052},
  reloadDuration:1.85,magazineCapacity:30,pellets:1,range:180,automatic:true,
  adsFov:45,scope:false,equipDuration:.34,projectile:null,
  presentation:presentation({anchor:[.34,-.34,-.78],adsAnchor:[0,-.255,-.58],scale:1,recoil:[-.085,.035,.018],sway:.018,bob:.014,sprint:[.32,-.22,.5],model:'ar'})
 }),
 shotgun:Object.freeze({
  id:'shotgun',slot:2,name:'THUNDER SHOTGUN',shortName:'SHOTGUN',rarity:'epic',color:'#a970f5',icon:'═',
  damage:14,fireInterval:.82,recoil:[.054,.014],spread:{hip:.082,ads:.047,move:.026,max:.12},
  reloadDuration:2.35,magazineCapacity:6,pellets:8,range:52,automatic:false,
  adsFov:52,scope:false,equipDuration:.42,projectile:null,
  presentation:presentation({anchor:[.36,-.38,-.86],adsAnchor:[0,-.28,-.68],scale:1.08,recoil:[-.15,.065,.025],sway:.015,bob:.013,sprint:[.34,-.25,.58],model:'shotgun'})
 }),
 smg:Object.freeze({
  id:'smg',slot:3,name:'BURST SMG',shortName:'SMG',rarity:'uncommon',color:'#63cf70',icon:'≋',
  damage:19,fireInterval:.072,recoil:[.012,.011],spread:{hip:.034,ads:.013,move:.02,max:.072},
  reloadDuration:1.55,magazineCapacity:32,pellets:1,range:110,automatic:true,
  adsFov:48,scope:false,equipDuration:.28,projectile:null,
  presentation:presentation({anchor:[.32,-.32,-.68],adsAnchor:[0,-.245,-.52],scale:.94,recoil:[-.065,.025,.024],sway:.021,bob:.016,sprint:[.3,-.2,.44],model:'smg'})
 }),
 sniper:Object.freeze({
  id:'sniper',slot:4,name:'EAGLE-EYE SNIPER',shortName:'SNIPER',rarity:'legendary',color:'#efad43',icon:'—',
  damage:116,fireInterval:1.32,recoil:[.075,.008],spread:{hip:.075,ads:.00045,move:.032,max:.1},
  reloadDuration:2.75,magazineCapacity:4,pellets:1,range:360,automatic:false,
  adsFov:15,scope:true,equipDuration:.48,projectile:Object.freeze({speed:180,gravity:18,maxAge:3}),
  presentation:presentation({anchor:[.38,-.39,-1],adsAnchor:[0,-.22,-.7],scale:1.05,recoil:[-.18,.08,.016],sway:.012,bob:.01,sprint:[.38,-.28,.65],model:'sniper'})
 })
});

export const BUILD_SLOTS=Object.freeze({5:2,6:3});
export const isWeaponSlot=slot=>Number.isInteger(slot)&&slot>=1&&slot<=WEAPON_ORDER.length;
export const isBuildSlot=slot=>Object.hasOwn(BUILD_SLOTS,slot);
export const buildTypeForSlot=slot=>BUILD_SLOTS[slot]||2;
export const weaponIdForSlot=slot=>WEAPON_ORDER[slot-1]||'ar';
export const weaponForSlot=slot=>WEAPON_PROFILES[weaponIdForSlot(slot)];
export const weaponForId=id=>WEAPON_PROFILES[id]||WEAPON_PROFILES.ar;

export function createLoadout(){
 return Object.fromEntries(WEAPON_ORDER.map(id=>[id,{ammo:WEAPON_PROFILES[id].magazineCapacity,reserve:null}]));
}

export function cloneLoadout(loadout={}){
 const fresh=createLoadout();
 for(const id of WEAPON_ORDER){
  const capacity=WEAPON_PROFILES[id].magazineCapacity;
  fresh[id].ammo=Math.max(0,Math.min(capacity,Math.floor(Number(loadout[id]?.ammo) || 0)));
 }
 return fresh;
}

export function currentAmmo(loadout,slot){
 const id=weaponIdForSlot(slot),profile=WEAPON_PROFILES[id];
 return Math.max(0,Math.min(profile.magazineCapacity,Number(loadout?.[id]?.ammo) || 0));
}

export function reloadProgress(remaining,slot){
 const duration=weaponForSlot(slot).reloadDuration;
 return Math.max(0,Math.min(1,1-(Number(remaining)||0)/duration));
}

export function shotSpread(profile,{aim=false,moving=0,sustained=0}={}){
 const base=aim?profile.spread.ads:profile.spread.hip;
 return Math.min(profile.spread.max,base+profile.spread.move*Math.min(1,Math.max(0,moving))+sustained*.006);
}

export function spreadDirection(yaw,pitch,spread,random=Math.random){
 const angle=random()*Math.PI*2,radius=Math.sqrt(random())*spread;
 const shotYaw=yaw+Math.cos(angle)*radius,shotPitch=pitch+Math.sin(angle)*radius;
 return [-Math.sin(shotYaw)*Math.cos(shotPitch),Math.sin(shotPitch),-Math.cos(shotYaw)*Math.cos(shotPitch)];
}

export function weaponPublicState(player){
 const weapon=weaponIdForSlot(player.slot);
 return {
  slot:player.slot,
  weapon,
  ammo:currentAmmo(player.weapons,player.slot),
  weapons:cloneLoadout(player.weapons),
  reload:Math.max(0,Number(player.reload)||0),
  equip:Math.max(0,Number(player.equip)||0),
  aim:Boolean(player.input?.aim)
 };
}
