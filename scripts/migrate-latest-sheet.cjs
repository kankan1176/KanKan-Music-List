'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib');
const EXPECTED='78f6a50dae9c515f3fbfdd1074f3182512627d987979013709537507abcca32c',OP='sheet-master-20261024-v1',CAPTURED=Date.parse('2026-10-23T16:27:38.420Z');
const columns='id,title,artist,chordwiki,bpm,genre1,genre2,genre3,genre4,genre5,genre6,vocal_synths,release_year,anime_year,tieup,search,lyrics,composition,arrangement'.split(',');
function validate(payload){
 if(JSON.stringify(payload.columns)!==JSON.stringify(columns)||Object.keys(payload.songs||{}).length!==27346)throw Error('Unexpected 19-column source');
 for(const[id,song]of Object.entries(payload.songs)){
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(id)||song.id!==id||Object.keys(song).length!==19||columns.some(f=>typeof song[f]!=='string'||song[f].length>2048)||!song.title)throw Error('Invalid master row');
  for(const f of ['release_year','anime_year'])if(song[f]&&!/^\d{4}(?:、\d{4})*$/.test(song[f]))throw Error('Invalid source year');
 }
 return payload.songs;
}
function decode(envelope,privateKey){
 if(envelope.algorithm!=='RSA-OAEP-SHA256/AES-256-GCM/gzip'||envelope.sha256!==EXPECTED)throw Error('Unexpected encrypted source');
 const key=crypto.privateDecrypt({key:privateKey,oaepHash:'sha256',padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(envelope.key,'base64')),decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
 const raw=zlib.gunzipSync(Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]));if(crypto.createHash('sha256').update(raw).digest('hex')!==EXPECTED)throw Error('Source checksum mismatch');return validate(JSON.parse(raw));
}
function plan(source,live){
 const updates={},backup={},counts={matched:0,sourceOnly:0,liveOnly:0,changed:0,recentSkipped:0,fields:{}};
 for(const[id,song]of Object.entries(source)){
  const previous=live[id];if(!previous){counts.sourceOnly++;continue;}counts.matched++;
  if(Number(previous.updatedAt)>CAPTURED){counts.recentSkipped++;continue;}
  let changed=false;for(const f of [...columns.slice(1),'genre']){
   let next=f==='genre'?song.genre1:song[f];
   // Preserve numeric BPM representation when its value did not change.
   if(f==='bpm'&&typeof previous[f]==='number'&&String(previous[f])===next)continue;
   if(previous[f]===next)continue;changed=true;const path='songs/'+id+'/'+f;updates[path]=next;backup[path]=previous[f]??null;counts.fields[f]=(counts.fields[f]||0)+1;
  }if(changed)counts.changed++;
 }
 counts.liveOnly=Object.keys(live).filter(id=>!source[id]).length;
 if(counts.sourceOnly||counts.matched!==27346)throw Error('Production/source IDs differ; no master writes');
 if(Buffer.byteLength(JSON.stringify(updates))>14*1024*1024)throw Error('Changes exceed atomic budget');return{updates,backup,counts};
}
function refreshShare(current,master){
 // null must reach the server CAS, so a cold transaction can retry with real data.
 if(current==null)return null;
 if(current.reserved||!current.songs)return;
 const core=require('../list-share-core.js');
 for(const[id,row]of Object.entries(current.songs)){if(!master[id])continue;const next=core.song(master[id],{},{});if(!next)continue;for(const[key,value]of Object.entries(next))row[key]=value;if(!next.url)delete row.url;}
 return current;
}
async function main(){
 const {initializeApp,cert,deleteApp}=require('firebase-admin/app'),{getDatabase}=require('firebase-admin/database'),{addGenreRules}=require('./genre-rules.cjs'),core=require('../list-share-core.js');
 const credential=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT),source=decode(JSON.parse(fs.readFileSync('maintenance/master-sheet-20261024.enc.json','utf8')),credential.private_key),app=initializeApp({credential:cert(credential),databaseURL:'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app'}),db=getDatabase(app);
 fs.mkdirSync('.sheet-migration',{recursive:true});
 try{
  const marker=db.ref('maintenanceOperations/'+OP);
  if((await marker.get()).val()?.sha256!==EXPECTED){
   const revision=(await db.ref('masterMeta/revision').get()).val(),live=(await db.ref('songs').get()).val(),p=plan(source,live);
   const rules=await db.getRulesJSON(),nextRules=addGenreRules(rules);fs.writeFileSync('.sheet-migration/rules-before.json',JSON.stringify(rules),{mode:0o600});fs.writeFileSync('.sheet-migration/backup.json',JSON.stringify({revision,updates:p.backup}),{mode:0o600});
   if(JSON.stringify(nextRules)!==JSON.stringify(rules))await db.setRules(nextRules);
   if((await db.ref('masterMeta/revision').get()).val()!==revision)throw Error('Master changed during audit; no master writes');
   await db.ref().update({...p.updates,'masterMeta/revision':db.ref('masterMeta').push().key,['maintenanceOperations/'+OP]:{sha256:EXPECTED,counts:p.counts,appliedAt:Date.now()}});
   const saved=(await db.ref('songs').get()).val();for(const[path,value]of Object.entries(p.updates)){const[,id,f]=path.split('/');if(saved[id]?.[f]!==value)throw Error('Master readback mismatch');}
   for(const[id,previous]of Object.entries(live))for(const f of Object.keys(previous))if(!Object.hasOwn(p.updates,'songs/'+id+'/'+f)&&JSON.stringify(saved[id]?.[f])!==JSON.stringify(previous[f]))throw Error('Preserved field changed');
   console.log('PASS latest 19-column source applied: '+JSON.stringify(p.counts));
  }
  const master=(await db.ref('songs').get()).val(),shares=(await db.ref('publicListShares').get()).val()||{};let refreshed=0;
  for(const token of Object.keys(shares)){const ref=db.ref('publicListShares/'+token),result=await ref.transaction(current=>refreshShare(current,master),undefined,false);if(result.committed)refreshed+=Object.keys(result.snapshot.val()?.songs||{}).filter(id=>master[id]).length;}
  console.log('PASS public song metadata refreshed; private lists and rooms untouched. Public rows='+refreshed);
 }finally{await deleteApp(app);}
}
module.exports={columns,validate,decode,plan,refreshShare,EXPECTED,OP,CAPTURED};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
