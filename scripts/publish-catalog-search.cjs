'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const base=require('./publish-sheet-metadata.cjs');
const OP='catalog-search-publication-20261104-v1',SHA='3675c6ac3a996d374373b07ccf87ef14acac7e30a37c7873bdf2a38d97cbb2ff';
const INPUT='maintenance/catalog-search-20261104.enc.json',DIR='.catalog-search-publication';
const fields=['genre5','tieup','search'];
function validate(p){assert.equal(p.operation,OP);assert.equal(p.songCount,26296);assert.equal(p.cellCount,26443);assert.equal(p.entries.length,p.songCount);const ids=new Set(),counts={};for(const e of p.entries){assert(/^[a-zA-Z0-9_-]{1,80}$/.test(e.id)&&!ids.has(e.id));ids.add(e.id);assert(typeof e.title==='string'&&e.title&&typeof e.chordwiki==='string');if(e.chordwiki){const u=new URL(e.chordwiki);assert(u.protocol==='https:'&&['ja.chordwiki.org','beta.chordwiki.org'].includes(u.hostname)&&!u.username&&!u.password&&!u.port);}assert(Object.keys(e.changes).length);for(const[f,c]of Object.entries(e.changes)){assert(fields.includes(f));assert(typeof c.before==='string'&&typeof c.after==='string'&&c.after.trim());assert(c.after.length<=(f==='search'?500:f==='genre5'?100:240));if(f==='search')assert.equal(c.before,'');counts[f]=(counts[f]||0)+1;}}assert.deepEqual(counts,{genre5:169,search:26273,tieup:1});return p;}
function decode(envelope,privateKey){assert.equal(envelope.operation,OP);assert.equal(envelope.sha256,SHA);assert.equal(envelope.algorithm,'RSA-OAEP-SHA256/AES-256-GCM/gzip');const key=crypto.privateDecrypt({key:privateKey,oaepHash:'sha256'},Buffer.from(envelope.key,'base64')),d=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));d.setAAD(Buffer.from(OP));d.setAuthTag(Buffer.from(envelope.tag,'base64'));const raw=zlib.gunzipSync(Buffer.concat([d.update(Buffer.from(envelope.data,'base64')),d.final()]));assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),SHA);return validate(JSON.parse(raw));}
async function retry(fn){for(let n=0;;n++){try{return await fn();}catch(e){if(n>=3||!/timeout|network|ECONNRESET|unavailable|disconnected|503|429/i.test(e.message))throw e;await new Promise(r=>setTimeout(r,1000*2**n));}}}
async function main(){
 const{initializeApp,cert,deleteApp}=require('firebase-admin/app'),{getDatabase}=require('firebase-admin/database'),account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT),p=decode(JSON.parse(fs.readFileSync(INPUT)),account.private_key),app=initializeApp({credential:cert(account),databaseURL:'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app'}),db=getDatabase(app);fs.mkdirSync(DIR,{recursive:true});
 try{
  const initial=(await retry(()=>db.ref('songs').get())).val()||{},backup=p.entries.map(e=>({id:e.id,song:initial[e.id]||null})),results=[];let cursor=0;
  fs.writeFileSync(DIR+'/before.enc.json',JSON.stringify(base.encryptAudit({operation:OP,backup})));
  const worker=async()=>{while(cursor<p.entries.length){const e=p.entries[cursor++];if(!base.identity(initial[e.id],e)){results.push({id:e.id,status:initial[e.id]?'identity_conflict':'missing'});continue;}let before;
   const tx=await retry(()=>db.ref('songs/'+e.id).transaction(s=>{if(s!==null)before=s;return base.updateSong(s,e,Date.now());},undefined,false)),after=tx.snapshot.val();
   if(!base.identity(after,e)){results.push({id:e.id,status:'concurrent_identity_change'});continue;}
   const checked=base.verify(before||initial[e.id],after,e);results.push({id:e.id,status:'verified',committed:tx.committed,...checked});
   if(results.length%1000===0)console.log('Verified '+results.length+'/'+p.entries.length);
  }};
  const settled=await Promise.allSettled(Array.from({length:48},worker)),failures=settled.filter(r=>r.status==='rejected').map(r=>r.reason.message),report={operation:OP,sourceSongs:p.songCount,sourceCells:p.cellCount,verifiedSongs:results.filter(r=>r.status==='verified').length,updatedSongs:results.filter(r=>r.committed).length,writtenCells:results.filter(r=>r.committed).reduce((n,r)=>n+r.written.length,0),conflictSongs:results.filter(r=>r.status!=='verified'||r.conflicts.length).length,failures,appliedAt:Date.now()};
  if(report.updatedSongs)await db.ref('masterMeta/revision').set(db.ref('masterMeta').push().key);
  await db.ref('maintenanceOperations/'+OP).set(report);fs.writeFileSync(DIR+'/verification.json',JSON.stringify(report));fs.writeFileSync(DIR+'/results.enc.json',JSON.stringify(base.encryptAudit({results})));console.log('PUBLICATION_RESULT '+JSON.stringify(report));
  if(failures.length||results.length!==p.entries.length)throw Error('Incomplete publication; consult encrypted audit');
  const core=require('../list-share-core.js'),master=(await db.ref('songs').get()).val(),shares=(await db.ref('publicListShares').get()).val()||{},changed=new Set(p.entries.map(e=>e.id));let refreshed=0;
  for(const token of Object.keys(shares)){if(!core.tokenOK(token))continue;const tx=await db.ref('publicListShares/'+token).transaction(s=>{if(s==null)return null;if(s.reserved||!s.songs)return;let dirty=false;for(const[id,row]of Object.entries(s.songs)){if(!changed.has(id)||!master[id])continue;const projected=core.song(master[id],{},{});if(!projected)continue;for(const[f,v]of Object.entries(projected))if(JSON.stringify(row[f])!==JSON.stringify(v)){row[f]=v;dirty=true;}}return dirty?s:undefined;},undefined,false);if(tx.committed)refreshed++;}
  console.log('PUBLIC_SHARES_REFRESHED '+refreshed);
 }finally{await deleteApp(app);}
}
module.exports={OP,SHA,INPUT,DIR,fields,validate,decode};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
