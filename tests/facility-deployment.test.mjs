import test from 'node:test';import assert from 'node:assert/strict';
import {safeLandingPoint} from '../public/deployment-sequence.js';
test('facility destinations snap to designated exterior pads, never a reactor roof',()=>{
 const world={height:()=>7,obstacles:[],landingPoints:[{x:130,z:0},{x:-130,z:0}],isLandingAllowed:(x,z)=>Math.hypot(x-130,z)<12||Math.hypot(x+130,z)<12};
 assert.deepEqual(safeLandingPoint({x:0,z:0},world),{x:130,z:0,y:7});
 const first=safeLandingPoint({x:130,z:0},world);const second=safeLandingPoint({x:130,z:0},world,[first]);
 assert.ok(second);assert.ok(Math.hypot(second.x-first.x,second.z-first.z)>8);assert.equal(world.isLandingAllowed(second.x,second.z),true);
});
test('facility landing rejects unavailable pads rather than searching inside the building',()=>{
 const world={height:()=>7,obstacles:[],landingPoints:[{x:130,z:0}],isLandingAllowed:()=>false};assert.equal(safeLandingPoint({x:0,z:0},world),null);
});
test('actual facility decks accept eight separated pod landings with floor collision present',async()=>{
 const {REACTOR_POIS,reactorLayout,reactorHeight,isReactorLandingAllowed}=await import('../public/reactor-map.js');
 const world={height:reactorHeight,obstacles:reactorLayout().obstacles,minLandingHeight:6,landingPoints:REACTOR_POIS,isLandingAllowed:isReactorLandingAllowed},reserved=[];
 for(const pad of REACTOR_POIS){const landing=safeLandingPoint(pad,world,reserved);assert.ok(landing,`pad ${pad.name} allows landing`);assert.ok(Math.hypot(landing.x-pad.x,landing.z-pad.z)<8);reserved.push(landing);}
});
