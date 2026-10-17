'use strict';
// Never print rules, private data or credential contents. Only synthetic operation outcomes.
const path=require('node:path');
const req=require('node:module').createRequire(path.join(__dirname,'../functions/package.json'));
const testReq=require('node:module').createRequire(path.join(__dirname,'../tests/free-controls/package.json'));
const {initializeApp,applicationDefault,deleteApp}=req('firebase-admin/app');
const {getDatabase}=req('firebase-admin/database');
const {initializeTestEnvironment}=testReq('@firebase/rules-unit-testing');
const {ref,set,runTransaction,onValue}=testReq('firebase/database');
(async()=>{
 const app=initializeApp({credential:applicationDefault(),projectId:'kankan-session-room',databaseURL:'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app'});
 let env;
 try{
  const emulatorHost=process.env.FIREBASE_DATABASE_EMULATOR_HOST;delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  let rules;try{rules=await getDatabase().getRulesJSON();}finally{if(emulatorHost)process.env.FIREBASE_DATABASE_EMULATOR_HOST=emulatorHost;}
  env=await initializeTestEnvironment({projectId:'demo-queue-audit',database:{host:'127.0.0.1',port:9000,rules:JSON.stringify(rules)}});
  const record=status=>({songId:'audit_song',status,addedBy:'Synthetic test',order:1000,keyOffset:0});
  await env.withSecurityRulesDisabled(async c=>{await set(ref(c.database(),'admins/audit_admin'),true);await set(ref(c.database(),'rooms/AUDIT'),{settings:{createdByUid:'audit_google',source:'master',createdAt:1000},members:{one:{uid:'audit_google',guest:false,name:'Synthetic google'},two:{uid:'audit_guest',guest:true,name:'Synthetic guest'}}});});
  for(const [uid,provider]of [['audit_google','google.com'],['audit_guest','anonymous'],['audit_admin','google.com']]){
   const database=env.authenticatedContext(uid,{firebase:{sign_in_provider:provider}}).database();
   for(const [label,status,action]of [['confirmed-back','confirmed','reserved'],['completed-back','completed','confirmed'],['reserved-delete','reserved',null],['confirmed-delete','confirmed',null],['reserved-forward','reserved','confirmed']]){
    await env.withSecurityRulesDisabled(c=>set(ref(c.database(),'rooms/AUDIT/queue/q_audit'),record(status)));
    let stop;try{await new Promise((resolve,reject)=>{stop=onValue(ref(database,'rooms/AUDIT/queue/q_audit'),()=>resolve(),reject)});const outcome=await runTransaction(ref(database,'rooms/AUDIT/queue/q_audit'),current=>!current?undefined:action===null?null:{...current,status:action,order:2000},{applyLocally:false});console.log('QUEUE_RESULT '+uid.replace('audit_','')+' '+label+' '+(outcome.committed?'allowed':'aborted'));}catch(error){console.log('QUEUE_RESULT '+uid.replace('audit_','')+' '+label+' denied '+String(error.code||'error'));}finally{if(stop)stop();}
   }
  }
 }finally{if(env)await env.cleanup();await deleteApp(app)}
})().catch(()=>{console.error('Queue policy verification failed; policy contents are not logged.');process.exitCode=1});
