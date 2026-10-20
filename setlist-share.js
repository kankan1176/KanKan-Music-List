/* Room setlist export. Uses the same queue order as the session dock. */
(()=>{
'use strict';
const style=document.createElement('style');style.textContent=`
#setlistShareDialog{width:min(920px,96vw);max-height:92dvh;overflow:auto;border:1px solid var(--border-color,#ccc);border-radius:20px;background:var(--panel-bg,#fff);color:var(--text-color,#111);padding:24px}#setlistShareDialog,#setlistShareDialog *{box-sizing:border-box}#setlistShareDialog::backdrop{background:#0009}.setlist-top,.setlist-controls,.setlist-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.setlist-top{justify-content:space-between}#setlistShareDialog .setlist-controls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;align-items:start}.setlist-controls label{display:grid;gap:6px;min-width:0}.setlist-controls input,.setlist-controls select{padding:10px;width:100%;font:inherit;border:1px solid #888;border-radius:8px;background:var(--panel-bg,#fff);color:inherit}.setlist-preview canvas{width:100%;height:auto;display:block;margin:18px 0;border:1px solid #888;border-radius:8px}.setlist-actions button,.setlist-top button{padding:12px 18px;border-radius:12px;cursor:pointer;font:inherit}.setlist-actions{border-top:1px solid #8885;padding-top:18px}.setlist-note{font-size:13px;line-height:1.7}#setlistShareStatus{min-height:1.5em}#setlistDate{cursor:pointer}#setlistDate::-webkit-calendar-picker-indicator{display:none}@media (max-width:600px), (max-width:1366px) and (pointer:coarse){#setlistShareDialog .setlist-controls{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}#setlistShareDialog{margin:auto auto 0;width:100%;max-width:100%;max-height:90dvh;border-radius:20px 20px 0 0;padding:18px}.setlist-actions button{flex:1 1 40%}}
@media (max-width:360px){#setlistShareDialog .setlist-controls{grid-template-columns:1fr}}
`;document.head.append(style);
const dialog=document.createElement('dialog');dialog.id='setlistShareDialog';dialog.innerHTML=`
<div class="setlist-top"><h2>セットリスト画像を保存</h2><button type="button" aria-label="閉じる" id="setlistClose">✕</button></div>
<div class="setlist-controls"><label>ルーム名<input id="setlistRoomName" maxlength="80" placeholder="ルーム名を入力"></label><label>日付<input id="setlistDate" type="date" required></label><label>背景<select id="setlistTheme"><option value="paper">① くしゃ紙</option><option value="white">② 白い紙</option><option value="black">③ 黒いテクスチャ</option></select></label><label>文字配置<select id="setlistLayout"><option value="left">① 左にルーム名</option><option value="corner">② 右下にルーム名</option><option value="top">③ 上にルーム名</option></select></label></div>
<p class="setlist-note">完了曲を右バーの並び順で表示します。1枚20曲以内で、各画像の曲数を均等に分けます。画像は横長1.91:1です。</p>
<div class="setlist-preview" id="setlistPreview"></div><p id="setlistShareStatus" role="status"></p>
<div class="setlist-actions"><button type="button" id="setlistSave">↓ 画像保存</button></div>
<p class="setlist-note">「画像保存」でPNG画像を保存できます。X・Discordなどに投稿する場合は、保存した画像を投稿画面に添付してください。</p>`;document.body.append(dialog);
const $=id=>document.getElementById(id);let songs=[],roomId='',generation=0,files=[];
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
 const pending=new Promise((resolve,reject)=>{
  const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>{backgrounds.delete(theme);reject(Error('背景画像を読み込めませんでした。デザインを選び直して再試行してください。'));};
  img.src=new URL('assets/setlist/'+theme+'.jpg',document.baseURI).href;
 });
 backgrounds.set(theme,pending);return pending;
}
async function render(){
 const version=++generation;files=[];$('setlistPreview').replaceChildren();const name=$('setlistRoomName').value.trim()||uiText('ルーム名'),date=$('setlistDate').value.replaceAll('-','. '),theme=$('setlistTheme').value,black=theme==='black';
 const layout=$('setlistLayout').value,ink=black?'#faf9f5':'#111213',family=layout==='left'?fonts.sans:fonts.serif;
 const pages=Math.ceil(songs.length/20),jobs=[];
 let image;status('背景画像を読み込み中…');
 try{image=await background(theme);}catch(e){if(version===generation)status(e.message);return;}
 if(version!==generation)return;
 for(let page=0;page<pages;page++){
  const canvas=document.createElement('canvas');canvas.width=1910;canvas.height=1000;canvas.setAttribute('aria-label',`セットリスト ${page+1}/${pages}`);$('setlistPreview').append(canvas);
  const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,1910,1000);ctx.textBaseline='top';
  const start=Math.floor(page*songs.length/pages),end=Math.floor((page+1)*songs.length/pages),batch=songs.slice(start,end);
  let originX,originY,columnStep,columnWidth,columns,perColumn,rowHeight;
  ctx.fillStyle=ink;
  if(layout==='left'){
   drawText(ctx,uiText('〜本日のセットリスト〜'),125,100,470,40,27,fonts.sans,ink);
   ctx.globalAlpha=.65;ctx.fillRect(675,100,2,800);ctx.fillRect(110,410,440,2);ctx.globalAlpha=1;
   drawText(ctx,name,120,285,450,115,85,fonts.sans,ink,2);
   drawText(ctx,date,120,820,440,55,32,fonts.hand,ink);
   columns=batch.length>10?2:1;originX=750;originY=100;columnStep=560;columnWidth=columns===2?510:1070;
  }else if(layout==='corner'){
   drawText(ctx,uiText('〜本日のセットリスト〜'),1475,775,385,38,24,fonts.sans,ink);
   drawText(ctx,name,1450,815,400,70,62,fonts.hand,ink);
   ctx.globalAlpha=.65;ctx.fillRect(1450,905,400,2);ctx.globalAlpha=1;
   drawText(ctx,date,1580,925,270,35,25,fonts.hand,ink);
   columns=2;originX=180;originY=100;columnStep=580;columnWidth=540;
  }else{
   drawText(ctx,uiText('〜本日のセットリスト〜'),110,65,370,40,26,fonts.sans,ink);
   drawText(ctx,date,155,120,330,45,30,fonts.hand,ink);
   drawText(ctx,name,545,55,510,85,70,fonts.serif,ink);
   ctx.globalAlpha=.65;ctx.fillRect(465,155,590,2);ctx.globalAlpha=1;
   columns=2;originX=140;originY=235;columnStep=810;columnWidth=755;
  }
  perColumn=Math.ceil(batch.length/columns);rowHeight=Math.min(layout==='left'?85:70,(layout==='top'?680:700)/perColumn);
  batch.forEach((song,i)=>{
   const col=Math.floor(i/perColumn),row=i%perColumn,x=originX+col*columnStep,y=originY+row*rowHeight;
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
  jobs.push(new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(new File([blob],`setlist-${$('setlistDate').value}-${theme}-${layout}-${page+1}.png`,{type:'image/png'})):reject(Error('画像を生成できませんでした。')),'image/png')));
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
function openDatePicker(){try{$('setlistDate').showPicker?.();}catch{ /* Native date input remains editable if showPicker is unavailable. */ }}
$('setlistDate').addEventListener('click',openDatePicker);
$('setlistDate').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openDatePicker();}});
window.addEventListener('sl-language-change',()=>{if(dialog.open)void render();});
$('setlistClose').onclick=()=>dialog.close();
for(const id of ['setlistRoomName','setlistDate','setlistTheme','setlistLayout'])$(id).addEventListener('input',render);
$('setlistSave').onclick=()=>{if(!valid())return;if(!files.length){status('画像生成中です。少し待ってから再試行してください。');return;}for(const file of files){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}status('画像を保存しました。複数枚の保存を求められた場合は許可してください。');};
})();

