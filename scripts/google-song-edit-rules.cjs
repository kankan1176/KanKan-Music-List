'use strict';
const {ADMIN}=require('./high-priority-rules.cjs');
const GOOGLE="auth != null && auth.token.firebase.sign_in_provider === 'google.com'";
const grant=(a,b)=>a===b?a:`(${a||false}) || (${b})`;
function addGoogleSongEditRules(document){
 const r=document.rules,songKey=Object.keys(r.songs).find(k=>k.startsWith('$')&&k!=='$other'),song=r.songs[songKey];
 const logKey=Object.keys(r.songEditLogs).find(k=>k.startsWith('$')&&k!=='$other'),entry=r.songEditLogs[logKey];
 const newSong='newData.parent()',newRoot='newData.parent().parent().parent()',log=`${newRoot}.child('songEditLogs').child(${newSong}.child('_lastEditId').val())`;
 const allowed=`(${GOOGLE}) && data.parent().exists() && newData.exists() && ${log}.child('actorUid').val() === auth.uid && ${log}.child('editedAt').val() === now`;
 for(const field of require('../song-change-core.js').fields){
  const n=song[field] ||= {};
  n['.write']=grant(ADMIN,`${allowed} && newData.val() === ${log}.child('changes/${field}/after').val()`);
 }
 for(const field of ['_editRevision','_lastEditId','updatedAt']){const n=song[field] ||= {};n['.write']=grant(ADMIN,allowed+(field==='updatedAt'?' && newData.val() === now':''));}
 const self=`(${GOOGLE}) && newData.child('actorUid').val() === auth.uid && newData.child('editorUid').val() === auth.uid && newData.child('action').val() === 'edit' && !newData.hasChild('sourceLogId')`;
 entry['.write']=`((${ADMIN}) || (${self})) && !data.exists() && newData.exists()`;
 entry['.validate'] += ` && newData.parent().parent().child('masterMeta/revision').val() === ${logKey}`;
 // History must describe exactly the public values before and after this write.
 const oldSong="root.child('songs').child(newData.parent().parent().child('songId').val())";
 const afterSong="newData.parent().parent().parent().parent().child('songs').child(newData.parent().parent().child('songId').val())";
 for(const[field,node]of Object.entries(entry.changes))if(!field.startsWith('.')){
  if(field.startsWith('$'))continue;
  const old=`${oldSong}.child('${field}')`,before=field==='genre1'?`(${old}.exists() ? ${old}.val() + '' : (${oldSong}.child('genre').exists() ? ${oldSong}.child('genre').val() + '' : ''))`:`(${old}.exists() ? ${old}.val() + '' : '')`;
  let binding=`newData.child('before').val() === ${before} && newData.child('after').val() === ${afterSong}.child('${field}').val()`;
  if(field==='title'){
   const stripped=[9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279].reduce((v,code)=>v+'.replace('+JSON.stringify(String.fromCharCode(code)).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+",'')","newData.child('after').val()");
   binding += ' && '+stripped+'.length > 0';
  }
  if(field==='chordwiki')binding += " && (newData.child('after').val() === '' || newData.child('after').val().matches(/^https:\\/\\/(ja|beta)\\.chordwiki\\.org\\/(wiki\\/.+|wiki\\.cgi\\?.+)$/))";
  if(!String(node['.validate']).includes(binding))node['.validate']='('+node['.validate']+') && ('+binding+')';
 }
 const meta=r.masterMeta ||= {},revision=meta.revision ||= {},revRoot='newData.parent().parent()',revLog=`${revRoot}.child('songEditLogs').child(newData.val())`;
 revision['.write']=grant(ADMIN,`(${GOOGLE}) && newData.isString() && newData.val().matches(/^[A-Za-z0-9_-]{1,80}$/) && !root.child('songEditLogs').child(newData.val()).exists() && ${revLog}.child('actorUid').val() === auth.uid && ${revLog}.child('editedAt').val() === now`);
 return document;
}
module.exports={addGoogleSongEditRules};
