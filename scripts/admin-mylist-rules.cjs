'use strict';
const ADMIN = "auth != null && auth.token.firebase.sign_in_provider === 'google.com' && root.child('admins').child(auth.uid).val() === true";
const INSERT = `(${ADMIN}) && !data.exists() && newData.exists() && $songId.matches(/^[A-Za-z0-9_-]{1,80}$/) && root.child('songs').child($songId).exists() && (root.child('publicProfiles').child($uid).exists() || root.child('adminClientControl/clients').child($uid).child('kind').val() === 'account') && newData.hasChildren(['registered','part','liked','key']) && newData.child('registered').val() === true && newData.child('part').val() === '' && newData.child('liked').val() === false && (!newData.hasChild('parts')) && newData.child('key').isNumber() && newData.child('key').val() >= -5 && newData.child('key').val() <= 6 && newData.child('key').val() % 1 === 0 && !newData.hasChild('excluded')`;
function grant(existing, added) {
  if (existing === true || existing === 'true') return existing;
  if (existing === undefined || existing === false || existing === 'false') return added;
  if (typeof existing !== 'string') throw Error('未対応のルール形式があるため適用を停止しました。');
  return existing.includes(added) ? existing : `(${existing}) || (${added})`;
}
function addMyListRules(document) {
  const users = document.rules.users;
  if (!users?.$uid || typeof users.$uid !== 'object') throw Error('既存の users/$uid ルールを確認できません。');
  const songs = users.$uid.songs ||= {};
  songs['.read'] = grant(songs['.read'], ADMIN);
  const entry = songs.$songId ||= {};
  // This only adds a per-song insert grant. It never grants a parent write,
  // so another user's existing record cannot be edited or deleted by an admin.
  entry['.write'] = grant(entry['.write'], INSERT);
  return document;
}
module.exports = {addMyListRules};
