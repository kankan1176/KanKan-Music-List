/* Synthetic access tests; no real users or song records are read. */
'use strict';
const assert=require('node:assert/strict'),{initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing'),{ref,set,get,update,serverTimestamp}=require('firebase/database');
const {mergeFreeRules}=require('../../scripts/free-control-rules.cjs'),service=require('../../song-edit-service.js');
(async()=>{
 const original={rules:{'.read':false,'.write':false,songs:{'.read':true},admins:{$uid:{'.read':'auth != null && auth.uid === $uid'}},users:{$uid:{'.read':'auth != null && auth.uid === $uid','.write':'auth != null && auth.uid === $uid'}},publicProfiles:{'.read':true}}};
 const env=await initializeTestEnvironment({projectId:'demo-free-controls',database:{host:'127.0.0.1',port:9000,rules:JSON.stringify(mergeFreeRules(original))}});
 try{
  const song={title:'Original',artist:'Artist',chordwiki:'https://ja.chordwiki.org/wiki/Original',genre:'J-POP',genre1:'J-POP',keep:'metadata'};
  await env.withSecurityRulesDisabled(async c=>{const db=c.database();await set(ref(db,'admins/admin'),true);await set(ref(db,'songs/song'),song);await set(ref(db,'publicProfiles/member'),{displayName:'Member',code:'SL-TEST'});await set(ref(db,'users/member/songs/song'),{registered:true,key:2,part:'🎸',parts:['🎸'],liked:true,keep:'private metadata'});await set(ref(db,'users/member/profile/private'),{secret:true});});
  const context=(uid,provider='google.com')=>env.authenticatedContext(uid,{firebase:{sign_in_provider:provider}}).database(),admin=context('admin'),member=context('member'),other=context('other'),fake=context('admin','anonymous'),anon=env.unauthenticatedContext().database();
  const actor={uid:'admin',displayName:'Admin'},editor={uid:'member',displayName:'Editor'},changes={artist:{before:'Artist',after:'Changed'}};
  const prepare=(before,changes,id,extra={})=>service.prepare({songId:'song',before,changes,actor,editor,action:'approve',logId:id,revision:'rev-'+id,timestamp:serverTimestamp(),...extra});
  const first=prepare(song,changes,'first');
  for(const db of [member,other,fake,anon])await assertFails(update(ref(db),first.updates));
  await assertFails(update(ref(admin,'songs/song'),{artist:'Unlogged'}));
  await assertFails(set(ref(admin,'songEditLogs/orphan'),first.log));
  await assertSucceeds(update(ref(admin),first.updates));
  const actual=(await get(ref(admin,'songEditLogs/first'))).val();assert.equal(actual.editorUid,'member');assert.equal(actual.actorUid,'admin');assert.equal(actual.changes.artist.after,'Changed');assert.equal((await get(ref(admin,'songs/song/keep'))).val(),'metadata');
  for(const db of [member,other,fake,anon])await assertFails(get(ref(db,'songEditLogs')));
  await assertSucceeds(get(ref(admin,'songEditLogs')));
  await assertFails(update(ref(admin,'songEditLogs/first'),{editorUid:'forged'}));await assertFails(set(ref(admin,'songEditLogs/first'),null));
  // Two editors prepared against version zero: the second cannot overwrite the first.
  const stale=prepare(song,{title:{before:'Original',after:'Stale'}},'stale');await assertFails(update(ref(admin),stale.updates));assert.equal((await get(ref(admin,'songs/song/title'))).val(),'Original');
  let current=(await get(ref(admin,'songs/song'))).val();const undo=prepare(current,service.inverse(current,actual),'undo',{action:'undo',sourceLogId:'first',editor:actor});await assertSucceeds(update(ref(admin),undo.updates));assert.equal((await get(ref(admin,'songs/song/artist'))).val(),'Artist');assert.equal((await get(ref(admin,'songEditLogs/undo/action'))).val(),'undo');
  current=(await get(ref(admin,'songs/song'))).val();const again=prepare(current,{artist:{before:'Artist',after:'Another'}},'again',{action:'edit',editor:actor});await assertSucceeds(update(ref(admin),again.updates));assert.throws(()=>service.inverse({...current,artist:'Another'},actual),/変更/);
  const request={songId:'song',requestedBy:'member',editorName:'Member',title:'Original',artist:'Another',status:'pending',createdAt:serverTimestamp(),changes:{artist:{before:'Another',after:'Proposed'}}};
  await assertSucceeds(set(ref(member,'songChangeRequests/song/member'),request));await assertFails(set(ref(context('guest','anonymous'),'songChangeRequests/song/guest'),{...request,requestedBy:'guest'}));
  const saved='users/member/songs/song';await assertSucceeds(update(ref(admin,saved),{key:3,parts:['🎤','🎹'],part:'🎤',liked:false}));assert.equal((await get(ref(member,saved+'/keep'))).val(),'private metadata');
  for(const db of [other,fake,anon])await assertFails(update(ref(db,saved),{key:1}));
  for(const key of [-6,7,1.5,'3'])await assertFails(update(ref(admin,saved),{key}));
  await assertFails(set(ref(admin,saved),null));await assertFails(get(ref(admin,'users/member/profile/private')));await assertFails(update(ref(admin,'users/member/profile/private'),{secret:false}));
  await assertSucceeds(update(ref(member,saved),{key:4}));
  console.log('PASS: Google-only editing requests; admin-only list edits, immutable private data, append-only attributed history, atomic song/log writes, stale revision denial, undo and re-edit.');
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
