'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const f=require('firebase/database'),reader=require('../../genre-index-reader.js');
(async()=>{const env=await initializeTestEnvironment({projectId:'demo-free-controls',database:{host:'127.0.0.1',port:9000,rules:fs.readFileSync(process.env.GENRE_RULE_TEST,'utf8')}});try{
 const songs={},maps={};for(let i=0;i<705;i++){const id='g'+String(i).padStart(4,'0'),key=String(i).padStart(8,'0')+'_'+id,song={id,title:'Synthetic '+i,artist:'Artist',updatedAt:i,genre1:i%2?'洋楽':'J-POP',genre2:i%3?'ゲーム':'TV（CM・バラエティ）主題歌',genre3:'ロック',genre4:i===600?'ジャンプ':'',genre5:i===600?'ジャンプ':''};songs[id]=song;for(const field of ['genre1','genre2','genre3','genre4','genre5'])if(song[field])(maps[reader.encode(field+'::'+song[field])]??={})[key]=id;}
 await env.withSecurityRulesDisabled(async c=>{await f.set(f.ref(c.database(),'songs'),songs);await f.set(f.ref(c.database(),'songGenreRows/demo'),maps);await f.set(f.ref(c.database(),'songSearchRows/demo'),Object.fromEntries(Object.keys(songs).map(id=>['test_'+id,id])));});
 for(const db of [env.unauthenticatedContext().database(),env.authenticatedContext('query-guest',{firebase:{sign_in_provider:'anonymous'}}).database(),env.authenticatedContext('query-user',{firebase:{sign_in_provider:'google.com'}}).database()]){
  const first=(await assertSucceeds(f.get(f.query(f.ref(db,'songs'),f.orderByChild('updatedAt'),f.limitToLast(101))))).val();assert.equal(Object.keys(first).length,101);
  const base=f.ref(db,'songGenreRows/demo/'+reader.encode('genre1::J-POP'));
  await assertFails(f.get(f.query(base,f.orderByKey(),f.limitToFirst(101))));await assertFails(f.get(base));
  const search=f.ref(db,'songSearchRows/demo');await assertFails(f.get(f.query(search,f.orderByKey(),f.limitToFirst(150))));await assertSucceeds(f.get(f.query(search,f.orderByKey(),f.startAt('test_'),f.endAt('test_\uf8ff'),f.limitToFirst(100))));
  function ref(path,clauses=[]){return{orderByKey:()=>ref(path,[...clauses,f.orderByKey()]),startAt:k=>ref(path,[...clauses,f.startAt(k)]),startAfter:k=>ref(path,[...clauses,f.startAfter(k)]),limitToFirst:n=>ref(path,[...clauses,f.limitToFirst(n)]),once:()=>f.get(f.query(f.ref(db,path),...clauses))};}
  const compat={ref},one=await reader.page(compat,'demo',{genre1:'J-POP'}),two=await reader.page(compat,'demo',{genre1:'J-POP'},{after:one.cursor});assert.equal(one.rows.length,100);assert.equal(two.rows.length,100);assert.equal(new Set([...one.rows,...two.rows].map(row=>row.id)).size,200);
  const selection={genre1:'J-POP',genre2:'TV（CM・バラエティ）主題歌'},a=await reader.page(compat,'demo',selection),b=await reader.page(compat,'demo',selection,{after:a.cursor});assert.equal(a.rows.length,100);assert.equal(b.rows.length,18);assert(!b.hasNext);assert([...a.rows,...b.rows].every(row=>Number(row.id.slice(1))%6===0));
  const all=await reader.page(compat,'demo',{...selection,genre3:'ロック',genre4:'ジャンプ',genre5:'ジャンプ'});assert.deepEqual(all.rows.map(row=>row.id),['g0600']);
 }
 console.log('PASS: current production rules allow initial all-song reads; reproduce old genre/search query denials; actual client reader single/AND/five-field queries and pagination succeed for unauthenticated, guest and Google users. Synthetic emulator data only.');
}finally{await env.cleanup();}})().catch(e=>{console.error('FAIL: '+e.message);process.exitCode=1;});
