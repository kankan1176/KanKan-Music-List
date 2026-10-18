'use strict';
const assert=require('node:assert/strict'),core=require('../list-share-core.js'),factory=require('../list-share-service.js');
const {addListShareRules}=require('./list-share-rules.cjs');
assert.equal(core.wiki('javascript:alert(1)'), '');assert.equal(core.wiki('https://ja.chordwiki.org.evil.test/wiki/Song'),'');assert.equal(core.wiki('https://ja.chordwiki.org/wiki/Song'),'https://ja.chordwiki.org/wiki/Song');
assert.equal(core.registered({registered:true,excluded:true}),false);assert.equal(core.registered({registered:true}),true);
assert.deepEqual(core.song({title:'Song',artist:'Artist',chordwiki:'https://ja.chordwiki.org/wiki/Song'},{key:2,parts:['Guitar']},{}),{title:'Song',artist:'Artist',url:'https://ja.chordwiki.org/wiki/Song'});
assert.deepEqual(core.song({title:'Song'},{key:99,parts:['Guitar','Guitar']},{showKey:true,showParts:true}),{title:'Song',artist:'',key:0,parts:['Guitar']});
assert.equal(core.link('https://ja.chordwiki.org/wiki/Song',2),'https://ja.chordwiki.org/wiki.cgi?c=view&t=Song&key=2&symbol=');
assert.equal(core.tokenOK('a'.repeat(48)),true);assert.equal(core.tokenOK('../wrong'),false);const before={rules:{users:{keep:true}}};assert.deepEqual(addListShareRules(addListShareRules(structuredClone(before))),addListShareRules(structuredClone(before)));assert.deepEqual(before,{rules:{users:{keep:true}}});
global.firebase={database:{ServerValue:{TIMESTAMP:1}}};
const state={users:{member:{profile:{displayName:'表示名'},songs:{song1:{registered:true,key:2,parts:['Guitar']},excluded:{registered:true,excluded:true},missing:{registered:true}}}},songs:{song1:{title:'Song',artist:'Artist',chordwiki:'https://ja.chordwiki.org/wiki/Song'}}};
let watchers=[],events=[],current=true;const at=path=>path.split('/').filter(Boolean).reduce((a,k)=>a?.[k],state),snap=value=>({val:()=>structuredClone(value??null)});
function write(path,value){const keys=path.split('/').filter(Boolean);let parent=state;for(const key of keys.slice(0,-1))parent=parent[key]||=( {} );if(value===null)delete parent[keys.at(-1)];else parent[keys.at(-1)]=structuredClone(value);}
function emit(){for(const w of watchers)w.fn(snap(at(w.path)));}
const database={ref(path=''){return{on(event,fn){watchers.push({path,fn});queueMicrotask(()=>fn(snap(at(path))))},off(event,fn){watchers=watchers.filter(w=>w.path!==path||w.fn!==fn)},async once(){return snap(at(path))},async set(value){write(path,value)},async update(changes){for(const [key,value]of Object.entries(changes))write((path?path+'/':'')+key,value);for(const w of watchers)if(Object.keys(changes).some(key=>key===w.path))w.fn(snap(at(w.path)));}}}};
const service=factory(database,{uid:'member',displayName:'Google'},()=>current,event=>events.push(event),core);
(async()=>{
 await new Promise(resolve=>setImmediate(resolve));await service.enable({showKey:false,showParts:false});let token=state.userListShares.member.token;assert(core.tokenOK(token));assert.deepEqual(state.publicListShares[token].songs.song1,{title:'Song',artist:'Artist',url:'https://ja.chordwiki.org/wiki/Song'});assert.equal(Object.keys(state.publicListShares[token].songs).length,1);
 await service.enable({showKey:true,showParts:true});assert.equal(state.publicListShares[token].songs.song1.key,2);assert.deepEqual(state.publicListShares[token].songs.song1.parts,['Guitar']);
 state.users.member.songs.song1.key=-3;emit();await service.retry();assert.equal(state.publicListShares[token].songs.song1.key,-3);
 state.users.member.profile.displayName='変更名';emit();await service.retry();assert.equal(state.publicListShares[token].name,'変更名');
 await service.enable({},true);assert.notEqual(state.userListShares.member.token,token);assert.equal(state.publicListShares[token],undefined);token=state.userListShares.member.token;
 await service.disable();await service.retry();assert.equal(state.publicListShares[token],undefined);assert.equal(state.userListShares.member,undefined);
 current=false;await assert.rejects(()=>service.enable({}));service.close();assert.equal(watchers.length,0);
 console.log('PASS: safe URL and metadata, opt-in key/parts, saved-only live sync, rename sync, token rotation, stop, auth cleanup and idempotent isolated rules.');
})().catch(error=>{console.error(error);process.exitCode=1});
