(() => {
 'use strict';
 const el=id=>document.getElementById(id);
 const paths={
 '🎤':['ボーカル','M9 12a4 4 0 1 0 6-6 4 4 0 0 0-6 6ZM10 13 3 20l1 1 7-7M13 5l6 6'],
 '🎸':['ギター','M14 10 20 3l1 1-6 7c2 3 0 5-2 5 0 3-3 5-6 3s-3-6 0-7c0-3 4-4 7-2ZM9 13l2 2'],
 '🥁':['ドラム','M4 8c0-4 16-4 16 0v10c0 4-16 4-16 0V8Zm0 0c0 4 16 4 16 0M7 10v9m10-9v9M3 2l9 5m9-5-9 5'],
 '🎹':['鍵盤','M3 4h18v16H3ZM7 4v16m5-16v16m5-16v16M7 4v8m5-8v8m5-8v8'],
 '🎺':['管楽器','M3 12h9l7-6v14l-7-6H3Zm4 0V8m4 4V8m-4 8v3h6v-4'],
 '🎻':['弦楽器','M12 8V2m-2 6c-6 0-5 5-2 5-5 3-3 8 4 8s9-5 4-8c3 0 4-5-2-5M12 8v10M20 2l-2 19'],
 '🪈':['笛','M17 2 4 20l3 2L20 4ZM14 9l1 1m-4 3 1 1m-4 3 1 1']
 };
 function parts(){
  el('detailPersonalControls')?.querySelectorAll('.detail-part-icons button').forEach(button=>{
   const value=paths[button.textContent.trim()];if(!value)return;
   const [label,path]=value;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
   const shape=document.createElementNS(svg.namespaceURI,'path');shape.setAttribute('d',path);svg.append(shape);
   const caption=document.createElement('span');caption.className='sl-part-caption';caption.textContent=label;button.replaceChildren(svg,caption);
  });
 }
 function tab(value){
  const selected=value==='play'?'play':'info';el('songDetailsModal').dataset.detailTab=selected;
  ['info','play'].forEach(key=>{const button=el(key==='info'?'detailInfoTab':'detailPlayTab');button.setAttribute('aria-selected',String(key===selected));button.tabIndex=key===selected?0:-1;});
 }
 function render(song,loggedIn){
  const year=String(song.release_year||'').trim();el('detailYear').textContent=year?year+'年':'';el('detailYearBadge').hidden=!year;
  el('detailTieup').textContent=[song['タイアップ情報'],song.anime_year?'作品公開：'+song.anime_year+'年':''].filter(Boolean).join('\n');el('detailTieupSection').hidden=!el('detailTieup').textContent.trim();
  el('detailGenre6').textContent=window.SLSongGenres?.value(song,'genre6')||'';
  const seen=new Set();for(let i=1;i<=6;i++){const node=el('detailGenre'+i),value=node.textContent.trim();node.hidden=!value||value==='-'||seen.has(value);if(!node.hidden)seen.add(value);}
  el('detailGenreSection').hidden=!seen.size;
  el('detailLoginNote').hidden=loggedIn;el('detailNoScore').hidden=el('detailKeyArea').style.display!=='none';
  parts();tab('info');el('songDetailsModal').querySelector('.modal').scrollTop=0;
 }
 window.SLDetailView={render,parts,tab};
 document.addEventListener('keydown',event=>{if(!event.target.closest('#songDetailsModal [role=tab]'))return;if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const play=event.key==='End'||(event.key!=='Home'&&el('songDetailsModal').dataset.detailTab!=='play');tab(play?'play':'info');el(play?'detailPlayTab':'detailInfoTab').focus();});
})();
