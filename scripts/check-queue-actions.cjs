'use strict';
const assert=require('node:assert/strict');
const {transact,swapOrders}=require('../queue-actions.js');
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
 const queue={a:{status:'reserved',songId:'one',order:10,keyOffset:2},b:{status:'reserved',songId:'two',order:20},c:{status:'confirmed',songId:'three',order:30}};
 function swapFixture(value,{deny=false}={}){const f=fixture(value);let writes=0;f.ref.update=async patch=>{if(deny)throw Object.assign(Error('denied'),{code:'PERMISSION_DENIED'});writes++;assert.deepEqual(patch,{'a/order':20,'b/order':10});for(const[path,value]of Object.entries(patch)){const[id,key]=path.split('/');f.value[id][key]=value;}};return{...f,ref:f.ref,get value(){return f.value},get detached(){return f.detached},get writes(){return writes}};}
 const options={status:'reserved',orderA:10,orderB:20};
 const swapped=swapFixture(queue);assert.equal((await swapOrders(swapped.ref,'a','b',options)).committed,true);assert.equal(swapped.writes,1);assert.equal(swapped.value.a.order,20);assert.equal(swapped.value.b.order,10);assert.equal(swapped.value.a.keyOffset,2);assert.deepEqual(swapped.value.c,queue.c);assert.equal(swapped.detached,1);
 for(const value of [{...queue,b:{...queue.b,status:'completed'}},{...queue,b:{...queue.b,order:21}},{a:queue.a}]){const f=swapFixture(value);assert.equal((await swapOrders(f.ref,'a','b',options)).committed,false);assert.equal(f.writes,0);assert.equal(f.detached,1);}
 const switched=swapFixture(queue);assert.equal((await swapOrders(switched.ref,'a','b',{...options,isCurrent:()=>false})).committed,false);assert.equal(switched.writes,0);
 const blocked=swapFixture(queue,{deny:true});await assert.rejects(swapOrders(blocked.ref,'a','b',options),e=>e.code==='PERMISSION_DENIED');assert.deepEqual(blocked.value,queue);assert.equal(blocked.detached,1);
 const waiting=fixture(queue,{delayed:true});await assert.rejects(swapOrders(waiting.ref,'a','b',{...options,timeoutMs:10}),e=>e.code==='QUEUE_READ_TIMEOUT');assert.equal(waiting.detached,1);
 console.log('PASS: reorder updates exactly two order fields atomically; stale/deleted/status-changed records and switched rooms abort; errors and timeouts clean up listeners.');
 console.log('PASS: cold-cache failure reproduced; read-before-write fixes back/delete; concurrent changes preserved; room switches, permission errors and timeouts detach listeners safely.');
})().catch(error=>{console.error(error);process.exitCode=1});
