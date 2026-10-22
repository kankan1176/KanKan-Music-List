'use strict';const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),core=require('../obs-scene-core.js'),{addObsSceneRules}=require('./obs-scene-rules.cjs');
assert.equal(core.config({theme:'bad',speed:999,font:'url(bad)'}).theme,'dark');assert.equal(core.config({speed:999}).speed,80);assert.equal(core.config({roomName:'x'.repeat(500)}).roomName.length,80);assert.equal(Object.keys(core.config({members:Object.fromEntries(Array.from({length:30},(_,i)=>['u'+i,{name:'n',part:'p',color:88}]))}).members).length,30);assert.equal(core.people({one:{uid:'a',name:'Haru',lastSeen:Date.now()},two:{uid:'a',name:'Haru'},old:{uid:'old',lastSeen:1},guest:{uid:'guest',guest:true,name:'ゲスト'}}).length,2);assert.equal(core.people({guest:{uid:'guest',guest:true,name:'ゲスト'}})[0].name,'guest');const original={rules:{'.read':false,rooms:{keep:true}}};assert.deepEqual(addObsSceneRules(addObsSceneRules(original)),addObsSceneRules(original));assert.deepEqual(original.rules.rooms,{keep:true});for(const file of ['obs-scene.js','obs-scene-core.js','obs-scene-editor.js'])new vm.Script(fs.readFileSync(require('path').join(__dirname,'..',file),'utf8'));console.log('PASS: scene normalization, bounded settings, member deduplication and expiry, isolated idempotent rules and scripts.');

assert.equal(core.config({}).transparentBackground,false);assert.equal(core.config({transparentBackground:true}).transparentBackground,true);assert.equal(core.config({transparentBackground:'true'}).transparentBackground,false);

assert.equal(core.people({one:{uid:'member',defaultPart:'🥁'}})[0].defaultPart,'ドラム・パーカッション');
assert.equal(core.people({one:{uid:'guest',guest:true,defaultPart:'🥁'}})[0].defaultPart,'');

const writeRule=addObsSceneRules(original).rules.obsScenes.$room.$uid['.write'];assert.ok(writeRule.includes("auth.token.firebase.sign_in_provider === 'google.com'"));assert.ok(!writeRule.includes('anonymous'));

const ordered=core.config({members:{b:{name:'B',order:0},a:{name:'A',order:1},bad:{order:-1},fraction:{order:1.5}}});
assert.equal(ordered.members.b.order,0);assert.equal(ordered.members.bad.order,undefined);assert.equal(ordered.members.fraction.order,undefined);
const list=[{uid:'a'},{uid:'new'},{uid:'b'}];assert.deepEqual(core.orderedPeople(list,ordered).map(p=>p.uid),['b','a','new']);assert.deepEqual(list.map(p=>p.uid),['a','new','b']);assert.deepEqual(core.orderedPeople(list,core.config()).map(p=>p.uid),['a','new','b']);assert.deepEqual(core.config(ordered),ordered);
console.log('PASS: optional member order survives normalization; old scenes keep their order, new members follow ordered members; invalid orders removed.');
