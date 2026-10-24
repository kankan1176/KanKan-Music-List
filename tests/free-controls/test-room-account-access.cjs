'use strict';
const fs=require('node:fs'),{initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing'),{ref,set,get,update,serverTimestamp,onValue}=require('firebase/database');
(async()=>{const env=await initializeTestEnvironment({projectId:'demo-free-controls',database:{host:'127.0.0.1',port:9000,rules:fs.readFileSync(process.env.OBS_RULE_TEST,'utf8')}});try{
 const google=env.authenticatedContext('feature-google',{firebase:{sign_in_provider:'google.com'}}).database(),guest=env.authenticatedContext('feature-guest',{firebase:{sign_in_provider:'anonymous'}}).database(),none=env.unauthenticatedContext().database();
 const settings=uid=>({source:'master',songIds:[],createdAt:serverTimestamp(),createdByUid:uid});
 await assertSucceeds(set(ref(google,'rooms/ACCTTEST/settings'),settings('feature-google')));
 await assertFails(set(ref(guest,'rooms/GUESTNO1/settings'),settings('feature-guest')));
 await assertFails(set(ref(none,'rooms/GUESTNO2/settings'),settings('feature-guest')));
 await env.withSecurityRulesDisabled(async c=>{await set(ref(c.database(),'rooms/PARTIAL1/members/old'),{name:'old'});});
 await assertFails(set(ref(guest,'rooms/PARTIAL1/settings'),settings('feature-guest')));
 await assertSucceeds(get(ref(guest,'rooms/ACCTTEST/settings')));
 await assertSucceeds(set(ref(guest,'rooms/ACCTTEST/members/guest-session'),{uid:'feature-guest',name:'Guest',guest:true,lastSeen:serverTimestamp(),defaultPart:''}));
 await assertSucceeds(update(ref(guest,'rooms/ACCTTEST/members/guest-session'),{name:'Renamed guest',lastSeen:serverTimestamp()}));
 await env.withSecurityRulesDisabled(async c=>{await set(ref(c.database(),'songs/audit-song'),{title:'Audit Song',artist:'Artist'});});
 await assertSucceeds(set(ref(guest,'rooms/ACCTTEST/queue/guest-song'),{songId:'audit-song',status:'reserved',addedBy:'Guest',order:1,keyOffset:0}));
 await assertSucceeds(update(ref(guest,'rooms/ACCTTEST/queue/guest-song'),{status:'confirmed'}));
 await assertSucceeds(update(ref(guest,'rooms/ACCTTEST/queue/guest-song'),{status:'completed'}));
 await env.withSecurityRulesDisabled(async c=>{await set(ref(c.database(),'songs/audit-song'),{title:'Audit Song',artist:'Artist'});});
 await assertSucceeds(set(ref(guest,'rooms/ACCTTEST/queue/guest-song'),null));
 await env.withSecurityRulesDisabled(async c=>{await set(ref(c.database(),'publicProfiles/feature-google'),{displayName:'Google',code:'SL-JKLMNPQRST'});await set(ref(c.database(),'publicProfiles/feature-other'),{displayName:'Other',code:'SL-ABCDEFGHJK'});await set(ref(c.database(),'userFavorites/feature-guest'),{'feature-other':true});});
 await assertFails(get(ref(guest,'userFavorites/feature-guest')));await assertFails(set(ref(guest,'userFavorites/feature-guest/feature-other'),true));
 await assertSucceeds(set(ref(google,'userFavorites/feature-google/feature-other'),true));await assertSucceeds(get(ref(google,'userFavorites/feature-google')));
 await assertSucceeds(set(ref(guest,'rooms/ACCTTEST/members/guest-session'),null));
 // My List and song submissions are account-only, including direct API requests.
 const song={registered:true,key:0,part:'',liked:false};
 await assertSucceeds(set(ref(google,'users/feature-google/songs/account-song'),song));
 await assertSucceeds(get(ref(google,'users/feature-google/songs')));
 await assertFails(set(ref(guest,'users/feature-guest/songs/guest-song'),song));
 const wrongProvider=env.authenticatedContext('feature-google',{firebase:{sign_in_provider:'anonymous'}}).database();
 await assertFails(get(ref(wrongProvider,'users/feature-google/songs')));
 await assertFails(set(ref(wrongProvider,'users/feature-google/songs/account-song'),null));
 const request=uid=>({type:'newSong',requestedBy:uid,title:'Synthetic new song',artist:'Synthetic artist',chordwiki:'https://ja.chordwiki.org/wiki/Synthetic',status:'pending',createdAt:serverTimestamp(),genre:'J-POP',genre1:'J-POP',genre2:'アニソン、ゲーム',genre3:'ロック',genre4:'ジャンプ',genre5:''});
 try{await assertSucceeds(set(ref(google,'songAddRequests/feature-google/account-request'),request('feature-google')));}catch(error){
  const root=JSON.parse(fs.readFileSync(process.env.OBS_RULE_TEST,'utf8')).rules.songAddRequests;const owner=root[Object.keys(root).find(key=>key.startsWith('$'))];const node=owner[Object.keys(owner).find(key=>key.startsWith('$'))];
  console.error('Synthetic registration validation diagnostics: '+JSON.stringify(Object.fromEntries(['title','artist','chordwiki','.validate'].map(key=>[key,key==='.validate'?node[key]:node[key]?.['.validate']||null]))));throw error;
 }
 await assertSucceeds(get(ref(google,'songAddRequests/feature-google')));
 for(const field of ['title','artist','chordwiki']){
  for(const value of ['', '   ',null]){const bad={...request('feature-google'),[field]:value};await assertFails(set(ref(google,'songAddRequests/feature-google/bad-'+field),bad));}
 }
 await assertFails(set(ref(google,'songAddRequests/feature-google/unsafe-url'),{...request('feature-google'),chordwiki:'https://evil.test/wiki/Song'}));
 const voices=require('../../song-registration.js').voices.map(row=>row.name);const singers=[...new Set(voices)].join('、');
 await assertSucceeds(set(ref(google,'songAddRequests/feature-google/many-vocals'),{...request('feature-google'),vocal_synths:singers}));
 await assertFails(set(ref(google,'songAddRequests/feature-google/oversized-vocals'),{...request('feature-google'),vocal_synths:'x'.repeat(1001)}));

 await assertFails(set(ref(google,'songAddRequests/feature-google/oversized-genre'),{...request('feature-google'),genre5:'x'.repeat(101)}));
 await assertFails(set(ref(guest,'songAddRequests/feature-guest/guest-request'),request('feature-guest')));
 await assertFails(get(ref(wrongProvider,'songAddRequests/feature-google')));
 await assertFails(set(ref(wrongProvider,'songAddRequests/feature-google/account-request'),null));
 await env.withSecurityRulesDisabled(async c=>{await set(ref(c.database(),'admins/feature-admin'),true);});
 const admin=env.authenticatedContext('feature-admin',{firebase:{sign_in_provider:'google.com'}}).database();
 await assertSucceeds(get(ref(admin,'songAddRequests')));
 await assertSucceeds(update(ref(admin,'songAddRequests/feature-google/account-request'),{status:'approved',reviewedBy:'feature-admin',reviewedAt:serverTimestamp()}));
 console.log('PASS: Google My List read/write and song submission retained; anonymous My List/submission denied; admin request review retained. Synthetic data only.');
 // Reproduce the forbidden queue-root write, then exercise the real reorder helper.
 const {swapOrders}=require('../../queue-actions.js');
 for(const db of [google,guest]){
  const queue=ref(db,'rooms/ACCTTEST/queue');
  const item=order=>({songId:'audit-song',status:'reserved',addedBy:'Guest',order,keyOffset:2});
  await assertSucceeds(set(ref(db,'rooms/ACCTTEST/queue/reorder-a'),item(10)));
  await assertSucceeds(set(ref(db,'rooms/ACCTTEST/queue/reorder-b'),item(20)));
  const before=(await get(queue)).val();
  await assertFails(set(queue,before));
  let unsubscribe;const compat={on:(_event,receive,error)=>{unsubscribe=onValue(queue,receive,error)},off:()=>unsubscribe?.(),update:patch=>update(queue,patch)};
  const result=await swapOrders(compat,'reorder-a','reorder-b',{status:'reserved',orderA:10,orderB:20});
  if(!result.committed)throw Error('Expected reorder commit');
  const after=(await assertSucceeds(get(queue))).val();
  if(after['reorder-a'].order!==20||after['reorder-b'].order!==10||after['reorder-a'].keyOffset!==2)throw Error('Unexpected reorder data');
 }
 console.log('PASS: reproduced forbidden queue-root writes; real helper atomically reorders using existing child permissions for Google and guests without widening rules. Synthetic data only.');
 console.log('PASS: production-derived rules allow Google room creation and favorites; deny guest room creation/favorites; preserve guest shared-room membership, rename, queue progression/deletion and leave. Synthetic data only.');
}finally{await env.cleanup();}})().catch(()=>{console.error('FAIL: room/account access assertion. No production room data was read or changed.');process.exitCode=1;});
