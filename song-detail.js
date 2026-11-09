(() => {
 'use strict';
 const el=id=>document.getElementById(id);
 // Generated instrument illustrations; each SVG frames one instrument from the shared sheet.
 const instruments={
  '🎤':['ボーカル','30 230 265 310'], '🎸':['ギター','290 215 300 340'],
  '🥁':['ドラム','600 250 265 290'], '🎹':['鍵盤','885 285 285 205'],
  '🎺':['管楽器','1190 290 305 185'], '🎻':['弦楽器','1500 185 260 380'],
  '🪈':['笛','1765 210 255 350']
 };
 function parts(){
  el('detailPersonalControls')?.querySelectorAll('.detail-part-icons button').forEach(button=>{
   const value=instruments[button.textContent.trim()];if(!value)return;
   const [label,viewBox]=value;
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
   svg.classList.add('sl-instrument-illustration');
   svg.setAttribute('viewBox',viewBox);svg.setAttribute('aria-hidden','true');
   const image=document.createElementNS(svg.namespaceURI,'image');
   image.setAttribute('href','assets/instrument-icons.webp?v=20261109-1');
   image.setAttribute('width','2048');image.setAttribute('height','719');
   const defs=document.createElementNS(svg.namespaceURI,'defs'),clip=document.createElementNS(svg.namespaceURI,'clipPath'),rect=document.createElementNS(svg.namespaceURI,'rect');
   const clipId='sl-instrument-'+Object.keys(instruments).indexOf(button.textContent.trim());
   clip.id=clipId;clip.setAttribute('clipPathUnits','userSpaceOnUse');
   viewBox.split(' ').forEach((v,i)=>rect.setAttribute(['x','y','width','height'][i],v));
   clip.append(rect);defs.append(clip);image.setAttribute('clip-path','url(#'+clipId+')');svg.append(defs,image);
   const caption=document.createElement('span');caption.className='sl-part-caption';caption.textContent=label;
   button.replaceChildren(svg,caption);
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
