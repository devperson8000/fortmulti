import './multiplayer-runtime.js';

const CONFIG_STORE='duel-config';
const cleanConfig=config=>({url:String(config?.url||'').trim().replace(/\/$/,''),key:String(config?.key||'').trim()});
const publicKey=key=>{
 if(!key||key.startsWith('sb_secret_'))return false;
 if(key.startsWith('eyJ')){try{if(JSON.parse(atob(key.split('.')[1])).role==='service_role')return false;}catch{}}
 return true;
};
export const validRuntimeConfig=config=>{
 const c=cleanConfig(config);return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(c.url)&&publicKey(c.key);
};

export function resolveRuntimeConfig(deployed={},saved={}){
 const d=cleanConfig(deployed),s=cleanConfig(saved);
 return validRuntimeConfig(d)?d:s;
}

export function renderBudget(devicePixelRatio=1,hardwareConcurrency=8){
 const dpr=Math.max(1,Number(devicePixelRatio)||1),cores=Math.max(1,Number(hardwareConcurrency)||4);
 let cap=1.6;
 if(dpr>1.4)cap=cores<=4?1.15:cores<=8?1.3:1.45;
 return {pixelRatio:Math.min(dpr,cap),fps:cores<=4?45:60};
}

const readSaved=storage=>{try{return JSON.parse(storage?.getItem(CONFIG_STORE)||'null')||{};}catch{return {};}};

export function bootstrapRuntime(win=globalThis.window){
 if(!win)return null;
 const storage=win.localStorage,deployed=cleanConfig(win.SUNNY_CONFIG||{}),saved=readSaved(storage),resolved=resolveRuntimeConfig(deployed,saved);
 if(validRuntimeConfig(deployed)){try{storage?.removeItem(CONFIG_STORE);}catch{}}
 win.SUNNY_CONFIG=resolved;
 const budget=renderBudget(win.devicePixelRatio,win.navigator?.hardwareConcurrency);
 if(budget.pixelRatio<Number(win.devicePixelRatio||1)){
  try{Object.defineProperty(win,'devicePixelRatio',{configurable:true,get:()=>budget.pixelRatio});}catch{}
 }
 win.SUNNY_RENDER_BUDGET=budget;
 return {config:resolved,budget};
}

if(typeof window!=='undefined')bootstrapRuntime(window);
