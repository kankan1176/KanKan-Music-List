'use strict';
const fs = require('node:fs');
const {mergeFreeRules} = require('./free-control-rules.cjs');
const canonical = value => JSON.stringify(Array.isArray(value) ? value.map(item => JSON.parse(canonical(item))) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(canonical(value[key]))])) : value);
async function main() {
  const input = process.argv[2];
  if (input && input !== '--apply') { process.stdout.write(JSON.stringify(mergeFreeRules(JSON.parse(fs.readFileSync(input, 'utf8'))), null, 2) + '\n'); return; }
  const fromFunctions = require('node:module').createRequire(require('node:path').join(__dirname, '../functions/package.json'));
  const {initializeApp, applicationDefault, deleteApp} = fromFunctions('firebase-admin/app');
  const {getDatabase} = fromFunctions('firebase-admin/database');
  const app = initializeApp({credential:applicationDefault(), projectId:'kankan-session-room', databaseURL:'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app'});
  try {
  const database = getDatabase();
  const original = await database.getRulesJSON();
  const updated = mergeFreeRules(original);
  fs.mkdirSync('.account-controls-backup', {recursive:true});
  fs.writeFileSync('.account-controls-backup/free-rules-' + Date.now() + '.json', JSON.stringify(original, null, 2), {mode:0o600});
  if (input !== '--apply') { console.log('バックアップを保存しました。ルールとデータは変更していません。'); return; }
  if (canonical(original) !== canonical(await database.getRulesJSON())) throw Error('既存ルールが変更されたため適用を停止しました。');
  await database.setRules(updated);
  if (canonical(updated) !== canonical(await database.getRulesJSON())) throw Error('ルールの一致を確認できません。機能は有効化していません。');
  // Preserve a deliberate pause after initialization; do not re-enable on every push.
  const ref = database.ref('adminClientControl/config');
  const result = await ref.transaction(current => current || {enabled:true, version:1});
  if (!result.snapshot.val() || result.snapshot.val().version !== 1) throw Error('設定のバージョンを確認してください。');
  console.log('無料構成のルールを適用しました。課金プラン・API・Cloud Functionsには変更を加えていません。');
  } finally { await deleteApp(app); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
