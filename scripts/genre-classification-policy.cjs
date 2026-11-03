'use strict';
// Rules requested by the administrator. Artist evidence comes from indexed public
// MusicBrainz and official artist pages, not an exported spreadsheet song list.
const evidence=require('../maintenance/classification-country-evidence-20261104.json');
const fields=['artist','genre1','genre2','genre3','genre4','genre5','genre6'];
const split=v=>[...new Set(String(v??'').split(/[/／、,，|｜]/).map(t=>t.trim()).filter(Boolean))];
const tagAliases={'VTuber':'Vtuber','VTUBER':'Vtuber','ジャンプ':'週刊少年ジャンプ','サンデー':'週刊少年サンデー','マガジン':'週刊少年マガジン'};
const artistAliases={'テレサテン':'テレサ・テン','Earth, Wind &: Fire':'Earth, Wind & Fire','EARTH, WIND &: FIRE':'Earth, Wind & Fire','Earth Wind &: Fire':'Earth, Wind & Fire','Stevie wonder':'Stevie Wonder'};
const pendingArtists=new Set(['DAZBEE','ダズビー','Juniel(주니엘)','F.I.R.','AAA ( HYUKOH(혁오) & 落日飛車 Sunset Rollercoaster )','Guriri &, M2U']);
const value=(s,f)=>String((f==='genre1'&&!Object.hasOwn(s,f)?s.genre:s[f])??'');
function classify(song,existingForeignArtists=new Set()){
 const next=Object.fromEntries(fields.map(f=>[f,value(song,f)]));
 for(let n=1;n<=6;n++)next['genre'+n]=[...new Set(split(next['genre'+n]).map(t=>tagAliases[t]||t))].join('、');
 const special=Array.from({length:6},(_,i)=>split(next['genre'+(i+1)])).flat().some(t=>['ボカロ','アニソン','Vtuber','ゲーム'].includes(t));
 const artist=next.artist,label=evidence[artist]?.classification||(existingForeignArtists.has(artist)?'洋楽':'');
 if(label)next.genre1=label;
 else if(special)next.genre1=split(next.genre1).filter(t=>t!=='J-POP').join('、');
 else if(!pendingArtists.has(artist))next.genre1='J-POP';
 if(special)for(let n=2;n<=6;n++)next['genre'+n]=split(next['genre'+n]).filter(t=>t!=='J-POP').join('、');
 if(artistAliases[artist])next.artist=artistAliases[artist];return next;
}
function plan(songs){
 const foreign=new Set(Object.values(songs).filter(s=>value(s,'genre1')==='洋楽'&&s.artist).map(s=>String(s.artist))),entries=[];
 for(const[id,song]of Object.entries(songs)){
  const after=classify(song,foreign),before=Object.fromEntries(fields.map(f=>[f,value(song,f)]));
  const changes=Object.fromEntries(fields.filter(f=>before[f]!==after[f]).map(f=>[f,{before:before[f],after:after[f]}]));
  if(Object.keys(changes).length)entries.push({id,title:String(song.title??''),chordwiki:String(song.chordwiki??''),baseline:before,changes});
 }return entries;
}
module.exports={fields,split,value,evidence,pendingArtists,classify,plan};
