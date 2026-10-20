/* Subscribe only after administrator authorization. A failed source never hides another source. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.SLAdminRequestFeed=factory;})(typeof globalThis!=='undefined'?globalThis:this,(database,isCurrent,onChange)=>{
 'use strict';
 const sources=[{path:'songAddRequests',label:'新規追加申請'},{path:'songEditRequests',label:'編集申請'}];
 let closed=false,timer=0;const waiters=[];
 const active=()=>!closed&&isCurrent();
 const ready=()=>sources.every(source=>source.done);
 const result=()=>({snapshots:sources.map(source=>source.snapshot),errors:sources.filter(source=>source.error).map(source=>source.label+'を取得できません。権限と接続状態を確認し「更新」で再試行してください。')});
 function changed(){
  if(!active()||!ready())return;
  const value=result();waiters.splice(0).forEach(resolve=>resolve(value));
  clearTimeout(timer);timer=setTimeout(()=>{if(active())onChange();},150);
 }
 function start(source){
  if(!active())return;
  source.detach?.();source.snapshot=null;source.error=null;source.done=false;
  const version=source.version=(source.version||0)+1,ref=database.ref(source.path);
  const receive=snapshot=>{if(!active()||version!==source.version)return;source.snapshot=snapshot;source.error=null;source.done=true;changed();};
  const fail=error=>{if(!active()||version!==source.version)return;source.snapshot=null;source.error=error||Error('read');source.done=true;changed();};
  source.detach=()=>ref.off('value',receive);try{ref.on('value',receive,fail);}catch(error){fail(error);}
 }
 sources.forEach(start);
 return{
  read(){if(!active())return Promise.resolve({snapshots:[],errors:[]});return ready()?Promise.resolve(result()):new Promise(resolve=>waiters.push(resolve));},
  refresh(){if(!active())return;clearTimeout(timer);sources.forEach(start);},
  close(){closed=true;clearTimeout(timer);sources.forEach(source=>{source.version++;source.detach?.();});waiters.splice(0).forEach(resolve=>resolve({snapshots:[],errors:[]}));}
 };
});
