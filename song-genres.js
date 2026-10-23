/* Canonical five-column genres with read compatibility for existing song records. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SLSongGenres=api;})(typeof globalThis==='object'?globalThis:this,()=>{
 'use strict';
 const fields=['genre1','genre2','genre3','genre4','genre5'];
 const aliases={genre1:['genre1','genre','ジャンル①','ジャンル','ジャンル1'],genre2:['genre2','ジャンル②','ジャンル2'],genre3:['genre3','ジャンル③','ジャンル3'],genre4:['genre4','ジャンル④','ジャンル4'],genre5:['genre5','ジャンル⑤','ジャンル5']};
 const split=value=>[...new Set(String(value??'').split(/[\/／、,，|｜]/).map(v=>v.trim()).filter(Boolean))];
 function value(song,field){for(const key of aliases[field]||[]){if(song&&Object.hasOwn(song,key)&&song[key]!==null&&song[key]!==undefined)return String(song[key]);}return '';}
 const groups=song=>Object.fromEntries(fields.map(field=>[field,split(value(song,field))]));
 const all=song=>[...new Set(Object.values(groups(song)).flat())];
 function catalog(songs){const out=Object.fromEntries(fields.map(field=>[field,new Set()]));for(const song of songs)for(const field of fields)for(const tag of split(value(song,field)))out[field].add(tag);return Object.fromEntries(fields.map(field=>[field,[...out[field]].sort((a,b)=>a.localeCompare(b,'ja'))]));}
 function matches(song,selected,mode='and'){const chosen=fields.filter(field=>selected?.[field]);if(!chosen.length)return true;const tests=chosen.map(field=>split(value(song,field)).includes(selected[field]));return mode==='or'?tests.some(Boolean):tests.every(Boolean);}
 const defaults={"genre1":["J-POP","K-POP","洋楽"],"genre2":["TV（CM・バラエティ）主題歌","Vtuber","アニソン","ゲーム","ドラマ主題歌","ボカロ","映画主題歌","歌い手"],"genre3":["アイドル","アニメ","インスト","サンバ","シティポップ","ジャズ","フォーク","ポップス","ロック","合唱","童謡"],"genre4":["NHK","サンデー","ジブリ","ジャンプ","ディズニー","マーガレット","マガジン","りぼん"],"genre5":["ジャンプ"]};
 return{fields,aliases,split,value,groups,all,catalog,matches,defaults};
});
