/* Admin-only history browser, optimistic edits and non-destructive undo. */
(()=>{
 'use strict';
 const api=window.SLSongEditService,el=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 if(!api||!el('songHistoryRows'))return;
 let records=[],cursor=null,more=true,busy=false,generation=0,editing=null,historyActor=null;
 const authorized=actor=>!!actor&&currentUser?.uid===actor.uid&&auth.currentUser?.uid===actor.uid&&isAdminUser(actor);
 const status=text=>el('songHistoryStatus').textContent=text;
 const dialog=document.createElement('dialog');dialog.className='admin-edit-dialog';dialog.setAttribute('aria-labelledby','adminSongEditTitle');
 dialog.innerHTML='<form><h2 id="adminSongEditTitle">楽曲情報を再編集</h2><p id="adminSongEditIdentity"></p><div class="admin-edit-fields"></div><p role="status" id="adminSongEditStatus"></p><div class="admin-edit-actions"><button type="button" data-close>閉じる</button><button type="submit">変更を保存</button></div></form>';document.body.append(dialog);
 const fields=dialog.querySelector('.admin-edit-fields');
 for(const field of SLSongChange.fields.filter(key=>key!=='genre')){const label=node('label',api.labels[field]||field),input=document.createElement(['search','tieup','vocal_synths'].includes(field)?'textarea':'input');input.name=field;input.maxLength=SLSongChange.limits[field];if(field==='title')input.required=true;label.append(input);fields.append(label);}
 function render(){
  const host=el('songHistoryRows'),q=el('songHistorySearch').value.trim().toLocaleLowerCase();host.replaceChildren();
  for(const log of records.filter(v=>[v.songId,v.songTitleAfter,v.songTitleBefore,v.editorUid,v.editorName,v.actorUid,v.actorName].join(' ').toLocaleLowerCase().includes(q))){
   const article=node('article','');article.className='admin-history-item';article.append(node('h3',log.songTitleAfter||log.songTitleBefore||log.songId));
   const meta=node('p',formatDate(log.editedAt)+' ／ '+({undo:'元に戻す',edit:'管理者による編集',approve:'編集申請の承認'}[log.action]||'楽曲編集'));meta.className='admin-history-meta';
   article.append(meta,node('p',(log.actorUid?'編集ユーザー：':'編集ユーザー（旧記録）：')+(log.editorName||log.editorUid||'未記録')+'（'+(log.editorUid||'未記録')+'）'));
   if(log.actorUid)article.append(node('p','実行・承認した管理者：'+(log.actorName||log.actorUid)+'（'+log.actorUid+'）'));
   article.append(node('small','楽曲ID：'+log.songId));
   const dl=node('dl','');dl.className='admin-history-changes';for(const[key,v]of Object.entries(log.changes||{})){dl.append(node('dt',api.labels[key]||key),node('dd',String(v?.before??'')+' → '+String(v?.after??'')));}article.append(dl);
   const actions=node('div','');actions.className='admin-history-actions';
   for(const[label,fn]of [['元に戻す',()=>undo(log)],['現在の情報を再編集',()=>openEditor(log.songId)]]){const button=node('button',label);button.type='button';button.disabled=busy||!authorized(currentUser);button.onclick=fn;actions.append(button);}article.append(actions);host.append(article);
  }
  if(!host.children.length)host.append(node('p',records.length?'条件に一致する履歴はありません。':'編集履歴はありません。'));
  el('songHistoryMore').hidden=!more;el('songHistoryMore').disabled=busy;
 }
 async function load(reset=false){
  if(busy||!currentUser)return;const actor=currentUser,version=++generation;busy=true;historyActor=actor;
  if(reset){records=[];cursor=null;more=true;}render();status('編集履歴を取得しています…');
  try{let query=db.ref('songEditLogs').orderByChild('editedAt');if(cursor)query=query.endBefore(cursor.time,cursor.id);const snap=await query.limitToLast(50).once('value');if(version!==generation||!authorized(actor))return;
   const page=[];snap.forEach(s=>page.push({...s.val(),id:s.key}));page.reverse();records.push(...page);const last=page.at(-1);if(last)cursor={time:last.editedAt,id:last.id};more=page.length===50;status(records.length+'件を読み込みました。変更前 → 変更後を表示しています。');
  }catch(e){if(version===generation)status('編集履歴を取得できません：'+e.message);}finally{if(version===generation){busy=false;render();}}
 }
 async function openEditor(songId){
  if(busy||!currentUser)return;const actor=currentUser;if(!/^[A-Za-z0-9_-]{1,80}$/.test(songId||'')){status('楽曲IDを入力してください。');showView('history');return;}
  try{const snap=await db.ref('songs/'+songId).once('value');if(!authorized(actor))return;const song=snap.val();if(!song)throw Error('楽曲が見つかりません。');editing={songId,song,actor};
   el('adminSongEditIdentity').textContent=song.title+' ／ '+(song.artist||'未設定')+' ['+songId+']';for(const input of fields.querySelectorAll('[name]'))input.value=String(input.name==='genre1'?SLSongGenres.value(song,'genre1'):song[input.name]??'');el('adminSongEditStatus').textContent='保存すると管理者の編集として履歴に記録します。';dialog.showModal();
  }catch(e){showView('history');status('編集画面を開けません：'+e.message);}
 }
 dialog.querySelector('form').onsubmit=async event=>{
  event.preventDefault();if(busy||!editing||!authorized(editing.actor))return;const selected=editing,after={...selected.song};for(const input of fields.querySelectorAll('[name]'))after[input.name]=input.value;
  busy=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);el('adminSongEditStatus').textContent='保存しています…';
  try{const baseline={...selected.song,genre1:SLSongGenres.value(selected.song,'genre1')};const changes=SLSongChange.changes(baseline,after);await api.save({database:db,songId:selected.songId,changes,actor:selected.actor,isAuthorized:()=>authorized(selected.actor)});dialog.close();busy=false;showView('history');await load(true);status('楽曲情報を保存し、編集履歴に記録しました。検索・絞り込みは定期更新後に反映されます。');void loadNews();}
  catch(e){el('adminSongEditStatus').textContent='保存できません：'+e.message+' 競合の場合は閉じて最新の内容を開き直してください。';}
  finally{busy=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);render();}
 };
 async function undo(log){
  if(busy||!currentUser)return;const actor=currentUser;
  if(!confirm('「'+(log.songTitleAfter||log.songId)+'」のこの履歴の変更項目だけを元に戻します。\nその後に対象項目が編集されている場合は停止します。よろしいですか？'))return;
  busy=true;render();status('現在の楽曲情報を確認して元に戻しています…');
  try{await api.save({database:db,songId:log.songId,log,action:'undo',actor,isAuthorized:()=>authorized(actor)});busy=false;await load(true);status('元に戻しました。この操作も新しい履歴として記録しました。');void loadNews();}
  catch(e){status('元に戻せません：'+e.message);}finally{busy=false;render();}
 }
 dialog.querySelector('[data-close]').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>{editing=null;});
 el('songHistoryReload').onclick=()=>load(true);el('songHistoryMore').onclick=()=>load();el('songHistorySearch').oninput=render;el('adminSongOpen').onclick=()=>openEditor(el('adminSongId').value.trim());
 window.addEventListener('sl-admin-view',e=>{if(e.detail==='history'&&!records.length)void load(true);});
 auth.onAuthStateChanged(()=>{if(historyActor&&!authorized(historyActor)||editing&&!authorized(editing.actor)){generation++;busy=false;records=[];cursor=null;historyActor=null;dialog.close();status('');render();}});
})();
