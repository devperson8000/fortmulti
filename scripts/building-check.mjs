import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {checkBuilding} from './browser-building.mjs';
const url=process.env.GAME_TEST_URL||'http://127.0.0.1:4174',artifacts=process.env.GAME_ARTIFACTS||'/workspace/fortmulti-artifacts/building';
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const context=await browser.newContext({viewport:{width:1280,height:720}}),checks=[],errors=[];
async function open(){
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>localStorage.setItem('horizon-callsign',JSON.stringify({name:'Ranger'})));await p.goto(url+'/?local=1');await p.waitForFunction(()=>!!window.Game);
 await p.evaluate(async()=>{const[{Connection},{Match}]=await Promise.all([import('/network.js'),import('/simulation.js')]);const open=Connection.prototype.open;Connection.prototype.open=async function(...args){await open.apply(this,args);window.__testConnection=this;};const round=Match.prototype.startRound;Match.prototype.startRound=function(...args){const result=round.apply(this,args);window.__testMatch=this;return result;};});return p;
}
try{
 const host=await open(),guest=await open();await host.locator('#create').click();await host.waitForFunction(()=>window.__testConnection?.connected);
 const code=await host.evaluate(()=>window.__testConnection.code);await guest.locator('.test-tools summary').first().click();await guest.locator('#code').fill(code);await guest.locator('#join').click();
 await host.waitForFunction(()=>document.getElementById('party-count').textContent.startsWith('2'));await guest.waitForFunction(()=>window.__testConnection?.host);
 await host.locator('#ready').click();await guest.locator('#ready').click();await host.waitForFunction(()=>!!window.__testMatch);
 await host.evaluate(()=>{const m=window.__testMatch;m.phase='playing';for(const[i,p]of m.players.entries()){p.air='landed';p.p=[i*30,m.world.height(i*30,62),62];p.vy=0;p.deploymentState='match_active';}});
 await guest.waitForFunction(()=>window.Game.pose().air==='landed');
 if(await guest.locator('#resume-control').isVisible())await guest.locator('#resume-control').click();
 const id=await guest.evaluate(()=>window.__testConnection.id);await checkBuilding(host,guest,id,artifacts,checks);
 if(errors.length)throw Error(errors.join('\n'));await writeFile(artifacts+'/building-results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}catch(error){
 await writeFile(artifacts+'/building-failure.json',JSON.stringify({error:String(error),checks,pages:await Promise.all(context.pages().map(p=>p.evaluate(()=>({pose:window.Game?.pose(),input:window.Game?.input(),host:window.__testMatch?.snapshot(),observations:window.__buildObservations}))))},null,2));throw error;
}finally{await browser.close();}
