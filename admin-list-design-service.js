/* Administrator design edits. Publication choices and saved songs are never written. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.SLAdminListDesignService=factory;})(typeof globalThis!=='undefined'?globalThis:this,(database,target,isCurrent,core,design)=>{
 'use strict';
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(target.uid))throw Error('対象ユーザーIDが不正です。');
 let baseline=null,background=null,saved={},ready=false;
 const uid=target.uid,read=async path=>(await database.ref(path).once('value')).val(),check=()=>{if(!isCurrent())throw Error('管理者のログイン状態が変わりました。');};
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const random=bytes=>Array.from(crypto.getRandomValues(new Uint8Array(bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 async function load(){
  check();const values=await Promise.all([read('userListShares/'+uid),read('userListBackgrounds/'+uid),read('users/'+uid+'/songs')]);check();
  [baseline,background,saved]=values;saved||={};ready=true;return{config:baseline,background};
 }
 async function preview(appearance){
  check();if(!ready)throw Error('読み込みが完了していません。');const records=Object.entries(saved).filter(([id,item])=>/^[A-Za-z0-9_-]{1,80}$/.test(id)&&core.registered(item)),songs={};let next=0;
  await Promise.all(Array.from({length:Math.min(8,records.length)},async()=>{while(next<records.length){check();const[id,item]=records[next++],master=await read('songs/'+id);check();const song=core.song(master,item,baseline||{});if(song)songs[id]=song;}}));
  check();return{uid,name:String(target.name||'ユーザー').slice(0,40),songs,appearance:design.normalize(appearance),updatedAt:Date.now()};
 }
 async function save({appearance,backgroundImage}){
  check();if(!ready)throw Error('読み込みが完了していません。');
  const [latest,latestImage]=await Promise.all([read('userListShares/'+uid),read('userListBackgrounds/'+uid)]);check();
  if(!same(latest,baseline)||!same(latestImage,background))throw Error('本人または別の管理者が設定を更新しました。「再読み込み」で最新の内容を確認してください。');
  let image=background;
  if(backgroundImage===null)image=null;
  else if(typeof backgroundImage==='string'){
   if(backgroundImage.length>360000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(backgroundImage))throw Error('背景画像の形式が不正です。');
   image={version:random(16),image:backgroundImage};
  }
  const next={...(latest||{token:random(24),enabled:false,showKey:false,showParts:false}),appearance:design.normalize(appearance)};
  const updates={};
  if(latest)updates['userListShares/'+uid+'/appearance']=next.appearance;
  else updates['userListShares/'+uid]=next;
  if(backgroundImage!==undefined){
   updates['userListBackgrounds/'+uid]=image;
   if(image)next.backgroundVersion=image.version;else delete next.backgroundVersion;
   if(latest)updates['userListShares/'+uid+'/backgroundVersion']=image?.version||null;
  }
  // Update the existing published design only. A stopped/unpublished page stays stopped.
  if(latest&&latest.enabled!==false){
   const share=await read('publicListShares/'+latest.token);check();
   if(share&&!share.reserved){
    if(share.uid!==uid)throw Error('共有ページの所有者が一致しません。');
    updates['publicListShares/'+latest.token+'/appearance']=next.appearance;
    updates['publicListShares/'+latest.token+'/updatedAt']=firebase.database.ServerValue.TIMESTAMP;
    if(backgroundImage!==undefined){
     updates['publicListShares/'+latest.token+'/backgroundVersion']=image?.version||null;
     updates['publicListBackgrounds/'+latest.token]=image?{uid,...image}:null;
    }
   }
  }
  check();await database.ref().update(updates);check();baseline=next;background=image;return{config:baseline,background};
 }
 return{load,preview,save};
});
