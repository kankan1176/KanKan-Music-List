'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const ALLOWED=['genre2','genre5','tieup'];
function labels(value){return String(value??'').split('、').map(v=>v.trim()).filter(Boolean);}
function append(value,tag){const parts=labels(value);return parts.includes(tag)?value:[...parts,tag].join('、');}
function validatePatch(patch){
 assert.equal(patch.operation,'shojo-anime-tieups-20261028');assert.equal(patch.entries.length,41);
 const ids=new Set();
 for(const entry of patch.entries){
  assert.match(entry.id,/^[A-Za-z0-9_-]{1,80}$/);assert(!ids.has(entry.id));ids.add(entry.id);
  assert.equal(typeof entry.title,'string');assert(entry.title);assert.match(entry.chordwiki,/^https:\/\/ja\.chordwiki\.org\/wiki\//);
  assert.deepEqual(Object.keys(entry.append).sort(),[...ALLOWED].sort());assert.equal(entry.append.genre2,'アニソン');
  assert(['ちゃお','なかよし','りぼん'].includes(entry.append.genre5));assert(entry.append.tieup.length>0&&entry.append.tieup.length<120);
 }
 return patch;
}
function updateSong(current,entry){
 // The RTDB SDK may first invoke a cold transaction with null and retry against the server value.
 if(current===null)return null;
 if(!current||Array.isArray(current)||current.title!==entry.title||current.chordwiki!==entry.chordwiki)return;
 const next={...current};let changed=false;
 for(const field of ALLOWED){const value=append(current[field],entry.append[field]);if(value!==current[field]){next[field]=value;changed=true;}}
 return changed?next:undefined;
}
function verifySong(current,entry){
 assert(current&&current.title===entry.title&&current.chordwiki===entry.chordwiki,'Song identity changed: '+entry.id);
 for(const field of ALLOWED)assert(labels(current[field]).includes(entry.append[field]),'Readback mismatch: '+entry.id+'/'+field);
}
async function main(){
 const {initializeApp,cert,deleteApp}=require('firebase-admin/app'),{getDatabase}=require('firebase-admin/database');
 const patch=validatePatch(JSON.parse(fs.readFileSync('maintenance/shojo-anime-tieups-20261028.json','utf8')));
 const app=initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),databaseURL:'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app'}),db=getDatabase(app);
 const dir='.anime-tieup-backup';fs.mkdirSync(dir,{recursive:true});
 try{
  const before={};
  // Read only the explicitly requested public catalog entries. No profile, account, room, or private-list access.
  for(const entry of patch.entries){const song=(await db.ref('songs/'+entry.id).get()).val();assert(song&&song.title===entry.title&&song.chordwiki===entry.chordwiki,'Preflight identity mismatch: '+entry.id);before[entry.id]=Object.fromEntries(ALLOWED.map(field=>[field,song[field]??null]));}
  fs.writeFileSync(dir+'/before.json',JSON.stringify(before),{mode:0o600});
  let updated=0;
  for(const entry of patch.entries){const result=await db.ref('songs/'+entry.id).transaction(song=>updateSong(song,entry),undefined,false);verifySong(result.snapshot.val(),entry);if(result.committed)updated++;}
  for(const entry of patch.entries)verifySong((await db.ref('songs/'+entry.id).get()).val(),entry);
  const report={operation:patch.operation,verified:patch.entries.length,updated,alreadyCorrect:patch.entries.length-updated,allowedFields:ALLOWED,appliedAt:Date.now()};
  const changes={['maintenanceOperations/'+patch.operation]:report};
  if(updated)changes['masterMeta/revision']=db.ref('masterMeta').push().key;
  await db.ref().update(changes);fs.writeFileSync(dir+'/verification.json',JSON.stringify(report,null,2),{mode:0o600});
  console.log('PASS '+JSON.stringify(report));
 }finally{await deleteApp(app);}
}
module.exports={labels,append,validatePatch,updateSong,verifySong};if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
