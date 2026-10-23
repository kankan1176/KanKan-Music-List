'use strict';
// One-time genre-only migration. No user, membership, queue or song deletion.
const fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib');
const genres=require('../song-genres.js');
const EXPECTED='f7d434e7d579ad10fcf81e1eb144b39baaef56845adaa4c129f77b2fed2004a2';
const OP='master-genres-20261023-v1';
function decode(envelope,privateKey){
 if(envelope.algorithm!=='RSA-OAEP-SHA256/AES-256-GCM/gzip'||envelope.sha256!==EXPECTED)throw Error('Unexpected source envelope');
 const key=crypto.privateDecrypt({key:privateKey,oaepHash:'sha256',padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(envelope.key,'base64'));
 const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
 const raw=zlib.gunzipSync(Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]));
 if(crypto.createHash('sha256').update(raw).digest('hex')!==EXPECTED)throw Error('Source checksum mismatch');
 const songs=JSON.parse(raw).songs,entries=Object.entries(songs);
 if(entries.length!==27346)throw Error('Unexpected source count');
 for(const[id,song]of entries)if(!/^[A-Za-z0-9_-]{1,80}$/.test(id)||song.id!==id||Object.keys(song).length!==15||genres.fields.some(f=>typeof song[f]!=='string'||song[f].length>100))throw Error('Invalid source schema');
 return songs;
}
function plan(source,live){
 const updates={},backup={},counts={source:27346,matched:0,sourceOnly:0,liveOnly:0,changed:0,recentSkipped:0};
 for(const[id,song]of Object.entries(source)){
  if(!live[id]){counts.sourceOnly++;continue;}
  counts.matched++;
  if(Number(live[id].updatedAt)>Date.parse('2026-10-23T04:14:27.944Z')){counts.recentSkipped++;continue;}
  let changed=false;for(const field of [...genres.fields,'genre']){const next=field==='genre'?song.genre1:song[field];if(live[id][field]===next)continue;changed=true;updates[`songs/${id}/${field}`]=next;backup[`songs/${id}/${field}`]=live[id][field]??null;}
  if(changed)counts.changed++;
 }
 counts.liveOnly=Object.keys(live).filter(id=>!source[id]).length;
 // Any unmatched source ID needs a separate audit; never silently duplicate/rekey songs.
 if(counts.sourceOnly||counts.matched!==27346)throw Error('Source IDs differ from production. Migration stopped without writes. '+JSON.stringify(counts));
 if(Buffer.byteLength(JSON.stringify(updates))>14*1024*1024)throw Error('Migration exceeds atomic update budget');
 return{updates,backup,counts};
}
async function main(){
 const {initializeApp,cert,deleteApp}=require('firebase-admin/app'),{getDatabase}=require('firebase-admin/database');
 const credential=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT),source=decode(JSON.parse(fs.readFileSync('maintenance/master-genres-20261023.enc.json','utf8')),credential.private_key);
 const app=initializeApp({credential:cert(credential),databaseURL:'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app'}),db=getDatabase(app);
 fs.mkdirSync('.genre-migration',{recursive:true});
 try{
  const marker=db.ref('maintenanceOperations/'+OP),completed=(await marker.get()).val();
  if(completed?.sha256===EXPECTED){console.log('Master migration already applied; verifying public genre projections.');}
  else{
   const before=(await db.ref('masterMeta/revision').get()).val(),live=(await db.ref('songs').get()).val(),p=plan(source,live);
   fs.writeFileSync('.genre-migration/genre-backup.json',JSON.stringify({revision:before,updates:p.backup}),{mode:0o600});
   fs.writeFileSync('.genre-migration/audit.json',JSON.stringify(p.counts,null,2));
   console.log('Genre migration audit: '+JSON.stringify(p.counts));
   if((await db.ref('masterMeta/revision').get()).val()!==before)throw Error('Master changed during audit; no migration writes');
   const next=db.ref('masterMeta').push().key;
   await db.ref().update({...p.updates,'masterMeta/revision':next,['maintenanceOperations/'+OP]:{sha256:EXPECTED,counts:p.counts,appliedAt:Date.now()}});
   const saved=(await db.ref('songs').get()).val();
   for(const path of Object.keys(p.updates)){const[,id,field]=path.split('/');if(saved[id]?.[field]!==p.updates[path])throw Error('Post-write genre verification failed');}
   for(const[id,previous]of Object.entries(live))for(const field of Object.keys(previous).filter(f=>!genres.fields.includes(f)&&f!=='genre'))if(JSON.stringify(saved[id]?.[field])!==JSON.stringify(previous[field]))throw Error('Non-genre field changed during verification');
   console.log('PASS: production genre update verified; all non-genre song fields preserved.');
  }
  // Existing public snapshots are projections. Preserve their names, keys, parts and appearance.
  const master=(await db.ref('songs').get()).val(),shares=(await db.ref('publicListShares').get()).val()||{};let sharedRows=0;
  for(const[token,share]of Object.entries(shares)){
   const updates={};for(const[id,row]of Object.entries(share.songs||{})){const song=master[id];if(!song)continue;for(const field of genres.fields)updates[`songs/${id}/${field}`]=genres.value(song,field);updates[`songs/${id}/genres`]=genres.all(song).slice(0,12);updates[`songs/${id}/genresKnown`]=true;sharedRows++;}
   if(Object.keys(updates).length)await db.ref('publicListShares/'+token).update(updates);
  }
  console.log('PASS: public list genre projections refreshed: '+sharedRows+' rows. No private My List or room paths written.');
 }finally{await deleteApp(app);}
}
module.exports={decode,plan};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
