'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),artists=require('../artist-classification.js');
function updateSong(current){
 // A cold transaction may see null first; let the server retry with the real value.
 if(current===null)return null;
 if(!current||typeof current!=='object')throw Error('Invalid song in affiliation transaction');
 const next=artists.enrich(current);
 if(!Object.keys(next).some(field=>current[field]!==next[field]))return;
 return {...current,...next};
}
function refreshShare(current,master){
 if(current===null)return null;
 if(current.reserved||!current.songs)return;
 let changed=false;
 for(const[id,row]of Object.entries(current.songs)){
  const song=master[id];if(!song||!artists.match(song.artist).matches.length)continue;
  for(const field of ['genre2','genre4'])if(row[field]!==song[field]){row[field]=song[field]||'';changed=true;}
 }
 return changed?current:undefined;
}
async function main(){
 const {initializeApp,cert,deleteApp}=require('firebase-admin/app'),{getDatabase}=require('firebase-admin/database');
 const credential=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT),app=initializeApp({credential:cert(credential),databaseURL:'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app'}),db=getDatabase(app);
 const directory='.vtuber-affiliation-backup';fs.mkdirSync(directory,{recursive:true});
 try{
  const before=(await db.ref('songs').get()).val();if(!before||Object.keys(before).length<27000)throw Error('Unexpected production master size');
  const candidates=Object.entries(before).filter(([,song])=>artists.match(song.artist).matches.length);
  if(candidates.length<150||candidates.length>1500)throw Error('Unexpected affiliation candidate count');
  const backup=Object.fromEntries(candidates.map(([id,s])=>[id,{artist:s.artist,genre2:s.genre2??null,genre4:s.genre4??null}]));
  fs.writeFileSync(directory+'/before.json',JSON.stringify(backup),{mode:0o600});
  let updated=0;const touched=[];
  for(const[id]of candidates){
   const result=await db.ref('songs/'+id).transaction(updateSong,undefined,false);
   if(result.committed&&result.snapshot.exists()){updated++;touched.push(id);}
  }
  const master=(await db.ref('songs').get()).val();let concurrentSkipped=0;
  for(const[id]of candidates){const current=master[id];if(!current||current.artist!==before[id].artist){concurrentSkipped++;continue;}const expected=artists.enrich(current);for(const[field,value]of Object.entries(expected))if(current[field]!==value)throw Error('Affiliation readback mismatch: '+id);}
  const shares=(await db.ref('publicListShares').get()).val()||{};let sharesUpdated=0;
  for(const token of Object.keys(shares)){const result=await db.ref('publicListShares/'+token).transaction(value=>refreshShare(value,master),undefined,false);if(result.committed&&result.snapshot.exists())sharesUpdated++;}
  const sha256=crypto.createHash('sha256').update(fs.readFileSync('data/reference-masters/vtubers.json')).digest('hex');
  const report={candidates:candidates.length,updated,sharesUpdated,concurrentSkipped,unmatchedExistingVtuber:Object.values(master).filter(song=>String(song.genre2||'').split('、').includes('Vtuber')&&!artists.match(song.artist).matches.length).length,sha256,appliedAt:Date.now()};
  const changes={'maintenanceOperations/vtuber-affiliations-20261024':report};if(updated||sharesUpdated)changes['masterMeta/revision']=db.ref('masterMeta').push().key;
  await db.ref().update(changes);
  fs.writeFileSync(directory+'/verification.json',JSON.stringify(report,null,2),{mode:0o600});
  console.log('PASS: VTuber affiliations verified; only genre2/genre4 changed. '+JSON.stringify(report));
 }finally{await deleteApp(app);}
}
module.exports={updateSong,refreshShare};if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
