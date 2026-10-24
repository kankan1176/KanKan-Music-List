'use strict';
function addGenreRules(document){
 const out=structuredClone(document),r=out.rules,string={'.validate':'newData.isString() && newData.val().length <= 100'};
 function wildcard(node,key){const keys=Object.keys(node||{}).filter(k=>k.startsWith('$')&&k!=='$other');if(keys.length>1)throw Error('Unexpected genre schema wildcard');return node[keys[0]||key] ||= {};}
 const song=wildcard(r.songs,'$songId'),request=wildcard(wildcard(r.songAddRequests ||= {},'$uid'),'$requestId'),shared=wildcard(r.publicListShares,'$token').songs.$song;
 for(let i=1;i<=6;i++)for(const entry of [song,request,shared])entry['genre'+i]=structuredClone(string);
 for(const field of ['vocal_synths','release_year','anime_year'])for(const entry of [song,request,shared])entry[field]=field==='vocal_synths'?{'.validate':'newData.isString() && newData.val().length <= 1000'}:structuredClone(string);
 const nonblank=field=>{const value=`newData.child('${field}').val()`;const whitespace=[9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279];const trimmed=whitespace.reduce((expression,code)=>expression+".replace("+JSON.stringify(String.fromCharCode(code)).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+",'')",value);return `newData.child('${field}').isString() && ${trimmed}.length > 0`;};
 const url="newData.child('chordwiki')",urlValue=url+'.val()';
 const official=['https://ja.chordwiki.org/wiki/','https://beta.chordwiki.org/wiki/','https://ja.chordwiki.org/wiki.cgi?','https://beta.chordwiki.org/wiki.cgi?'].map(prefix=>urlValue+".beginsWith('"+prefix+"')").join(' || ');
 const required="data.exists() || (newData.hasChildren(['title','artist','chordwiki']) && "+nonblank('title')+' && '+nonblank('artist')+' && '+url+'.isString() && '+urlValue+'.length <= 2048 && ('+official+'))';
 const old=request['.validate'];request['.validate']=old===false||old==='false'?old:!old||old===true||old==='true'?required:old.includes(required)?old:'('+old+') && ('+required+')';
 return out;
}
module.exports={addGenreRules};
