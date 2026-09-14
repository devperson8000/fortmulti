import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

async function loadRuntime(){
 const url=new URL('../public/bootstrap-runtime.js',import.meta.url);
 assert.equal(existsSync(url),true,'bootstrap runtime must exist before app startup');
 return import(url);
}

test('valid deployed Supabase config wins over stale browser settings',async()=>{
 const {resolveRuntimeConfig}=await loadRuntime();
 assert.deepEqual(resolveRuntimeConfig({url:'https://abc.supabase.co',key:'sb_publishable_x'},{url:'https://old.supabase.co',key:'old'}),{url:'https://abc.supabase.co',key:'sb_publishable_x'});
});

test('manual browser config is retained when deployment has no online config',async()=>{
 const {resolveRuntimeConfig}=await loadRuntime();
 assert.deepEqual(resolveRuntimeConfig({url:'',key:''},{url:'https://abc.supabase.co',key:'k'}),{url:'https://abc.supabase.co',key:'k'});
});

test('high DPR laptops receive a conservative pixel budget without lowering model topology',async()=>{
 const {renderBudget}=await loadRuntime();
 const q=renderBudget(2,8);assert.ok(q.pixelRatio<=1.35&&q.pixelRatio>=1);assert.ok(q.fps>=45);
});

test('normal DPR devices keep native resolution',async()=>{
 const {renderBudget}=await loadRuntime();
 assert.equal(renderBudget(1,8).pixelRatio,1);
});

test('bootstrap runs before the app and replaces the old dynamic runtime loader',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const config=readFileSync(new URL('../public/config.js',import.meta.url),'utf8');
 const bootstrapIndex=html.indexOf('bootstrap-runtime.js'),appIndex=html.indexOf('app.js');
 assert.ok(bootstrapIndex>=0&&appIndex>bootstrapIndex,'bootstrap module must load before app.js');
 assert.equal(config.includes('multiplayer-runtime.js'),false,'config.js should only provide config data');
});

test('syntax verification includes the bootstrap runtime',()=>{
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.match(pkg.scripts.syntax,/bootstrap-runtime\.js/);
});
