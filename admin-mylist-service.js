/* Append-only writes: every song is rechecked by a transaction and RTDB rules. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./admin-mylist-core.js'));
  else root.SLAdminMyListService = factory(root.SLAdminMyList);
})(typeof window === 'object' ? window : globalThis, core => {
  'use strict';
  async function append({database, uid, rows, master, saved, choices, isAuthorized, progress = () => {}}) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw Error('対象ユーザーIDが不正です。');
    const planned = core.analyze(rows, master, saved, choices).filter(row => row.status === 'ready');
    const result = {added:[], duplicate:[], failed:[], stopped:false};
    for (let i = 0; i < planned.length; i++) {
      const row = planned[i];
      if (!isAuthorized()) { result.stopped = true; result.failed.push(...planned.slice(i).map(item => ({...item, error:'管理者のログイン状態が変わったため中止しました。'}))); break; }
      try {
        // An initial null cache is not authoritative. Firebase retries against the server,
        // and the rule also refuses an existing record, even if another tab creates it now.
        const outcome = await database.ref(`users/${uid}/songs/${row.songId}`).transaction(current => {
          if (!isAuthorized() || current !== null) return;
          return core.payload(row.key);
        }, undefined, false);
        if (outcome.committed) result.added.push(row);
        else if (!isAuthorized()) { result.failed.push({...row,error:'管理者のログイン状態が変わりました。'}); result.stopped = true; }
        else result.duplicate.push(row);
      } catch (error) {
        let exists = false;
        if (isAuthorized()) { try { exists = (await database.ref(`users/${uid}/songs/${row.songId}`).once('value')).exists(); } catch {} }
        if (exists) result.duplicate.push(row);
        else result.failed.push({...row, error:error.message || '保存に失敗しました。'});
      }
      progress(i + 1, planned.length);
    }
    return result;
  }
  const editable = value => Object.fromEntries(['registered','key','part','parts','liked','excluded'].map(key=>[key,value?.[key]??null]));
  function patch(current,baseline,values){
    if(!current || JSON.stringify(editable(current))!==JSON.stringify(editable(baseline)))return;
    if(!Number.isInteger(values.key)||values.key < -5||values.key > 6||typeof values.registered!=='boolean'||typeof values.liked!=='boolean'||!Array.isArray(values.parts)||values.parts.length>7||values.parts.some(p=>typeof p!=='string'||!p||p.length>40))throw Error('Key・担当パートの入力を確認してください。');
    const parts=[...new Set(values.parts)];
    return {...current,registered:values.registered,key:values.key,liked:values.registered&&values.liked,parts:values.registered?parts:[],part:values.registered?(parts[0]||''):'',excluded:!values.registered};
  }
  async function edit({database,uid,songId,baseline,values,isAuthorized}){
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||!/^[A-Za-z0-9_-]{1,80}$/.test(songId)||!isAuthorized())throw Error('対象または管理者のログイン状態を確認してください。');
    const ref=database.ref(`users/${uid}/songs/${songId}`);
    await ref.once('value');
    const result=await ref.transaction(current=>{
      if(!isAuthorized())return;
      if(current===null)return null;
      return patch(current,baseline,values);
    },undefined,false);
    if(!isAuthorized())throw Error('管理者のログイン状態が変わりました。');
    if(!result.committed||!result.snapshot.val())throw Error('本人または別の管理者が更新しました。再読み込みしてから編集してください。');
    return result.snapshot.val();
  }
  async function syncPublic({database,uid,songId,isAuthorized,shareCore}){
    if(!isAuthorized())throw Error('管理者のログイン状態が変わりました。');
    const read=async path=>(await database.ref(path).once('value')).val();
    const config=await read('userListShares/'+uid);
    if(!config||config.enabled===false||!shareCore.tokenOK(config.token))return;
    const base='publicListShares/'+config.token;
    const [owner,reserved,item,master]=await Promise.all([read(base+'/uid'),read(base+'/reserved'),read('users/'+uid+'/songs/'+songId),read('songs/'+songId)]);
    if(owner!==uid||reserved===true)return;
    const value=shareCore.registered(item)?shareCore.song(master,item,config):null;
    if(!isAuthorized())throw Error('管理者のログイン状態が変わりました。');
    await database.ref().update({[base+'/songs/'+songId]:value,[base+'/updatedAt']:{'.sv':'timestamp'}});
  }
  return {append,editable,patch,edit,syncPublic};
});
