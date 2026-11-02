/* User-name -> saved list -> CSV upload -> review -> append-only confirmation. */
(() => {
  'use strict';
  const core = window.SLAdminMyList, service = window.SLAdminMyListService;
  const dialog = document.getElementById('adminMyListDialog');
  if (!dialog || !core || !service) return;
  const el = id => document.getElementById(id);
  let target = null, actor = null, master = {}, saved = {}, parsed = [], analysis = [], choices = {}, busy = false, version = 0, masterPromise = null, loaded = false;
  const authorized = () => !!actor && auth.currentUser?.uid === actor.uid && currentUser?.uid === actor.uid;
  const note = value => { el('adminMyListStatus').textContent = value; };
  const node = (tag, value, className) => { const n = document.createElement(tag); n.textContent = value; if (className) n.className = className; return n; };
  const read = async path => (await db.ref(path).once('value')).val() || {};
  const editDialog=document.createElement('dialog');editDialog.className='admin-edit-dialog';editDialog.setAttribute('aria-labelledby','adminSavedEditTitle');
  editDialog.innerHTML='<form><h2 id="adminSavedEditTitle">マイリスト情報を編集</h2><p id="adminSavedEditSong"></p><div class="admin-edit-fields"><label>Key<select name="key"></select></label><label><span>登録状態</span><span><input type="checkbox" name="registered"> マイリストに登録する</span></label><label><span>お気に入り</span><span><input type="checkbox" name="liked"> お気に入りにする</span></label></div><fieldset><legend>担当パート（複数選択）</legend><div class="admin-edit-parts"></div></fieldset><p role="status" id="adminSavedEditStatus"></p><div class="admin-edit-actions"><button type="button" data-close>閉じる</button><button type="submit">変更を保存</button></div></form>';document.body.append(editDialog);
  const editForm=editDialog.querySelector('form');let selectedEdit=null;
  for(let i=-5;i<=6;i++)editForm.elements.key.append(new Option(i===0?'0（原曲）':(i>0?'+':'')+i,String(i)));
  function openSavedEditor(v){
    if(busy||!authorized())return;
    selectedEdit={id:v.id,baseline:structuredClone(v.item),uid:target.uid,request:version};
    el('adminSavedEditSong').textContent=(v.song?.title||v.id)+' ／ '+(v.song?.artist||'未設定');
    editForm.elements.key.value=String(Number.isInteger(v.item.key)?v.item.key:0);editForm.elements.registered.checked=core.active(v.item);editForm.elements.liked.checked=!!v.item.liked;
    const selected=Array.isArray(v.item.parts)?v.item.parts:v.item.part?[v.item.part]:[],parts=editDialog.querySelector('.admin-edit-parts');parts.replaceChildren();
    for(const part of new Set(['🎤','🎸','🥁','🎹','🎺','🎻','🪈',...selected])){const label=node('label',''),input=document.createElement('input');input.type='checkbox';input.name='part';input.value=part;input.checked=selected.includes(part);label.append(input,document.createTextNode(part));parts.append(label);}
    el('adminSavedEditStatus').textContent='本人または別の管理者が更新した場合は保存を停止します。登録解除はチェックを外して保存してください。';editDialog.showModal();
  }
  editForm.onsubmit=async event=>{
    event.preventDefault();if(busy||!selectedEdit||!authorized())return;const selected=selectedEdit;
    setBusy(true);editDialog.querySelectorAll('button,input,select').forEach(n=>n.disabled=true);el('adminSavedEditStatus').textContent='保存しています…';
    try{const values={key:Number(editForm.elements.key.value),registered:editForm.elements.registered.checked,liked:editForm.elements.liked.checked,parts:[...editDialog.querySelectorAll('[name=part]:checked')].map(input=>input.value)};
      const isCurrent=()=>selected.request===version&&authorized()&&target?.uid===selected.uid;
      const result=await service.edit({database:db,uid:selected.uid,songId:selected.id,baseline:selected.baseline,values,isAuthorized:isCurrent});
      saved[selected.id]=result;let warning='';
      try{await service.syncPublic({database:db,uid:selected.uid,songId:selected.id,isAuthorized:isCurrent,shareCore:window.SLListShare});}catch{warning=' 公開ページへの同期はできませんでした。「公開UI・公開設定」から再公開すると同期できます。';}
      if(!isCurrent())return;editDialog.close();renderSaved();note('マイリストを変更しました。本人の画面は再読み込みすると反映されます。'+warning);
    }catch(e){el('adminSavedEditStatus').textContent='保存できません：'+e.message;}
    finally{setBusy(false);editDialog.querySelectorAll('button,input,select').forEach(n=>n.disabled=false);}
  };
  editDialog.querySelector('[data-close]').onclick=()=>{if(!busy)editDialog.close();};editDialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});editDialog.addEventListener('close',()=>{selectedEdit=null;});
  function show(step) {
    dialog.querySelectorAll('[data-import-step]').forEach(section => { section.hidden = section.dataset.importStep !== step; });
    el('adminMyListStep').textContent = {browse:'保存済みマイリスト',upload:'CSVアップロード',review:'登録内容の確認',result:'登録結果'}[step];
  }
  function setBusy(value) {
    busy = value;
    dialog.querySelectorAll('button,input,select').forEach(n => { n.disabled = value; });
    el('adminMyListStart').disabled = value || !loaded;
    if (!value) el('adminMyListConfirm').disabled = !analysis.some(row => row.status === 'ready');
  }
  function clear() {
    version++; target = actor = null; master = {}; saved = {}; parsed = []; analysis = []; choices = {}; masterPromise = null; loaded = false;
    el('adminMyListSavedRows').replaceChildren(); el('adminMyListPreviewRows').replaceChildren(); el('adminMyListResultRows').replaceChildren();
    el('adminMyListShowInactive').checked = false; el('adminMyListFile').value = ''; el('adminMyListSearch').value = ''; el('adminMyListUser').textContent = ''; el('adminMyListUid').textContent = ''; note('');
  }
  function renderSaved() {
    const filter = el('adminMyListSearch').value.trim().toLocaleLowerCase();
    const songs = core.buildIndex(master).byId;
    const entries = Object.entries(saved).filter(([,item]) => core.active(item)||el('adminMyListShowInactive').checked);
    const list = entries.map(([id,item]) => ({id,item,song:songs.get(id)})).filter(v => (v.song?.title + ' ' + v.song?.artist + ' ' + v.id).toLocaleLowerCase().includes(filter));
    list.sort((a,b) => (a.song?.title || a.id).localeCompare(b.song?.title || b.id, 'ja'));
    el('adminMyListCount').textContent = '保存済み ' + entries.length + '曲 / 表示 ' + list.length + '曲';
    const rows = el('adminMyListSavedRows'); rows.replaceChildren();
    for (const v of list) {
      const row = document.createElement('tr');
      row.append(node('td',v.song?.title || 'マスターに存在しない楽曲：' + v.id),node('td',v.song?.artist || '—'),node('td',Number.isInteger(v.item.key)?(v.item.key>0?'+':'')+v.item.key:'0'),node('td',(Array.isArray(v.item.parts)?v.item.parts:v.item.part?[v.item.part]:[]).join(' ')),node('td',core.active(v.item)?(v.item.liked?'お気に入り':'登録済み'):'登録解除済み'));
      const actions=node('td',''),button=node('button','編集');button.type='button';button.className='admin-mylist-edit';button.disabled=busy;button.onclick=()=>openSavedEditor(v);actions.append(button);row.append(actions);
      rows.append(row);
    }
    if (!list.length) { const row = document.createElement('tr'), cell = node('td', entries.length ? '条件に一致する曲はありません。' : '保存済みの楽曲はありません。'); cell.colSpan=6; row.append(cell); rows.append(row); }
  }
  function renderReview() {
    analysis = core.analyze(parsed, master, saved, choices);
    const count = key => analysis.filter(row => row.status === key).length;
    el('adminMyListSummary').textContent = `追記 ${count('ready')}曲 / 重複 ${count('duplicate')}曲 / マスター未一致・入力不備など ${count('excluded')}曲 / 候補未選択 ${count('candidate')}曲`;
    const host = el('adminMyListPreviewRows'); host.replaceChildren();
    for (const item of analysis) {
      const row = document.createElement('tr');
      row.append(node('td',item.line),node('td',item.title),node('td',item.artist),node('td',item.rawKey || '0'));
      const state = node('td', {ready:'追記',duplicate:'重複・除外',candidate:'候補選択',excluded:'除外'}[item.status]); state.className = 'import-' + item.status;
      state.append(node('small',item.reason)); if(item.songId)state.append(node('small','登録先：'+item.masterTitle+' / '+(item.masterArtist||'アーティスト未設定')+' ['+item.songId+']')); row.append(state);
      if (item.candidates.length > 1) {
        const select = document.createElement('select'); select.setAttribute('aria-label',item.line+'行目の登録先');
        select.append(new Option('未選択のまま除外',''),new Option('この行は登録しない','skip'));
        for (const song of item.candidates) select.append(new Option(song.title+' / '+song.artist+' ['+song.id+']',song.id));
        select.value=choices[item.line]||''; select.onchange=()=>{choices[item.line]=select.value;renderReview();}; state.append(select);
      }
      host.append(row);
    }
    el('adminMyListConfirm').disabled = busy || !analysis.some(row=>row.status==='ready');
  }
  async function getMaster() {
    if (!masterPromise) masterPromise = read('songs').catch(error => { masterPromise = null; throw error; });
    return masterPromise;
  }
  async function open(user) {
    if (busy) return;
    clear();
    if (!user || !/^[A-Za-z0-9_-]{1,128}$/.test(user.uid) || !currentUser || auth.currentUser?.uid !== currentUser.uid) return;
    actor = auth.currentUser; target = {uid:user.uid,name:String(user.name||user.uid)};
    const request = ++version; el('adminMyListUser').textContent=target.name; el('adminMyListUid').textContent=target.uid; show('browse'); dialog.showModal(); setBusy(true); note('保存済みマイリストと楽曲マスターを取得しています…');
    try {
      const result=await Promise.all([read(`users/${target.uid}/songs`),getMaster()]);
      if(request!==version||!authorized())return;
      [saved,master]=result;loaded=true;renderSaved();note('「編集」からKey・担当パート・お気に入り・登録状態を変更できます。');
    } catch(error) { if(request===version)note('マイリストを取得できませんでした。'+error.message+' 権限ルール適用の完了を確認し、開き直してください。'); }
    finally { if(request===version)setBusy(false); }
  }
  async function analyzeFile() {
    const file=el('adminMyListFile').files[0];if(busy||!target||!authorized())return;if(!file){note('アップロードするCSVファイルを選択してください。');return;}
    const request=++version;setBusy(true);note('CSVを解析しています…');
    try {
      if(file.size>2*1024*1024)throw Error('CSVは2MB以下にしてください。');
      const source=core.decode(await file.arrayBuffer());
      const rows=core.parseCsv(source);
      const latest=await read(`users/${target.uid}/songs`);
      if(request!==version||!authorized())return;
      parsed=rows;saved=latest;choices={};renderReview();show('review');note('追記対象を確認してください。重複・未一致・未選択の行は保存しません。Key未指定は0（原曲）です。');
    } catch(error) { if(request===version)note('CSVを解析できませんでした。'+error.message); }
    finally { if(request===version)setBusy(false); }
  }
  async function confirm() {
    if(busy||!target||!authorized()||!analysis.some(row=>row.status==='ready'))return;
    const user={...target}, request=++version, prior=JSON.stringify(analysis);setBusy(true);note('保存前に既存曲とマスターを再確認しています…');
    try {
      const [latestSongs,latestMaster]=await Promise.all([read(`users/${user.uid}/songs`),read('songs')]);
      if(request!==version||!authorized())return;
      saved=latestSongs;master=latestMaster;masterPromise=Promise.resolve(master);renderReview();
      if(prior!==JSON.stringify(analysis)){note('確認中にマイリストまたはマスターが更新されました。更新後の内容を確認して、もう一度「確定」を押してください。');return;}
      const result=await service.append({database:db,uid:user.uid,rows:parsed,master,saved,choices,isAuthorized:()=>request===version&&authorized(),progress:(done,total)=>note(`追記中… ${done} / ${total}曲。完了まで画面を閉じないでください。`)});
      if(request!==version||!authorized())return;
      const out=el('adminMyListResultRows');out.replaceChildren();
      for(const row of result.failed)out.append(node('p',row.line+'行目 '+row.title+' / '+row.artist+'：'+row.error,'error'));
      el('adminMyListResultSummary').textContent=`追記 ${result.added.length}曲 / 保存中の重複 ${result.duplicate.length}曲 / 保存失敗 ${result.failed.length}曲。解析時の除外は保存していません。`;
      show('result');note(result.failed.length?'一部を保存できませんでした。CSVを再確認すると、保存済みの曲は重複として除外されます。':'追記が完了しました。既存曲とKeyは変更していません。本人の画面は再読み込みすると反映されます。');
    } catch(error) { if(request===version)note('登録できませんでした。'+error.message+' 保存状況を再確認してから再実行してください。'); }
    finally { if(request===version)setBusy(false); }
  }
  el('adminMyListReload').onclick=()=>{if(target&&!busy)void open(target);};
  el('adminMyListStart').onclick=()=>{if(!busy){show('upload');note('曲名,アーティスト,Key（任意）,楽曲ID（任意）の順でCSVを選択してください。');}};
  el('adminMyListAnalyze').onclick=analyzeFile;
  el('adminMyListConfirm').onclick=confirm;
  el('adminMyListSearch').oninput=renderSaved;
  el('adminMyListShowInactive').onchange=renderSaved;
  el('adminMyListUploadBack').onclick=()=>{if(!busy)show('browse');};
  el('adminMyListReviewBack').onclick=()=>{if(!busy)show('upload');};
  el('adminMyListRefresh').onclick=()=>{if(target&&!busy)void open(target);};
  el('adminMyListRetry').onclick=()=>{if(!busy){show('upload');note('再アップロード時は保存済みの曲を除外して再確認します。');}};
  el('adminMyListClose').onclick=()=>{if(!busy)dialog.close();};
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('close',()=>{if(!busy)clear();});
  window.addEventListener('sl-admin-mylist',event=>void open(event.detail));
  auth.onAuthStateChanged(()=>{if(actor&&!authorized()){version++;busy=false;editDialog.close();dialog.close();clear();}});
})();
