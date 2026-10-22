/* One-time guest-name maintenance. Google account profiles are never changed. */
(function(root){
 'use strict';
 const id='guest-name-reset-20261022-v1',cutoff=1792640750000,key='shareliscore_guest_name_reset_v1';
 function create(storage){
  const atBoot=storage.get('kankan_username');let applied=storage.get(key)===id;
  return{
   apply(user){
    if(!user?.isAnonymous||applied)return null;
    const saved=storage.get('kankan_username'),clear=!!saved&&saved===atBoot;
    if(clear&&!storage.remove('kankan_username'))throw Error('名前を端末に保存できませんでした。');
    if(!storage.set(key,id))throw Error('名前を端末に保存できませんでした。');
    applied=true;return{name:clear||!saved?String(user.uid||'').slice(0,5)||'ゲスト':saved,unnamed:clear||!saved};
   },
   obsolete(command){return command?.id===id||(Number.isFinite(command?.issuedAt)&&command.issuedAt<=cutoff);}
  };
 }
 const api={id,cutoff,key,create};if(typeof module==='object'&&module.exports)module.exports=api;else root.SLGuestNameReset=api;
})(typeof window==='object'?window:globalThis);
