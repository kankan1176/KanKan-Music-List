'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getDatabase}=require('firebase-admin/database');
const {createService,ControlError}=require('./account-control-service.cjs');
initializeApp({databaseURL:'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app'});
const authentication=getAuth();
const database=getDatabase();
const service=createService({database,authentication});
exports.accountControl=onCall({region:'asia-northeast1',maxInstances:3,cors:['https://kankan1176.com','https://kankan1176.github.io',/^http:\/\/localhost(?::\d+)?$/]},async request=>{
 const header=request.rawRequest.get('authorization')||'';
 const bearer=header.match(/^Bearer (.+)$/i);let identity=null;
 if(bearer){
  try{identity=await authentication.verifyIdToken(bearer[1],true);}
  catch(error){
   const revoked=['auth/id-token-revoked','auth/user-disabled','auth/user-not-found'].includes(error.code);
   throw new HttpsError('unauthenticated','ログイン状態を確認してください。',{reason:revoked?'SESSION_REVOKED':'TOKEN_INVALID'});
  }
 }else if(request.data?.action!=='poll')throw new HttpsError('unauthenticated','ログインしてください。');
 try{
  if(identity){const revoked=(await database.ref('adminControl/revocations/'+identity.uid).once('value')).val();if(typeof revoked==='number'&&identity.auth_time<=revoked)throw new HttpsError('unauthenticated','管理者によりログアウトされました。',{reason:'SESSION_REVOKED'});}
  return await service.handle(request.data,identity);
 }
 catch(error){if(error instanceof HttpsError)throw error;if(error instanceof ControlError)throw new HttpsError(error.code,error.message);if(error.code==='auth/user-not-found')throw new HttpsError('not-found','ユーザーが見つかりません。');console.error('account-control operation failed',{code:error.code||'internal'});throw new HttpsError('internal','操作を完了できませんでした。再試行してください。');}
});
