'use strict';
const assert=require('node:assert/strict'),createFeed=require('../admin-request-feed.js');
(async()=>{
 const watches=[],sources=new Map(),snapshot=value=>({val:()=>value});let authorized=true,changes=0;
 const database={ref(path){return{on(event,receive,fail){const watch={path,receive,fail};watches.push(watch);sources.set(path,watch);},off(event,receive){const watch=watches.find(w=>w.receive===receive);if(watch)watch.detached=true;}};}};
 const feed=createFeed(database,()=>authorized,()=>changes++);
 const first=feed.read();sources.get('songAddRequests').receive(snapshot({request:'new song'}));sources.get('songEditRequests').fail(Error('denied'));
 const partial=await first;assert.deepEqual(partial.snapshots[0].val(),{request:'new song'});assert.equal(partial.errors.length,1);assert.match(partial.errors[0],/編集申請/);
 const stale=sources.get('songEditRequests');feed.refresh();const refreshed=feed.read();stale.receive(snapshot({stale:true}));sources.get('songAddRequests').receive(snapshot({request:'new song'}));sources.get('songEditRequests').receive(snapshot({edit:'artist'}));const complete=await refreshed;assert.deepEqual(complete.errors,[]);assert.deepEqual(complete.snapshots[1].val(),{edit:'artist'});
 sources.get('songAddRequests').receive(snapshot({request:'new song',later:'second song'}));assert.equal((await feed.read()).snapshots[0].val().later,'second song');
 await new Promise(resolve=>setTimeout(resolve,180));assert.equal(changes,1,'rapid changes should produce one UI refresh');
 feed.refresh();const waiting=feed.read();feed.close();assert.deepEqual(await waiting,{snapshots:[],errors:[]});assert.ok(watches.every(w=>w.detached));const previous=changes;sources.get('songAddRequests').receive(snapshot({late:true}));await new Promise(resolve=>setTimeout(resolve,180));assert.equal(changes,previous);
 authorized=false;const count=watches.length,denied=createFeed(database,()=>authorized,()=>{});assert.equal(watches.length,count,'unauthorized clients must not subscribe');assert.deepEqual(await denied.read(),{snapshots:[],errors:[]});denied.close();
 console.log('PASS: partial failures, retry, live updates, stale responses, logout cleanup and administrator-only subscriptions');
})().catch(error=>{console.error(error);process.exitCode=1;});
