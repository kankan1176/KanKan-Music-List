/* Shared, pure transformations. Never include private account or unsaved data. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SLListShare=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const tokenOK=value=>typeof value==='string'&&/^[a-f0-9]{48}$/.test(value);
 const registered=item=>item&&typeof item==='object'&&!item.excluded&&(item.registered===true||!!item.part||Array.isArray(item.parts)&&item.parts.length>0||item.liked===true);
 function wiki(raw){try{const url=new URL(String(raw||''));return url.protocol==='https:'&&['ja.chordwiki.org','chordwiki.org'].includes(url.hostname)&&!url.port&&!url.username&&!url.password?url.href:'';}catch{return '';}}
 function song(master,item,options){
  const title=String(master?.title||master?.['曲名']||'').trim().slice(0,500);
  if(!title)return null;
  const value={title,artist:String(master?.artist||master?.['アーティスト']||'').slice(0,300)};
  const url=wiki(master?.chordwiki||master?.['コードwiki']);if(url)value.url=url.slice(0,2048);
  if(options.showKey)value.key=Number.isInteger(item.key)&&item.key>=-5&&item.key<=6?item.key:0;
  if(options.showParts){const parts=Array.isArray(item.parts)?item.parts:item.part?[item.part]:[];value.parts=[...new Set(parts.filter(p=>typeof p==='string'&&p.length<=40))].slice(0,7);if(!value.parts.length)delete value.parts;}
  return value;
 }
 function link(raw,key){
  const safe=wiki(raw);if(!safe)return '';
  if(!Number.isInteger(key)||key===0)return safe;
  const url=new URL(safe);let title='';
  try{title=url.pathname.startsWith('/wiki/')?decodeURIComponent(url.pathname.slice(6)):url.searchParams.get('t')||'';}catch{return safe;}
  if(!title)return safe;
  return 'https://ja.chordwiki.org/wiki.cgi?'+new URLSearchParams({c:'view',t:title,key:String(key),symbol:''}).toString();
 }
 return {tokenOK,registered,wiki,song,link};
});
