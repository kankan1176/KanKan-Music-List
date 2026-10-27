const {addChordWikiPreferenceRules}=require('./chordwiki-preference-rules.cjs');
const {addAdminListDesignRules}=require('./admin-list-design-rules.cjs');
const {addGenreRules}=require('./genre-rules.cjs');
const {addAccountFeatureRules}=require('./account-feature-rules.cjs');
const {addHighPriorityRules}=require('./high-priority-rules.cjs');
const {addObsSceneRules}=require('./obs-scene-rules.cjs');
const {addAvatarRules}=require('./avatar-rules.cjs');
const {addListShareRules}=require('./list-share-rules.cjs');
const {addAccountNameRules}=require('./account-name-rules.cjs');
'use strict';
const {addMyListRules} = require('./admin-mylist-rules.cjs');
const ADMIN = "auth != null && auth.token.firebase.sign_in_provider === 'google.com' && root.child('admins').child(auth.uid).val() === true";
function commandRule(write, guest = false) {
  return {
    '.write': write,
    '.validate': "newData.hasChildren(['id','issuedAt'" + (guest ? ",'name'" : '') + "])",
    id: { '.validate': 'newData.isString() && newData.val().matches(/^[A-Za-z0-9_-]{8,80}$/)' },
    issuedAt: { '.validate': 'newData.isNumber() && newData.val() === now' },
    ...(guest ? { name: { '.validate': "newData.isString() && newData.val().length > 0 && newData.val().length <= 40 && newData.val().matches(/^[^\\x00-\\x1f\\x7f]+$/)" } } : {}),
    '$other': { '.validate': false }
  };
}
function freeRules() {
  const ack = { '.validate': 'newData.isString() && newData.val().matches(/^[A-Za-z0-9_-]{8,80}$/)' };
  return {
    '.read': false, '.write': false,
    config: { '.read': true, '.write': ADMIN, '.validate': "newData.hasChildren(['enabled','version'])", enabled: { '.validate': 'newData.isBoolean()' }, version: { '.validate': 'newData.val() === 1' }, '$other': { '.validate': false } },
    globalCache: { '.read': true, ...commandRule(ADMIN) },
    userCommands: {
      '.read': ADMIN,
      '$uid': {
        '.read': 'auth != null && auth.uid === $uid',
        cache: commandRule(ADMIN),
        logout: commandRule(`(${ADMIN}) && auth.uid !== $uid`),
        guestName: commandRule(`(${ADMIN}) && root.child('adminClientControl/clients').child($uid).child('kind').val() === 'guest'`, true),
        '$other': { '.validate': false }
      }
    },
    clients: {
      '.read': ADMIN,
      '$uid': {
        '.read': 'auth != null && auth.uid === $uid',
        '.write': "auth != null && auth.uid === $uid && (auth.token.firebase.sign_in_provider === 'google.com' || auth.token.firebase.sign_in_provider === 'anonymous') && newData.exists()",
        '.validate': "newData.hasChildren(['kind','name','lastSeen','devices'])",
        kind: { '.validate': "(newData.val() === 'guest' && auth.token.firebase.sign_in_provider === 'anonymous') || (newData.val() === 'account' && auth.token.firebase.sign_in_provider === 'google.com')" },
        name: { '.validate': 'newData.isString() && newData.val().length <= 40' },
        lastSeen: { '.validate': 'newData.isNumber() && newData.val() === now' },
        devices: {
          '$device': {
            '.validate': "$device.matches(/^[A-Za-z0-9_-]{8,80}$/) && newData.hasChild('lastSeen')",
            lastSeen: { '.validate': 'newData.isNumber() && newData.val() <= now' },
            cacheIds: { '0': ack, '1': ack, '$other': { '.validate': false } },
            guestNameId: ack, logoutId: ack, '$other': { '.validate': false }
          }
        },
        '$other': { '.validate': false }
      }
    },
    '$other': { '.validate': false }
  };
}
function mergeFreeRules(original) {
  const result = structuredClone(original);
  if (!result.rules || typeof result.rules !== 'object') throw Error('既存のデータベースルールがありません。');
  for (const key of ['.read', '.write']) if (![undefined, false, 'false'].includes(result.rules[key])) throw Error('ルートに包括的な許可があるため、安全な自動適用を停止しました。');
  if (Object.keys(result.rules).some(key => key.startsWith('$'))) throw Error('ルートのワイルドカードを確認する必要があります。自動適用を停止しました。');
  // Preserve existing grants and add only the administrator song-list read/insert permissions.
  result.rules.adminClientControl = freeRules();
  return addAdminListDesignRules(addChordWikiPreferenceRules(addGenreRules(addAccountFeatureRules(addHighPriorityRules(addObsSceneRules(addAvatarRules(addListShareRules(addAccountNameRules(addMyListRules(result))))))))));
}
module.exports = { freeRules, mergeFreeRules };





