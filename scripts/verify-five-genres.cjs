'use strict';
const genres=require('../song-genres.js'),{initializeApp,cert,deleteApp}=require('firebase-admin/app'),{getDatabase}=require('firebase-admin/database');
(async()=>{
 const app=initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),databaseURL:'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app'});
 try{
  const db=getDatabase(app),[gs,ss,revision,operation]=await Promise.all(['songGenreMeta','songSearchMeta','masterMeta/revision','maintenanceOperations/master-genres-20261023-v1'].map(p=>db.ref(p).get()));
  const meta=gs.val(),search=ss.val(),marker=operation.val();
  if(meta?.indexVersion!==4||search?.indexVersion!==4||meta.sourceRevision!==revision.val()||search.sourceRevision!==revision.val()||meta.currentIndexKey!==search.currentIndexKey||marker?.counts?.matched!==27346)throw Error('Production genre index metadata mismatch');
  for(const field of genres.fields){
   const choices=Object.values(meta.groups?.[field]||{});if(!choices.length)throw Error('Missing production genre group '+field);
   const choice=field==='genre2'?choices.find(v=>v.name==='TV（CM・バラエティ）主題歌')||choices[0]:choices[0];
   const key=Buffer.from(field+'::'+choice.name,'utf8').toString('hex'),rows=(await db.ref('songGenreRows/'+meta.currentIndexKey+'/'+key).orderByKey().limitToFirst(1).get()).val();
   const id=Object.values(rows||{})[0];if(!id)throw Error('Missing production genre rows '+field);
   const song=(await db.ref('songs/'+id).get()).val();if(!genres.matches(song,{[field]:choice.name}))throw Error('Production genre index does not match song');
  }
  console.log('PASS: production master and search revisions agree; all five genre indexes resolve to matching songs, including full-width label characters. songs='+meta.songCount+'; migrated='+marker.counts.matched+'; liveOnlyPreserved='+marker.counts.liveOnly);
 }finally{await deleteApp(app);}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
