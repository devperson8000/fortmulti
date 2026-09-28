import test from 'node:test';
import assert from 'node:assert/strict';
import {lobbyTabState,orderPartyProfiles} from '../public/lobby-state.js';

test('local player always owns the foreground hero slot',()=>{
 const party=orderPartyProfiles([{id:'host',name:'Host',host:true},{id:'me',name:'Me',self:true},{id:'friend',name:'Friend'}]);
 assert.equal(party[0].id,'me');
 assert.equal(party[1].id,'host');
});

test('hosting also keeps the local player in the hero slot',()=>{
 const party=orderPartyProfiles([{id:'friend',name:'Friend'},{id:'me',name:'Me',self:true,host:true}]);
 assert.equal(party[0].id,'me');
});

test('character, outfit and play tabs keep their panels mutually exclusive',()=>{
 assert.deepEqual(lobbyTabState('character'),{activeTab:'character',characterPreview:true,profileOpen:false});
 assert.deepEqual(lobbyTabState('outfit'),{activeTab:'outfit',characterPreview:false,profileOpen:true});
 assert.deepEqual(lobbyTabState('play'),{activeTab:'play',characterPreview:false,profileOpen:false});
});
