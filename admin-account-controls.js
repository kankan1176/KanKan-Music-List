/* Authenticated administrative UI. All authorization is enforced again by accountControl. */
(()=>{'use strict';
 const host=document.querySelector('[data-view-panel="users"]');if(!host)return;
 const section=document.createElement('section');section.className='card';section.id='accountControlsPanel';
 section.innerHTML='<h2>端末・アカウント操作</h2><p>ログアウト指示は、このアプリを利用するGoogleログイン端末が対象です。Google認証トークンの失効は行いません。楽曲キャッシュ削除は保存済みマイリストを保持します。未接続の端末は次回アクセス時に反映されます。</p><div class="toolbar-actions"><button type="button" id="accountControlsRefresh">対象と受信状況を更新</button><button type="button" id="accountControlsAllCache" disabled>全ユーザー・ゲストの楽曲キャッシュを削除</button></div><p id="accountControlsStatus" role="status" aria-live="polite"></p><div class="table-scroll" role="region" aria-label="端末・アカウント操作一覧" tabindex="0"><table><thead><tr><th>種別・ユーザーID</th><th>名前</th><th>最終連絡・受信状況</th><th>操作</th></tr></thead><tbody id="accountControlsRows"></tbody></table></div>';
 host.append(section);
 const style=document.createElement('style');style.textContent='#accountControlsPanel td{vertical-align:top;white-space:normal;overflow-wrap:anywhere}#accountControlsPanel .control-actions{display:flex;gap:7px;flex-wrap:wrap}#accountControlsPanel input{max-width:100%;box-sizing:border-box;padding:8px}#accountControlsStatus{white-space:pre-line}#accountControlsPanel small{display:block;margin-top:6px}';document.head.append(style);
 const el=id=>document.getElementById(id);let operation=false,loadVersion=0;
 const status=text=>{el('accountControlsStatus').textContent=text;};
 const current=()=>auth.currentUser&&currentUser?.uid===auth.currentUser.uid?auth.currentUser:null;
 function cell(row,text){const td=document.createElement('td');td.textContent=text;row.append(td);return td;}
 function button(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=operation;b.onclick=fn;return b;}
 async function run(data,question,done){
  const user=current();if(!user||operation)return;
  if(!window.confirm(question))return;
  operation=true;el('accountControlsAllCache').disabled=true;el('accountControlsRefresh').disabled=true;section.querySelectorAll('tbody button,tbody input').forEach(e=>e.disabled=true);
  status('処理中です…');
  try{await window.slAccountControlCall(data,user);if(current()?.uid===user.uid){await refresh();status(done);}}
  catch(error){if(current()?.uid===user.uid)status('操作できませんでした。'+error.message);}
  finally{operation=false;el('accountControlsRefresh').disabled=false;if(current()?.uid===user.uid)await refresh(false);}
 }
 async function refresh(show=true){
  const user=current(),version=++loadVersion;if(!user){el('accountControlsRows').replaceChildren();el('accountControlsAllCache').disabled=true;return;}
  if(show)status('管理機能と対象ユーザーを確認しています…');
  try{
   const result=await window.slAccountControlCall({action:'list'},user);
   if(version!==loadVersion||current()?.uid!==user.uid)return;
   el('accountControlsRows').replaceChildren();el('accountControlsAllCache').disabled=!result.enabled||operation;
   if(!result.enabled){status('Firebase側の初期設定が未完了です。無料構成用のデータベースルール適用後に操作できます。');return;}
   for(const item of result.targets||[]){
    const row=document.createElement('tr');cell(row,(item.kind==='guest'?'ゲスト':'Googleアカウント')+'\n'+item.uid);
    const nameCell=cell(row,item.name);if(item.requestedName&&item.requestedName!==item.name){const note=document.createElement('small');note.textContent='変更指示：'+item.requestedName;nameCell.append(note);}
    const received=cell(row,item.lastSeen?new Date(item.lastSeen).toLocaleString('ja-JP'):'端末からの連絡は未記録');
    const devices=item.devices||[];
    if(item.pendingCacheId){const count=devices.filter(d=>d.cacheIds?.includes(item.pendingCacheId)).length;const info=document.createElement('small');info.textContent='個別キャッシュ削除：'+count+'端末で受信済み';received.append(info);}
    if(result.globalCache?.id){const count=devices.filter(d=>d.cacheIds?.includes(result.globalCache.id)).length;const info=document.createElement('small');info.textContent='全体キャッシュ削除：'+count+'端末で受信済み';received.append(info);}
    if(item.pendingLogoutId){const count=devices.filter(d=>d.logoutId===item.pendingLogoutId).length;const info=document.createElement('small');info.textContent='ログアウト指示：'+count+'端末で受信済み';received.append(info);}
    if(item.pendingNameId){const count=devices.filter(d=>d.guestNameId===item.pendingNameId).length;const info=document.createElement('small');info.textContent='名前変更：'+count+'端末で受信済み';received.append(info);}
    const td=document.createElement('td'),actions=document.createElement('div');actions.className='control-actions';td.append(actions);row.append(td);
    actions.append(button('楽曲キャッシュを削除',()=>run({action:'clearCache',uid:item.uid},item.name+' の端末へ楽曲キャッシュの削除を指示しますか？ 保存済みマイリストは保持されます。','キャッシュ削除の指示を送信しました。端末の受信状況は更新ボタンで確認できます。')));
    if(item.kind==='account'){
     const logout=button('アプリからログアウト',()=>run({action:'forceLogout',uid:item.uid},item.name+' にアプリのログアウト指示を送信しますか？ 接続中または次回アクセス時に反映します。未保存の変更は失われる場合があります。','アプリのログアウト指示を送信しました。Google認証トークン自体は失効しません。'));
     logout.className='danger';logout.disabled=operation||item.uid===user.uid;actions.append(logout);
    }else{
     const input=document.createElement('input');input.type='text';input.maxLength=40;input.value=item.requestedName||item.name;input.setAttribute('aria-label','ゲストの新しい名前');input.disabled=operation;
     actions.append(input,button('ゲスト名を変更',()=>{const name=input.value.trim();if(!name||name.length>40){status('名前は1〜40文字で入力してください。');return;}return run({action:'renameGuest',uid:item.uid,name},item.name+' のゲスト名を「'+name+'」へ変更しますか？','ゲスト名の変更指示を送信しました。ルーム内の表示は対象端末が受信後に更新されます。');}));
    }
    el('accountControlsRows').append(row);
   }
   if(show)status((result.targets||[]).length+'件を表示しています。端末の連絡状況はログイン履歴とは異なります。');
  }catch(error){if(version===loadVersion&&current()?.uid===user.uid){el('accountControlsAllCache').disabled=true;status('管理機能を利用できません。'+error.message);}}
 }
 el('accountControlsRefresh').onclick=()=>refresh();
 el('accountControlsAllCache').onclick=()=>run({action:'clearCache',scope:'all'},'ログインユーザーとゲストを含む、全端末へ楽曲キャッシュの削除を指示しますか？ 保存済みマイリストは保持されます。','全ユーザー・ゲストへの楽曲キャッシュ削除指示を送信しました。未接続端末は次回アクセス時に受信します。');
 const original=window.loadUsers||loadUsers;
 window.loadUsers=async function(){await original.apply(this,arguments);await refresh();};
 // Top-level function declarations and window properties refer to the same binding.
 auth.onAuthStateChanged(()=>{loadVersion++;el('accountControlsRows').replaceChildren();el('accountControlsAllCache').disabled=true;});
})();
