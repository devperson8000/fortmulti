import test from 'node:test';
import assert from 'node:assert/strict';
import {REACTOR_POIS,reactorLayout,reactorHeight,reactorSupportHeight,reactorIsLandingAllowed} from '../public/reactor-map.js';
import {REACTOR_COLLISION} from '../public/maps/reactor/collision-data.js';
import {moveHorizontal} from '../public/movement-collision.js';
test('imports source hierarchy including all radial and stair scene instances',()=>{
 assert.ok(REACTOR_COLLISION.length>1000);
 assert.ok(REACTOR_COLLISION.filter(s=>s.name.includes('radial_colliders.tscn')).length>150);
 assert.ok(REACTOR_COLLISION.filter(s=>s.name.includes('stair_pillar.tscn')).length>200);
});
test('eight external landing pads have clear footprints and level access through real wall gates',()=>{
 const {obstacles}=reactorLayout();assert.equal(REACTOR_POIS.length,8);
 for(const pad of REACTOR_POIS){assert.equal(reactorHeight(pad.x,pad.z),6.8);assert.ok(reactorIsLandingAllowed(pad.x,pad.z));
 const a=Math.atan2(pad.z,pad.x),p=[pad.x,6.8,pad.z];
 assert.ok(!obstacles.some(b=>p[0]+.5>b.min[0]&&p[0]-.5<b.max[0]&&p[2]+.5>b.min[2]&&p[2]-.5<b.max[2]&&b.max[1]>6.95&&b.min[1]<8.58));
 for(let r=146;r>105;r-=.25)moveHorizontal(p,-Math.cos(a)*.25,-Math.sin(a)*.25,obstacles);
 assert.ok(Math.hypot(p[0],p[2])<106,`gate ${pad.name} is traversable`);
 }
 assert.equal(reactorIsLandingAllowed(0,0),false);
});
test('support queries preserve lower levels instead of snapping players onto the roof',()=>{
 assert.ok(reactorSupportHeight(90,0,1.6)<2);
 assert.equal(reactorSupportHeight(REACTOR_POIS[0].x,REACTOR_POIS[0].z,6.8),6.8);
 assert.ok(reactorHeight(190,190)<0);
});
test('interior loot is distributed on clear native floors across multiple levels',()=>{const layout=reactorLayout(),interior=layout.chests.filter(c=>c.id.includes(':interior:'));assert.equal(interior.length,16);assert.ok(new Set(interior.map(c=>Math.round(c.y))).size>=5);for(const c of interior){assert.ok(Math.hypot(c.x,c.z)<110);assert.ok(Math.abs(reactorSupportHeight(c.x,c.z,c.y,0)-c.y)<.001);assert.equal(layout.obstacles.some(b=>c.x+.4>b.min[0]&&c.x-.4<b.max[0]&&c.z+.4>b.min[2]&&c.z-.4<b.max[2]&&b.min[1]<c.y+1.78&&b.max[1]>c.y+.15),false);}});
test('verified inward stairs reach the native lower combat floor',()=>{const boxes=reactorLayout().obstacles;for(const degrees of [-20,265]){const angle=degrees*Math.PI/180,p=[98*Math.cos(angle),6.8,98*Math.sin(angle)];for(let i=0;i<130;i++){moveHorizontal(p,-Math.cos(angle)*.1,-Math.sin(angle)*.1,boxes);const floor=reactorSupportHeight(p[0],p[2],p[1]);p[1]=Math.max(floor,p[1]-.1);}assert.ok(Math.hypot(p[0],p[2])<86);assert.ok(Math.abs(p[1]-1.6)<.01);}});
test('every landing outpost has a supported walking route into the shared inside gallery',()=>{const layout=reactorLayout(),floors=new Set(),blocked=new Set(),key=(x,z)=>`${x},${z}`;for(const part of layout.parts){if(Math.abs(part.position[1]+part.size[1]/2-6.8)>.001)continue;for(let x=Math.ceil(part.position[0]-part.size[0]/2);x<=Math.floor(part.position[0]+part.size[0]/2);x++)for(let z=Math.ceil(part.position[2]-part.size[2]/2);z<=Math.floor(part.position[2]+part.size[2]/2);z++)floors.add(key(x,z));}for(const b of layout.obstacles){if(b.max[1]<=7.18||b.min[1]>=8.58)continue;for(let x=Math.ceil(b.min[0]-.35);x<=Math.floor(b.max[0]+.35);x++)for(let z=Math.ceil(b.min[2]-.35);z<=Math.floor(b.max[2]+.35);z++)blocked.add(key(x,z));}for(const pad of REACTOR_POIS){const origin=[Math.round(pad.x),Math.round(pad.z)],queue=[origin],seen=new Set([key(...origin)]);let found=false;for(let i=0;i<queue.length;i++){const p=queue[i],radius=Math.hypot(...p);if(radius<101&&radius>96){found=true;break;}for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const q=[p[0]+dx,p[1]+dz],k=key(...q);if(!seen.has(k)&&floors.has(k)&&!blocked.has(k)){seen.add(k);queue.push(q);}}}assert.ok(found,`${pad.name} has a continuous floor route through its gate`);}});
test('facility supplies provide both building materials without permanent collision',async()=>{const {Match}=await import('../public/simulation.js'),layout=reactorLayout();assert.equal(layout.resources.length,24);assert.equal(new Set(layout.resources.map(n=>n.id)).size,24);for(const kind of ['wood','stone'])assert.equal(layout.resources.filter(n=>n.kind===kind).length,12);const world={...layout,height:reactorHeight,supportHeight:reactorSupportHeight,landingPoints:REACTOR_POIS,isLandingAllowed:reactorIsLandingAllowed};const match=new Match(world,['a','b']),player=match.players[0];match.phase='playing';player.air='landed';player.deploymentState='match_active';player.slot=0;for(const kind of ['wood','stone']){const node=layout.resources.find(n=>n.kind===kind);player.p=[node.x,node.y,node.z+1.5];for(let i=0;i<4;i++){player.cool=0;assert.equal(match.harvest(player,{yaw:0,pitch:0}),true);}assert.ok(player.materials[kind]>=20);assert.equal(match.resourceHP.get(node.id),0);player.cool=0;assert.equal(match.harvest(player,{yaw:0,pitch:0}),false);}const pad=REACTOR_POIS[6];player.p=[pad.x,pad.y,pad.z];player.cool=0;match.input('a',{slot:6,fire:true,yaw:0,pitch:0,material:'wood'});match.tick(.025);assert.equal(match.structures.length,1,'harvested supplies can fund a real construction on the landing deck');assert.equal(player.materials.wood,30);});
