const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function fixture(storage){
 const state={'masterMeta/revision':'r1','adminClientControl/globalCache':null,'songs/a':{title:'Song A',artist:'Artist',chordwiki:'https://ja.chordwiki.org/wiki/A',email:'private@example.test',registered:true,key:3,parts:['Guitar']}};
 const watchers=new Map(),reads=[],events=new Map();let rejectNext=false,delay=null;
 const window={addEventListener:(type,fn)=>events.set(fn,type),removeEventListener:(type,fn)=>events.delete(fn)};
 if(storage==='throws')Object.defineProperty(window,'indexedDB',{get(){throw Error('storage blocked');}});
 const context={window,console,Blob,WeakMap,Map,Set,Object,Promise,Date,JSON,Error,setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(path.join(root,'list-master-cache.js'),'utf8'),context);
 const database={ref(p){return{on(event,fn){if(!watchers.has(p))watchers.set(p,new Set());watchers.get(p).add(fn);queueMicrotask(()=>fn({val:()=>state[p]??null}));},off(event,fn){watchers.get(p)?.delete(fn);},async once(){reads.push(p);if(delay)await delay;if(rejectNext){rejectNext=false;throw Error('synthetic network failure');}return{val:()=>state[p]??null};}};}};
 return {database,state,reads,cache:window.SLListMasterCache,emit(p,value){state[p]=value;for(const fn of watchers.get(p)||[])fn({val:()=>value});},storage(value){for(const[fn,type]of events)if(type==='storage')fn({key:'sharelistscore_mylist_cache_epoch',newValue:value});},fail(){rejectNext=true;},delay(value){delay=value;},listeners:()=>[...watchers.values()].reduce((n,set)=>n+set.size,0)};
}
(async()=>{
 const f=fixture(),a=f.cache.forOwner(f.database,'owner-a');assert.equal(f.cache.forOwner(f.database,'owner-a'),a);
 const results=await Promise.all(Array.from({length:30},()=>a.get('a')));assert.equal(f.reads.length,1);assert.equal(results[0].title,'Song A');assert.deepEqual(Object.keys(results[0]).sort(),['artist','chordwiki','title']);assert.ok(!JSON.stringify(results).includes('private@example.test'));
 await a.get('missing');await a.get('missing');assert.equal(f.reads.filter(p=>p==='songs/missing').length,1);
 let changed=0;const stop=a.subscribe(()=>changed++);f.emit('masterMeta/revision','r2');await a.get('a');assert.equal(changed,1);assert.equal(f.reads.filter(p=>p==='songs/a').length,2);
 f.emit('adminClientControl/globalCache',{id:'clear-1'});await a.get('a');assert.equal(changed,2);assert.equal(f.reads.filter(p=>p==='songs/a').length,3);
 f.storage('clear-1');await a.get('a');assert.equal(changed,2);assert.equal(f.reads.filter(p=>p==='songs/a').length,3);
 f.storage('clear-2');await a.get('a');assert.equal(changed,3);f.emit('adminClientControl/globalCache',{id:'clear-2'});await a.get('a');assert.equal(changed,3);assert.equal(f.reads.filter(p=>p==='songs/a').length,4);
 f.fail();await assert.rejects(()=>a.get('retry'));await a.get('retry');assert.equal(f.reads.filter(p=>p==='songs/retry').length,2);
 const b=f.cache.forOwner(f.database,'owner-b');await b.get('a');assert.equal(f.reads.filter(p=>p==='songs/a').length,5);stop();await a.forget();await assert.rejects(()=>a.get('a'));assert.equal(f.listeners(),2);await b.forget();assert.equal(f.listeners(),0);
 const g=fixture('throws'),c=g.cache.forOwner(g.database,'owner');assert.equal((await c.get('a')).title,'Song A');await c.forget();
 const h=fixture(),d=h.cache.forOwner(h.database,'owner');let finish;h.delay(new Promise(resolve=>finish=resolve));const pending=d.get('a');await new Promise(resolve=>setImmediate(resolve));await d.forget();finish();await assert.rejects(()=>pending);
 for(const file of ['mylist.js','mylist-actions.js','list-share-service.js','list-master-cache.js','list-share-i18n.js','admin-client-controls.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'));
 assert.ok(f.reads.every(p=>p.startsWith('songs/')));
 console.log('PASS: concurrent master requests coalesced, only public fields returned, missing-song caching, revision/admin invalidation, failed-request retry, account isolation, logout cancellation, storage-denied fallback and script syntax');
})().catch(error=>{console.error(error);process.exitCode=1});
