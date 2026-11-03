'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const OP='genre-revision-20261104',DIR='.genre-revision-backup',FIELDS=['artist','genre1','genre2','genre3','genre4','genre5','genre6'];
const policy=require('./genre-classification-policy.cjs');
const clean=v=>v==null?'':String(v);
function identity(song,e){return !!song&&typeof song==='object'&&!Array.isArray(song)&&clean(song.title)===e.title&&clean(song.chordwiki)===e.chordwiki;}
function value(song,f){return clean(f==='genre1'&&!Object.hasOwn(song,f)?song.genre:song[f]);}
function updateSong(song,e){
 if(song===null)return null; // A cold RTDB transaction retries against the existing server value.
 if(!identity(song,e)||Object.entries(e.baseline).some(([f,v])=>policy.value(song,f)!==v))return undefined;
 const next={...song};let changed=false;
 for(const[f,v]of Object.entries(e.changes)){
  if(value(song,f)!==v.before)continue;
  next[f]=v.after;changed=true;
  // Match the existing editor's canonical/legacy pair without replacing a separately changed value.
  if(f==='genre1'&&(!Object.hasOwn(song,'genre')||clean(song.genre)===v.before))next.genre=v.after;
 }
 return changed?next:undefined;
}
function verify(before,after,e){
 assert(identity(after,e),'Identity changed during migration: '+e.id);
 const written=[],conflicts=[];
 for(const[f,v]of Object.entries(e.changes)){
  if(value(before,f)===v.before){assert.equal(value(after,f),v.after);written.push(f);}else if(value(before,f)!==v.after){assert.equal(value(after,f),value(before,f));conflicts.push(f);}
 }
 for(const[f,v]of Object.entries(before)){
  if(Object.hasOwn(e.changes,f))continue;
  if(f==='genre'&&e.changes.genre1&&value(before,'genre1')===e.changes.genre1.before&&clean(v)===e.changes.genre1.before){assert.equal(after.genre,e.changes.genre1.after);continue;}
  assert.deepEqual(after[f],v,'Unrelated field changed: '+e.id+'/'+f);
 }
 return {written,conflicts};
}
async function retry(fn){for(let n=0;;n++){try{return await fn();}catch(e){if(n>=3||!/timeout|network|ECONNRESET|unavailable|disconnected|503|429/i.test(e.message))throw e;await new Promise(r=>setTimeout(r,1000*2**n));}}}
async function main(){
 const{initializeApp,cert,deleteApp}=require('firebase-admin/app'),{getDatabase}=require('firebase-admin/database');
 const app=initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),databaseURL:'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app'}),db=getDatabase(app);
 const songs=(await db.ref('songs').get()).val();assert(songs&&typeof songs==='object'&&!Array.isArray(songs));const sourceSongs=Object.keys(songs).length;assert(sourceSongs>=27345&&sourceSongs<100000);const entries=policy.plan(songs),p={entries,sourceSongs,songCount:entries.length,cellCount:entries.reduce((n,e)=>n+Object.keys(e.changes).length,0)};console.log('Planned '+JSON.stringify({sourceSongs,changedSongs:p.songCount,changedCells:p.cellCount}));
 fs.mkdirSync(DIR,{recursive:true});const backup=fs.openSync(DIR+'/before.jsonl','a',0o600),log=fs.openSync(DIR+'/results.jsonl','a',0o600),results=[];let cursor=0;
 try{
  async function worker(){while(cursor<p.entries.length){const e=p.entries[cursor++],ref=db.ref('songs/'+e.id),initial=(await retry(()=>ref.get())).val();
   if(!identity(initial,e)){const r={id:e.id,status:initial?'identity_conflict_preserved':'missing_id_not_created'};results.push(r);fs.writeSync(log,JSON.stringify(r)+'\n');continue;}
   fs.writeSync(backup,JSON.stringify({id:e.id,fields:Object.fromEntries([...Object.keys(e.changes),'genre'].map(f=>[f,initial[f]??null]))})+'\n');
   let prior;const tx=await retry(()=>ref.transaction(current=>{if(current!==null)prior=current;return updateSong(current,e);},undefined,false));
   const after=(await retry(()=>ref.get())).val();let v;if(!tx.committed&&Object.entries(e.baseline).some(([f,x])=>policy.value(prior||initial,f)!==x)){v={written:[],conflicts:Object.keys(e.changes).filter(f=>policy.value(after,f)!==e.changes[f].after)};}else v=verify(prior||initial,after,e);const r={id:e.id,status:'verified',committed:tx.committed,writtenFields:v.written,conflictFields:v.conflicts};results.push(r);fs.writeSync(log,JSON.stringify(r)+'\n');if(results.length%1000===0)console.log('Verified '+results.length+'/'+p.entries.length);
  }}
  const settled=await Promise.allSettled(Array.from({length:16},worker)),failures=settled.filter(x=>x.status==='rejected').map(x=>x.reason.message);
  const report={operation:OP,sourceSongs:p.sourceSongs,requestedSongs:p.songCount,requestedCells:p.cellCount,verifiedSongs:results.filter(r=>r.status==='verified').length,updatedSongs:results.filter(r=>r.committed).length,writtenCells:results.reduce((n,r)=>n+(r.writtenFields?.length||0),0),conflicts:results.filter(r=>r.conflictFields?.length||r.status!=='verified'),failures,appliedAt:Date.now()};
  if(report.updatedSongs)await db.ref('masterMeta/revision').set(db.ref('masterMeta').push().key);
  await db.ref('maintenanceOperations/'+OP).set(report);fs.writeFileSync(DIR+'/verification.json',JSON.stringify(report,null,2),{mode:0o600});console.log('RESULT '+JSON.stringify(report));
  if(failures.length||results.length!==p.songCount)throw Error('Migration incomplete; inspect catalog-only verification artifact.');
 }finally{fs.closeSync(backup);fs.closeSync(log);await deleteApp(app);}
}
module.exports={identity,value,updateSong,verify};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
