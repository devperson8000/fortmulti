import test from 'node:test';
import assert from 'node:assert/strict';
import {safeLandingPoint} from '../public/deployment-sequence.js';
import {aimedEntity} from '../public/resource-system.js';
import {Match} from '../public/simulation.js';
const map=await import('../public/island-map.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});

test('height field follows the rendered triangles rather than a bilinear saddle',()=>{
 assert.equal(typeof map.createHeightField,'function');
 const height=map.createHeightField([0,10,20,40],2,0,1);
 assert.equal(height(.75,.25),15);
 assert.equal(height(.25,.75),20);
 assert.equal(height(.5,.5),20);
 assert.equal(height(-10,10),20);
});
test('height field rejects malformed or nonfinite map data',()=>{
 assert.equal(typeof map.createHeightField,'function');
 assert.throws(()=>map.createHeightField([0,1],2,0,1));
 assert.throws(()=>map.createHeightField([0,1,2,NaN],2,0,1));
 assert.throws(()=>map.createHeightField([0,1,2,3],2,0,0));
});
test('downloaded island has dry compounds, ocean edges and varied terrain',()=>{
 assert.equal(typeof map.islandHeight,'function');
 assert.equal(map.MAP_SOURCE.license,'MIT');
 assert.equal(map.islandHeight(320,320),-5);
 assert.equal(map.islandHeight(-320,-320),-5);
 assert.ok(map.ISLAND_POIS.length>=6);
 for(const poi of map.ISLAND_POIS)assert.ok(map.islandHeight(poi.x,poi.z)>=0);
 const heights=[];for(let x=-220;x<220;x+=20)for(let z=-220;z<220;z+=20)heights.push(map.islandHeight(x,z));
 assert.ok(Math.max(...heights)-Math.min(...heights)>20);
});
test('military compounds use matching solid geometry and have safe landing corridors',()=>{
 assert.equal(typeof map.militaryLayout,'function');
 const layout=map.militaryLayout(),world={height:map.islandHeight,obstacles:layout.parts.filter(p=>p.solid).map(p=>({min:p.position.map((v,i)=>v-p.size[i]/2),max:p.position.map((v,i)=>v+p.size[i]/2)}))};
 assert.ok(layout.buildings.length>=12);assert.ok(layout.chests.length>=18);
 for(const poi of map.ISLAND_POIS){const landing=safeLandingPoint(poi,world);assert.ok(landing,poi.name);assert.ok(Math.hypot(landing.x-poi.x,landing.z-poi.z)<25,poi.name);}
 for(const chest of layout.chests){assert.ok(chest.y>=map.islandHeight(chest.x,chest.z)-.1);assert.ok(!world.obstacles.some(b=>b.min[1]<chest.y+.6&&b.max[1]>chest.y+.2&&chest.x>b.min[0]&&chest.x<b.max[0]&&chest.z>b.min[2]&&chest.z<b.max[2]));}
});
test('island minimap distinguishes dry land from ocean using the actual terrain',()=>{
 assert.equal(typeof map.islandMapPixels,'function');
 const pixels=map.islandMapPixels(161);assert.equal(pixels.length,161*161*4);
 assert.deepEqual([...pixels.slice(0,4)],[40,86,105,255]);
 assert.notDeepEqual([...pixels.slice((80*161+80)*4,(80*161+80)*4+4)],[40,86,105,255]);
});
test('island deployment cannot select a submerged ocean landing',()=>{
 const world={height:map.createHeightField([-5,-5,-5,-5],2,-320,640),obstacles:[],minLandingHeight:0};
 assert.equal(safeLandingPoint({x:290,z:10},world),null);
});
test('each downloaded forest trunk gets a centered harvest target',()=>{
 assert.equal(typeof map.forestTreePlacements,'function');
 const trees=map.forestTreePlacements(90,120,14,.7);assert.equal(trees.length,5);
 for(const tree of trees){
  assert.equal(aimedEntity({p:[tree.x,tree.y,tree.z+2]},{yaw:0},[tree]),tree);
  const vertices=tree.vertices,low=[];for(let i=0;i<vertices.length;i+=6)if(vertices[i+1]<.06)low.push([vertices[i],vertices[i+2]]);
  assert.ok(low.length>2);assert.ok(Math.abs(Math.min(...low.map(p=>p[0]))+Math.max(...low.map(p=>p[0])))<.01);assert.ok(Math.abs(Math.min(...low.map(p=>p[1]))+Math.max(...low.map(p=>p[1])))<.01);
 }
});
test('the imported terrain can be climbed with normal movement from the command clearing',()=>{
 const layout=map.militaryLayout(),world={height:map.islandHeight,obstacles:layout.parts.filter(p=>p.solid).map(p=>({min:p.position.map((v,i)=>v-p.size[i]/2),max:p.position.map((v,i)=>v+p.size[i]/2)}))};
 const match=new Match(world,['a','b']);match.phase='playing';
 for(const [i,p] of match.players.entries()){p.air='landed';p.grounded=true;p.p=[i?250:0,map.islandHeight(i?250:0,50),50];p.deploymentState='match_active';}
 for(let i=0;i<400;i++){match.input('a',{z:1,yaw:Math.PI});match.tick(.016);}
 const p=match.players[0];assert.ok(p.p[2]>90);assert.ok(p.p[1]>3);assert.ok(Math.abs(p.p[1]-map.islandHeight(p.p[0],p.p[2]))<.1);
});
