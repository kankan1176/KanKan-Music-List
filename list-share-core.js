/* Shared, pure transformations. Never include private account or unsaved data. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SLListShare=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const tokenOK=value=>typeof value==='string'&&/^[a-f0-9]{48}$/.test(value);
 const registered=item=>item&&typeof item==='object'&&!item.excluded&&(item.registered===true||!!item.part||Array.isArray(item.parts)&&item.parts.length>0||item.liked===true);
 function wiki(raw){try{const url=new URL(String(raw||''));return url.protocol==='https:'&&['ja.chordwiki.org','beta.chordwiki.org','chordwiki.org'].includes(url.hostname)&&!url.port&&!url.username&&!url.password?url.href:'';}catch{return '';}}
 const genreCore=typeof module==='object'&&module.exports?require('./song-genres.js'):SLSongGenres;
 function genres(master){return genreCore.all(master).slice(0,12).map(value=>value.slice(0,80));}
 function song(master,item,options){
  const title=String(master?.title||master?.['曲名']||'').trim().slice(0,500);
  if(!title)return null;
  const value={genresKnown:true,genres:genres(master),...Object.fromEntries(genreCore.metadataFields.map(field=>[field,genreCore.value(master,field)])),title,artist:String(master?.artist||master?.['アーティスト']||'').slice(0,300)};
  const url=wiki(master?.chordwiki||master?.['コードwiki']);if(url)value.url=url.slice(0,2048);
  if(options.showKey)value.key=Number.isInteger(item.key)&&item.key>=-5&&item.key<=6?item.key:0;
  if(options.showParts){const parts=Array.isArray(item.parts)?item.parts:item.part?[item.part]:[];value.parts=[...new Set(parts.filter(p=>typeof p==='string'&&p.length<=40))].slice(0,7);if(!value.parts.length)delete value.parts;}
  return value;
 }
 const wikiVersions=typeof module==='object'&&module.exports?require('./chordwiki-version.js'):SLChordWiki;
 function link(raw,key,version){return wikiVersions.link(raw,key,version);}

 return {tokenOK,registered,wiki,song,link,genres};
});

