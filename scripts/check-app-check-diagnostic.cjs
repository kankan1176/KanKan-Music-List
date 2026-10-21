const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../appcheck-test.html','utf8');
const source=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const endpoint='https://firebaseappcheck.googleapis.com/v1/projects/example/apps/example:exchangeRecaptchaEnterpriseToken';
async function run({ok=false,url=endpoint,body={},invalid=false}){
 const nodes=Object.fromEntries(['host','appcheck','dbcheck','detail'].map(id=>[id,{textContent:id==='appcheck'?'確認中…':'',className:''}]));
 let clones=0,reads=0,fetches=0;
 const response={ok,status:ok?200:403,clone(){clones++;return{async json(){if(invalid)throw Error('not JSON');return body;}};}};
 const originalFetch=async()=>{fetches++;return response;};
 const window={fetch:originalFetch};
 const context={window,URL,String,Array,document:{getElementById:id=>nodes[id]},location:{hostname:'kankan1176.com'},console:{error(){}},firebase:{initializeApp:()=>({}),database:()=>({ref:()=>({async once(){reads++;return{val:()=>1};}})})},SLAppCheck:{activate:()=>({async getToken(){const result=await window.fetch(url);assert.equal(result,response);if(!ok)throw{code:'appCheck/throttled',message:'synthetic throttle'};return{token:'synthetic-token-never-display'};}})}};
 const result=vm.runInNewContext(source,context);await result;
 assert.equal(window.fetch,originalFetch);assert.equal(fetches,1);
 return {nodes,clones,reads};
}
(async()=>{
 let r=await run({body:{error:{status:'PERMISSION_DENIED',message:'App attestation failed.',details:[{reason:'API_KEY_SERVICE_BLOCKED',metadata:{private:'DO_NOT_DISPLAY'}}],token:'DO_NOT_DISPLAY'}}});
 assert.match(r.nodes.detail.textContent,/HTTP: 403/);assert.match(r.nodes.detail.textContent,/App attestation failed/);assert.match(r.nodes.detail.textContent,/API_KEY_SERVICE_BLOCKED/);assert.ok(!r.nodes.detail.textContent.includes('DO_NOT_DISPLAY'));assert.equal(r.reads,0);assert.equal(r.nodes.dbcheck.textContent,'未実行（認証に失敗）');
 r=await run({body:{error:{message:'eyJabc.def.ghi'}}});assert.ok(!r.nodes.detail.textContent.includes('eyJabc.def.ghi'));assert.match(r.nodes.detail.textContent,/redacted/);
 r=await run({ok:true,body:{token:'DO_NOT_DISPLAY'}});assert.equal(r.clones,0);assert.equal(r.reads,1);assert.equal(r.nodes.appcheck.textContent,'成功');assert.ok(!r.nodes.detail.textContent.includes('synthetic-token-never-display'));
 r=await run({url:'https://unrelated.example/test',body:{error:{message:'DO_NOT_DISPLAY'}}});assert.equal(r.clones,0);assert.ok(!r.nodes.detail.textContent.includes('DO_NOT_DISPLAY'));
 r=await run({invalid:true});assert.match(r.nodes.detail.textContent,/synthetic throttle/);
 console.log('PASS: original 403 reason captured, no extra requests or DB read on failure, tokens/unrelated data excluded, invalid JSON tolerated, fetch restored, success unchanged');
})().catch(error=>{console.error(error);process.exit(1)});
