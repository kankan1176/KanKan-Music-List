'use strict';
const g=require('../song-genres.js'),{initializeApp,cert,deleteApp}=require('firebase-admin/app'),{getDatabase}=require('firebase-admin/database');
(async()=>{const app=initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),databaseURL:'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app'});try{
 const db=getDatabase(app),get=p=>db.ref(p).get().then(s=>s.val()),[meta,search,revision,marker]=await Promise.all(['songGenreMeta','songSearchMeta','masterMeta/revision','maintenanceOperations/category-master-20261023-v1'].map(get));
 if(meta.indexVersion<5||search.indexVersion<5||meta.sourceRevision!==revision||search.sourceRevision!==revision||meta.currentIndexKey!==search.currentIndexKey||marker?.counts?.matched!==27346)throw Error('Category index is not current');
 for(const category of g.categories){const selected=g.selection(category),[[field,label]]=Object.entries(selected),key=Buffer.from(field+'::'+label).toString('hex'),rows=await db.ref('songGenreRows/'+meta.currentIndexKey+'/'+key).orderByKey().limitToFirst(1).get();if(!rows.exists())throw Error('No category index '+category);}
 for(const field of ['genre6','vocal_synths']){const choice=Object.values(meta.groups[field]||{})[0];if(!choice)throw Error('Missing '+field);const rows=await db.ref('songGenreRows/'+meta.currentIndexKey+'/'+Buffer.from(field+'::'+choice.name).toString('hex')).orderByKey().limitToFirst(1).get(),id=Object.values(rows.val()||{})[0],song=await get('songs/'+id);if(!g.matches(song,{[field]:choice.name}))throw Error('Index/song mismatch '+field);}
 if(!meta.facets?.['ボカロ']?.vocal_synths?.includes('初音ミク'))throw Error('Vocaloid dependent options missing');
 console.log('PASS live categories=5, dependent synth/music choices, index revision, source IDs, live-only preservation; songs='+meta.songCount);
}finally{await deleteApp(app);}})().catch(e=>{console.error(e.message);process.exitCode=1;});
