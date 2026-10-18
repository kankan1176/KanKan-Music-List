(() => {
 'use strict';
 const el=id=>document.getElementById('share'+id),core=SLListShare;
 let data=null,rows=[],page=0,status='loading',stop=()=>{};
 const preferred=navigator.language.toLowerCase();let language=preferred.startsWith('ko')?'ko':preferred.startsWith('zh')?'zh-TW':preferred.startsWith('en')?'en':'ja';el('Language').value=language;
 const t=()=>SLListShareText[language]||SLListShareText.ja;
 function render(){
  const text=t();document.documentElement.lang=language;el('Brand').textContent=text.brand;el('ReadOnly').textContent=text.readOnly;
  el('Title').textContent=data?String(data.name||'')+text.list:text.title;document.title=el('Title').textContent+' | '+text.brand;
  el('Status').textContent=status==='ready'?'':text[status]||text.loadError;
  el('Search').hidden=!data;el('Search').placeholder=text.search;el('Search').setAttribute('aria-label',text.search);
  const filtered=rows.filter(row=>(row.title+' '+row.artist).normalize('NFKC').toLocaleLowerCase().includes(el('Search').value.normalize('NFKC').toLocaleLowerCase().trim()));
  const pages=Math.max(1,Math.ceil(filtered.length/100));page=Math.min(page,pages-1);
  el('Count').textContent=data?filtered.length+' / '+rows.length+' '+text.count:'';
  el('Updated').textContent=data?.updatedAt?text.updated+' '+new Date(data.updatedAt).toLocaleString(language):'';
  el('Songs').replaceChildren();
  for(const [i,row]of filtered.slice(page*100,(page+1)*100).entries()){
   const li=document.createElement('li'),number=document.createElement('span'),info=document.createElement('div'),title=document.createElement('strong'),artist=document.createElement('p');
   number.className='number';number.textContent=String(page*100+i+1).padStart(2,'0');info.className='song-info';title.textContent=row.title;artist.textContent=row.artist;info.append(title,artist);
   const details=[];if(Number.isInteger(row.key))details.push('Key '+(row.key>0?'+':'')+row.key);if(Array.isArray(row.parts))details.push(row.parts.join(' / '));
   if(details.length){const extra=document.createElement('p');extra.textContent=details.join(' · ');info.append(extra);}li.append(number,info);
   const url=core.wiki(row.url);if(url){const link=document.createElement('a');link.className='song-link';link.href=core.link(url,row.key);link.target='_blank';link.rel='noopener noreferrer';link.textContent=text.wiki;li.append(link);}el('Songs').append(li);
  }
  if(data&&!filtered.length)el('Status').textContent=text.empty;
  el('Pagination').hidden=!data||pages===1;el('Prev').textContent=text.previous;el('Next').textContent=text.next;el('Prev').disabled=page===0;el('Next').disabled=page===pages-1;el('Page').textContent=(page+1)+' / '+pages;
 }
 el('Search').oninput=()=>{page=0;render();};el('Language').onchange=()=>{language=el('Language').value;render();};el('Prev').onclick=()=>{page--;render();};el('Next').onclick=()=>{page++;render();};
 const config={apiKey:'AIzaSyAidXlfliIIHzTFmr06EKDV6Fit-bSThLI',databaseURL:'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app',projectId:'kankan-session-room',appId:'1:759342880820:web:9af0af755e35926a281261'};
 function load(){
  stop();data=null;rows=[];page=0;status='loading';render();const token=location.hash.slice(1);
  if(!core.tokenOK(token)){status='unavailable';render();return;}
  try{
   const app=firebase.apps?.length?firebase.app():firebase.initializeApp(config),ref=app.database().ref('publicListShares/'+token);
   let current=true;const listener=snapshot=>{if(!current)return;const value=snapshot.val();data=value&&typeof value.name==='string'?value:null;rows=data?Object.values(data.songs||{}).filter(r=>r&&typeof r.title==='string'&&typeof r.artist==='string').sort((a,b)=>a.title.localeCompare(b.title,language)||a.artist.localeCompare(b.artist,language)):[];status=data?'ready':'unavailable';render();};
   ref.on('value',listener,error=>{if(!current)return;data=null;rows=[];status=/permission.denied/i.test(error?.code||error?.message||'')?'unavailable':'loadError';render();});stop=()=>{current=false;ref.off('value',listener);};
  }catch{status='loadError';render();}
 }
 window.addEventListener('hashchange',load);load();
})();
