(() => {
 'use strict';
 const trigger=document.getElementById('listUrlShareButton');if(!trigger)return;
 const dialog=document.createElement('dialog');dialog.className='sl-list-share-dialog';dialog.setAttribute('aria-labelledby','listShareTitle');
 dialog.innerHTML='<form method="dialog"><button class="sl-share-close" aria-label="Close">×</button></form><h2 id="listShareTitle"></h2><p id="listShareNote"></p><label><input type="checkbox" id="listShareKey"><span></span></label><label><input type="checkbox" id="listShareParts"><span></span></label><p id="listShareStatus" role="status" aria-live="polite"></p><input id="listShareUrl" type="text" readonly aria-label="URL"><div class="sl-share-actions"><button id="listShareCopy" type="button"></button><a id="listSharePreview" target="_blank" rel="noopener noreferrer"></a><button id="listShareSave" type="button"></button><button id="listShareRetry" type="button"></button><button id="listShareRenew" type="button"></button><button id="listShareStop" type="button"></button></div>';
 document.body.append(dialog);
 const style=document.createElement('style');style.textContent='.sl-list-share-dialog{box-sizing:border-box;width:min(580px,calc(100vw - 28px));max-height:85dvh;overflow:auto;padding:28px;border:1px solid #456084;border-radius:18px;background:#101e34;color:#eef5ff;box-shadow:0 20px 80px #0008}.sl-list-share-dialog::backdrop{background:#0009}.sl-list-share-dialog h2{font-size:22px;margin:0 28px 18px 0}.sl-list-share-dialog p{line-height:1.8;overflow-wrap:anywhere}.sl-list-share-dialog label{display:flex;align-items:center;gap:10px;margin:14px 0}.sl-list-share-dialog input[type=checkbox]{width:18px;height:18px}.sl-list-share-dialog #listShareUrl{box-sizing:border-box;width:100%;padding:12px;border:1px solid #527092;border-radius:8px;background:#081323;color:#e6f4ff}.sl-share-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.sl-share-actions button,.sl-share-actions a,.sl-share-close{padding:10px 14px;background:#203952;color:#fff;border:1px solid #527092;border-radius:8px;font:inherit;cursor:pointer;text-decoration:none}.sl-share-actions button:disabled{opacity:.45;cursor:default}.sl-share-close{position:absolute;right:18px;top:16px;padding:2px 10px;font-size:24px}.sl-list-share-dialog [hidden]{display:none!important}.sl-share-actions #listShareStop{border-color:#c47883}';document.head.append(style);
 const el=id=>document.getElementById('listShare'+id);
 let service=null,config=null,state='off',busy=false,owner=null;
 const lang=()=>typeof activeLanguage!=='undefined'?activeLanguage:document.documentElement.lang;
 const t=()=>SLListShareText[lang()]||SLListShareText.ja;
 function render(){
  const text=t();trigger.textContent=text.share;trigger.disabled=!owner;
  el('Title').textContent=text.title;el('Note').textContent=text.note;
  el('Key').nextElementSibling.textContent=text.key;el('Parts').nextElementSibling.textContent=text.parts;
  for(const [id,key]of Object.entries({Save:'enable',Copy:'copy',Preview:'preview',Stop:'stop',Renew:'renew',Retry:'retry'}))el(id).textContent=text[key];
  dialog.querySelector('.sl-share-close').setAttribute('aria-label',text.close);
  if(!dialog.open){el('Key').checked=!!config?.showKey;el('Parts').checked=!!config?.showParts;}
  el('Status').textContent=text[state]||text.error;
  const url=config?new URL('mylist.html#'+config.token,location.href).href:'';
  el('Url').value=url;el('Url').hidden=!url;el('Preview').href=url||'#';el('Preview').hidden=!url||state!=='ready';
  el('Copy').disabled=busy||state!=='ready';el('Save').disabled=busy||!owner;el('Retry').hidden=state!=='error';el('Retry').disabled=busy;
  el('Stop').disabled=busy||!config;el('Renew').disabled=busy||!config;el('Key').disabled=el('Parts').disabled=busy;
 }
 async function run(action){if(busy||!service)return;busy=true;render();try{await action();}catch(error){console.warn('リストURL共有',error);state='error';}finally{busy=false;render();}}
 trigger.onclick=()=>{if(!owner)return;el('Key').checked=!!config?.showKey;el('Parts').checked=!!config?.showParts;render();dialog.showModal();};
 dialog.addEventListener('close',()=>trigger.focus());
 el('Save').onclick=()=>run(()=>service.enable({showKey:el('Key').checked,showParts:el('Parts').checked}));
 el('Retry').onclick=()=>run(()=>service.retry());
 el('Stop').onclick=()=>{if(confirm(t().stopAsk))void run(()=>service.disable());};
 el('Renew').onclick=()=>{if(confirm(t().renewAsk))void run(()=>service.enable({showKey:el('Key').checked,showParts:el('Parts').checked},true));};
 el('Url').onclick=()=>el('Url').select();
 el('Copy').onclick=async()=>{try{await navigator.clipboard.writeText(el('Url').value);el('Status').textContent=t().copied;}catch{el('Url').focus();el('Url').select();el('Status').textContent=t().copyFail;}};
 auth.onAuthStateChanged(user=>{
  service?.close();service=null;owner=user&&!user.isAnonymous?user:null;config=null;state='off';if(dialog.open)dialog.close();
  if(owner){const uid=owner.uid;service=SLListShareService(db,owner,()=>auth.currentUser?.uid===uid,result=>{config=result.config;state=result.state;render();},SLListShare);}
  render();
 });
 window.addEventListener('sl-language-change',render);render();
})();
