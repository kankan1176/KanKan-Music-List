/* Shared public-song lookups. Personal registrations, keys and parts are never persisted. */
(() => {
 'use strict';
 const databaseName='share-list-score-mylist-master-v2',storeName='owners',instances=new WeakMap();
 const epochKey='sharelistscore_mylist_cache_epoch',uidOK=value=>/^[A-Za-z0-9_-]{1,128}$/.test(value||'');
 async function disk(mode,uid,value,valid=()=>true){
  try{if(!window.indexedDB)return null;}catch{return null;}
  return new Promise(resolve=>{
   let finished=false;const finish=value=>{if(!finished){finished=true;resolve(value);}};
   let request;try{request=indexedDB.open(databaseName,1);}catch{finish(null);return;}
   request.onupgradeneeded=()=>request.result.createObjectStore(storeName);
   request.onerror=()=>finish(null);request.onblocked=()=>finish(null);
   request.onsuccess=()=>{
    const db=request.result;if(finished||!valid()){db.close();finish(null);return;}db.onversionchange=()=>db.close();
    try{const tx=db.transaction(storeName,mode==='get'?'readonly':'readwrite'),store=tx.objectStore(storeName);let result=null;
     const op=mode==='get'?store.get(uid):mode==='put'?store.put(value,uid):mode==='clear'?store.clear():store.delete(uid);
     op.onsuccess=()=>{result=op.result;};tx.oncomplete=()=>{db.close();finish(result);};tx.onabort=tx.onerror=()=>{db.close();finish(null);};
    }catch{db.close();finish(null);}
   };
  });
 }
 const safeMaster=value=>value&&typeof value.title==='string';
 const publicMaster=value=>Object.fromEntries(['title','artist','chordwiki','genre','genre1','genre2','genre3','genre4','genre5','ジャンル','ジャンル2','ジャンル3'].filter(key=>typeof value[key]==='string').map(key=>[key,value[key].slice(0,key==='chordwiki'?2048:1000)]));
 function forOwner(database,uid){
  if(!uidOK(uid))throw Error('Invalid owner');
  let owners=instances.get(database);if(!owners){owners=new Map();instances.set(database,owners);}if(owners.has(uid))return owners.get(uid);
  const values=new Map(),pending=new Map(),subscribers=new Set(),stops=[];
  let closed=false,generation=0,timer,revision,controlId,haveRevision=false,haveControl=false,lastClearId='';
  let resolveRevision,resolveControl;
  const revisionReady=new Promise(resolve=>resolveRevision=resolve),controlReady=new Promise(resolve=>resolveControl=resolve);
  const stored=disk('get',uid);
  const notify=()=>{for(const callback of subscribers)callback();};
  function invalidate(){generation++;values.clear();pending.clear();clearTimeout(timer);void disk('delete',uid);notify();}
  function watch(path,receive,fail){const ref=database.ref(path),fn=s=>{if(!closed)receive(s.val());};ref.on('value',fn,error=>{if(!closed)fail(error);});stops.push(()=>ref.off('value',fn));}
  watch('masterMeta/revision',value=>{
   const next=typeof value==='string'||typeof value==='number'?value:null;
   if(haveRevision&&next!==revision){revision=next;invalidate();}else revision=next;
   if(!haveRevision){haveRevision=true;resolveRevision();}
  },()=>{if(!haveRevision){revision=undefined;haveRevision=true;resolveRevision();}});
  watch('adminClientControl/globalCache',value=>{
   const next=typeof value?.id==='string'?value.id:'';
   if(haveControl&&next!==controlId){controlId=next;if(lastClearId!==next){lastClearId=next;invalidate();}}else{controlId=next;lastClearId=next;}
   if(!haveControl){haveControl=true;resolveControl();}
  },()=>{if(!haveControl){controlId=undefined;haveControl=true;resolveControl();}});
  const warm=Promise.all([stored,controlReady]).then(([saved])=>{
   if(closed||generation||!saved||controlId===undefined||saved.controlId!==controlId||!Number.isFinite(saved.at)||saved.at>Date.now()+60000||Date.now()-saved.at>7*86400000)return;
   for(const[id,master]of Object.entries(saved.songs||{}))if(uidOK(id)&&safeMaster(master))values.set(id,publicMaster(master));
  });
  const ready=Promise.all([warm,revisionReady]).then(async()=>{
   const saved=await stored;
   if(revision===undefined||saved?.revision!==revision){values.clear();await disk('delete',uid);}
  });
  function save(){clearTimeout(timer);const version=generation;timer=setTimeout(async()=>{
   await ready;if(closed||version!==generation||revision===undefined||controlId===undefined)return;
   const snapshot={revision,controlId,at:Date.now(),songs:Object.fromEntries([...values].filter(([,value])=>value))};
   if(new Blob([JSON.stringify(snapshot)]).size<=2_000_000)await disk('put',uid,snapshot,()=>!closed&&version===generation);
  },80);}
  async function get(id){
   await ready;if(closed)throw Error('Closed song cache');if(!uidOK(id))return null;
   if(values.has(id))return values.get(id);if(pending.has(id))return pending.get(id);
   const version=generation;
   const promise=database.ref('songs/'+id).once('value').then(snapshot=>{
    if(closed)throw Error('Closed song cache');if(version!==generation)return get(id);
    const raw=snapshot.val(),value=safeMaster(raw)?publicMaster(raw):null;values.set(id,value);save();return value;
   }).finally(()=>{if(pending.get(id)===promise)pending.delete(id);});pending.set(id,promise);return promise;
  }
  const storageChanged=event=>{if(event.key===epochKey&&event.newValue&&event.newValue!==lastClearId){lastClearId=event.newValue;invalidate();}};window.addEventListener('storage',storageChanged);
  const api={warm,get,peek:id=>values.get(id),subscribe(fn){subscribers.add(fn);return()=>subscribers.delete(fn);},
   async forget(){closed=true;generation++;clearTimeout(timer);stops.forEach(stop=>stop());window.removeEventListener('storage',storageChanged);values.clear();pending.clear();subscribers.clear();owners.delete(uid);await disk('delete',uid);}};
  owners.set(uid,api);return api;
 }
 window.SLListMasterCache=Object.freeze({forOwner});
})();
