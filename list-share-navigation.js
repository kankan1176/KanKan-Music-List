/* One My list entry; registration tools stay available from the list page. */
(() => {
 'use strict';
 const t=()=>SLListShareText[typeof activeLanguage!=='undefined'?activeLanguage:document.documentElement.lang]||SLListShareText.ja;
 window.slOpenMyListPage=()=>{
  const user=auth.currentUser;if(!user||user.isAnonymous){alert(t().login);return;}
  const url=new URL('mylist.html?v=20261020-3#mine',location.href);window.open(url.href,'_blank','noopener,noreferrer');
 };
 const original=document.getElementById('slNavMy');
 if(original){
  original.onclick=()=>window.slOpenMyListPage();
  document.getElementById('slNavListSiteShare')?.remove();
  let button=document.getElementById('slNavListSiteEdit');
  if(!button){button=document.createElement('button');button.type='button';button.id='slNavListSiteEdit';button.className='sl-nav-list-site';const mark=document.createElement('span'),label=document.createElement('b');mark.textContent='🎨';label.dataset.shareNav='siteEdit';button.append(mark,label);original.after(button);}
  button.onclick=()=>window.slOpenMyListEditor?.();
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
