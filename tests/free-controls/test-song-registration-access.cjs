'use strict';
const assert=require('node:assert/strict'),{initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing'),{ref,set}=require('firebase/database'),{addGenreRules}=require('../../scripts/genre-rules.cjs');
(async()=>{
 const source={rules:{'.read':false,'.write':false,songs:{},publicListShares:{$token:{songs:{$song:{}}}}}};
 source.rules.songAddRequests={$uid:{$requestId:{'.write':'auth != null && auth.uid === $uid'}}};
 const rules=addGenreRules(source),validation=rules.rules.songAddRequests.$uid.$requestId['.validate'];
 const parts=validation.slice('data.exists() || ('.length,-1).split(' && ');rules.rules.schemaProbes={'.write':true};parts.forEach((part,i)=>rules.rules.schemaProbes['probe'+i]={'.validate':part});
 const env=await initializeTestEnvironment({projectId:'demo-free-controls',database:{host:'127.0.0.1',port:9000,rules:JSON.stringify(rules)}});
 try{
  const db=env.authenticatedContext('registration-owner',{firebase:{sign_in_provider:'google.com'}}).database();const request={title:'Synthetic song',artist:'Synthetic artist',chordwiki:'https://ja.chordwiki.org/wiki/Synthetic'};
  const failed=[];for(const[i,part]of parts.entries()){try{await set(ref(db,'schemaProbes/probe'+i),request);}catch{failed.push({index:i,field:part.match(/child\('([^']+)'\)/)?.[1]||'required fields',kind:part.includes('.matches(')?'pattern':part.includes('.beginsWith(')?'official URL':part.includes('.isString(')?'string':'shape'});}}
  assert.deepEqual(failed,[],'Registration schema compatibility probes');
  await assertSucceeds(set(ref(db,'songAddRequests/registration-owner/valid'),request));
  for(const field of ['title','artist','chordwiki'])for(const value of ['', '   ',null])await assertFails(set(ref(db,'songAddRequests/registration-owner/invalid-'+field),{...request,[field]:value}));
  await assertFails(set(ref(db,'songAddRequests/registration-owner/unsafe-url'),{...request,chordwiki:'https://evil.test/wiki/Song'}));
  const singers=[...new Set(require('../../song-registration.js').voices.map(row=>row.name))].join('、');
  await assertSucceeds(set(ref(db,'songAddRequests/registration-owner/many'),{...request,vocal_synths:singers}));await assertFails(set(ref(db,'songAddRequests/registration-owner/oversized'),{...request,vocal_synths:'x'.repeat(1001)}));
  console.log('PASS: Firebase registration schema accepts valid inputs and all singers; rejects absent/blank required fields, unsafe URLs and oversized singer data.');
 }finally{await env.cleanup();}
})().catch(error=>{console.error(error);process.exitCode=1;});
