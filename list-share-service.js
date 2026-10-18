/* Owner-only publication. Read saved records directly; never inspect pending edits. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.SLListShareService=factory;})(typeof globalThis!=='undefined'?globalThis:this,(database,owner,isCurrent,changed,core,beforePublish)=>{
 'use strict';
 const committed=beforePublish|| (async()=>true);
 let config=null,saved=null,name='',revision=0,queue=Promise.resolve(),closed=false;
 const stops=[],cache=new Map();
 const active=()=>!closed&&isCurrent();
 const notify=(state,error)=>{if(active())changed({state,config,error});};
 function listen(path,receive){const ref=database.ref(path),fn=snapshot=>{if(!active())return;receive(snapshot.val());revision++;schedule();};ref.on('value',fn,error=>notify('error',error));stops.push(()=>ref.off('value',fn));}
 async function publish(){
  if(!active()||!config||saved===null||!name)return;
  if(!await committed()){notify('error');return;}
  if(!active()||!config)return;
  const version=revision,settings={...config},records=Object.entries(saved).filter(([id,item])=>/^[A-Za-z0-9_-]{1,80}$/.test(id)&&core.registered(item)),songs={};let next=0;
  notify('syncing');
  await Promise.all(Array.from({length:Math.min(8,records.length)},async()=>{
   while(next<records.length){const [id,item]=records[next++];if(!active()||version!==revision)return;
    let master=cache.get(id);if(!master){master=(await database.ref('songs/'+id).once('value')).val();if(master)cache.set(id,master);}
    const value=core.song(master,item,settings);if(value)songs[id]=value;
   }
  }));
  if(!active()||version!==revision||settings.token!==config?.token)return;
  await database.ref('publicListShares/'+settings.token).set({uid:owner.uid,name:name.slice(0,40),songs,updatedAt:firebase.database.ServerValue.TIMESTAMP});
  if(active()&&version===revision)notify('ready');
 }
 function schedule(){queue=queue.catch(()=>{}).then(async()=>{const version=revision;try{await publish();}catch(error){if(config&&version===revision)notify('error',error);}});return queue;}
 listen('userListShares/'+owner.uid,value=>{config=value&&core.tokenOK(value.token)?value:null;notify(config?'syncing':'off');});
 listen('users/'+owner.uid+'/songs',value=>{saved=value||{};});
 listen('users/'+owner.uid+'/profile/displayName',value=>{name=String(value||owner.displayName||'ユーザー').trim()||'ユーザー';});
 return {
  async enable(options,replace=false){
   if(!active())throw Error('ログイン状態が変わりました。');
   const old=config?.token;
   const token=!replace&&old?old:Array.from(crypto.getRandomValues(new Uint8Array(24)),v=>v.toString(16).padStart(2,'0')).join('');
   revision++;const next={token,showKey:!!options.showKey,showParts:!!options.showParts};
   const updates={['userListShares/'+owner.uid]:next};if(old&&old!==token)updates['publicListShares/'+old]=null;
   await database.ref().update(updates);
   if(!active())return;config=next;revision++;
   await schedule();
  },
  async disable(){
   if(!active())throw Error('ログイン状態が変わりました。');
   const old=config?.token;revision++;config=null;
   const updates={['userListShares/'+owner.uid]:null};if(old)updates['publicListShares/'+old]=null;
   await database.ref().update(updates);if(active())notify('off');
  },
  retry:schedule,
  close(){closed=true;revision++;stops.forEach(stop=>stop());}
 };
});
