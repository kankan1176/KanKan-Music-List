'use strict';
function addGenreRules(document){
 const out=structuredClone(document),r=out.rules,string={'.validate':'newData.isString() && newData.val().length <= 100'};
 function wildcard(node,key){const keys=Object.keys(node||{}).filter(k=>k.startsWith('$')&&k!=='$other');if(keys.length>1)throw Error('Unexpected genre schema wildcard');return node[keys[0]||key] ||= {};}
 const song=wildcard(r.songs,'$songId'),request=wildcard(wildcard(r.songAddRequests ||= {},'$uid'),'$requestId'),shared=wildcard(r.publicListShares,'$token').songs.$song;
 for(let i=1;i<=6;i++)for(const entry of [song,request,shared])entry['genre'+i]=structuredClone(string);
 for(const field of ['vocal_synths','release_year','anime_year'])for(const entry of [song,request,shared])entry[field]=field==='vocal_synths'?{'.validate':'newData.isString() && newData.val().length <= 1000'}:structuredClone(string);
 const required=String.raw`data.exists() || (newData.hasChildren(['title','artist','chordwiki']) && newData.child('title').isString() && newData.child('title').val().matches(/.*[^\x00-\x20\x7f\xa0　].*/) && newData.child('artist').isString() && newData.child('artist').val().matches(/.*[^\x00-\x20\x7f\xa0　].*/) && newData.child('chordwiki').isString() && newData.child('chordwiki').val().length <= 2048 && newData.child('chordwiki').val().matches(/^https:\/\/(ja|beta)\.chordwiki\.org\/(wiki\/[^?#]+|wiki\.cgi\?[^#]+)$/) && newData.child('chordwiki').val().matches(/^[^\x00-\x20\x7f]+$/))`;
 const old=request['.validate'];request['.validate']=old===false||old==='false'?old:!old||old===true||old==='true'?required:old.includes(required)?old:'('+old+') && ('+required+')';
 return out;
}
module.exports={addGenreRules};
