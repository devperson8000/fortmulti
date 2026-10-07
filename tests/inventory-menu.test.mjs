import test from 'node:test';import assert from 'node:assert/strict';import {beginDrag,moveDrag,finishDrag} from '../public/inventory-menu.js';
test('drag threshold distinguishes click, occupied swap and empty movement',()=>{const d=beginDrag(2,100,100,1);assert.equal(moveDrag(d,103,100),false);assert.equal(finishDrag(d,2),null);const s=beginDrag(2,100,100,1);assert.equal(moveDrag(s,110,100),true);assert.deepEqual(finishDrag(s,5),{from:2,to:5});assert.equal(finishDrag(s,null),null);assert.equal(finishDrag(s,2),null);});

test('drag preview remains fully visible at every viewport edge',async()=>{
 const {dragGhostPosition}=await import('../public/inventory-menu.js');assert.equal(typeof dragGhostPosition,'function');
 for(const [width,height]of [[1280,720],[800,600],[390,640]])for(const [x,y]of [[0,0],[width-1,0],[0,height-1],[width-1,height-1],[width/2,height/2]]){
  const p=dragGhostPosition(x,y,180,246,width,height);assert.ok(p.x>=0&&p.y>=0);assert.ok(p.x+180<=width&&p.y+246<=height,'preview clipped at viewport boundary');
 }
});

test('drag preview approaches screen edges continuously without jumping across the cursor',async()=>{
 const {dragGhostPosition}=await import('../public/inventory-menu.js');
 for(const axis of ['x','y']){let previous=null;for(let n=0;n<=800;n++){
  const position=dragGhostPosition(axis==='x'?n:300,axis==='y'?n:300,180,246,800,600)[axis];
  if(previous!==null)assert.ok(Math.abs(position-previous)<=1,`${axis} preview jumped at pointer ${n}`);previous=position;
 }}
});
