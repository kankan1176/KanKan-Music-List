'use strict';
function addGenreRules(document){
 const out=structuredClone(document),r=out.rules,string={'.validate':'newData.isString() && newData.val().length <= 100'};
 function wildcard(node,key){const keys=Object.keys(node||{}).filter(k=>k.startsWith('$')&&k!=='$other');if(keys.length>1)throw Error('Unexpected genre schema wildcard');return node[keys[0]||key] ||= {};}
 const song=wildcard(r.songs,'$songId'),request=wildcard(wildcard(r.songAddRequests ||= {},'$uid'),'$requestId'),shared=wildcard(r.publicListShares,'$token').songs.$song;
 for(let i=1;i<=6;i++)for(const entry of [song,request,shared])entry['genre'+i]=structuredClone(string);
 for(const field of ['vocal_synths','release_year','anime_year'])for(const entry of [song,request,shared])entry[field]=structuredClone(string);
 return out;
}
module.exports={addGenreRules};
