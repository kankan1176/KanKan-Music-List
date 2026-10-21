/* Keep the initial page covered until data, controls and visible assets are ready. */
(() => {
 'use strict';
 const words={ja:['読み込み中','マイリストを準備しています','読み込みに失敗しました。通信環境を確認して再読み込みしてください。','再読み込み'],en:['Loading','Preparing your list','Unable to load. Check your connection and reload.','Reload'],ko:['불러오는 중','마이리스트를 준비하고 있습니다','불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.','다시 불러오기'],'zh-TW':['載入中','正在準備清單','載入失敗，請確認連線後重新載入。','重新載入']};
 let active=true,failed=false,ready=false,frame=0,timer;
 const pending=new Set(['assets','actions']);
 const node=id=>document.getElementById(id);
 function labels(){const lang=document.documentElement.lang||navigator.language;return words[lang]||words[lang?.slice(0,2)]||words.ja;}
 function paint(){if(!node('listLoading'))return;const text=labels();node('listLoadingTitle').textContent=failed?text[2]:text[0];node('listLoadingHint').textContent=failed?'':text[1];node('listLoadingRetry').textContent=text[3];node('listLoadingRetry').hidden=!failed;node('listLoading').classList.toggle('is-error',failed);node('listLoading').setAttribute('aria-busy',String(!failed));}
 function check(){paint();cancelAnimationFrame(frame);if(!active||failed||!ready||pending.size)return;frame=requestAnimationFrame(()=>{if(failed||!ready||pending.size)return;active=false;clearTimeout(timer);document.documentElement.classList.remove('list-is-loading');node('listLoading').hidden=true;document.querySelector('main').inert=false;document.querySelector('main').removeAttribute('aria-busy');});}
 function error(){if(!active)return;failed=true;paint();}
 timer=setTimeout(error,45000);
 window.SLListLoading={
  hold(){if(!active)return()=>{};const key={};pending.add(key);let done=false;return()=>{if(done)return;done=true;pending.delete(key);check();};},
  state(value){if(!active)return;ready=!['loading','updating'].includes(value);if(['loadError','refreshError'].includes(value))error();check();},
  actions(){pending.delete('actions');check();},
  error,
  reset(){if(active)return;active=true;failed=false;ready=false;clearTimeout(timer);document.documentElement.classList.add('list-is-loading');node('listLoading').hidden=false;document.querySelector('main').inert=true;timer=setTimeout(error,45000);paint();}
 };
 window.addEventListener('error',event=>{if(event.target?.tagName==='SCRIPT')error();},true);
 document.addEventListener('DOMContentLoaded',async()=>{
  node('listLoadingRetry').onclick=()=>location.reload();paint();
  const image=document.querySelector('#shareBrand img');
  try{await Promise.all([document.fonts?.ready,image?.decode?image.decode():Promise.resolve()]);}catch{/* A missing brand image must not hide an otherwise usable list. */}
  pending.delete('assets');if(location.hash==='#preview')pending.delete('actions');check();
 });
})();
