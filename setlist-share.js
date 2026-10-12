/* Room setlist export. Uses the same queue order as the session dock. */
(()=>{
'use strict';
const style=document.createElement('style');style.textContent=`
#setlistShareDialog{width:min(920px,96vw);max-height:92dvh;overflow:auto;border:1px solid var(--border-color,#ccc);border-radius:20px;background:var(--panel-bg,#fff);color:var(--text-color,#111);padding:24px}#setlistShareDialog::backdrop{background:#0009}.setlist-top,.setlist-controls,.setlist-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.setlist-top{justify-content:space-between}.setlist-controls label{display:grid;gap:6px;flex:1;min-width:150px}.setlist-controls input,.setlist-controls select{padding:10px;width:100%;font:inherit;border:1px solid #888;border-radius:8px;background:var(--panel-bg,#fff);color:inherit}.setlist-preview canvas{width:100%;height:auto;display:block;margin:18px 0;border:1px solid #888;border-radius:8px}.setlist-actions button,.setlist-top button{padding:12px 18px;border-radius:12px;cursor:pointer;font:inherit}.setlist-actions{border-top:1px solid #8885;padding-top:18px}.setlist-note{font-size:13px;line-height:1.7}#setlistShareStatus{min-height:1.5em}@media(max-width:600px){#setlistShareDialog{margin:auto auto 0;width:100%;max-width:100%;max-height:90dvh;border-radius:20px 20px 0 0;padding:18px}.setlist-actions button{flex:1 1 40%}}
`;document.head.append(style);
const dialog=document.createElement('dialog');dialog.id='setlistShareDialog';dialog.innerHTML=`
<div class="setlist-top"><h2>セットリストを共有</h2><button type="button" aria-label="閉じる" id="setlistClose">✕</button></div>
<div class="setlist-controls"><label>ルーム名<input id="setlistRoomName" maxlength="80" placeholder="ルーム名を入力"></label><label>日付<input id="setlistDate" type="date" required></label><label>背景<select id="setlistTheme"><option value="white">白背景</option><option value="black">黒背景</option></select></label></div>
<p class="setlist-note">完了曲を右バーの並び順で表示します。1枚20曲まで。画像は横長1.91:1です。</p>
<div class="setlist-preview" id="setlistPreview"></div><p id="setlistShareStatus" role="status"></p>
<div class="setlist-actions"><button type="button" id="setlistSave">↓ 画像保存</button><button type="button" id="setlistX">𝕏 投稿</button><button type="button" id="setlistNative">↗ その他のアプリへ共有</button><button type="button" id="setlistCopy">投稿文をコピー</button></div>
<p class="setlist-note">Xボタンは投稿文を開きます。保存した画像を添付してください。Discordへは「その他のアプリへ共有」または画像保存から投稿できます。共有先は端末によって異なります。</p>`;document.body.append(dialog);
const $=id=>document.getElementById(id);let songs=[],roomId='',generation=0,files=[],busy=false;
function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function status(text){$('setlistShareStatus').textContent=text;}
function valid(){if(!currentRoomId||currentRoomId!==roomId){status('ルームが変更されました。閉じて開き直してください。');return false;}if(!$('setlistRoomName').value.trim()){status('ルーム名を入力してください。');$('setlistRoomName').focus();return false;}if(!$('setlistDate').value){status('日付を指定してください。');return false;}return true;}
function wrap(ctx,text,width,maxLines,size){
 ctx.font=`${size}px Georgia,"Noto Serif JP","Yu Mincho",serif`;let lines=[''];for(const ch of Array.from(String(text))){if(ctx.measureText(lines.at(-1)+ch).width>width&&lines.at(-1))lines.push(ch);else lines[lines.length-1]+=ch;}return lines;
}
function drawText(ctx,text,x,y,width,size,maxLines,color){
 let lines;do{lines=wrap(ctx,text,width,maxLines,size);if(lines.length<=maxLines||size<=12)break;size--;}while(true);
 ctx.fillStyle=color;lines.forEach((line,i)=>ctx.fillText(line,x,y+i*size*1.3));
}
function render(){
 const version=++generation;files=[];$('setlistPreview').replaceChildren();const name=$('setlistRoomName').value.trim()||'ルーム名',date=$('setlistDate').value.replaceAll('-','.'),black=$('setlistTheme').value==='black';const bg=black?'#101112':'#faf9f6',ink=black?'#f5f3ee':'#191a1b',muted=black?'#b6b6b3':'#666764';
 const pages=Math.ceil(songs.length/20);const jobs=[];
 for(let page=0;page<pages;page++){
  const canvas=document.createElement('canvas');canvas.width=1910;canvas.height=1000;canvas.setAttribute('aria-label',`セットリスト ${page+1}/${pages}`);$('setlistPreview').append(canvas);
  const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,1910,1000);
  ctx.textAlign='center';ctx.font='24px Georgia,"Yu Mincho",serif';ctx.fillStyle=muted;ctx.fillText('〜本日のセットリスト〜',955,65);ctx.textAlign='left';
  ctx.strokeStyle=muted;ctx.globalAlpha=.35;ctx.beginPath();ctx.moveTo(635,145);ctx.lineTo(635,860);ctx.stroke();ctx.globalAlpha=1;
  drawText(ctx,name,90,370,470,68,4,ink);ctx.font='26px Georgia,serif';ctx.fillStyle=muted;ctx.fillText(date,94,750);ctx.fillRect(94,785,70,2);
  const batch=songs.slice(page*20,page*20+20),columns=batch.length>10?2:1,perColumn=Math.ceil(batch.length/columns),width=columns===2?490:1050,rowHeight=Math.min(115,720/perColumn);
  batch.forEach((song,i)=>{const col=Math.floor(i/perColumn),row=i%perColumn,x=710+col*580,y=175+row*rowHeight;ctx.fillStyle=muted;ctx.font='18px Georgia,serif';ctx.fillText(String(page*20+i+1).padStart(2,'0'),x,y);drawText(ctx,song.title,x+45,y,width-45,columns===2?24:34,2,ink);drawText(ctx,song.artist,x+45,y+rowHeight*.8,width-45,18,1,muted);ctx.globalAlpha=.22;ctx.fillStyle=muted;ctx.fillRect(x,y+rowHeight-6,width,1);ctx.globalAlpha=1;});
  ctx.textAlign='right';ctx.font='18px Georgia,serif';ctx.fillStyle=muted;ctx.fillText(`${page+1} / ${pages}`,1815,945);ctx.textAlign='left';
  jobs.push(new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(new File([blob],`setlist-${$('setlistDate').value}-${page+1}.png`,{type:'image/png'})):reject(Error('画像を生成できませんでした。')),'image/png')));
 }
 status(songs.length?`${songs.length}曲・${pages}枚`:'完了曲がありません。');
 Promise.all(jobs).then(result=>{if(version===generation)files=result;}).catch(e=>status(e.message));
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
