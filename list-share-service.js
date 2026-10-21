/* Owner-only publication with a separately stored, versioned background image. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.SLListShareService=factory;})(typeof globalThis!=='undefined'?globalThis:this,(database,owner,isCurrent,changed,core,beforePublish,design)=>{
 'use strict';
 const committed=beforePublish|| (async()=>true),appearance=value=>design?design.normalize(value):value||{};
 let config=null,saved=null,name='',background=null,backgroundLoaded=false,revision=0,queue=Promise.resolve(),closed=false,lastAsset='',lastPublished=-1;
 const repository=globalThis.SLListMasterCache?.forOwner(database,owner.uid);
 const stops=[],cache=new Map(),pending=new Map(),active=()=>!closed&&isCurrent();
 const reservation=()=>({uid:owner.uid,name:'[paused]',reserved:true,updatedAt:firebase.database.ServerValue.TIMESTAMP});
 const notify=(state,error)=>{if(active())changed({state,config,error,background});};
 function listen(path,receive){const ref=database.ref(path),fn=snapshot=>{if(!active())return;receive(snapshot.val());revision++;schedule();};ref.on('value',fn,error=>notify('error',error));stops.push(()=>ref.off('value',fn));}
 async function collect(settings,valid){
  const records=Object.entries(saved||{}).filter(([id,item])=>/^[A-Za-z0-9_-]{1,80}$/.test(id)&&core.registered(item)),songs={};let next=0;
  await Promise.all(Array.from({length:Math.min(8,records.length)},async()=>{while(next<records.length){const[id,item]=records[next++];if(!valid())return;let master;if(repository)master=await repository.get(id);else{master=cache.get(id);if(!master){if(!pending.has(id))pending.set(id,database.ref('songs/'+id).once('value').then(snapshot=>{const value=snapshot.val();if(value)cache.set(id,value);return value;}).finally(()=>pending.delete(id)));master=await pending.get(id);}}const value=core.song(master,item,settings);if(value)songs[id]=value;}}));
  return {uid:owner.uid,name:name.slice(0,40),songs,appearance:appearance(settings.appearance),updatedAt:firebase.database.ServerValue.TIMESTAMP};
 }
 async function publish(){
  if(!active()||!config||config.enabled===false||saved===null||!name||!backgroundLoaded)return;
  if(!await committed()){notify('error');return;}
  if(!active()||!config)return;
  const version=revision,settings={...config};if(lastPublished===version){notify('ready');return;}
  if(settings.backgroundVersion&&background?.version!==settings.backgroundVersion)return;
  notify('syncing');const valid=()=>active()&&version===revision&&settings.token===config?.token;
  const payload=await collect(settings,valid);if(!valid())return;
  const updates={['publicListShares/'+settings.token]:payload,['publicListLinks/'+owner.uid]:{token:settings.token}};
  if(settings.backgroundVersion){payload.backgroundVersion=settings.backgroundVersion;const asset=settings.token+':'+settings.backgroundVersion;if(lastAsset!==asset)updates['publicListBackgrounds/'+settings.token]={uid:owner.uid,version:settings.backgroundVersion,image:background.image};}
  await database.ref().update(updates);
  if(valid()){lastPublished=version;lastAsset=settings.backgroundVersion?settings.token+':'+settings.backgroundVersion:'';notify('ready');}
 }
 function schedule(){queue=queue.catch(()=>{}).then(async()=>{const version=revision;try{await publish();}catch(error){if(config&&version===revision)notify('error',error);}});return queue;}
 if(repository)stops.push(repository.subscribe(()=>{revision++;schedule();}));
 listen('userListShares/'+owner.uid,value=>{config=value&&core.tokenOK(value.token)?value:null;notify(config&&config.enabled!==false?'syncing':'off');});
 listen('users/'+owner.uid+'/songs',value=>{saved=value||{};});
 listen('users/'+owner.uid+'/profile/displayName',value=>{name=String(value||owner.displayName||'ユーザー').trim()||'ユーザー';});
 listen('userListBackgrounds/'+owner.uid,value=>{background=value;backgroundLoaded=true;notify(config&&config.enabled!==false?'syncing':'off');});
 return {
  async enable(options,replace=false,publish=true){
   if(!active())throw Error('login');
   const old=config?.token,random=bytes=>Array.from(crypto.getRandomValues(new Uint8Array(bytes)),v=>v.toString(16).padStart(2,'0')).join('');
   const token=!replace&&old?old:random(24),next={token,enabled:publish,showKey:!!options.showKey,showParts:!!options.showParts,appearance:appearance(options.appearance)};
   let image=background;
   if(options.backgroundImage===null)image=null;
   else if(typeof options.backgroundImage==='string'){
    if(options.backgroundImage.length>360000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(options.backgroundImage))throw Error('imageType');
    image={version:random(16),image:options.backgroundImage};
   }
   if(image)next.backgroundVersion=image.version;
   revision++;const updates={['userListShares/'+owner.uid]:next};
   if(options.backgroundImage!==undefined)updates['userListBackgrounds/'+owner.uid]=image;
   if(!publish)updates['publicListLinks/'+owner.uid]=null;
   if(old&&(!publish||old!==token)){updates['publicListShares/'+old]=reservation();updates['publicListBackgrounds/'+old]=null;}
   else if(old&&!image)updates['publicListBackgrounds/'+old]=null;
   await database.ref().update(updates);
   if(!active())return;config=next;background=image;backgroundLoaded=true;revision++;if(!publish){await database.ref('publicListShares/'+token).set(reservation());notify('off');}await schedule();
  },
  async disable(){
   if(!active())throw Error('login');const old=config?.token;if(!old)return;revision++;config={...config,enabled:false};lastAsset='';
   const updates={['userListShares/'+owner.uid+'/enabled']:false,['publicListLinks/'+owner.uid]:null};if(old){updates['publicListShares/'+old]=reservation();updates['publicListBackgrounds/'+old]=null;}
   await database.ref().update(updates);if(active())notify('off');
  },
  async save(options){return this.enable(options,false,!!config&&config.enabled!==false);},
  async preview(options){if(!active())throw Error('login');if(saved===null)throw Error('loading');if(!await committed())throw Error('error');const payload=await collect(options,active);payload.updatedAt=Date.now();return payload;},
  retry:schedule,close(){closed=true;revision++;stops.forEach(stop=>stop());}
 };
});



