/* Viewer-owned preference. Public lists never inherit the list owner's setting. */
(() => {
 'use strict';
 let version='normal',connected=false,currentUser=null,loaded=false,busy=false,serial=0,detach=()=>{},notice='';
 const toggle=()=>document.getElementById('chordwikiVersionToggle');
 function render(){
  const button=toggle();if(!button)return;
  button.disabled=!currentUser||!loaded||busy;
  button.setAttribute('aria-checked',String(version==='beta'));
  button.setAttribute('aria-busy',String(busy));
  const status=document.getElementById('chordwikiVersionStatus');
  if(status)status.textContent=notice||(!currentUser?'Googleログイン後に設定できます。':!loaded?'設定を読み込み中…':busy?'保存中…':'選択はアカウントに自動保存されます。');
 }
 function refreshLink(anchor){
  const raw=anchor.getAttribute('href');if(!raw)return;
  const next=SLChordWiki.url(raw,version);if(next&&next!==raw)anchor.setAttribute('href',next);
 }
 function refreshLinks(node=document){
  if(node.nodeType===1&&node.matches('a[href]'))refreshLink(node);
  if(node.querySelectorAll)for(const anchor of node.querySelectorAll('a[href*="chordwiki.org"]'))refreshLink(anchor);
 }
 function apply(value){version=SLChordWiki.normalize(value);refreshLinks();render();}
 async function save(){
  if(!currentUser||!loaded||busy)return;
  const user=currentUser,session=serial,next=version==='beta'?'normal':'beta';busy=true;notice='';render();
  try{
   await user.ref.set(next);
   if(session!==serial)return;
   apply(next);notice='保存しました。';
  }catch{if(session===serial)notice='保存できませんでした。時間をおいてもう一度お試しください。';}
  finally{if(session===serial){busy=false;render();}}
 }
 function connect(auth,database){
  if(connected)return;connected=true;
  if(toggle())toggle().addEventListener('click',save);
  new MutationObserver(records=>{for(const record of records){if(record.type==='attributes')refreshLink(record.target);else for(const node of record.addedNodes)refreshLinks(node);}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});
  // Also covers links produced immediately before the user activates them.
  document.addEventListener('click',event=>{const anchor=event.target.closest?.('a[href]');if(anchor)refreshLink(anchor);},true);
  auth.onAuthStateChanged(user=>{
   detach();detach=()=>{};const session=++serial;currentUser=null;loaded=false;busy=false;notice='';apply('normal');
   if(!user||user.isAnonymous)return;
   const ref=database.ref('users/'+user.uid+'/preferences/chordwikiVersion');currentUser={uid:user.uid,ref};render();
   const listener=snapshot=>{if(session!==serial)return;loaded=true;notice='';apply(snapshot.val());};
   ref.on('value',listener,()=>{if(session!==serial)return;loaded=true;notice='設定を読み込めませんでした。通常版を使用します。';apply('normal');});
   detach=()=>ref.off('value',listener);
  });
  render();
 }
 window.SLChordWikiPreference={connect,getVersion:()=>version};
})();
