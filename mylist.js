(() => {
 'use strict';
 const el=id=>document.getElementById('share'+id),core=SLListShare,design=SLListDesign,preview=location.hash==='#preview'&&window.parent!==window,mine=location.hash==='#mine';
 let data=null,rows=[],page=0,status='loading',stop=()=>{},generation=0,lastImage='',imageVersion='',imageSerial=0;
 const genreCache=new Map();
 const preferred=navigator.language.toLowerCase();let language=preferred.startsWith('ko')?'ko':preferred.startsWith('zh')?'zh-TW':preferred.startsWith('en')?'en':'ja';el('Language').value=language;
 const t=()=>SLListShareText[language]||SLListShareText.ja;
 function cell(tag,value,className){const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;}
 function setImage(image){if(image===lastImage)return;lastImage=image||'';document.querySelector('.share-backdrop').style.backgroundImage=lastImage?'url("'+lastImage+'")':'';}
 function validImage(image){return typeof image==='string'&&image.length<=360000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image);}
 function move(next){page=next;render();el('ListViewport').scrollTop=0;}
 function render(){
  const text=t(),appearance=design.apply(document.documentElement,data?.appearance);document.documentElement.lang=language;document.documentElement.style.colorScheme=appearance.preset;
  el('BrandName').textContent=text.brand;el('Brand').setAttribute('aria-label',text.brandHome);el('Terms').textContent=text.terms;el('Privacy').textContent=text.privacy;el('Edit').textContent=text.editList;el('Edit').hidden=!mine;el('ReadOnly').textContent=preview?text.designPreview:mine?text.ownView:text.readOnly;
  const title=appearance.title||(data?String(data.name||'')+text.list:text.title);el('Title').textContent=title;el('Title').title=title;document.title=title+' | '+text.brand;
  el('Owner').textContent=data&&appearance.title?data.name+text.list:'';
  el('Status').textContent=status==='ready'?'':text[status]||text.loadError;
  for(const key of ['Search','Genre','Sort'])el(key).hidden=!data;
  el('Search').placeholder=text.search;el('Search').setAttribute('aria-label',text.search);el('Genre').setAttribute('aria-label',text.genre);el('Sort').setAttribute('aria-label',text.sort);
  const genre=el('Genre').value,sort=el('Sort').value||'title',tags=[...new Set(rows.flatMap(row=>row.genres||[]))].sort((a,b)=>a.localeCompare(b,language));
  el('Genre').replaceChildren(new Option(text.allGenres,''),...tags.map(value=>new Option(value,value)),new Option(text.uncategorized,'__none__'));el('Genre').value=genre&&([...tags,'__none__'].includes(genre))?genre:'';
  el('Sort').replaceChildren(new Option(text.titleOrder,'title'),new Option(text.artistOrder,'artist'));el('Sort').value=sort;
  const search=el('Search').value.normalize('NFKC').toLocaleLowerCase().trim(),chosen=el('Genre').value;
  const filtered=rows.filter(row=>(!chosen||(chosen==='__none__'?!row.genres.length:row.genres.includes(chosen)))&&(row.title+' '+row.artist).normalize('NFKC').toLocaleLowerCase().includes(search));
  filtered.sort((a,b)=>(sort==='artist'?a.artist.localeCompare(b.artist,language):a.title.localeCompare(b.title,language))||a.title.localeCompare(b.title,language));
  const pages=Math.max(1,Math.ceil(filtered.length/100));page=Math.max(0,Math.min(page,pages-1));
  el('Count').textContent=data?rows.length+' '+text.count:'';el('ResultCount').textContent=data?filtered.length+' / '+rows.length+' '+text.count:'';
  el('Updated').textContent=data?.updatedAt?text.updated+' '+new Date(data.updatedAt).toLocaleString(language):'';
  const showKey=rows.some(row=>Number.isInteger(row.key)),showParts=rows.some(row=>Array.isArray(row.parts)&&row.parts.length);
  const header=document.createElement('tr');for(const label of ['No.',text.songTitle,text.artist,text.genre,...(showKey?['Key']:[]),...(showParts?[text.partsLabel]:[]),'ChordWiki'])header.append(cell('th',label));el('TableHead').replaceChildren(header);el('Songs').replaceChildren();
  for(const[i,row]of filtered.slice(page*100,(page+1)*100).entries()){
   const tr=document.createElement('tr'),genres=cell('td','','genre-cell');tr.append(cell('td',String(page*100+i+1).padStart(2,'0'),'number'),cell('td',row.title,'song-title'),cell('td',row.artist,'song-artist'));
   for(const value of row.genres)genres.append(cell('span',value,'genre-tag'));tr.append(genres);
   if(showKey)tr.append(cell('td',Number.isInteger(row.key)?(row.key>0?'+':'')+row.key:'—','optional'));
   if(showParts)tr.append(cell('td',Array.isArray(row.parts)?row.parts.join(' / '):'—','optional'));
   const action=cell('td',''),url=core.link(row.url,row.key);if(url){const link=cell('a','↗ '+text.wiki,'song-link');link.href=url;link.target='_blank';link.rel='noopener noreferrer';action.append(link);}tr.append(action);el('Songs').append(tr);
  }
  if(data&&!filtered.length)el('Status').textContent=text.empty;
  for(const suffix of ['', 'Top']){el('Pagination'+suffix).hidden=!data;el('Prev'+suffix).textContent=text.previous;el('Next'+suffix).textContent=text.next;el('Prev'+suffix).disabled=page===0;el('Next'+suffix).disabled=page===pages-1;}
  el('Page').textContent=(page+1)+' / '+pages;el('PageSelect').setAttribute('aria-label',text.page);el('PageSelect').replaceChildren(...Array.from({length:pages},(_,i)=>new Option((i+1)+' / '+pages,String(i))));el('PageSelect').value=String(page);el('ListViewport').setAttribute('aria-label',text.songList);
  window.SLListPageState={ownerUid:data?.uid||'',available:!!data&&!data.reserved,language};window.dispatchEvent(new CustomEvent('sl-list-page-state',{detail:window.SLListPageState}));
 }
 function accept(value){data=value&&typeof value.name==='string'&&!value.reserved?value:null;rows=data?Object.entries(data.songs||{}).filter(([,r])=>r&&typeof r.title==='string'&&typeof r.artist==='string').map(([id,row])=>({...row,id,genres:Array.isArray(row.genres)?row.genres:genreCache.get(id)||[]})):[];status=data?'ready':'unavailable';render();}
 el('Search').oninput=()=>move(0);el('Genre').onchange=()=>move(0);el('Sort').onchange=()=>move(0);el('Language').onchange=()=>{language=el('Language').value;render();};for(const suffix of ['', 'Top']){el('Prev'+suffix).onclick=()=>move(page-1);el('Next'+suffix).onclick=()=>move(page+1);}el('PageSelect').onchange=()=>move(Number(el('PageSelect').value));
 const config={apiKey:'AIzaSyAidXlfliIIHzTFmr06EKDV6Fit-bSThLI',authDomain:'kankan-session-room.firebaseapp.com',databaseURL:'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app',projectId:'kankan-session-room',appId:'1:759342880820:web:9af0af755e35926a281261'};
 async function loadImage(database,token,version){
  const requested=version?token+':'+version:'';if(requested===imageVersion)return;imageVersion=requested;const serial=++imageSerial;setImage('');if(!version)return;
  try{const value=(await database.ref('publicListBackgrounds/'+token).once('value')).val();if(serial===imageSerial&&value?.version===version&&validImage(value.image))setImage(value.image);}catch{if(serial===imageSerial)imageVersion='';}
 }
 async function legacyGenres(database,version){
  const missing=rows.filter(row=>!row.genresKnown&&!Array.isArray(data.songs?.[row.id]?.genres)&&!genreCache.has(row.id));let next=0;
  await Promise.all(Array.from({length:Math.min(8,missing.length)},async()=>{while(next<missing.length&&version===generation){const row=missing[next++];try{const master=(await database.ref('songs/'+row.id).once('value')).val();genreCache.set(row.id,core.genres(master));}catch{genreCache.set(row.id,[]);}}}));
  if(version===generation&&data){for(const row of rows)if(!row.genres.length&&genreCache.has(row.id))row.genres=genreCache.get(row.id);render();}
 }
 async function load(){
  stop();const version=++generation;data=null;rows=[];page=0;status='loading';imageVersion='';imageSerial++;setImage('');render();const fragment=location.hash.slice(1);
  const userRoute=fragment.startsWith('user='),uid=userRoute?fragment.slice(5):'';
  if(userRoute?!/^[A-Za-z0-9_-]{1,128}$/.test(uid):!core.tokenOK(fragment)){status='unavailable';render();return;}
  try{
   const app=firebase.apps?.length?firebase.app():firebase.initializeApp(config);SLAppCheck.activate(app);const database=app.database();let token=fragment;
   if(userRoute){
    try{token=(await database.ref('publicListLinks/'+uid).once('value')).val()?.token;}catch(error){if(version!==generation)return;status=/permission.denied/i.test(error?.code||error?.message||'')?'userUnavailable':'loadError';render();return;}
    if(version!==generation)return;
    if(!core.tokenOK(token)){status='userUnavailable';render();return;}
   }
   const ref=database.ref('publicListShares/'+token);let current=true;
   const listener=snapshot=>{if(!current||version!==generation)return;accept(snapshot.val());if(!data&&userRoute){status='userUnavailable';render();}void loadImage(database,token,data?.backgroundVersion);if(data)void legacyGenres(database,version);};
   ref.on('value',listener,error=>{if(!current||version!==generation)return;data=null;rows=[];setImage('');imageSerial++;status=/permission.denied/i.test(error?.code||error?.message||'')?(userRoute?'userUnavailable':'unavailable'):'loadError';render();});stop=()=>{current=false;ref.off('value',listener);};
  }catch{if(version===generation){status='loadError';render();}}
 }
 function loadMine(){
  status='loading';render();
  async function start(){
   try{
    const app=firebase.apps?.length?firebase.app():firebase.initializeApp(config);SLAppCheck.activate(app);const database=app.database();let listeners=[],repository=null,repositoryUid='';
    app.auth().onAuthStateChanged(user=>{
     listeners.forEach(fn=>fn());listeners=[];const oldRepository=repository;repository=null;const version=++generation;imageSerial++;setImage('');data=null;rows=[];status='loading';render();
     if(oldRepository&&repositoryUid!==(!user?.isAnonymous?user?.uid:''))void oldRepository.forget();
     repositoryUid=!user?.isAnonymous?user?.uid||'':'';
     if(!user||user.isAnonymous){status='login';render();return;}
     repository=window.SLListMasterCache.forOwner(database,user.uid);
     let settings=null,saved=null,name=user.displayName||'ユーザー',image=null,ready=0,serial=0,validSession=true;const cache=repository;
     async function refresh(){
      if(ready<3||version!==generation||!validSession)return;const update=++serial,songs={};let next=0,failed=false;const records=Object.entries(saved||{}).filter(([id,item])=>/^[A-Za-z0-9_-]{1,80}$/.test(id)&&core.registered(item));
      const current=()=>version===generation&&update===serial&&validSession;
      await cache.warm;if(!current())return;
      if(records.length&&records.every(([id])=>cache.peek(id))){
       const cached=Object.fromEntries(records.map(([id,item])=>[id,core.song(cache.peek(id),item,{showKey:true,showParts:true})]).filter(([,row])=>row));
       accept({uid:user.uid,name,songs:cached,appearance:settings?.appearance,updatedAt:0});status='updating';render();setImage(validImage(image?.image)?image.image:'');
      }
      await Promise.all(Array.from({length:Math.min(8,records.length)},async()=>{while(next<records.length&&current()){const[id,item]=records[next++];try{const master=await cache.get(id);const row=core.song(master,item,{showKey:true,showParts:true});if(row)songs[id]=row;}catch{failed=true;}}}));
      if(!current())return;if(failed){status='refreshError';render();return;}
      accept({uid:user.uid,name,songs,appearance:settings?.appearance,updatedAt:0});setImage(validImage(image?.image)?image.image:'');
     }
     listeners.push(cache.subscribe(()=>void refresh()));
     for(const[path,receive]of [['userListShares/'+user.uid,v=>settings=v],['users/'+user.uid+'/songs',v=>saved=v||{}],['users/'+user.uid+'/profile/displayName',v=>name=v||user.displayName||'ユーザー'],['userListBackgrounds/'+user.uid,v=>image=v]]){
      const ref=database.ref(path);let loaded=false;const fn=snapshot=>{if(version!==generation)return;receive(snapshot.val());if(path==='userListBackgrounds/'+user.uid){setImage(validImage(image?.image)?image.image:'');return;}if(!loaded){loaded=true;ready++;}void refresh();};ref.on('value',fn,()=>{if(version===generation){if(path==='userListBackgrounds/'+user.uid){setImage('');return;}validSession=false;serial++;data=null;rows=[];status='loadError';setImage('');render();}});listeners.push(()=>ref.off('value',fn));
     }
    });
   }catch{status='loadError';render();}
  }
  if(typeof firebase.auth==='function')void start();else{const script=document.createElement('script');script.src='https://www.gstatic.com/firebasejs/10.13.0/firebase-auth-compat.js';script.onload=()=>void start();script.onerror=()=>{status='loadError';render();};document.head.append(script);}
 }
 if(preview){
  status='loading';render();window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='sl-list-preview')return;language=SLListShareText[event.data.language]?event.data.language:language;el('Language').value=language;accept(event.data.payload);setImage(validImage(event.data.image)?event.data.image:'');});
 }else{window.addEventListener('hashchange',()=>location.reload());if(mine)loadMine();else load();}
})();





