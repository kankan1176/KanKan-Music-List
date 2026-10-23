'use strict';
const assert=require('node:assert/strict'),core=require('../genre-index-reader.js');
function fixture(){
 const indexKey='demo',maps={},reads=[];
 for(let i=0;i<705;i++){const id='s'+String(i).padStart(4,'0'),key=String(i).padStart(8,'0')+'_'+id;for(const [field,label]of [['genre1',i%2?'洋楽':'J-POP'],['genre2',i%3?'ゲーム':'TV（CM・バラエティ）主題歌'],['genre3',i%7?'ロック':'合唱'],['genre4',i===600?'ジャンプ':''],['genre5',i===600?'ジャンプ':'']])if(label)(maps[core.encode(field+'::'+label)]??={})[key]=id;}
 function ref(path,options={}){return{orderByKey:()=>ref(path,{...options,ordered:true}),startAt:key=>ref(path,{...options,start:key,inclusive:true}),startAfter:key=>ref(path,{...options,start:key,inclusive:false}),limitToFirst:n=>ref(path,{...options,limit:n}),async once(){reads.push({path,...options});if(!options.ordered||!options.limit||options.limit>100)throw Error('PERMISSION_DENIED');const entries=Object.entries(maps[path.split('/').at(-1)]||{}).sort(([a],[b])=>a<b?-1:a>b?1:0).filter(([key])=>!options.start|| (options.inclusive?key>=options.start:key>options.start)).slice(0,options.limit);return{forEach(fn){for(const [key,id]of entries)fn({key,val:()=>id});}};}};}
 return{db:{ref},indexKey,reads,maps};
}
(async()=>{const f=fixture();
 // Reproduce both rejected requests from the previous implementation.
 await assert.rejects(f.db.ref('songGenreRows/demo/x').orderByKey().limitToFirst(101).once('value'),/PERMISSION/);
 await assert.rejects(f.db.ref('songGenreRows/demo/x').once('value'),/PERMISSION/);f.reads.length=0;
 const selection={genre1:'J-POP'},first=await core.page(f.db,f.indexKey,selection),second=await core.page(f.db,f.indexKey,selection,{after:first.cursor});assert.equal(first.rows.length,100);assert(first.hasNext);assert.equal(second.rows.length,100);assert(!second.rows.some(row=>first.rows.some(old=>row.id===old.id)));
 const replay=await core.page(f.db,f.indexKey,selection);assert.deepEqual(replay,first);
 let after='',ids=[];for(;;){const result=await core.page(f.db,f.indexKey,{genre1:'J-POP',genre2:'TV（CM・バラエティ）主題歌'},{after});ids.push(...result.rows.map(r=>r.id));after=result.cursor;if(!result.hasNext)break;}
 const expected=Array.from({length:705},(_,i)=>i).filter(i=>i%6===0).map(i=>'s'+String(i).padStart(4,'0'));assert.deepEqual(ids,expected);assert.equal(new Set(ids).size,ids.length);
 const all=await core.page(f.db,f.indexKey,{genre1:'J-POP',genre2:'TV（CM・バラエティ）主題歌',genre3:'ロック',genre4:'ジャンプ',genre5:'ジャンプ'});assert.deepEqual(all.rows.map(r=>r.id),['s0600']);assert(!all.hasNext);
 const none=await core.page(f.db,f.indexKey,{genre1:'洋楽',genre4:'ジャンプ'});assert.equal(none.rows.length,0);
 await assert.rejects(core.page(f.db,f.indexKey,selection,{current:()=>false}),e=>e.code==='genre/cancelled');
 assert(f.reads.every(r=>r.ordered&&r.limit<=100));assert.equal(core.encode('genre2::TV（CM・バラエティ）主題歌'),Buffer.from('genre2::TV（CM・バラエティ）主題歌').toString('hex'));
 console.log('PASS: reproduced 101-row and unbounded query rejection; single/AND pagination returns all matches without duplicates using only ordered reads <=100, Unicode labels, empty results and cancellation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
