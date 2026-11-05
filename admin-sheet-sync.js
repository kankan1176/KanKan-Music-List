/* Administrator-only spreadsheet import. OAuth tokens remain in memory. */
(function(){
'use strict';
const sheetId='1dZYhGhsNwdOMGvPlHB1xsC7TNbU9PDKIQdoLYRvZumM';
const tab='ShareLiScore_master_2026-10-21';
const columns={id:['id','楽曲ID'],title:['title','曲名'],artist:['artist','アーティスト','アーティスト名'],chordwiki:['chordwiki','コードwiki','ChordWiki URL'],bpm:['bpm','BPM'],genre1:['genre1','genre','ジャンル'],genre2:['genre2','ジャンル②'],genre3:['genre3','ジャンル③'],genre4:['genre4','ジャンル④'],genre5:['genre5','ジャンル⑤'],genre6:['genre6','ジャンル⑥','音楽ジャンル'],vocal_synths:['vocal_synths'],release_year:['release_year'],anime_year:['anime_year'],tieup:['tieup','タイアップ情報'],search:['search','検索'],lyrics:['lyrics','作詞'],composition:['composition','作曲'],arrangement:['arrangement','編曲']};
function parse(rows){
 if(!Array.isArray(rows)||rows.length<2)throw Error('シートが空です。');
 const headers=rows[0].map(v=>String(v).trim()),index={};
 for(const [field,names]of Object.entries(columns)){
  const hits=headers.map((h,i)=>names.includes(h)?i:-1).filter(i=>i>=0);
  if(hits.length!==1)throw Error('列を特定できません: '+field);
  index[field]=hits[0];
 }
 const seen=new Set(),entries=[];
 for(const row of rows.slice(1)){
  if(!row.some(v=>String(v).trim()))continue;
  const id=String(row[index.id]||'').trim();
  if(!/^[\w-]{1,80}$/.test(id)||seen.has(id))throw Error('楽曲IDが空欄・重複・不正です: '+id);
  seen.add(id);
  const values=Object.fromEntries(Object.keys(columns).filter(f=>f!=='id').map(f=>[f,String(row[index[f]]??'').trim()]));
  if(!values.title)throw Error('曲名が空欄です: '+id);
  entries.push({id,values});
 }
 if(!entries.length)throw Error('登録可能な行がありません。');
 return entries;
}
if(typeof module==='object'&&module.exports){module.exports={parse};return;}
const status=document.getElementById('sheetSyncStatus'),read=document.getElementById('sheetSyncRead'),apply=document.getElementById('sheetSyncApply');
let plan=null,busy=false;
const value=(song,f)=>String(song?.[f]??(f==='genre1'?song?.genre:'')??'');
async function admin(){
 const user=auth.currentUser;
 if(!user||user.isAnonymous||(await db.ref('admins/'+user.uid).get()).val()!==true)throw Error('管理者のGoogleログインが必要です。');
 if(!user.providerData.some(p=>p.providerId==='google.com'))throw Error('Googleログインが必要です。');
 return user;
}
read.onclick=async()=>{
 if(busy)return;busy=true;read.disabled=true;apply.disabled=true;plan=null;
 try{
  const user=await admin();
  status.textContent='Googleでスプレッドシートの読み取りを許可してください…';
  const provider=new firebase.auth.GoogleAuthProvider();provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
  const result=await user.reauthenticateWithPopup(provider);
  const token=result.credential?.accessToken;if(!token)throw Error('Googleの読み取り権限を取得できませんでした。');
  status.textContent='最新版を取得しています…';
  const response=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+sheetId+'/values/'+encodeURIComponent("'"+tab+"'!A:Z")+'?valueRenderOption=FORMATTED_VALUE',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
  const data=await response.json();if(!response.ok)throw Error(data.error?.message||'スプレッドシートを読み取れません。');
  const entries=parse(data.values),songs=(await db.ref('songs').get()).val()||{};
  const changes=entries.map(e=>({...e,before:songs[e.id]||null})).filter(e=>!e.before||Object.entries(e.values).some(([f,v])=>value(e.before,f)!==v));
  plan={uid:user.uid,changes,total:entries.length};
  const added=changes.filter(e=>!e.before).length;
  status.textContent=entries.length+'曲を確認。更新 '+(changes.length-added)+'曲／新規 '+added+'曲。空欄もシートの値に合わせます。シートにない曲は保持します。';
  apply.disabled=!changes.length;
 }catch(e){status.textContent='取得できませんでした: '+e.message;}finally{busy=false;read.disabled=false;}
};
apply.onclick=async()=>{
 if(busy||!plan)return;busy=true;read.disabled=true;apply.disabled=true;
 let updated=0,conflicts=0;
 try{
  const user=await admin();if(user.uid!==plan.uid)throw Error('アカウントが変わりました。再取得してください。');
  for(const e of plan.changes){
   if(auth.currentUser?.uid!==user.uid)throw Error('ログイン状態が変わりました。');
   const ref=db.ref('songs/'+e.id);
   const keep=()=>{};
   ref.on('value',keep);
   let result;
   try {
   await ref.once('value');
   result=await ref.transaction(current=>{
    if (!!current !== !!e.before || (current && (Number(current._editRevision||0)!==Number(e.before._editRevision||0) || Object.keys(e.values).some(f=>value(current,f)!==value(e.before,f))))) return;
    return {...(current||{}),id:e.id,...e.values,updatedAt:firebase.database.ServerValue.TIMESTAMP,_editRevision:Number(current?._editRevision||0)+1};
   },undefined,false);
   if(result.committed){
    const saved=(await ref.get()).val();
    if(!saved||Object.entries(e.values).some(([f,v])=>value(saved,f)!==v))throw Error('保存後の照合に失敗しました: '+e.id);
    updated++;
   }else conflicts++;
   } finally {ref.off('value',keep);}
   status.textContent='反映中 '+(updated+conflicts)+' / '+plan.changes.length+'曲';
  }
  status.textContent='マスター更新完了：'+updated+'曲。競合で見送り：'+conflicts+'曲。検索・分類データの再生成は定期処理で行われます。サイトを再読み込みしてください。';
  plan=null;
 }catch(e){status.textContent='更新途中で停止しました（保存後の照合済み '+updated+'曲）: '+e.message+' 最新版を再取得すると残りを再実行できます。';}
 finally{
  if(updated){try{await db.ref('masterMeta/revision').set(db.ref().push().key);}catch(e){status.textContent+=' 更新通知に失敗しました: '+e.message;}}
  busy=false;read.disabled=false;
 }
};
auth.onAuthStateChanged(()=>{if(!busy){plan=null;apply.disabled=true;}});
})();