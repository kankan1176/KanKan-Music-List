/* Room setlist export. Uses the same queue order as the session dock. */
(()=>{
'use strict';
const style=document.createElement('style');style.textContent=`
#setlistShareDialog{width:min(920px,96vw);max-height:92dvh;overflow:auto;border:1px solid var(--border-color,#ccc);border-radius:20px;background:var(--panel-bg,#fff);color:var(--text-color,#111);padding:24px}#setlistShareDialog::backdrop{background:#0009}.setlist-top,.setlist-controls,.setlist-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.setlist-top{justify-content:space-between}.setlist-controls label{display:grid;gap:6px;flex:1;min-width:150px}.setlist-controls input,.setlist-controls select{padding:10px;width:100%;font:inherit;border:1px solid #888;border-radius:8px;background:var(--panel-bg,#fff);color:inherit}.setlist-preview canvas{width:100%;height:auto;display:block;margin:18px 0;border:1px solid #888;border-radius:8px}.setlist-actions button,.setlist-top button{padding:12px 18px;border-radius:12px;cursor:pointer;font:inherit}.setlist-actions{border-top:1px solid #8885;padding-top:18px}.setlist-note{font-size:13px;line-height:1.7}#setlistShareStatus{min-height:1.5em}@media(max-width:600px){#setlistShareDialog{margin:auto auto 0;width:100%;max-width:100%;max-height:90dvh;border-radius:20px 20px 0 0;padding:18px}.setlist-actions button{flex:1 1 40%}}
`;document.head.append(style);
const dialog=document.createElement('dialog');dialog.id='setlistShareDialog';dialog.innerHTML=`
<div class="setlist-top"><h2>セットリストを共有</h2><button type="button" aria-label="閉じる" id="setlistClose">✕</button></div>
<div class="setlist-controls"><label>ルーム名<input id="setlistRoomName" maxlength="80" placeholder="ルーム名を入力"></label><label>日付<input id="setlistDate" type="date" required></label><label>デザイン<select id="setlistTheme"><option value="paper">① くしゃ紙・明朝</option><option value="white">② 白い紙・ゴシック</option><option value="black">③ 黒いテクスチャ・明朝</option></select></label></div>
<p class="setlist-note">完了曲を右バーの並び順で表示します。1枚20曲以内で、各画像の曲数を均等に分けます。画像は横長1.91:1です。</p>
<div class="setlist-preview" id="setlistPreview"></div><p id="setlistShareStatus" role="status"></p>
<div class="setlist-actions"><button type="button" id="setlistSave">↓ 画像保存</button><button type="button" id="setlistX">𝕏 投稿</button><button type="button" id="setlistNative">↗ その他のアプリへ共有</button><button type="button" id="setlistCopy">投稿文をコピー</button></div>
<p class="setlist-note">Xボタンは投稿文を開きます。保存した画像を添付してください。Discordへは「その他のアプリへ共有」または画像保存から投稿できます。共有先は端末によって異なります。</p>`;document.body.append(dialog);
const $=id=>document.getElementById(id);let songs=[],roomId='',generation=0,files=[],busy=false;
function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function status(text){$('setlistShareStatus').textContent=text;}
function valid(){if(!currentRoomId||currentRoomId!==roomId){status('ルームが変更されました。閉じて開き直してください。');return false;}if(!$('setlistRoomName').value.trim()){status('ルーム名を入力してください。');$('setlistRoomName').focus();return false;}if(!$('setlistDate').value){status('日付を指定してください。');return false;}return true;}
const fonts={serif:'"Yu Mincho","Hiragino Mincho ProN","Noto Serif CJK JP",Georgia,serif',sans:'"Yu Gothic","Hiragino Kaku Gothic ProN","Noto Sans CJK JP",sans-serif',hand:'"Yu Kyokasho","Klee","Hiragino Mincho ProN","Yu Mincho",cursive'};
// Text is fitted into independent rectangles, so even long titles cannot enter the artist area.
function drawText(ctx,text,x,y,width,height,size,family,color,maxLines=1){
 let lines=[];
 for(;size>=10;size--){
  ctx.font=`${size}px ${family}`;lines=[''];
  for(const ch of Array.from(String(text))){if(ctx.measureText(lines.at(-1)+ch).width>width&&lines.at(-1))lines.push(ch);else lines[lines.length-1]+=ch;}
  if(lines.length<=maxLines&&lines.length*size*1.3<=height)break;
 }
 ctx.save();ctx.beginPath();ctx.rect(x,y,width,height);ctx.clip();ctx.fillStyle=color;ctx.textBaseline='top';
 const visible=lines.slice(0,Math.max(1,Math.floor(height/(size*1.3))));
 if(visible.length<lines.length){let last=visible.at(-1);while(ctx.measureText(last+'…').width>width)last=last.slice(0,-1);visible[visible.length-1]=last+'…';}
 visible.forEach((line,i)=>ctx.fillText(line,x,y+i*size*1.3));ctx.restore();
}
const backgrounds=new Map();
function background(theme){
 if(backgrounds.has(theme))return backgrounds.get(theme);
 const c=document.createElement('canvas');c.width=1910;c.height=1000;const ctx=c.getContext('2d');
 let seed=1729;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 ctx.fillStyle=theme==='black'?'#202122':theme==='paper'?'#e9e3da':'#fafaf8';ctx.fillRect(0,0,c.width,c.height);
 // Layered translucent grain and creases are local assets: exports do not depend on remote images.
 for(let i=0;i<(theme==='black'?8500:5000);i++){
  const x=random()*1910,y=random()*1000,r=theme==='white'?1+random()*10:3+random()*95;
  const g=ctx.createRadialGradient(x,y,0,x,y,r);const light=random()>.5;
  g.addColorStop(0,theme==='black'?(light?'rgba(210,210,210,.055)':'rgba(0,0,0,.15)'):(theme==='white'?(light?'rgba(255,255,255,.02)':'rgba(105,90,74,.006)'):(light?'rgba(255,255,255,.13)':'rgba(105,90,74,.035)')));g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
 }
 if(theme==='paper')for(let i=0;i<65;i++){
  const x=random()*1910,y=random()*1000,dx=(random()-.5)*600,dy=(random()-.5)*500;
  ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+dx*.45+50,y+dy*.45-30,x+dx,y+dy);ctx.lineWidth=2+random()*7;ctx.strokeStyle='rgba(105,85,68,.10)';ctx.stroke();ctx.translate(3,-3);ctx.strokeStyle='rgba(255,255,255,.24)';ctx.stroke();ctx.translate(-3,3);
 }
 backgrounds.set(theme,c);return c;
}
function render(){
 const version=++generation;files=[];$('setlistPreview').replaceChildren();const name=$('setlistRoomName').value.trim()||'ルーム名',date=$('setlistDate').value.replaceAll('-','. '),theme=$('setlistTheme').value,black=theme==='black';
 const ink=black?'#faf9f5':'#111213',family=theme==='white'?fonts.sans:fonts.serif;
 const pages=Math.ceil(songs.length/20),jobs=[];
 for(let page=0;page<pages;page++){
  const canvas=document.createElement('canvas');canvas.width=1910;canvas.height=1000;canvas.setAttribute('aria-label',`セットリスト ${page+1}/${pages}`);$('setlistPreview').append(canvas);
  const ctx=canvas.getContext('2d');ctx.drawImage(background(theme),0,0);ctx.textBaseline='top';
  drawText(ctx,'〜本日のセットリスト〜',125,100,470,40,27,fonts.sans,ink);
  ctx.fillStyle=ink;ctx.globalAlpha=.65;ctx.fillRect(675,100,2,800);ctx.fillRect(110,410,440,2);ctx.globalAlpha=1;
  drawText(ctx,name,120,285,450,115,85,black?fonts.hand:family,ink,2);
  drawText(ctx,date,120,820,440,55,32,fonts.hand,ink);
  const start=Math.floor(page*songs.length/pages),end=Math.floor((page+1)*songs.length/pages);
  const batch=songs.slice(start,end),columns=batch.length>10?2:1,perColumn=Math.ceil(batch.length/columns),columnWidth=columns===2?510:1070,rowHeight=Math.min(85,790/perColumn);
  batch.forEach((song,i)=>{
   const col=Math.floor(i/perColumn),row=i%perColumn,x=750+col*560,y=100+row*rowHeight;
   drawText(ctx,String(start+i+1).padStart(2,'0'),x,y+6,48,rowHeight-12,28,fonts.serif,ink);
   // Measure the whole row before drawing; artist follows the actual title with a constant gap.
   const textX=x+76,available=columnWidth-76,gap=24;
   let titleSize=columns===2?26:34,artistSize=columns===2?16:20,titleWidth,artistWidth;
   const measure=()=>{ctx.font=`${titleSize}px ${family}`;titleWidth=ctx.measureText(song.title).width;ctx.font=`${artistSize}px ${fonts.sans}`;artistWidth=ctx.measureText(song.artist).width;};
   measure();
   while(titleWidth+gap+artistWidth>available&&(titleSize>10||artistSize>10)){
    if(titleSize>10)titleSize--;else artistSize--;measure();
   }
   ctx.save();ctx.beginPath();ctx.rect(textX,y,available,rowHeight-12);ctx.clip();ctx.textBaseline='alphabetic';ctx.fillStyle=ink;
   const baseline=y+Math.min(rowHeight-16,36);
   ctx.font=`${titleSize}px ${family}`;ctx.fillText(song.title,textX,baseline);
   ctx.font=`${artistSize}px ${fonts.sans}`;ctx.fillText(song.artist,textX+titleWidth+gap,baseline);
   ctx.restore();
  });
  drawText(ctx,`${page+1} / ${pages}`,1795,950,85,30,18,fonts.serif,ink);
  jobs.push(new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(new File([blob],`setlist-${$('setlistDate').value}-${theme}-${page+1}.png`,{type:'image/png'})):reject(Error('画像を生成できませんでした。')),'image/png')));
 }
 status(songs.length?`${songs.length}曲・${pages}枚`:'完了曲がありません。');
 Promise.all(jobs).then(result=>{if(version===generation)files=result;}).catch(e=>{if(version===generation)status(e.message);});
}
window.openSetlistShare=async()=>{
 if(!currentRoomId){alert('ルーム内で利用できます。');return;}
 roomId=currentRoomId;songs=[];
 const entries=Object.entries(roomQueue||{}).filter(([,q])=>q?.status==='completed').sort((a,b)=>(Number(a[1].order)||0)-(Number(b[1].order)||0));
 if(!entries.length){alert('完了した曲がありません。');return;}
 for(const [,q]of entries){const song=queueSongDataById(q.songId);if(!song){alert('楽曲情報を読み込み中です。少し待ってから再度開いてください。');return;}songs.push({title:String(song['曲名']||'不明な曲'),artist:String(song['アーティスト']||'—')});}
 $('setlistDate').value=today();render();if(!dialog.open)dialog.showModal();
};
function postText(){return `${$('setlistRoomName').value.trim()}\n${$('setlistDate').value}\n〜本日のセットリスト〜\n`+songs.map((s,i)=>`${i+1}. ${s.title} / ${s.artist}`).join('\n');}
$('setlistClose').onclick=()=>dialog.close();
for(const id of ['setlistRoomName','setlistDate','setlistTheme'])$(id).addEventListener('input',render);
$('setlistSave').onclick=()=>{if(!valid())return;if(!files.length){status('画像生成中です。少し待ってから再試行してください。');return;}for(const file of files){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}status('画像を保存しました。複数枚の保存を求められた場合は許可してください。');};
$('setlistX').onclick=()=>{if(!valid())return;const text=`${$('setlistRoomName').value.trim()}\n${$('setlistDate').value}\n〜本日のセットリスト〜`;window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(text),'_blank','noopener,noreferrer');status('Xで、保存したセットリスト画像を添付してください。');};
$('setlistCopy').onclick=async()=>{if(!valid())return;try{await navigator.clipboard.writeText(postText());status('投稿文をコピーしました。');}catch{status('コピーできませんでした。ブラウザのクリップボード権限を確認してください。');}};
$('setlistNative').onclick=async()=>{if(!valid()||busy)return;if(!files.length){status('画像生成中です。少し待ってから再試行してください。');return;}if(!navigator.canShare?.({files})||!navigator.share){status('この端末は画像共有に対応していません。「画像保存」からX・Discordに添付してください。');return;}busy=true;try{await navigator.share({files,title:$('setlistRoomName').value.trim(),text:`${$('setlistRoomName').value.trim()} / ${$('setlistDate').value}\n〜本日のセットリスト〜`});status('共有先へ画像を渡しました。');}catch(e){status(e.name==='AbortError'?'共有をキャンセルしました。':'共有できませんでした。「画像保存」から投稿してください。');}finally{busy=false;}};
})();
