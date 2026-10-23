/* Shared, dependent category controls for the app and standalone My List. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./song-genres.js'):root.SLSongGenres);if(typeof module==='object'&&module.exports)module.exports=api;else root.SLCategoryFilters=api;})(typeof globalThis==='object'?globalThis:this,genres=>{
 'use strict';
 // Display order only: a singer name alone does not identify the engine used by a song.
 const singerOrder=new Map([
  ['初音ミク','鏡音リン','鏡音レン','巡音ルカ','KAITO','MEIKO','GUMI','IA','Lily','flower','miki','歌愛ユキ','結月ゆかり','Fukase','MAYU','神威がくぽ','CYBER DIVA','VY1','あきこロイドちゃん','ギャラ子','洛天依','Ken','LUMi','アルスロイド','音街ウナ','心華','兎眠りおん','氷山キヨテル'],
  ['可不','星界','裏命','ONE','POPY','ROSE'],
  ['花隈千冬','SOLARIA'],
  ['重音テト','足立レイ','波音リツ','穂歌ソラ']
 ].flatMap((names,rank)=>names.map(name=>[name,rank])));
 function compareOptions(field,a,b){if(field==='anime_year')return Number(b)-Number(a);if(field==='vocal_synths'){const order=(singerOrder.get(a)??4)-(singerOrder.get(b)??4);if(order)return order;}return a.localeCompare(b,'ja');}
 function controls(category){return [{field:'genre6',label:'音楽ジャンル'},...(category==='ボカロ'?[{field:'vocal_synths',label:'ボカロ別'}]:[]),...(category==='アニソン'?[{field:'anime_year',label:'放送・公開年'},{field:'genre5',label:'掲載媒体・関連作品'}]:[])];}
 function options(catalog,category,field){return [...new Set((catalog.facets?.[category]?(catalog.facets[category][field]||[]):(catalog.groups?.[field]||[])).filter(Boolean))].sort((a,b)=>compareOptions(field,a,b));}
 function render(host,selected,catalog,onChange){
  const category=genres.categoryOf(selected),fragment=document.createDocumentFragment(),tabs=document.createElement('div');tabs.className='sl-category-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','楽曲カテゴリ');
  for(const name of ['',...genres.categories]){const button=document.createElement('button');button.type='button';button.className='genre-btn sl-category-button';button.textContent=name||'すべて';button.dataset.category=name;button.setAttribute('aria-pressed',String(category===name));button.classList.toggle('active',category===name);button.onclick=()=>onChange(genres.selection(name));tabs.append(button);}fragment.append(tabs);
  if(category){const row=document.createElement('div');row.className='sl-category-selects';for(const {field,label}of controls(category)){const wrapper=document.createElement('label'),name=document.createElement('span'),select=document.createElement('select');name.textContent=label;select.dataset.filterField=field;select.setAttribute('aria-label',label);const values=options(catalog,category,field);select.append(new Option(values.length?'すべて':'登録された項目なし',''));for(const value of values)select.append(new Option(field==='anime_year'?value+'年':value,value));select.value=selected[field]||'';select.disabled=!values.length;select.onchange=()=>{const next={...selected};if(select.value)next[field]=select.value;else delete next[field];onChange(next);};wrapper.append(name,select);row.append(wrapper);}fragment.append(row);}host.replaceChildren(fragment);
 }
 return{controls,options,render};
});
