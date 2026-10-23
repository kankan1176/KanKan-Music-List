'use strict';
const fs=require('node:fs'),{decode,EXPECTED,OP,columns,CAPTURED}=require('./migrate-latest-sheet.cjs'),g=require('../song-genres.js'),reader=require('../genre-index-reader.js');
const {initializeApp,cert,deleteApp}=require('firebase-admin/app'),{getDatabase}=require('firebase-admin/database');
(async()=>{const credential=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT),source=decode(JSON.parse(fs.readFileSync('maintenance/master-sheet-20261024.enc.json')),credential.private_key),app=initializeApp({credential:cert(credential),databaseURL:'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app'});try{
 const db=getDatabase(app),get=path=>db.ref(path).get().then(s=>s.val()),[live,revision,meta,search,marker]=await Promise.all(['songs','masterMeta/revision','songGenreMeta','songSearchMeta','maintenanceOperations/'+OP].map(get));
 if(marker?.sha256!==EXPECTED||marker.counts.matched!==27346||meta.indexVersion<6||search.indexVersion<6||meta.sourceRevision!==revision||search.sourceRevision!==revision||meta.currentIndexKey!==search.currentIndexKey)throw Error('Master/index metadata mismatch');
 let checked=0;for(const[id,row]of Object.entries(source)){if(Number(live[id]?.updatedAt)>CAPTURED)continue;for(const f of columns.slice(1))if(String(live[id]?.[f]??'')!==row[f])throw Error('Live source mismatch '+f);checked++;}
 for(const f of ['release_year','anime_year']){
  const [id,song]=Object.entries(source).find(([id,song])=>song[f]&&Number(live[id]?.updatedAt||0)<=CAPTURED),year=g.split(song[f])[0],page=await reader.page(db,meta.currentIndexKey,{[f]:year});if(!page.rows.length)throw Error('No year index '+f);
  for(const r of page.rows)if(!g.matches(live[r.id],{[f]:year}))throw Error('Year index mismatch');
  const key=Buffer.from(year).toString('hex'),words=await db.ref('songSearchRows/'+meta.currentIndexKey).orderByKey().startAt(key).endAt(key+'\uf8ff').limitToFirst(1).get();if(!words.exists())throw Error('No year search index');
 }
 console.log('PASS current 19-column source='+checked+' verified rows; source release_year='+Object.values(source).filter(s=>s.release_year).length+'; anime_year='+Object.values(source).filter(s=>s.anime_year).length+'; year indexes and search agree; liveOnly='+marker.counts.liveOnly+'; recentSkipped='+marker.counts.recentSkipped);
}finally{await deleteApp(app);}})().catch(e=>{console.error(e.message);process.exitCode=1;});
