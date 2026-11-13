const assert=require('node:assert/strict');
global.SLSheetSyncCore=require('../sheet-sync-core.js');
const S=require('../sheet-sync-service.js');
global.firebase={auth:{GoogleAuthProvider:class{addScope(){}}}};
(async()=>{
const calls=[],u={uid:'test',reauthenticateWithPopup:async()=>({credential:{accessToken:'fixture'}})},auth={currentUser:u};let status=200;
const service=S.create({auth,fetch:async raw=>{const url=new URL(raw);calls.push(url);const ranges=url.searchParams.getAll('ranges');return {ok:status===200,status,json:async()=>status===200?{sheets:[{properties:{sheetId:3},data:[{startRow:ranges[0]?.includes('501')?500:0,rowData:ranges[0]?.includes('501')?[{values:[{formattedValue:'Continued'},{},{formattedValue:'-2'}]}]:[{values:[{formattedValue:'曲名'},{formattedValue:'アーティスト'},{formattedValue:'Key'}]},{values:[{formattedValue:'First'},{formattedValue:'Artist'},{formattedValue:'2'}]},...Array.from({length:498},()=>({values:[{formattedValue:'Other'},{formattedValue:'Artist'}]}))]}]}]}:{error:{message:'upstream'}}};}});
await service.connect();const meta={sheets:[{properties:{sheetId:3,title:"Artist's songs",gridProperties:{rowCount:501,columnCount:3}}}]};
const cfg={id:3,name:"Artist's songs",enabled:true,title:'A',artist:'B',key:'C',start:2,carryArtist:true};
const rows=await service.read('sheet',[cfg],meta);assert.equal(rows.length,500);assert.equal(rows.at(-1).artist,'Artist');assert.equal(rows.at(-1).row,501);assert.equal(rows.at(-1).key,-2);assert.equal(calls[0].searchParams.get('ranges'),"'Artist''s songs'!A1:C500");
await assert.rejects(service.read('sheet',[{...cfg,start:502}],meta),/開始行/);
status=403;await assert.rejects(service.metadata('sheet'),/権限/);
status=401;await assert.rejects(service.metadata('sheet'),/許可が切れ/);
assert.throws(()=>S.spreadsheetId('not a url'),/URLを入力/);
console.log('PASS 500-row boundary, carried artist, range quoting, invalid start, auth errors');
})();
