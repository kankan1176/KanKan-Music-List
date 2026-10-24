/* Exact, master-backed artist recognition shared by registration and maintenance. */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./data/reference-masters/vtubers.json'):root.SLVtuberMaster);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.SLArtistClassification=api;
})(typeof globalThis!=='undefined'?globalThis:this,master=>{
 'use strict';
 if(!master||master.schemaVersion!==1||!Array.isArray(master.entries))throw Error('VTuber master is unavailable');
 const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/gu,'');
 const names=new Map();
 for(const entry of master.entries){
  if(!entry.name||!entry.group)throw Error('Invalid VTuber master row');
  const key=normalize(entry.name),old=names.get(key);
  if(old&&old.group!==entry.group)throw Error('Ambiguous VTuber master alias');
  names.set(key,{name:entry.name,group:entry.group});
 }
 function match(artist){
  const raw=String(artist||'').trim(),exact=names.get(normalize(raw));
  const matches=exact?[exact]:raw.split(/[、,，&＆＋+／/]|\s+(?:feat\.?|featuring|with)\s+/iu).map(part=>names.get(normalize(part))).filter(Boolean);
  return {matches:[...new Map(matches.map(entry=>[normalize(entry.name),entry])).values()],groups:[...new Set(matches.map(entry=>entry.group))]};
 }
 function appendTags(previous,extra){
  const original=String(previous??''),seen=new Set(original.split('、').map(value=>value.trim())),added=[];
  for(const value of extra)if(value&&!seen.has(value)){seen.add(value);added.push(value);}
  return [original,...added].filter(Boolean).join('、');
 }
 function enrich(song){
  const result=match(song.artist);if(!result.matches.length)return {};
  const next={genre2:appendTags(song.genre2,['Vtuber']),genre4:appendTags(song.genre4,result.groups)};
  if(Object.values(next).some(value=>value.length>100))throw Error('VTuber classification exceeds the existing genre limit');
  return next;
 }
 return {match,appendTags,enrich,normalize};
});
