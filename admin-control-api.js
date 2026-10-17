/* Shared callable transport. No administrative credential is sent to the browser. */
(()=>{'use strict';
 const endpoint='https://asia-northeast1-kankan-session-room.cloudfunctions.net/accountControl';
 window.slAccountControlCall=async(data,user)=>{
  const headers={'Content-Type':'application/json'};
  if(user)headers.Authorization='Bearer '+await user.getIdToken();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({data}),signal:controller.signal});
   const body=await response.json().catch(()=>null);
   if(!response.ok||body?.error){const error=new Error(body?.error?.message||'管理機能へ接続できません。Firebase側の設定・デプロイを確認してください。');error.code=body?.error?.status||String(response.status);error.details=body?.error?.details||{};throw error;}
   if(!body||!Object.prototype.hasOwnProperty.call(body,'result'))throw Error('管理機能からの応答が不正です。');
   return body.result;
  }finally{clearTimeout(timer);}
 };
})();
