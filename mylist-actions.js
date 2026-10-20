/* Own-list controls and unilateral favorites. Public list reads stay independent of sign-in. */
(() => {
 'use strict';
 if(location.hash==='#preview')return;
 const mine=location.hash==='#mine',button=document.getElementById('shareFavorite'),notice=document.getElementById('shareActionStatus');
 let state=window.SLListPageState||{},user=null,authReady=false,saved=false,loaded=false,busy=false,watchKey='',detach=()=>{},version=0;
 const text=()=>SLListShareText[state.language||document.documentElement.lang]||SLListShareText.ja;
 const validUid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
 const account=()=>user&&!user.isAnonymous;
 function render(){
  button.hidden=mine||!state.available||!validUid(state.ownerUid)||user?.uid===state.ownerUid;
  button.textContent=!account()?text().favoriteLogin:saved?text().favoriteRemove:text().favoriteAdd;
  button.disabled=!authReady||busy||!!account()&&!loaded;button.setAttribute('aria-pressed',String(saved));
 }
 if(!window.firebase?.apps?.length||typeof firebase.auth!=='function'){render();return;}
 const app=firebase.app(),auth=app.auth(),database=app.database();
 function synchronize(){
  const key=!mine&&state.available&&validUid(state.ownerUid)&&account()&&user.uid!==state.ownerUid?user.uid+'/'+state.ownerUid:'';
  if(key!==watchKey){detach();detach=()=>{};watchKey=key;const current=++version;saved=false;loaded=false;notice.textContent='';
   if(key){const ref=database.ref('userFavorites/'+key),listener=snapshot=>{if(current!==version)return;saved=snapshot.val()===true;loaded=true;render();};ref.on('value',listener,()=>{if(current!==version)return;loaded=false;notice.textContent=text().favoriteError;render();});detach=()=>ref.off('value',listener);}
  }
  render();
 }
 window.addEventListener('sl-list-page-state',event=>{state=event.detail;synchronize();window.dispatchEvent(new Event('sl-language-change'));});
 auth.onAuthStateChanged(value=>{user=value;authReady=true;synchronize();});
 button.onclick=async()=>{
  if(busy||button.hidden)return;
  busy=true;render();const current=version;
  try{
   if(!account()){await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());return;}
   if(!loaded||!state.available||!validUid(state.ownerUid)||user.uid===state.ownerUid)return;
   const viewer=user.uid,target=state.ownerUid,remove=saved;
   if(remove&&!confirm(text().favoriteRemoveAsk))return;
   if(auth.currentUser?.uid!==viewer)return;
   await database.ref('userFavorites/'+viewer+'/'+target).set(remove?null:true);
   if(current===version)notice.textContent=remove?text().favoriteRemoved:text().favoriteSaved;
  }catch(error){if(current===version&&error?.code!=='auth/popup-closed-by-user'&&error?.code!=='auth/cancelled-popup-request')notice.textContent=text().favoriteError;}
  finally{busy=false;render();}
 };
 if(mine){
  window.SLListOwnerContext={auth,database};
  function script(path){return new Promise((resolve,reject)=>{const node=document.createElement('script');node.src=path+'?v=20261020-10';node.onload=resolve;node.onerror=reject;document.head.append(node);});}
  void script('list-share-service.js').then(()=>script('list-share-owner.js')).catch(()=>{notice.textContent=text().loadError;});
 }
 synchronize();
})();
