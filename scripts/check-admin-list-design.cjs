'use strict';
const assert=require('node:assert/strict'),factory=require('../admin-list-design-service.js'),core=require('../list-share-core.js'),design=require('../list-share-design.js');
global.firebase={database:{ServerValue:{TIMESTAMP:123}}};
const token='a'.repeat(48),settings={token,enabled:true,showKey:true,showParts:true,appearance:design.normalize({title:'Original'})};
const state={userListShares:{member:structuredClone(settings)},publicListShares:{[token]:{uid:'member',name:'Member',songs:{song:{title:'Song',artist:'Artist',key:2,parts:['Guitar']}}}},publicListLinks:{member:{token}},users:{member:{songs:{song:{registered:true,key:2,part:'Guitar',liked:true}}}},songs:{song:{title:'Song',artist:'Artist'}}};
const at=path=>path.split('/').filter(Boolean).reduce((v,k)=>v?.[k],state),writes=[];
function write(path,value){const keys=path.split('/');let parent=state;for(const k of keys.slice(0,-1))parent=parent[k]||={};if(value===null)delete parent[keys.at(-1)];else parent[keys.at(-1)]=structuredClone(value);}
const database={ref(path=''){return{async once(){return{val:()=>structuredClone(at(path)??null)};},async update(changes){writes.push(structuredClone(changes));for(const[k,v]of Object.entries(changes))write(k,v);}};}};
let current=true;const service=factory(database,{uid:'member',name:'Member'},()=>current,core,design);
(async()=>{
 await service.load();const preview=await service.preview({title:'Preview'});assert.equal(preview.songs.song.key,2);assert.deepEqual(preview.songs.song.parts,['Guitar']);assert.equal(writes.length,0);
 const privateBefore=structuredClone(state.users),songsBefore=structuredClone(state.publicListShares[token].songs);
 await service.save({appearance:{title:'Edited',preset:'light'},backgroundImage:'data:image/jpeg;base64,/9j/'});
 assert.equal(state.userListShares.member.appearance.title,'Edited');assert.equal(state.publicListShares[token].appearance.title,'Edited');assert.equal(state.publicListBackgrounds[token].uid,'member');assert.equal(state.userListBackgrounds.member.version,state.publicListBackgrounds[token].version);
 assert.deepEqual(state.users,privateBefore);assert.deepEqual(state.publicListShares[token].songs,songsBefore);assert.equal(state.userListShares.member.token,token);assert.equal(state.userListShares.member.enabled,true);assert.equal(state.userListShares.member.showKey,true);assert.equal(state.userListShares.member.showParts,true);
 await service.save({appearance:{title:'Remove'},backgroundImage:null});assert.equal(state.userListBackgrounds.member,undefined);assert.equal(state.publicListBackgrounds[token],undefined);
 state.userListShares.member.appearance.title='Concurrent owner';const count=writes.length;await assert.rejects(()=>service.save({appearance:{title:'Stale'}}),/更新/);assert.equal(writes.length,count);
 state.userListShares.member.enabled=false;await service.load();await service.save({appearance:{title:'Paused'}});assert.equal(state.userListShares.member.enabled,false);assert.ok(Object.keys(writes.at(-1)).every(p=>p.startsWith('userListShares/')));
 current=false;await assert.rejects(()=>service.save({appearance:{title:'Denied'}}),/ログイン/);
 current=true;const fresh=factory(database,{uid:'fresh',name:'Fresh'},()=>current,core,design);await fresh.load();await fresh.save({appearance:{title:'New'},backgroundImage:'data:image/jpeg;base64,/9j/'});assert.equal(state.userListShares.fresh.enabled,false);assert.equal(state.userListShares.fresh.showKey,false);assert.equal(state.userListShares.fresh.backgroundVersion,state.userListBackgrounds.fresh.version);assert.ok(!Object.keys(writes.at(-1)).some(p=>p.startsWith('public')));
 const {mergeFreeRules}=require('./free-control-rules.cjs'),base={rules:{'.read':false,'.write':false,users:{$uid:{'.read':'auth != null && auth.uid === $uid','.write':'auth != null && auth.uid === $uid'}}}};
 assert.deepEqual(mergeFreeRules(mergeFreeRules(base)),mergeFreeRules(base));
 for(const file of ['admin-list-design-service.js','admin-list-design-ui.js'])new(require('node:vm').Script)(require('node:fs').readFileSync(require('node:path').join(__dirname,'..',file),'utf8'));
 console.log('PASS: admin design preview/save, atomic asset changes, preserved publication/URL/disclosure/songs, stale edit and auth guards, private draft creation, idempotent rules.');
})().catch(e=>{console.error(e);process.exitCode=1;});
