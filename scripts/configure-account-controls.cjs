'use strict';
const fs=require('node:fs');
const GUARD="(auth == null || !root.child('adminControl/revocations').child(auth.uid).exists() || auth.token.auth_time > root.child('adminControl/revocations').child(auth.uid).val())";
function mergeRules(original){
 const document=JSON.parse(JSON.stringify(original));
 if(!document.rules||typeof document.rules!=='object')throw Error('Realtime DatabaseルールJSONを指定してください。');
 function visit(node){for(const [key,value]of Object.entries(node)){
  if(key==='.read'||key==='.write'){
   if(value===false||value==='false')continue;
   if(typeof value!=='boolean'&&typeof value!=='string')throw Error('未対応のルール形式です。');
   if(String(value).includes("root.child('adminControl/revocations')"))continue;
   node[key]='('+String(value)+') && '+GUARD;
  }else if(value&&typeof value==='object'&&!key.startsWith('.'))visit(value);
 }}
 visit(document.rules);
 // Commands, presence and revocation times are accessible only through the trusted function.
 // A granting ancestor cannot be overridden by a denying child in RTDB rules.
 for(const permission of ['.read','.write']){const root=document.rules[permission];if(root!==undefined&&root!==false&&root!=='false')throw Error('ルートに許可ルールがあります。adminControlを保護できないため自動適用を停止しました。');}
 document.rules.adminControl={'.read':false,'.write':false};
 return document;
}
async function main(){
 const args=process.argv.slice(2),apply=args.includes('--apply');
 const input=args.find(a=>a!=='--apply');
 if(input){const updated=mergeRules(JSON.parse(fs.readFileSync(input,'utf8')));process.stdout.write(JSON.stringify(updated,null,2)+'\n');return;}
 const path=require('node:path');
 const requireFunctions=require('node:module').createRequire(path.join(__dirname,'../functions/package.json'));
 const {initializeApp,applicationDefault}=requireFunctions('firebase-admin/app');
 const {getDatabase}=requireFunctions('firebase-admin/database');
 initializeApp({credential:applicationDefault(),projectId:'kankan-session-room',databaseURL:'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app'});
 const database=getDatabase();
 const current=await database.getRulesJSON();
 const updated=mergeRules(current);
 fs.mkdirSync('.account-controls-backup',{recursive:true});
 const backup='.account-controls-backup/rules-'+Date.now()+'.json';fs.writeFileSync(backup,JSON.stringify(current,null,2)+'\n',{mode:0o600});
 if(!apply){console.log('既存ルールのバックアップ: '+backup);console.log('適用するには --apply を付けて実行してください。');return;}
 const canonical=value=>JSON.stringify(Array.isArray(value)?value.map(item=>JSON.parse(canonical(item))):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,JSON.parse(canonical(value[key]))])):value);
 if(canonical(await database.getRulesJSON())!==canonical(current))throw Error('確認中にルールが変更されました。適用を停止しました。');
 await database.setRules(updated);
 const applied=await database.getRulesJSON();
 if(canonical(applied)!==canonical(updated))throw Error('適用後のルールが一致しません。機能は有効化していません。');
 await database.ref('adminControl/config').set({enabled:true,securityRulesVersion:1,configuredAt:Date.now()});
 console.log('既存ルールを保ったまま認証失効チェックを追加し、管理機能を有効化しました。バックアップ: '+backup);
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={mergeRules,GUARD};
