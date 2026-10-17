/* Spark-compatible account controls. Authorization is enforced by RTDB rules. */
(() => {
  'use strict';
  const root = 'adminClientControl';
  const serverTime = () => firebase.database.ServerValue.TIMESTAMP;
  const read = async path => (await db.ref(path).once('value')).val();
  const fail = message => { throw new Error(message); };
  const uidOK = uid => typeof uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(uid);
  const sameUser = user => auth.currentUser?.uid === user?.uid;
  async function requireAdmin(user) {
    if (!user || !sameUser(user) || user.isAnonymous) fail('管理者のGoogleログインが必要です。');
    const token = await user.getIdTokenResult();
    if (token.claims.firebase?.sign_in_provider !== 'google.com' || await read('admins/' + user.uid) !== true) fail('管理者権限がありません。');
  }
  async function targets() {
    const [profiles, rooms, clients, commands] = await Promise.all(['publicProfiles', 'rooms', root + '/clients', root + '/userCommands'].map(read));
    const map = new Map();
    for (const [uid, p] of Object.entries(profiles || {})) if (uidOK(uid)) map.set(uid, { uid, kind: 'account', name: String(p?.displayName || '未設定') });
    for (const room of Object.values(rooms || {})) for (const member of Object.values(room?.members || {})) {
      if (member?.guest === true && uidOK(member.uid) && !map.has(member.uid)) map.set(member.uid, { uid: member.uid, kind: 'guest', name: String(member.name || 'ゲスト') });
    }
    for (const [uid, client] of Object.entries(clients || {})) {
      if (!uidOK(uid)) continue;
      // Only the authenticated owner can publish this registry entry; kind is checked against its token in rules.
      const devices = Object.values(client.devices || {});
      const item = map.get(uid) || { uid };
      Object.assign(item, { kind: client.kind, name: (client.kind === 'account' ? profiles?.[uid]?.displayName : null) || client.name || item.name || '未設定', lastSeen: client.lastSeen, devices });
      map.set(uid, item);
    }
    for (const item of map.values()) {
      const command = commands?.[item.uid];
      item.pendingCacheId = command?.cache?.id || null;
      item.pendingNameId = command?.guestName?.id || null;
      item.pendingLogoutId = command?.logout?.id || null;
      if (item.kind === 'guest') item.requestedName = command?.guestName?.name;
    }
    return [...map.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'ja'));
  }
  async function report(user, data) {
    if (!user || !sameUser(user) || !/^[A-Za-z0-9_-]{8,80}$/.test(data.deviceId || '')) return;
    const own = await read(root + '/clients/' + user.uid) || {};
    if (!sameUser(user)) return;
    const record = { lastSeen: serverTime(), cacheIds: (data.applied?.cacheIds || []).slice(-2) };
    if (data.applied?.guestNameId) record.guestNameId = data.applied.guestNameId;
    if (data.applied?.logoutId) record.logoutId = data.applied.logoutId;
    const changes = { kind: user.isAnonymous ? 'guest' : 'account', name: String(data.name || '').slice(0, 40), lastSeen: serverTime(), ['devices/' + data.deviceId]: record };
    const others = Object.entries(own.devices || {}).filter(([id]) => id !== data.deviceId).sort((a, b) => (b[1].lastSeen || 0) - (a[1].lastSeen || 0));
    for (const [id] of others.slice(9)) changes['devices/' + id] = null;
    await db.ref(root + '/clients/' + user.uid).update(changes);
  }
  window.slAccountControlCall = async (data, user) => {
    if (data.action === 'poll') {
      const config = await read(root + '/config');
      if (config?.enabled !== true || config.version !== 1) return { enabled: false };
      const [globalCache, own] = await Promise.all([read(root + '/globalCache'), user && sameUser(user) ? read(root + '/userCommands/' + user.uid) : null]);
      if (user && !sameUser(user)) return { enabled: false };
      await report(user, data);
      let logout = null;
      if (user && !user.isAnonymous && own?.logout) {
        const token = await user.getIdTokenResult();
        if (Number(token.claims.auth_time) <= Math.floor(own.logout.issuedAt / 1000)) logout = own.logout;
      }
      return { enabled: true, cacheCommands: [globalCache, own?.cache].filter(Boolean), guestName: user?.isAnonymous ? own?.guestName || null : null, logout };
    }
    if (data.action === 'ackLogout') { await report(user, data); return {}; }
    await requireAdmin(user);
    const config = await read(root + '/config');
    const enabled = config?.enabled === true && config.version === 1;
    if (data.action === 'list') return { enabled, targets: enabled ? await targets() : [], globalCache: enabled ? await read(root + '/globalCache') : null };
    if (!enabled) fail('Firebaseの無料構成用ルールが未適用です。');
    const command = { id: crypto.randomUUID(), issuedAt: serverTime() };
    if (data.action === 'clearCache' && data.scope === 'all') {
      await db.ref(root + '/globalCache').set(command); return { command };
    }
    if (!uidOK(data.uid)) fail('対象ユーザーIDが不正です。');
    if (data.action === 'renameAccount') {
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (!name || name.length > 40 || /[\x00-\x1f\x7f]/.test(name)) fail('名前は1〜40文字で入力してください。');
      const [profile, client] = await Promise.all([read('publicProfiles/' + data.uid), read(root + '/clients/' + data.uid)]);
      if (!profile && client?.kind !== 'account') fail('Googleログインユーザーを確認できません。');
      const friendName = await read('friendProfiles/' + data.uid + '/displayName');
      if (!sameUser(user)) fail('ログイン状態が変更されました。');
      const changes = { ['users/' + data.uid + '/profile/displayName']: name };
      if (profile?.displayName != null) changes['publicProfiles/' + data.uid + '/displayName'] = name;
      if (friendName != null) changes['friendProfiles/' + data.uid + '/displayName'] = name;
      await db.ref().update(changes);
      return { name };
    }
    let type;
    if (data.action === 'clearCache') type = 'cache';
    else if (data.action === 'forceLogout') {
      if (data.uid === user.uid) fail('操作中の管理者自身はログアウト対象にできません。');
      type = 'logout';
    } else if (data.action === 'renameGuest') {
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (!name || name.length > 40 || /[\x00-\x1f\x7f]/.test(name)) fail('名前は1〜40文字で入力してください。');
      command.name = name; type = 'guestName';
    } else fail('未対応の操作です。');
    await db.ref(root + '/userCommands/' + data.uid + '/' + type).set(command);
    return { command };
  };
  window.slWatchAccountControls = (user, changed) => {
    const refs = [root + '/config', root + '/globalCache'];
    if (user) refs.push(root + '/userCommands/' + user.uid);
    const listeners = refs.map(path => { const ref = db.ref(path), listener = () => changed(); ref.on('value', listener, () => {}); return () => ref.off('value', listener); });
    return () => listeners.forEach(stop => stop());
  };
})();

