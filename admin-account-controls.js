/* Dedicated user controls view. RTDB rules enforce administrator authorization. */
(() => {
  'use strict';
  const section = document.getElementById('accountControlsPanel');
  if (!section) return;
  const el = id => document.getElementById(id);
  const status = text => { el('accountControlsStatus').textContent = text; };
  const current = () => auth.currentUser && currentUser?.uid === auth.currentUser.uid ? auth.currentUser : null;
  let operation = false, loadVersion = 0, enabled = false, targets = [], globalCache = null, page = 0;
  const pageSize = 20;
  function text(tag, value, className) {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  }
  function button(label, click, disabled = false) {
    const node = text('button', label);
    node.type = 'button'; node.disabled = operation || disabled; node.onclick = click;
    return node;
  }
  function render() {
    const search = el('accountControlsSearch').value.trim().toLocaleLowerCase();
    const kind = el('accountControlsKind').value;
    const filtered = targets.filter(item => (kind === 'all' || item.kind === kind) && (item.name + ' ' + item.uid).toLocaleLowerCase().includes(search));
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, pages - 1);
    const host = el('accountControlsRows'); host.replaceChildren();
    for (const item of filtered.slice(page * pageSize, (page + 1) * pageSize)) {
      const card = document.createElement('article'); card.className = 'user-card';
      card.append(text('span', item.kind === 'guest' ? 'GUEST / ゲスト' : 'GOOGLE / アカウント', 'type-label' + (item.kind === 'guest' ? ' guest' : '')),
        text('h3', item.name), text('div', item.uid, 'uid'));
      if (item.requestedName && item.requestedName !== item.name) card.append(text('small', '変更指示：' + item.requestedName));
      card.append(text('p', item.lastSeen ? '最終連絡：' + new Date(item.lastSeen).toLocaleString('ja-JP') : '端末からの連絡は未記録', 'contact'));
      const devices = item.devices || [];
      const receipts = [['全体キャッシュ削除', globalCache?.id, d => d.cacheIds?.includes(globalCache.id)],
        ['ログアウト指示', item.pendingLogoutId, d => d.logoutId === item.pendingLogoutId],
        ['名前変更', item.pendingNameId, d => d.guestNameId === item.pendingNameId]];
      for (const [label, id, received] of receipts) if (id) card.append(text('small', label + '：' + devices.filter(received).length + '端末で受信済み'));
      const actions = document.createElement('div'); actions.className = 'control-actions';
      
      if (item.kind === 'account') {
        const logout = button('アプリからログアウト', () => run({action:'forceLogout', uid:item.uid}, item.name + ' にログアウト指示を送信しますか？ 未保存の変更が失われる場合があります。', 'ログアウト指示を送信しました。Google認証トークン自体は失効しません。'), item.uid === current()?.uid);
        logout.className = 'danger';
        if (item.uid === current()?.uid) logout.title = '操作中の管理者自身には実行できません';
        actions.append(logout);
      } else {
        const rename = document.createElement('div'); rename.className = 'guest-rename';
        const input = document.createElement('input'); input.maxLength = 40; input.value = item.requestedName || item.name;
        input.setAttribute('aria-label', item.name + ' の新しい参加名'); input.disabled = operation || !devices.length;
        card.append(text('small', 'ルーム参加名を変更', 'rename-label'));
        if(!devices.length) card.append(text('small', '対象ゲストがサイトを再読み込みした後、「受信状況を更新」を押してください。'));
        rename.append(input, button('参加名を変更', () => {
          const name = input.value.trim();
          if (!name || name.length > 40 || /[\x00-\x1f\x7f]/.test(name)) { status('名前は1〜40文字で入力してください。'); input.focus(); return; }
          return run({action:'renameGuest', uid:item.uid, name}, item.name + ' の名前を「' + name + '」へ変更しますか？', '名前の変更指示を送信しました。ルーム表示は対象端末が受信後に更新されます。');
        }, !devices.length)); actions.append(rename);
      }
      card.append(actions); host.append(card);
    }
    if (!filtered.length) host.append(text('p', enabled ? (kind==='guest'&&!search ? '表示できるゲストがいません。ゲストがルームに参加してサイトに接続した後、受信状況を更新してください。' : targets.length ? '条件に一致するユーザーはいません。' : '対象ユーザーはまだいません。Googleユーザーの公開プロフィールや、サイトを利用したゲスト端末がここに表示されます。') : 'ユーザー操作を利用できるか確認してください。', 'empty-state'));
    el('accountControlsPrev').disabled = page === 0;
    el('accountControlsNext').disabled = page >= pages - 1;
    el('accountControlsPage').textContent = filtered.length + '件 / ' + (page + 1) + '・' + pages + 'ページ';
    el('accountControlsAllCache').disabled = !enabled || operation;
  }
  async function run(data, question, done) {
    const user = current();
    if (!user || operation || !enabled || !window.confirm(question)) return;
    operation = true;
    section.querySelectorAll('button,input,select').forEach(node => { node.disabled = true; });
    status('処理中です…');
    try {
      await window.slAccountControlCall(data, user);
      if (current()?.uid === user.uid) { await refresh(false); status(done); }
    } catch (error) { if (current()?.uid === user.uid) status('操作できませんでした。' + error.message); }
    finally {
      operation = false;
      section.querySelectorAll('button,input,select').forEach(node => { node.disabled = false; });
      render();
    }
  }
  async function refresh(show = true) {
    const user = current(), version = ++loadVersion;
    if (!user) { targets = []; enabled = false; render(); status('管理者のGoogleアカウントでログインしてください。'); return; }
    if (show) status('ユーザーと端末の受信状況を確認しています…');
    try {
      if (typeof window.slAccountControlCall !== 'function') throw Error('通信機能を読み込めません。ページを再読み込みしてください。');
      const result = await window.slAccountControlCall({action:'list'}, user);
      if (version !== loadVersion || current()?.uid !== user.uid) return;
      enabled = result.enabled === true; targets = enabled ? result.targets || [] : []; globalCache = result.globalCache;
      render();
      if (!enabled) status('無料構成の初期設定が未完了です。GitHubの Apply free admin control rules の実行結果を確認してください。');
      else if (show) status(targets.length + '件を取得しました。端末の最終連絡はログイン履歴とは異なります。');
    } catch (error) {
      if (version === loadVersion && current()?.uid === user.uid) {
        enabled = false; targets = []; render(); status('ユーザー操作を取得できませんでした。' + error.message);
      }
    }
  }
  el('accountControlsRefresh').onclick = () => refresh();
  el('accountControlsSearch').oninput = el('accountControlsKind').onchange = () => { page = 0; render(); };
  el('accountControlsPrev').onclick = () => { page--; render(); };
  el('accountControlsNext').onclick = () => { page++; render(); };
  el('accountControlsAllCache').onclick = () => run({action:'clearCache', scope:'all'}, '全ユーザー・ゲストへ楽曲キャッシュ削除を指示しますか？ マイリスト・個人設定・ログイン情報は保持します。', '全端末へキャッシュ削除を指示しました。未接続端末は次回アクセス時に受信します。');
  window.addEventListener('sl-admin-view', event => { if (event.detail === 'controls') void refresh(); });
  window.addEventListener('sl-admin-ready', () => void refresh());
  auth.onAuthStateChanged(() => { loadVersion++; enabled = false; targets = []; globalCache = null; render(); });
  if (current()) void refresh();
})();

