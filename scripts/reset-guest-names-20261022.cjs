'use strict';
const {transact}=require('../queue-actions.js');
const operation='guest-name-reset-20261022-v1';
function guestIds(rooms,clients){const out=new Set();for(const [id,c]of Object.entries(clients||{}))if(c?.kind==='guest')out.add(id);for(const r of Object.values(rooms||{}))for(const m of Object.values(r?.members||{}))if(m?.guest===true&&typeof m.uid==='string')out.add(m.uid);return [...out].filter(id=>/^[A-Za-z0-9_-]{1,128}$/.test(id));}
function resetMembers(current,allowed){if(!current||typeof current!=='object')return;let changed=false;const next={...current};for(const [session,m]of Object.entries(current))if(m?.guest===true&&allowed.has(m.uid)&&m.name!==m.uid.slice(0,5)){next[session]={...m,name:m.uid.slice(0,5)};changed=true;}return changed?next:undefined;}
async function run(database,auth,timestamp){
 const marker=database.ref('maintenanceOperations/'+operation),previous=(await marker.once('value')).val();if(previous){if(previous.status==='completed')return previous;throw Error('Previous reset is incomplete; inspect before retrying.');}
 const [rooms,clients,profiles]=await Promise.all(['rooms','adminClientControl/clients','publicProfiles'].map(async p=>(await database.ref(p).once('value')).val()||{}));
 const ids=guestIds(rooms,clients),accounts=new Set([...Object.keys(profiles),...Object.entries(clients).filter(([,c])=>c?.kind==='account').map(([id])=>id)]);
 // Verify actual authentication providers before issuing any writes. Do not log user records.
 for(let i=0;i<ids.length;i+=100){const records=await auth.getUsers(ids.slice(i,i+100).map(uid=>({uid})));for(const u of records.users)if(u.providerData?.length)accounts.add(u.uid);}
 const targets=ids.filter(id=>!accounts.has(id)),allowed=new Set(targets);
 const claim=await transact(marker,value=>value?undefined:{status:'running',startedAt:timestamp});if(!claim.committed)throw Error('A reset is already running.');
 const updates={};for(const uid of targets)updates['adminClientControl/userCommands/'+uid+'/guestName']={id:operation,name:uid.slice(0,5),issuedAt:timestamp};
 if(targets.length)await database.ref().update(updates);
 let roomEntries=0;
 for(const [room,value]of Object.entries(rooms)){if(!/^[A-Za-z0-9]{4,32}$/.test(room)||!Object.values(value?.members||{}).some(m=>m?.guest===true&&allowed.has(m.uid)))continue;const result=await transact(database.ref('rooms/'+room+'/members'),current=>resetMembers(current,allowed));const members=result.snapshot.val()||{};roomEntries+=Object.values(members).filter(m=>m?.guest===true&&allowed.has(m.uid)).length;}
 const summary={status:'completed',completedAt:timestamp,guestUsers:targets.length,guestRoomEntries:roomEntries,googleOrAccountExcluded:ids.length-targets.length};await marker.set(summary);return summary;
}
async function main(){
 if(process.argv[2]!=='--apply'||process.env.GITHUB_REPOSITORY!=='kankan1176/KanKan-Music-List')throw Error('This one-time operation requires the approved repository workflow.');
 const req=require('node:module').createRequire(require('node:path').join(__dirname,'../functions/package.json')),{initializeApp,applicationDefault,deleteApp}=req('firebase-admin/app'),{getDatabase,ServerValue}=req('firebase-admin/database'),{getAuth}=req('firebase-admin/auth');
 const app=initializeApp({credential:applicationDefault(),projectId:'kankan-session-room',databaseURL:'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app'});
 try{console.log('Guest reset result:',JSON.stringify(await run(getDatabase(app),getAuth(app),ServerValue.TIMESTAMP)));}finally{await deleteApp(app);}
}
module.exports={guestIds,resetMembers,run};if(require.main===module)main().catch(()=>{console.error('Guest reset failed. No names or credentials are printed. Inspect the operation status before retrying.');process.exitCode=1;});
