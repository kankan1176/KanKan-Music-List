/* One atomic write for song changes, append-only history and index revision. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./song-change-core.js'));else root.SLSongEditService=factory(root.SLSongChange);})(typeof globalThis!=='undefined'?globalThis:this,core=>{
 'use strict';
 const labels={title:'曲名',artist:'アーティスト',chordwiki:'ChordWiki URL',bpm:'BPM',genre:'基本ジャンル（互換）',genre1:'基本ジャンル',genre2:'楽曲の分類',genre3:'ジャンル③',genre4:'所属グループ',genre5:'掲載媒体・関連作品',genre6:'音楽ジャンル',vocal_synths:'ボカロ別',release_year:'発売・公開年',anime_year:'アニメ放送・公開年',tieup:'タイアップ作品',search:'検索ワード',lyrics:'作詞',composition:'作曲',arrangement:'編曲'};
 const text=value=>String(value??'').trim();
 function inverse(song,log){
  if(!log?.changes||!Object.keys(log.changes).length)throw Error('変更内容のない履歴は元に戻せません。');
  const changes={};for(const [key,v]of Object.entries(log.changes)){
   if(!core.fields.includes(key)||typeof v.before!=='string'||typeof v.after!=='string')throw Error('履歴の形式を確認できません。');
   if(text(key==='genre1'&&!Object.hasOwn(song,key)?song.genre:song[key])!==v.after)throw Error('この履歴の後に対象項目が変更されています。現在の内容を確認して再編集してください。');
   if(v.before!==v.after)changes[key]={before:v.after,after:v.before};
  }return changes;
 }
 function prepare({songId,before,changes,actor,editor=actor,action='edit',sourceLogId='',logId,revision,timestamp}){
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(songId)||!actor?.uid||!logId||!revision)throw Error('編集対象またはログイン情報が不正です。');
  if(!['edit','approve','undo'].includes(action))throw Error('編集操作が不正です。');
  const applied=core.apply(before,{changes}),actual={};
  for(const key of core.fields)if(Object.hasOwn(applied.song,key)&&text(before[key])!==text(applied.song[key]))actual[key]={before:String((key==='genre1'&&!Object.hasOwn(before,key)?before.genre:before[key])??''),after:text(applied.song[key])};
  if(!Object.keys(actual).length)throw Error('変更箇所がありません。');
  const version=Number(before._editRevision||0)+1;if(!Number.isSafeInteger(version)||version<1)throw Error('編集バージョンが不正です。');
  const log={songId,songTitleBefore:text(before.title),songTitleAfter:text(applied.song.title),editorUid:editor?.uid||actor.uid,editorName:String(editor?.displayName||editor?.name||editor?.uid||actor.uid).slice(0,80),actorUid:actor.uid,actorName:String(actor.displayName||actor.uid).slice(0,80),action,editedAt:timestamp,revision:version,changes:actual};
  if(sourceLogId)log.sourceLogId=sourceLogId;
  const updates={};for(const[key,v]of Object.entries(actual))updates['songs/'+songId+'/'+key]=v.after;
  updates['songs/'+songId+'/_editRevision']=version;updates['songs/'+songId+'/_lastEditId']=logId;updates['songs/'+songId+'/updatedAt']=timestamp;
  updates['songEditLogs/'+logId]=log;updates['masterMeta/revision']=logId;
  return{updates,log};
 }
 async function save({database,songId,changes,actor,isAuthorized,log,action='edit'}){
  if(!isAuthorized())throw Error('Googleログイン状態を確認してください。');
  const before=(await database.ref('songs/'+songId).once('value')).val();
  if(!before)throw Error('編集対象の楽曲がありません。');
  const result=prepare({songId,before,changes:log?inverse(before,log):changes,actor,action,sourceLogId:log?.id||'',logId:database.ref('songEditLogs').push().key,revision:database.ref().push().key,timestamp:{'.sv':'timestamp'}});
  if(!isAuthorized())throw Error('Googleログイン状態が変わりました。');
  await database.ref().update(result.updates);return result;
 }
 return{labels,inverse,prepare,save};
});
