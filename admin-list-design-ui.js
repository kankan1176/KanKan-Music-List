/* Shares the owner's appearance model and same-origin preview renderer. */
(()=>{
 'use strict';
 const design=window.SLListDesign;if(!design)return;
 const dialog=document.createElement('dialog');dialog.className='sl-list-share-dialog sl-admin-design';dialog.setAttribute('aria-labelledby','adminDesignTitle');
 dialog.innerHTML='<div class="sl-share-editor-heading"><div><h2 id="adminDesignTitle">マイリストUI編集</h2><p id="adminDesignTarget"></p></div><button type="button" id="adminDesignClose" aria-label="閉じる">×</button></div><div class="sl-share-editor-body"><section class="sl-share-editor-fields"><label>ページタイトル<input type="text" id="adminDesignPageTitle" maxlength="100"></label><label>テーマ<select id="adminDesignPreset"><option value="dark">ダーク</option><option value="light">ライト</option></select></label><div id="adminDesignColors" class="sl-share-colors"></div><label>背景画像（JPEG）<input type="file" id="adminDesignImage" accept=".jpg,.jpeg,image/jpeg"><small>1920×1080に調整して保存します。</small></label><button type="button" id="adminDesignRemove">背景画像を削除</button><label>背景の濃さ <output id="adminDesignOverlayValue"></output><input type="range" id="adminDesignOverlay" min="0" max="85" step="1"></label></section><section class="sl-share-editor-preview"><p>対象ユーザーの保存済みマイリストでプレビューします。</p><iframe id="adminDesignFrame" src="mylist.html#preview" title="マイリストUIのプレビュー"></iframe></section></div><div class="sl-share-editor-footer"><p>公開／非公開の切り替えは保存済みのデザインに適用します。共有URL・登録曲・Key／担当パートの公開設定は維持します。</p><p id="adminDesignStatus" role="status" aria-live="polite"></p><div class="sl-share-editor-actions"><button type="button" id="adminDesignPublish" role="switch" aria-checked="false">非公開：公開する</button><a id="adminDesignLink" target="_blank" rel="noopener noreferrer" hidden>公開ページを開く</a><button type="button" id="adminDesignReload">再読み込み</button><button type="button" id="adminDesignSave">設定を保存</button></div></div>';
 document.body.append(dialog);const el=id=>document.getElementById('adminDesign'+id);
 const names={background:'背景色',panel:'パネル色',text:'文字色',muted:'補助文字色',border:'枠線色',accent:'アクセント色',searchText:'検索文字色'};
 for(const key of design.keys){const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');input.type='color';input.id='adminDesignColor-'+key;input.setAttribute('aria-label',names[key]);span.textContent=names[key];label.append(input,span);el('Colors').append(label);}
 let version=0,actor=null,target=null,service=null,background=null,draftImage,previewData=null,busy=false,config=null,settingsLoaded=false;
 const authorized=()=>!!actor&&!actor.isAnonymous&&auth.currentUser?.uid===actor.uid&&currentUser?.uid===actor.uid;
 const status=text=>el('Status').textContent=text;
 function lock(value){busy=value;dialog.querySelectorAll('button,input,select').forEach(n=>n.disabled=value);el('Publish').disabled=value||!settingsLoaded;el('Save').disabled=value||!previewData;}
 function renderPublication(){
  const published=!!config&&config.enabled!==false;
  el('Publish').setAttribute('aria-checked',String(published));
  el('Publish').textContent=published?'公開中：非公開にする':'非公開：公開する';
  el('Publish').disabled=busy||!settingsLoaded;
  el('Link').hidden=!published;el('Link').href=published?new URL('mylist.html#'+config.token,location.href).href:'#';
 }
 function appearance(){return design.normalize({title:el('PageTitle').value,preset:el('Preset').value,overlay:Number(el('Overlay').value),...Object.fromEntries(design.keys.map(key=>[key,el('Color-'+key).value]))});}
 function send(){el('OverlayValue').value=el('Overlay').value+'%';el('Frame').contentWindow?.postMessage({type:'sl-list-preview',payload:previewData?{...previewData,appearance:appearance()}:null,image:draftImage===undefined?background?.image||'':draftImage||'',language:'ja'},location.origin);}
 async function reload(){
  if(!service||!authorized())return;const request=++version;previewData=null;send();lock(true);status('デザインとマイリストを取得しています…');
  try{const result=await service.load();if(request!==version||!authorized())return;config=result.config;settingsLoaded=true;renderPublication();
   const value=design.normalize(result.config?.appearance);el('PageTitle').value=value.title;el('Preset').value=value.preset;el('Overlay').value=value.overlay;for(const key of design.keys)el('Color-'+key).value=value[key];background=result.background;draftImage=undefined;el('Image').value='';
   previewData=await service.preview(value);if(request!==version||!authorized())return;send();status('プレビューを確認して保存してください。');
  }catch(error){if(request===version)status('読み込めませんでした。'+error.message);}
  finally{if(request===version){lock(false);el('Save').disabled=!previewData;}}
 }
 async function open(user){
  if(busy||!currentUser||auth.currentUser?.uid!==currentUser.uid||!user||!/^[A-Za-z0-9_-]{1,128}$/.test(user.uid))return;
  actor=auth.currentUser;target={uid:user.uid,name:String(user.name||user.uid)};previewData=null;background=null;draftImage=undefined;config=null;settingsLoaded=false;version++;renderPublication();el('Target').textContent=target.name+' ／ '+target.uid;
  const sessionActor=actor,sessionTarget=target;service=SLAdminListDesignService(db,target,()=>authorized()&&actor===sessionActor&&target===sessionTarget,SLListShare,design);dialog.showModal();send();await reload();
 }
 el('Close').onclick=()=>{if(!busy)dialog.close();};
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 dialog.addEventListener('close',()=>{version++;actor=null;target=null;service=null;background=null;draftImage=undefined;previewData=null;config=null;settingsLoaded=false;renderPublication();send();});
 el('Reload').onclick=()=>{if(!busy&&confirm('未保存の編集を破棄して最新の設定を読み込みますか？'))void reload();};
 el('Save').onclick=async()=>{
  if(busy||!service||!authorized()||!previewData||!confirm(target.name+' のマイリストUI設定を保存しますか？'))return;
  const request=++version;lock(true);status('保存しています…');
  try{const result=await service.save({appearance:appearance(),backgroundImage:draftImage});if(request!==version||!authorized())return;config=result.config;background=result.background;draftImage=undefined;el('Image').value='';renderPublication();send();status('保存しました。公開中のページがある場合は、そのデザインにも反映しました。停止中のページは停止状態を維持しています。');}
  catch(error){if(request===version)status('保存できませんでした。'+error.message);}
  finally{if(request===version)lock(false);}
 };
 el('Publish').onclick=async()=>{
  if(busy||!service||!authorized()||!settingsLoaded)return;
  const published=!(config&&config.enabled!==false);
  const message=published?' のマイリストを公開しますか？ 保存済みのデザインと最新の登録曲で公開します。':' のマイリストを非公開にしますか？ 共有URLからも閲覧できなくなります。';
  if(!confirm(target.name+message+' 未保存のデザイン変更は破棄します。'))return;
  const request=++version;lock(true);status(published?'公開する楽曲と設定を確認しています…':'非公開にしています…');
  try{const result=await service.setPublished(published);if(request!==version||!authorized())return;config=result.config;renderPublication();await reload();if(dialog.open&&authorized())status(published?'公開しました。共有URLは以前と同じです（初回のみ新規作成）。':'非公開にしました。共有URLとデザインは保持しています。');}
  catch(error){if(request===version)status('切り替えできませんでした。'+error.message);}
  finally{if(request===version)lock(false);}
 };
 el('Preset').onchange=()=>{for(const key of design.keys)el('Color-'+key).value=design.presets[el('Preset').value][key];send();};
 for(const id of ['PageTitle','Overlay','Colors'])el(id).oninput=send;
 el('Remove').onclick=()=>{draftImage=null;el('Image').value='';send();};
 el('Image').onchange=async()=>{const file=el('Image').files?.[0];if(!file||busy)return;const request=++version;lock(true);status('画像を調整しています…');try{const image=await design.jpeg(file);if(request!==version||!authorized())return;draftImage=image;send();status('画像をプレビューしました。「設定を保存」で反映します。');}catch(error){if(request===version)status('JPEG画像（16MB以下）を選択してください。画像を調整できませんでした。');}finally{if(request===version)lock(false);}};
 el('Frame').addEventListener('load',send);
 window.addEventListener('sl-admin-list-design',event=>void open(event.detail));
 auth.onAuthStateChanged(()=>{if(actor&&!authorized()){version++;busy=false;dialog.close();}});
})();
