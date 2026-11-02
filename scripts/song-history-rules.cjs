'use strict';
const {ADMIN}=require('./high-priority-rules.cjs');
function addSongHistoryRules(document){
 const out=structuredClone(document),r=out.rules;
 const google="auth != null && auth.token.firebase.sign_in_provider === 'google.com'";
 function googleOnly(node){if(!node||typeof node!=='object')return;for(const[k,v]of Object.entries(node)){if(k==='.write'&&v!==false&&v!=='false'){if(typeof v!=='string'&&v!==true)throw Error('Unexpected legacy edit request grant');const suffix=' && ('+google+')';if(!String(v).endsWith(suffix))node[k]='('+v+')'+suffix;}else if(!k.startsWith('.'))googleOnly(v);}}
 googleOnly(r.songEditRequests);
 function wildcard(node,fallback){const keys=Object.keys(node).filter(k=>k.startsWith('$')&&k!=='$other');if(keys.length>1)throw Error('Unexpected history wildcard');return keys[0]||fallback;}
 const songs=r.songs ||= {},songKey=wildcard(songs,'$songId'),song=songs[songKey] ||= {};
 const nextRoot='newData.parent().parent()',version="data.child('_editRevision')",nextVersion="newData.child('_editRevision')",log=nextRoot+".child('songEditLogs').child(newData.child('_lastEditId').val())";
 const guard=`!data.exists() || (${nextVersion}.isNumber() && ${nextVersion}.val() === (${version}.exists() ? ${version}.val() + 1 : 1) && newData.child('_lastEditId').isString() && ${log}.child('songId').val() === ${songKey} && ${log}.child('revision').val() === ${nextVersion}.val() && ${log}.child('actorUid').val() === auth.uid && ${log}.child('editedAt').val() === now)`;
 const marker="newData.child('_lastEditId').isString()";
 if(!String(song['.validate']).includes(marker))song['.validate']='('+ (song['.validate']??true) +') && ('+guard+')';
 song._editRevision={'.validate':'newData.isNumber() && newData.val() >= 1 && newData.val() % 1 === 0'};
 song._lastEditId={'.validate':'newData.isString() && newData.val().matches(/^[A-Za-z0-9_-]{1,80}$/)'};
 // Existing logs remain readable, but clients can only append new audited entries.
 const logs=r.songEditLogs ||= {},logKey=wildcard(logs,'$logId'),entry=logs[logKey] ||= {};
 function stripWrites(n){for(const[k,v]of Object.entries(n))if(k==='.write')n[k]=false;else if(v&&typeof v==='object')stripWrites(v);}
 stripWrites(logs);logs['.read']=ADMIN;logs['.indexOn']=['editedAt'];entry['.write']='('+ADMIN+') && !data.exists() && newData.exists()';
 const songAfter="newData.parent().parent().child('songs').child(newData.child('songId').val())";
 entry['.validate']="newData.hasChildren(['songId','songTitleBefore','songTitleAfter','editorUid','editorName','actorUid','actorName','action','editedAt','revision','changes']) && newData.child('songId').isString() && newData.child('songId').val().matches(/^[A-Za-z0-9_-]{1,80}$/) && newData.child('actorUid').val() === auth.uid && newData.child('editorUid').isString() && newData.child('editorName').isString() && newData.child('editorName').val().length <= 80 && newData.child('actorName').isString() && newData.child('actorName').val().length <= 80 && newData.child('editedAt').val() === now && newData.child('changes').hasChildren() && (newData.child('action').val() === 'edit' || newData.child('action').val() === 'approve' || newData.child('action').val() === 'undo') && "+songAfter+".child('_lastEditId').val() === "+logKey+" && "+songAfter+".child('_editRevision').val() === newData.child('revision').val()";
 for(const key of ['songId','songTitleBefore','songTitleAfter','editorUid','editorName','actorUid','actorName','action','sourceLogId'])entry[key]={'.validate':'newData.isString() && newData.val().length <= '+(['songTitleBefore','songTitleAfter'].includes(key)?240:128)};
 entry.editedAt={'.validate':'newData.isNumber() && newData.val() === now'};entry.revision={'.validate':'newData.isNumber() && newData.val() >= 1 && newData.val() % 1 === 0'};
 entry.changes={'.validate':'newData.hasChildren()',...Object.fromEntries(Object.entries(require('../song-change-core.js').limits).map(([key,max])=>[key,{'.validate':"newData.hasChildren(['before','after'])",before:{'.validate':'newData.isString() && newData.val().length <= 10000'},after:{'.validate':'newData.isString() && newData.val().length <= '+max},'$other':{'.validate':false}}])),'$other':{'.validate':false}};
 return out;
}
module.exports={addSongHistoryRules};
