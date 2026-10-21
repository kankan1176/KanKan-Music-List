'use strict';
const ADMIN="auth != null && auth.token.firebase.sign_in_provider === 'google.com' && root.child('admins').child(auth.uid).val() === true";
const GOOGLE="auth != null && auth.token.firebase.sign_in_provider === 'google.com'";
const {limits}=require('../song-change-core.js');
function stripReads(node){if(!node||typeof node!=='object')return;for(const key of Object.keys(node)){if(key==='.read')node[key]=false;else if(!key.startsWith('.'))stripReads(node[key]);}}
function restrictWrites(node){if(!node||typeof node!=='object')return;for(const key of Object.keys(node)){if(key==='.write'&&node[key]!==false&&node[key]!=='false'){const old=node[key];if(typeof old!=='string'&&old!==true)throw Error('Unsupported master write rule');node[key]=old===true||old==='true'?ADMIN:old===ADMIN||old.endsWith(' && ('+ADMIN+')')?old:'('+old+') && ('+ADMIN+')';}else if(!key.startsWith('.'))restrictWrites(node[key]);}}
function addHighPriorityRules(document){
 const out=structuredClone(document),r=out.rules;
 // Keep the legacy snapshot for its owner's room publishing, never as another public API.
 const legacy=r.friendSharedLists ||= {};stripReads(legacy);legacy['.read']=false;
 const ownerKeys=Object.keys(legacy).filter(key=>key.startsWith('$'));
 if(ownerKeys.length>1)throw Error('Unexpected legacy share wildcard rules');
 const ownerKey=ownerKeys[0]||'$owner',owner=legacy[ownerKey] ||= {};owner['.read']='('+GOOGLE+') && auth.uid === '+ownerKey;
 // Preserve validation and existing admin grants; remove all ordinary-user write paths.
 for(const base of ['songs','masterMeta','songEditLogs']){const node=r[base] ||= {};restrictWrites(node);if(base==='songs'||base==='songEditLogs'){const keys=Object.keys(node).filter(key=>key.startsWith('$'));if(keys.length>1)throw Error('Unexpected song wildcard rules');const entry=node[keys[0]||(base==='songs'?'$songId':'$logId')] ||= {};if(!entry['.write']||entry['.write']==='false')entry['.write']=ADMIN;}else if(base==='masterMeta'&&!node['.write'])node['.write']=ADMIN;}
 const changeFields=Object.fromEntries(Object.entries(limits).map(([key,max])=>[key,{'.validate':"newData.hasChildren(['before','after'])",before:{'.validate':'newData.isString() && newData.val().length <= 10000'},after:{'.validate':'newData.isString() && newData.val().length <= '+max+(key==='title'?' && newData.val().length > 0':'')},'$other':{'.validate':false}}]));
 r.songChangeRequests={'.read':ADMIN,'.write':false,'$songId':{'$uid':{
  '.read':'('+GOOGLE+') && auth.uid === $uid',
  '.write':'('+ADMIN+") || (("+GOOGLE+") && auth.uid === $uid && root.child('songs').child($songId).exists() && newData.exists() && newData.child('status').val() === 'pending' && newData.child('createdAt').val() === now && !newData.hasChild('reviewedAt') && !newData.hasChild('reviewedBy') && !newData.hasChild('approvedSongId') && (!data.exists() || data.child('status').val() !== 'pending'))",
  '.validate':"$songId.matches(/^[A-Za-z0-9_-]{1,80}$/) && newData.hasChildren(['songId','requestedBy','title','artist','status','createdAt','changes'])",
  songId:{'.validate':'newData.val() === $songId'},requestedBy:{'.validate':'newData.val() === $uid'},title:{'.validate':'newData.isString() && newData.val().length > 0 && newData.val().length <= 240'},artist:{'.validate':'newData.isString() && newData.val().length <= 240'},
  status:{'.validate':"newData.val() === 'pending' || newData.val() === 'approved' || newData.val() === 'rejected'"},createdAt:{'.validate':'newData.isNumber() && newData.val() <= now'},changes:{'.validate':'newData.hasChildren() && newData.numChildren() <= 12',...changeFields,'$other':{'.validate':false}},reviewedAt:{'.validate':'newData.isNumber() && newData.val() === now'},reviewedBy:{'.validate':'newData.val() === auth.uid'},approvedSongId:{'.validate':'newData.val() === $songId'},'$other':{'.validate':false}
 }}};
 return out;
}
module.exports={addHighPriorityRules,ADMIN};
