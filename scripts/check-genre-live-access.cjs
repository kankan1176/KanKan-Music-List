'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
(async()=>{const loader=require('node:module').createRequire(path.join(__dirname,'../functions/package.json')),{initializeApp,applicationDefault,deleteApp}=loader('firebase-admin/app'),{getDatabase}=loader('firebase-admin/database'),app=initializeApp({credential:applicationDefault(),projectId:'kankan-session-room',databaseURL:'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app'}),directory=fs.mkdtempSync(path.join(os.tmpdir(),'genre-access-'));try{
 const db=getDatabase(app),rules=await db.getRulesJSON(),file=path.join(directory,'rules.json');fs.writeFileSync(file,JSON.stringify(rules),{mode:0o600});
 const meta=(await db.ref('songGenreMeta').get()).val();console.log('Production genre index version='+meta?.indexVersion+'; songCount='+meta?.songCount+'; groups='+Object.keys(meta?.groups||{}).length);
 execFileSync('tests/free-controls/node_modules/.bin/firebase',['emulators:exec','--project','demo-free-controls','--only','database','--config','tests/free-controls/firebase.json','node tests/free-controls/test-genre-query-access.cjs'],{stdio:'inherit',env:{...process.env,GENRE_RULE_TEST:file}});
 console.log('PASS: production rules inspected unchanged; production song/user/room data not modified.');
}finally{await deleteApp(app);fs.rmSync(directory,{recursive:true,force:true});}})().catch(e=>{console.error('Genre client access verification failed: '+e.message);process.exitCode=1;});
