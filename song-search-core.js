/* Public master columns shared by indexed, local and My List searches. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SLSongSearch=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const aliases={title:['曲名'],artist:['アーティスト'],bpm:['BPM'],genre:['ジャンル'],genre1:['ジャンル①'],genre2:['ジャンル②'],genre3:['ジャンル③'],genre4:['ジャンル④'],genre5:['ジャンル⑤'],genre6:['ジャンル⑥'],vocal_synths:[],release_year:[],anime_year:[],tieup:['タイアップ情報'],search:['検索'],lyrics:['作詞'],composition:['作曲'],arrangement:['編曲']};
 const fields=Object.keys(aliases);
 const normalize=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ja').replace(/[^\p{L}\p{N}\p{M}]+/gu,' ').trim();
 const text=song=>normalize(fields.flatMap(field=>[field,...aliases[field]].map(key=>song?.[key]??'')).join(' '));
 const matches=(song,query)=>{const value=text(song);return normalize(query).split(/\s+/).filter(Boolean).every(term=>value.includes(term));};
 return{fields,normalize,text,matches};
});
