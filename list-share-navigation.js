/* Shared website actions; the original song-list editor remains available. */
(() => {
 'use strict';
 const t=()=>SLListShareText[typeof activeLanguage!=='undefined'?activeLanguage:document.documentElement.lang]||SLListShareText.ja;
 const original=document.getElementById('slNavMy');
 if(original){
  let after=original;
  for(const[id,key,icon,action]of [['slNavListSiteEdit','siteEdit','🎨',()=>window.slOpenMyListEditor?.()],['slNavListSiteShare','siteShare','🔗',()=>{
   const user=auth.currentUser;if(!user||user.isAnonymous){alert(t().login);return;}
   const url=window.slOwnListViewUrl?.()||new URL('mylist.html?v=20261019-2#mine',location.href).href;window.open(url,'_blank','noopener,noreferrer');
  }]]){
   const button=document.createElement('button'),mark=document.createElement('span'),label=document.createElement('b');button.type='button';button.id=id;button.className='sl-nav-list-site';mark.textContent=icon;label.dataset.shareNav=key;button.append(mark,label);button.onclick=action;after.parentElement.insertBefore(button,after.nextSibling);after=button;
  }
  const update=()=>document.querySelectorAll('[data-share-nav]').forEach(node=>node.textContent=t()[node.dataset.shareNav]);update();window.addEventListener('sl-language-change',update);
 }
 const route=new URLSearchParams(location.search).get('view');
 function openRoute(){
  if(route==='terms'||route==='privacy')window.slNavigate?.(route);
  else if(route==='mylist-edit'){let done=false;auth.onAuthStateChanged(user=>{if(!done&&user&&!user.isAnonymous){done=true;window.slNavigate?.('mylist');}});}
 }
 if(['terms','privacy','mylist-edit'].includes(route)){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(openRoute,0),{once:true});else setTimeout(openRoute,0);
 }
})();
