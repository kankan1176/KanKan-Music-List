/* Applies only administrator-issued RTDB controls; personal lists and preferences are preserved. */
(()=>{'use strict';
 if(typeof UI_I18N!=='undefined')Object.assign(UI_I18N,{"管理者によりログアウトされました。もう一度ログインしてください。": {"en": "An administrator has signed you out. Please sign in again.", "ko": "관리자에 의해 로그아웃되었습니다. 다시 로그인해 주세요.", "zh-TW": "管理員已將您登出，請重新登入。"}, "ログアウトに失敗しました。通信状況を確認してください。": {"en": "Could not sign out. Check your connection.", "ko": "로그아웃하지 못했습니다. 인터넷 연결을 확인해 주세요.", "zh-TW": "登出失敗，請檢查網路連線。"}, "管理者の指示で楽曲キャッシュを削除しました。ページを再読み込みすると最新データを取得します。": {"en": "The song cache was cleared at an administrator’s request. Reload this page to get the latest data.", "ko": "관리자 요청으로 곡 캐시를 삭제했습니다. 페이지를 새로고침하면 최신 데이터를 가져옵니다.", "zh-TW": "已依管理員指示清除歌曲快取。重新載入頁面即可取得最新資料。"}, "管理者によりゲスト名が変更されました。": {"en": "An administrator has changed your guest name.", "ko": "관리자가 게스트 이름을 변경했습니다.", "zh-TW": "管理員已變更您的訪客名稱。"}, "名前を端末に保存できませんでした。": {"en": "Could not save the name on this device.", "ko": "이 기기에 이름을 저장하지 못했습니다.", "zh-TW": "無法將名稱儲存至此裝置。"}, "キャッシュを削除できませんでした。": {"en": "Could not clear the cache.", "ko": "캐시를 삭제하지 못했습니다.", "zh-TW": "無法清除快取。"}, "ほかのタブがキャッシュを使用中です。ほかのタブを閉じてください。": {"en": "Another tab is using the cache. Close the other tabs.", "ko": "다른 탭에서 캐시를 사용 중입니다. 다른 탭을 닫아 주세요.", "zh-TW": "其他分頁正在使用快取，請關閉其他分頁。"}});
 const dbName='share-list-score-public-master-v2';
 const storage={get(key){try{return localStorage.getItem(key);}catch{return null;}},set(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}}};
 const deviceKey='shareliscore_control_device';let device=storage.get(deviceKey);
 if(!device){device=crypto.randomUUID();storage.set(deviceKey,device);}
 let busy=false,rerun=false,stopped=false,version=0,revoking=false;
 const applied=new Map();
 const ackFor=uid=>{if(!applied.has(uid)){let saved;try{saved=JSON.parse(storage.get('shareliscore_control_ack_'+uid)||'null');}catch{}applied.set(uid,{cacheIds:Array.isArray(saved?.cacheIds)?saved.cacheIds:[],guestNameId:saved?.guestNameId||null,logoutId:saved?.logoutId||null});}return applied.get(uid);};
 const notice=document.createElement('p');notice.id='slAccountControlNotice';notice.setAttribute('role','status');notice.style.cssText='display:none;position:fixed;bottom:12px;left:12px;right:12px;z-index:20000;margin:0;padding:14px;border:1px solid #8cb6ff;border-radius:10px;background:#10213d;color:white;font-size:14px;line-height:1.5';document.body.append(notice);
 function show(message){notice.textContent=typeof uiText==='function'?uiText(message):message;notice.style.display='block';}
 async function clearMaster(commandId){
  for(const cacheDatabase of [dbName,'share-list-score-mylist-master-v1'])await new Promise((resolve,reject)=>{
   if(!window.indexedDB){resolve();return;}
   const request=indexedDB.deleteDatabase(cacheDatabase);
   request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error||Error('キャッシュを削除できませんでした。'));
   request.onblocked=()=>reject(Error('ほかのタブがキャッシュを使用中です。ほかのタブを閉じてください。'));
  });
  storage.set('sharelistscore_mylist_cache_epoch',commandId||String(Date.now()));
  // Drop only public-song response caches owned by this site. Never clear Firebase/Auth caches.
  if('caches' in window)for(const key of await caches.keys()){
   if(!/^shareliscore-public-(?:master|songs)(?:-|$)/.test(key))continue;
   const cache=await caches.open(key);for(const request of await cache.keys()){
    const url=new URL(request.url);if(url.origin===location.origin&&url.pathname==='/public/songs.json')await cache.delete(request);
   }
  }
 }
 async function forceLogout(user){
  if(!user||auth.currentUser?.uid!==user.uid||revoking)return;
  revoking=true;show('管理者によりログアウトされました。もう一度ログインしてください。');
  try{
   if(typeof currentRoomId!=='undefined'&&currentRoomId&&typeof removeOwnRoomShare==='function'){try{await removeOwnRoomShare();}catch{}}
   if(typeof stopRoomOwnSource==='function')stopRoomOwnSource();
   if(typeof stopRoomOwnPublishing==='function')stopRoomOwnPublishing();
   await auth.signOut();
   if(typeof currentRoomId!=='undefined'&&currentRoomId)location.reload();
  }catch{revoking=false;show('ログアウトに失敗しました。通信状況を確認してください。');}
 }
 async function poll(){
  if(stopped)return;if(busy){rerun=true;return;}
  busy=true;const requestVersion=version,user=auth.currentUser,uid=user?.uid||'signed-out',ack=ackFor(uid);
  try{
   const result=await window.slAccountControlCall({action:'poll',deviceId:device,name:typeof myName==='string'?myName:'',applied:ack},user);
   if(requestVersion!==version||auth.currentUser?.uid!==user?.uid)return;
   if(!result.enabled)return;
   if(user&&!user.isAnonymous&&result.logout){
    ack.logoutId=result.logout.id;storage.set('shareliscore_control_ack_'+uid,JSON.stringify(ack));
    try{await window.slAccountControlCall({action:'ackLogout',deviceId:device,name:typeof myName==='string'?myName:'',applied:ack},user);}catch{}
    if(requestVersion===version)await forceLogout(user);return;
   }
   for(const command of result.cacheCommands||[]){
    if(!command?.id||ack.cacheIds.includes(command.id))continue;
    await clearMaster(command.id);if(requestVersion!==version)return;
    ack.cacheIds=[...ack.cacheIds,command.id].slice(-2);
    show('管理者の指示で楽曲キャッシュを削除しました。ページを再読み込みすると最新データを取得します。');rerun=true;
   }
   const nameCommand=result.guestName;
   if(user?.isAnonymous&&nameCommand?.id&&nameCommand.id!==ack.guestNameId){
    if(typeof nameCommand.name!=='string'||!nameCommand.name.trim()||nameCommand.name.length>40)throw Error('名前の変更指示が不正です。');
    if(!storage.set('kankan_username',nameCommand.name))throw Error('名前を端末に保存できませんでした。');
    if(typeof applyUsername==='function')applyUsername(nameCommand.name);
    ack.guestNameId=nameCommand.id;show('管理者によりゲスト名が変更されました。');rerun=true;
   }
   storage.set('shareliscore_control_ack_'+uid,JSON.stringify(ack));
  }catch(error){
   if(requestVersion!==version)return;
   if(error.details?.reason==='SESSION_REVOKED'||['auth/user-token-expired','auth/id-token-revoked','auth/user-disabled'].includes(error.code))await forceLogout(user);
   else if(error.message?.includes('キャッシュ')||error.message?.includes('名前を端末'))show(error.message);
   // Unapplied rules / offline state must not interrupt the existing application.
  }finally{busy=false;if(rerun){rerun=false;setTimeout(poll,250);}}
 }
 let unwatch=()=>{},cacheAccount=null;
 function dropMyListCache(){
  try{if(!window.indexedDB)return;const request=indexedDB.deleteDatabase('share-list-score-mylist-master-v1');
   request.onsuccess=()=>storage.set('sharelistscore_mylist_cache_epoch','auth-'+crypto.randomUUID());
  }catch{}
 }
 auth.onAuthStateChanged(user=>{const next=user&&!user.isAnonymous?user.uid:null;if(!next||cacheAccount&&cacheAccount!==next)dropMyListCache();cacheAccount=next;version++;revoking=false;unwatch();unwatch=typeof window.slWatchAccountControls==='function'?window.slWatchAccountControls(user,()=>void poll()):()=>{};void poll();});
 window.addEventListener('online',()=>void poll());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void poll();});
 let timer;const startTimer=()=>{clearInterval(timer);timer=setInterval(()=>{if(!document.hidden)void poll();},300000);};startTimer();
 window.addEventListener('pagehide',()=>{stopped=true;version++;clearInterval(timer);unwatch();});
 window.addEventListener('pageshow',event=>{if(event.persisted){stopped=false;version++;unwatch();unwatch=typeof window.slWatchAccountControls==='function'?window.slWatchAccountControls(auth.currentUser,()=>void poll()):()=>{};startTimer();void poll();}});
 window.slPollAccountControls=poll;
})();

