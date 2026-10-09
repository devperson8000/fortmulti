import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const artifacts=process.env.GAME_ARTIFACTS||'/workspace/fortmulti-artifacts/map-integration';await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text()+' '+JSON.stringify(m.location()));});
await page.addInitScript(()=>localStorage.setItem('sunny.graphicsQuality','high'));
await page.addInitScript(()=>localStorage.setItem('horizon-callsign',JSON.stringify({name:'Ranger'})));await page.goto('http://127.0.0.1:4174');await page.waitForFunction(()=>!!window.Game);
await page.evaluate(async()=>{const {Match}=await import('/simulation.js');const m=new Match(window.Game.world,['a','b']);m.phase='playing';for(const p of m.players){p.air='landed';p.deploymentState='match_active';p.p=[0,window.Game.world.height(0,0),0];}m.players[1].p=[500,-5,500];window.__mapMatch=m;window.Duel.lobby=false;window.Duel.render=()=>window.Game.apply(m.snapshot(),'a',{},.016);document.querySelector('#lobby').hidden=true;document.body.classList.remove('menu','in-lobby');});
for(const shot of [{name:'command-overview',p:[0,42,104],yaw:0,pitch:-.4},{name:'command-ground',p:[0,0,32],yaw:0,pitch:-.03},{name:'forest-ridge',p:[65,0,115],yaw:2.1,pitch:.03},{name:'harbor-overview',p:[-202,38,148],yaw:0,pitch:-.35},{name:'ridge-station',p:[126,0,-152],yaw:0,pitch:-.03}]){
 await page.evaluate(shot=>{const p=window.__mapMatch.players[0];p.p=[shot.p[0],shot.p[1]||window.Game.world.height(shot.p[0],shot.p[2]),shot.p[2]];window.Game.look(shot.yaw,shot.pitch);},shot);await page.waitForTimeout(1400);await page.screenshot({path:`${artifacts}/${shot.name}.png`});
}
const target=await page.evaluate(async()=>{
 const {aimedEntity}=await import('/resource-system.js'),m=window.__mapMatch,p=m.players[0];
 for(const node of m.resources.filter(n=>n.kind==='wood'))for(let k=0;k<8;k++){
  const yaw=k*Math.PI/4,position=[node.x+Math.sin(yaw)*2,0,node.z+Math.cos(yaw)*2];position[1]=m.world.height(position[0],position[2]);
  if(aimedEntity({p:position},{yaw},m.resources,3.6)?.id!==node.id||Math.abs(position[1]-node.y)>1.4)continue;
  p.p=position;p.slot=0;p.grounded=true;p.vy=0;window.Game.look(yaw);window.Duel.render=dt=>{m.input('a',window.Game.input());m.tick(dt);window.Game.apply(m.snapshot(),'a',{},dt);};return {id:node.id};
 }
 throw Error('No accessible native tree found');
});
await page.keyboard.press('0');await page.waitForTimeout(250);await page.screenshot({path:artifacts+'/tree-before-harvest.png'});
await page.mouse.move(720,450);await page.mouse.down();await page.waitForFunction(id=>(window.__mapMatch.resourceHP.get(id)??100)===0,target.id,{timeout:15000});await page.mouse.up();
const harvest=await page.evaluate(id=>({id,hp:window.__mapMatch.resourceHP.get(id),wood:window.__mapMatch.players[0].materials.wood,destroyed:[...window.__mapMatch.resourceHP].filter(([,hp])=>hp===0).length}),target.id);
assert.ok(harvest.wood>0);assert.equal(harvest.destroyed,1);await page.screenshot({path:artifacts+'/tree-after-harvest.png'});
const map=await page.evaluate(()=>({map:window.Game.world.map,obstacles:window.Game.world.obstacles.length,resources:window.Game.world.resources.length,chests:window.Game.world.chests.length,pois:window.Game.world.pois}));await writeFile(artifacts+'/visual-results.json',JSON.stringify({map,harvest,errors},null,2));await browser.close();if(errors.length)throw Error(errors.join('\n'));console.log({map,harvest});
