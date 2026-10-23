'use strict';
// Only classification fields change. Song IDs, titles, personal lists and rooms are preserved.
const fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib'),genres=require('../song-genres.js'),{addGenreRules}=require('./genre-rules.cjs');
const EXPECTED='125cb5bf557101dd59b165baba6117ec5b35c8fbefd4999ac2d452f51c597789',OP='category-master-20261023-v1',CAPTURED=Date.parse('2026-10-23T08:59:39.971Z');
function decode(envelope,privateKey){
 if(envelope.algorithm!=='RSA-OAEP-SHA256/AES-256-GCM/gzip'||envelope.sha256!==EXPECTED)throw Error('Unexpected category source');
 const key=crypto.privateDecrypt({key:privateKey,oaepHash:'sha256',padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(envelope.key,'base64')),decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
 const raw=zlib.gunzipSync(Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]));if(crypto.createHash('sha256').update(raw).digest('hex')!==EXPECTED)throw Error('Category source checksum mismatch');
 const songs=JSON.parse(raw).songs;if(Object.keys(songs).length!==27346)throw Error('Unexpected source count');
 for(const[id,song]of Object.entries(songs))if(!/^[A-Za-z0-9_-]{1,80}$/.test(id)||song.id!==id||Object.keys(song).length!==9||genres.metadataFields.some(f=>typeof song[f]!=='string'||song[f].length>100))throw Error('Invalid category source');return songs;
}
function plan(source,live){
 const updates={},backup={},counts={matched:0,sourceOnly:0,liveOnly:0,changed:0,recentSkipped:0};
 for(const[id,song]of Object.entries(source)){
  if(!live[id]){counts.sourceOnly++;continue;}counts.matched++;if(Number(live[id].updatedAt)>CAPTURED){counts.recentSkipped++;continue;}let changed=false;
  for(const f of [...genres.metadataFields,'genre']){const next=f==='genre'?song.genre1:song[f];if(live[id][f]===next)continue;changed=true;updates['songs/'+id+'/'+f]=next;backup['songs/'+id+'/'+f]=live[id][f]??null;}
  if(changed)counts.changed++;
 }
 counts.liveOnly=Object.keys(live).filter(id=>!source[id]).length;
 if(counts.sourceOnly||counts.matched!==27346)throw Error('Production/source IDs differ; no writes');
 if(Buffer.byteLength(JSON.stringify(updates))>14*1024*1024)throw Error('Category changes exceed atomic write budget');return{updates,backup,counts};
}
async function main(){
 const {initializeApp,cert,deleteApp}=require('firebase-admin/app'),{getDatabase}=require('firebase-admin/database'),credential=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT),source=decode(JSON.parse(fs.readFileSync('maintenance/master-categories-20261023.enc.json','utf8')),credential.private_key),app=initializeApp({credential:cert(credential),databaseURL:'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app'}),db=getDatabase(app);
 fs.mkdirSync('.category-migration',{recursive:true});
 try{
  const rules=await db.getRulesJSON(),nextRules=addGenreRules(rules);fs.writeFileSync('.category-migration/rules-before.json',JSON.stringify(rules),{mode:0o600});
  // Only add bounded string validators. Existing read/write grants are retained.
  if(JSON.stringify(nextRules)!==JSON.stringify(rules))await db.setRules(nextRules);
  const marker=db.ref('maintenanceOperations/'+OP);
  if((await marker.get()).val()?.sha256!==EXPECTED){
   const revision=(await db.ref('masterMeta/revision').get()).val(),live=(await db.ref('songs').get()).val(),p=plan(source,live);
   fs.writeFileSync('.category-migration/backup.json',JSON.stringify({revision,updates:p.backup}),{mode:0o600});
   if((await db.ref('masterMeta/revision').get()).val()!==revision)throw Error('Master changed during audit; no classification writes');
   const next=db.ref('masterMeta').push().key;await db.ref().update({...p.updates,'masterMeta/revision':next,['maintenanceOperations/'+OP]:{sha256:EXPECTED,counts:p.counts,appliedAt:Date.now()}});
   const saved=(await db.ref('songs').get()).val();for(const path of Object.keys(p.updates)){const[,id,field]=path.split('/');if(saved[id]?.[field]!==p.updates[path])throw Error('Category verification failed');}
   for(const[id,previous]of Object.entries(live))for(const field of Object.keys(previous).filter(f=>!genres.metadataFields.includes(f)&&f!=='genre'))if(JSON.stringify(saved[id]?.[field])!==JSON.stringify(previous[field]))throw Error('Non-classification field changed');
   console.log('PASS classification-only update: '+JSON.stringify(p.counts));
  }
  const master=(await db.ref('songs').get()).val(),shares=(await db.ref('publicListShares').get()).val()||{};let refreshed=0;
  for(const[token,share]of Object.entries(shares)){const updates={};for(const id of Object.keys(share.songs||{})){const song=master[id];if(!song)continue;for(const f of genres.metadataFields)updates['songs/'+id+'/'+f]=genres.value(song,f);updates['songs/'+id+'/genres']=genres.all(song).slice(0,12);refreshed++;}if(Object.keys(updates).length)await db.ref('publicListShares/'+token).update(updates);}
  console.log('PASS public projections refreshed: '+refreshed+' rows; no private user or room writes.');
 }finally{await deleteApp(app);}
}
module.exports={decode,plan};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
