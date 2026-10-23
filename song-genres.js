/* Canonical five-column genres with read compatibility for existing song records. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./sort-master.js'):root.SLSortMaster);if(typeof module==='object'&&module.exports)module.exports=api;else root.SLSongGenres=api;})(typeof globalThis==='object'?globalThis:this,master=>{
 'use strict';
 const fields=['genre1','genre2','genre3','genre4','genre5','genre6'];
 const metadataFields=[...fields,'vocal_synths','release_year','anime_year'];
 const aliases={genre1:['genre1','genre','ジャンル①','ジャンル','ジャンル1'],genre2:['genre2','ジャンル②','ジャンル2'],genre3:['genre3','ジャンル③','ジャンル3'],genre4:['genre4','ジャンル④','ジャンル4'],genre5:['genre5','ジャンル⑤','ジャンル5']};
 aliases.genre6=['genre6','ジャンル⑥'];aliases.vocal_synths=['vocal_synths'];aliases.release_year=['release_year'];aliases.anime_year=['anime_year'];
 const split=value=>[...new Set(String(value??'').split(/[\/／、,，|｜]/).map(v=>v.trim()).filter(Boolean))];
 function value(song,field){for(const key of aliases[field]||[]){if(song&&Object.hasOwn(song,key)&&song[key]!==null&&song[key]!==undefined)return String(song[key]);}return '';}
 const groups=song=>Object.fromEntries(fields.map(field=>[field,split(value(song,field))]));
 const all=song=>[...new Set(Object.values(groups(song)).flat())];
 function filterGroups(song){return Object.fromEntries(metadataFields.map(field=>[field,split(value(song,field))]));}
 function catalog(songs){const out=Object.fromEntries(metadataFields.map(field=>[field,new Set()]));for(const song of songs)for(const field of metadataFields)for(const tag of split(value(song,field)))out[field].add(tag);return Object.fromEntries(metadataFields.map(field=>[field,[...out[field]].sort((a,b)=>a.localeCompare(b,'ja'))]));}
 function matches(song,selected,mode='and'){const chosen=metadataFields.filter(field=>selected?.[field]);if(!chosen.length)return true;const tests=chosen.map(field=>master?.fields.includes(field)?master.matches(field,split(value(song,field)),selected[field]):split(value(song,field)).includes(selected[field]));return mode==='or'?tests.some(Boolean):tests.every(Boolean);}
 const defaults={"genre1":["J-POP","K-POP","洋楽"],"genre2":["TV（CM・バラエティ）主題歌","Vtuber","アニソン","ゲーム","ドラマ主題歌","ボカロ","映画主題歌","歌い手"],"genre3":["アイドル","アニメ","インスト","サンバ","シティポップ","ジャズ","フォーク","ポップス","ロック","合唱","童謡"],"genre4":["NHK","サンデー","ジブリ","ジャンプ","ディズニー","マーガレット","マガジン","りぼん"],"genre5":["ジャンプ"]};
 defaults.genre3=['TV（CM・バラエティ）主題歌','ゲーム','ドラマ主題歌','映画主題歌'];defaults.genre4=['アイドル','アニメ'];defaults.genre5=['NHK','サンデー','ジブリ','ジャンプ','ディズニー','マーガレット','マガジン','りぼん','ちゃお'];defaults.genre6=['ポップス','ロック','バラード','ジャズ','シティポップ','フォーク','サンバ','インスト','合唱','童謡'];defaults.vocal_synths=[];defaults.release_year=[];defaults.anime_year=[];
 const categories=['J-POP','アニソン','ボカロ','K-POP','洋楽'];
 function selection(category){return category?{[/^(アニソン|ボカロ)$/.test(category)?'genre2':'genre1']:category}:{};}
 function categoryOf(selected){return ['アニソン','ボカロ'].includes(selected?.genre2)?selected.genre2:['J-POP','K-POP','洋楽'].includes(selected?.genre1)?selected.genre1:'';}
 function facets(songs){return Object.fromEntries(categories.map(category=>[category,catalog(songs.filter(song=>matches(song,selection(category))))]));}
 return{fields,metadataFields,aliases,split,value,groups,filterGroups,all,catalog,matches,defaults,categories,selection,categoryOf,facets};
});
