import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const url=process.env.GAME_TEST_URL||'http://127.0.0.1:4174';
const markup=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const dialog=markup.match(/<section id="inventory-menu"[\s\S]*?<\/section>/)[0];
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.route('**/inventory-polish-lab',route=>route.fulfill({contentType:'text/html',body:`<link rel="stylesheet" href="/game.css"><link rel="stylesheet" href="/inventory-menu.css">${dialog}`}));
 await page.addInitScript(()=>localStorage.setItem('horizon-callsign',JSON.stringify({name:'Ranger'})));await page.goto(url+'/inventory-polish-lab');
 await page.evaluate(async()=>{
  const {createInventoryMenu}=await import('/inventory-menu.js');
  const state={alive:true,phase:'playing',slot:1,inventory:[{id:'a',type:'ar',ammo:17},{id:'b',type:'shotgun',ammo:3},{id:'c',type:'smg',ammo:23},{id:'d',type:'sniper',ammo:2},null]};
  window.__moves=[];
  window.__menu=createInventoryMenu({root:document.getElementById('inventory-menu'),getState:()=>state,onOpen(){},onClose(){},onSelect:slot=>{state.slot=slot;},onMove:(from,to)=>{window.__moves.push({from,to});[state.inventory[from-1],state.inventory[to-1]]=[state.inventory[to-1],state.inventory[from-1]];if(state.slot===from)state.slot=to;else if(state.slot===to)state.slot=from;}});
  window.__menu.open();
 });
 assert.equal(await page.locator('[data-inventory-count]').count(),1,'loadout count is missing');
 assert.match(await page.locator('[data-inventory-count]').textContent(),/4\s*\/\s*5/);
 assert.equal(await page.locator('.inventory-card.equipped .inventory-equipped').isVisible(),true);
 const fill=await page.locator('.inventory-card').first().evaluate(el=>el.querySelector('.inventory-ammo-fill').style.width);
 assert.ok(Math.abs(parseFloat(fill)-17/30*100)<.01);

 const source=await page.locator('[data-inventory-slot="1"]').boundingBox();
 const empty=await page.locator('[data-inventory-slot="5"]').boundingBox();
 await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();
 await page.mouse.move(empty.x+empty.width/2,empty.y+empty.height/2);
 assert.equal(await page.locator('[data-inventory-slot="5"]').getAttribute('data-drop-kind'),'move');
 assert.match(await page.locator('[data-inventory-hint]').textContent(),/slot 5/i);
 await page.mouse.move(798,598);
 const ghost=await page.locator('[data-drag-ghost]').boundingBox();
 assert.ok(ghost.x>=0&&ghost.y>=0&&ghost.x+ghost.width<=800&&ghost.y+ghost.height<=600,'real drag preview left the screen');
 assert.match(await page.locator('[data-inventory-hint]').textContent(),/cancel/i);
 await page.evaluate(()=>document.querySelector('[data-inventory-cards]').dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true})));
 await page.mouse.up();
 assert.equal(await page.locator('[data-drag-ghost]').isVisible(),false);
 assert.equal(await page.locator('[data-drop-kind]').count(),0);
 assert.match(await page.locator('[data-inventory-hint]').textContent(),/^Drag to move/);
 assert.deepEqual(await page.evaluate(()=>window.__moves),[]);

 await page.locator('[data-inventory-slot="1"]').focus();await page.keyboard.press('Space');await page.keyboard.press('Space');
 assert.deepEqual(await page.evaluate(()=>window.__moves),[],'returning to the source should cancel keyboard movement');
 await page.locator('[data-inventory-slot="1"]').focus();await page.keyboard.press('Space');
 await page.locator('[data-inventory-slot="2"]').focus();await page.keyboard.press('Space');
 assert.deepEqual(await page.evaluate(()=>window.__moves),[{from:1,to:2}]);
 assert.match(await page.locator('[data-inventory-hint]').textContent(),/^Drag to move/);
 await page.setViewportSize({width:390,height:640});
 assert.equal(await page.evaluate(()=>document.getElementById('inventory-menu').scrollWidth>innerWidth),false);
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.inventory-card').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
 assert.deepEqual(errors,[]);
 console.log('Passed inventory polish checks: ammo/equipped status, move feedback, viewport edges, cancellation, keyboard swaps, mobile layout and reduced motion; zero page errors.');
}finally{await browser.close();}
