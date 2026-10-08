import test from 'node:test';import assert from 'node:assert/strict';import {renderFacilityPass,warmFacilityResources} from '../public/facility-render-pass.js';
test('facility depth pass preserves glass and culled chunks before drawing color',()=>{
 const opaque={material:{side:0},visible:true,userData:{}},glass={material:{side:2,transparent:true},visible:true,userData:{}},culled={material:{side:0},visible:false,userData:{}},group={userData:{},children:[opaque,glass,culled]},original=[opaque.material,glass.material,culled.material],depth=[{name:'depth front'},null,{name:'depth double'}];let calls=0;
 renderFacilityPass({render(){if(calls++===0){assert.equal(opaque.material,depth[0]);assert.equal(glass.visible,false);assert.equal(culled.visible,false);}else{assert.deepEqual(group.children.map(o=>o.material),original);assert.equal(glass.visible,true);assert.equal(culled.visible,false);}}},{},{},group,depth);assert.equal(calls,2);
});
test('a failed depth pass restores original materials and visibility',()=>{
 const material={side:0},node={material,visible:true,userData:{}},group={userData:{},children:[node]};assert.throws(()=>renderFacilityPass({render(){throw Error('context lost');}},{},{},group,[{}]),/context lost/);assert.equal(node.material,material);assert.equal(node.visible,true);
});

test('low-cost facility pass submits geometry only once and clears previous depth statistics',()=>{const group={userData:{depthCalls:35,depthTriangles:100},children:[]};let calls=0;renderFacilityPass({render(){calls++;}},{},{},group,[],{depth:false});assert.equal(calls,1);assert.equal(group.userData.depthCalls,0);assert.equal(group.userData.depthTriangles,0);});

test('facility warmup uploads shared textures once and submits geometry before deployment',()=>{const texture={isTexture:true},material={map:texture,roughnessMap:texture},other={emissiveMap:texture},group={children:[{material,userData:{standardMaterial:material,simpleMaterial:other}}]},calls=[];warmFacilityResources({initTexture(t){assert.equal(t,texture);calls.push('texture');},render(){calls.push('geometry');}},{},{},group);assert.deepEqual(calls,['texture','geometry']);});
