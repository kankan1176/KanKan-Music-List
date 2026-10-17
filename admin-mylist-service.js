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
  return {append};
});
