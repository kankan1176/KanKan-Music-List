'use strict';
const assert=require('node:assert/strict');
const {transact}=require('../queue-actions.js');
function fixture(value,{error=false,delayed=false,race=null}={}){
 let warm=false,live=structuredClone(value),off=0,fn;
 const ref={on(event,callback,reject){fn=callback;if(error){queueMicrotask(()=>reject(Object.assign(Error('denied'),{code:'PERMISSION_DENIED'})));return;}if(!delayed)queueMicrotask(()=>{warm=true;callback({val:()=>live})});},off(){off++},async transaction(update){let next=update(warm?structuredClone(live):null);if(race){live=race;next=update(structuredClone(live));}if(next===undefined)return{committed:false};live=next;return{committed:true};}};
 return{ref,get value(){return live},get detached(){return off}};
}
(async()=>{
 const old=fixture({status:'confirmed',songId:'one',order:1});const previous=await old.ref.transaction(current=>current?{...current,status:'reserved'}:undefined);assert.equal(previous.committed,false);
 const fixed=fixture({status:'confirmed',songId:'one',order:1});const back=await transact(fixed.ref,current=>current?.status==='confirmed'?{...current,status:'reserved'}:undefined);assert.equal(back.committed,true);assert.equal(fixed.value.status,'reserved');assert.equal(fixed.detached,1);
 const deleted=fixture({status:'reserved',songId:'one',order:1});assert.equal((await transact(deleted.ref,()=>null)).committed,true);assert.equal(deleted.value,null);
 const concurrent=fixture({status:'confirmed',songId:'one'},{race:{status:'completed',songId:'one'}});assert.equal((await transact(concurrent.ref,current=>current?.status==='confirmed'?{...current,status:'reserved'}:undefined)).committed,false);assert.equal(concurrent.value.status,'completed');
 const differentRoom=fixture({status:'reserved'});assert.equal((await transact(differentRoom.ref,()=>null,{isCurrent:()=>false})).committed,false);assert.equal(differentRoom.value.status,'reserved');
 const denied=fixture({}, {error:true});await assert.rejects(transact(denied.ref,()=>null),e=>e.code==='PERMISSION_DENIED');assert.equal(denied.detached,1);
 const timeout=fixture({}, {delayed:true});await assert.rejects(transact(timeout.ref,()=>null,{timeoutMs:10}),e=>e.code==='QUEUE_READ_TIMEOUT');assert.equal(timeout.detached,1);
 console.log('PASS: cold-cache failure reproduced; read-before-write fixes back/delete; concurrent changes preserved; room switches, permission errors and timeouts detach listeners safely.');
})().catch(error=>{console.error(error);process.exitCode=1});
