'use strict';
const {randomUUID}=require('node:crypto');
const ROOT='adminControl';
class ControlError extends Error{constructor(code,message){super(message);this.code=code;}}
function createService({database,authentication,now=Date.now,uuid=randomUUID}){
 const read=async path=>(await database.ref(path).once('value')).val();
 const fail=(code,message)=>{throw new ControlError(code,message);};
 const uidOK=uid=>typeof uid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(uid);
 const command=(actor,extra={})=>({id:uuid(),issuedAt:now(),issuedBy:actor,...extra});
 async function admin(identity){
  if(!identity||identity.firebase?.sign_in_provider!=='google.com')fail('permission-denied','管理者のGoogleログインが必要です。');
  if(await read('admins/'+identity.uid)!==true)fail('permission-denied','管理者権限がありません。');
  return identity.uid;
 }
 async function enabled(){const config=await read(ROOT+'/config');if(config?.enabled!==true||config.securityRulesVersion!==1)fail('failed-precondition','Firebase側の初期設定が完了していません。');}
 async function targets(){
  const [profiles,rooms,clients,commands]=await Promise.all(['publicProfiles','rooms',ROOT+'/clients',ROOT+'/userCommands'].map(read));
  const map=new Map();
  for(const [uid,p] of Object.entries(profiles||{}))if(uidOK(uid))map.set(uid,{uid,kind:'account',name:String(p?.displayName||'未設定')});
  for(const room of Object.values(rooms||{}))for(const member of Object.values(room?.members||{})){
   if(member?.guest===true&&uidOK(member.uid)&&!map.has(member.uid))map.set(member.uid,{uid:member.uid,kind:'guest',name:String(member.name||'ゲスト')});
  }
  for(const [uid,client] of Object.entries(clients||{})){
   if(!uidOK(uid))continue;
   const devices=Object.values(client.devices||{});const latest=devices.sort((a,b)=>(b.lastSeen||0)-(a.lastSeen||0))[0];
   if(!map.has(uid)&&client.kind==='guest')map.set(uid,{uid,kind:'guest',name:String(latest?.name||'ゲスト')});
   const item=map.get(uid);if(item){item.lastSeen=Number(latest?.lastSeen)||null;item.devices=devices.map(d=>({lastSeen:d.lastSeen||null,cacheIds:d.cacheIds||[],guestNameId:d.guestNameId||null}));}
  }
  for(const item of map.values()){const c=commands?.[item.uid];if(item.kind==='guest'&&c?.guestName)item.requestedName=c.guestName.name;item.pendingCacheId=c?.cache?.id||null;item.pendingNameId=c?.guestName?.id||null;}
  return [...map.values()].sort((a,b)=>a.kind.localeCompare(b.kind)||a.name.localeCompare(b.name,'ja'));
 }
 async function poll(data,identity){
  const config=await read(ROOT+'/config');if(config?.enabled!==true||config.securityRulesVersion!==1)return {enabled:false};
  const globalCache=await read(ROOT+'/globalCache');
  if(!identity)return {enabled:true,cacheCommands:globalCache?[{id:globalCache.id,issuedAt:globalCache.issuedAt}]:[]};
  const uid=identity.uid,user=await read(ROOT+'/userCommands/'+uid)||{};
  const cacheCommands=[globalCache,user.cache].filter(Boolean);
  const guest=identity.firebase?.sign_in_provider==='anonymous';
  const guestName=guest?user.guestName||null:null;
  if(typeof data.deviceId==='string'&&/^[A-Za-z0-9_-]{8,80}$/.test(data.deviceId)){
   const allowed=new Set(cacheCommands.map(c=>c.id));
   const cacheIds=Array.isArray(data.applied?.cacheIds)?data.applied.cacheIds.filter(id=>allowed.has(id)).slice(0,2):[];
   const record={lastSeen:now(),name:String(data.name||'').slice(0,40),cacheIds,guestNameId:guestName&&data.applied?.guestNameId===guestName.id?guestName.id:null};
   await database.ref(ROOT+'/clients/'+uid).update({kind:guest?'guest':'account',['devices/'+data.deviceId]:record});
  }
  return {enabled:true,cacheCommands:cacheCommands.map(c=>({id:c.id,issuedAt:c.issuedAt})),guestName:guestName?{id:guestName.id,name:guestName.name,issuedAt:guestName.issuedAt}:null};
 }
 async function handle(data,identity){
  if(!data||typeof data!=='object')fail('invalid-argument','操作内容を指定してください。');
  if(data.action==='poll')return poll(data,identity);
  const actor=await admin(identity);
  if(data.action==='list'){const config=await read(ROOT+'/config');return {enabled:config?.enabled===true&&config.securityRulesVersion===1,targets:await targets(),globalCache:await read(ROOT+'/globalCache')};}
  await enabled();
  if(data.action==='clearCache'){
   if(data.scope==='all'){const c=command(actor);await database.ref(ROOT+'/globalCache').set(c);return {command:c};}
   if(!uidOK(data.uid))fail('invalid-argument','対象ユーザーIDが不正です。');
   await authentication.getUser(data.uid);
   const c=command(actor);await database.ref(ROOT+'/userCommands/'+data.uid+'/cache').set(c);return {command:c};
  }
  if(!uidOK(data.uid))fail('invalid-argument','対象ユーザーIDが不正です。');
  const target=await authentication.getUser(data.uid);
  if(data.action==='forceLogout'){
   if(data.uid===actor)fail('failed-precondition','操作中の管理者自身は強制ログアウトできません。');
   if(!target.providerData?.some(p=>p.providerId==='google.com'))fail('failed-precondition','Googleログインアカウントを選択してください。');
   await authentication.revokeRefreshTokens(data.uid);
   const refreshed=await authentication.getUser(data.uid);
   const seconds=Math.floor(Date.parse(refreshed.tokensValidAfterTime)/1000);
   if(!Number.isFinite(seconds))fail('internal','認証失効時刻を取得できませんでした。');
   const c=command(actor,{revokedAfter:seconds});
   await database.ref().update({[ROOT+'/revocations/'+data.uid]:seconds,[ROOT+'/userCommands/'+data.uid+'/logout']:c});
   return {command:c};
  }
  if(data.action==='renameGuest'){
   if(target.providerData?.length||target.email||target.phoneNumber)fail('failed-precondition','ゲスト以外の名前は変更できません。');
   const name=typeof data.name==='string'?data.name.trim():'';
   if(!name||name.length>40||/[\x00-\x1f\x7f]/.test(name))fail('invalid-argument','名前は1〜40文字で入力してください。');
   const rooms=await read('rooms')||{};const changes={};const c=command(actor,{name});
   changes[ROOT+'/userCommands/'+data.uid+'/guestName']=c;
   for(const [roomId,room]of Object.entries(rooms))for(const [session,m]of Object.entries(room?.members||{}))if(m?.uid===data.uid&&m.guest===true)changes[`rooms/${roomId}/members/${session}/name`]=name;
   await database.ref().update(changes);return {command:c};
  }
  fail('invalid-argument','未対応の操作です。');
 }
 return {handle};
}
module.exports={createService,ControlError};
