/* Reviewed master edits: preserve unchanged fields and reject stale proposals. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SLSongChange=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const limits={title:240,artist:240,chordwiki:2048,bpm:30,genre:100,genre1:100,genre2:100,genre3:100,genre4:100,genre5:100,genre6:100,vocal_synths:100,release_year:100,anime_year:100,tieup:240,search:500,lyrics:240,composition:240,arrangement:240};
 const fields=Object.keys(limits),clean=value=>String(value??'').trim();
 function changes(before,after){const out={};for(const key of fields){const value=clean(after[key]),old=clean(before[key]);if(value.length>limits[key]||old.length>10000)throw Error('入力文字数の上限を超えています。');if(key==='title'&&!value)throw Error('曲名は空にできません。');if(value!==old)out[key]={before:old,after:value};}return out;}
 function apply(song,request){
  if(!song||!request?.changes||typeof request.changes!=='object')throw Error('編集申請の形式が不正です。');
  const keys=Object.keys(request.changes);if(!keys.length||keys.length>fields.length)throw Error('変更項目がありません。');
  const next={...song},log={};
  for(const key of keys){const value=request.changes[key];if(!fields.includes(key)||!value||typeof value.before!=='string'||typeof value.after!=='string'||value.after.length>limits[key]||value.before.length>10000||key==='title'&&!value.after.trim())throw Error('編集申請の形式が不正です。');if(clean(key==='genre1'&&!Object.hasOwn(song,key)?song.genre:song[key])!==value.before)throw Error('申請後に楽曲が変更されています。最新の内容を確認し、申請し直してください。');next[key]=value.after;log[key]={before:value.before,after:value.after};}
  if(Object.hasOwn(log,'genre')&&!Object.hasOwn(log,'genre1'))next.genre1=next.genre;
  if(Object.hasOwn(log,'genre1'))next.genre=next.genre1;
  return{song:next,changes:log};
 }
 return{fields,limits,changes,apply};
});
