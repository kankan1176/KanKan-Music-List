/* Only the two official ChordWiki versions may be selected. Master URLs stay canonical. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SLChordWiki=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const normalize=value=>value==='beta'?'beta':'normal';
 function url(raw,version='normal'){
  try{
   const value=String(raw||'').trim(),parsed=new URL(value);
   if(!/^https:\/\//i.test(value)||/[\\\x00-\x1f\x7f]/.test(value)||parsed.protocol!=='https:'||!['ja.chordwiki.org','beta.chordwiki.org','chordwiki.org'].includes(parsed.hostname)||parsed.username||parsed.password||parsed.port)return '';
   // Change only the authority; preserve encoded titles, plus signs, query parameters and fragments.
   return value.replace(/^https:\/\/[^/\\?#]+/i,'https://'+(normalize(version)==='beta'?'beta':'ja')+'.chordwiki.org');
  }catch{return '';}
 }
 function link(raw,key,version='normal'){
  const safe=url(raw,version);if(!safe)return '';
  if(!Number.isInteger(key)||key===0)return safe;
  if(key < -5 || key > 6)return '';
  const parsed=new URL(safe);let title='';
  try{title=parsed.pathname.startsWith('/wiki/')?decodeURIComponent(parsed.pathname.slice(6).replace(/\+/g,' ')):parsed.searchParams.get('c')==='view'?parsed.searchParams.get('t')||'':'';}catch{return '';}
  if(!title)return safe;
  return parsed.origin+'/wiki.cgi?'+new URLSearchParams({c:'view',t:title,key:String(key),symbol:''}).toString();
 }
 return {normalize,url,link};
});
