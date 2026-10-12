(()=>{
'use strict';
const $=id=>document.getElementById(id),button=document.createElement('button');button.id='roomHistoryButton';button.type='button';button.className='sl-room-choice-button';button.disabled=true;button.innerHTML='<span class="sl-room-choice-emoji">🕘</span><strong>ルーム参加履歴</strong><small id="roomHistoryHint">ログインユーザーのみ可能</small>';$('slRoomChoice').append(button);
const style=document.createElement('style');style.textContent='#roomCreateModal .sl-room-choice{grid-template-columns:repeat(3,minmax(0,1fr))}@media(max-width:620px){#roomCreateModal .sl-room-choice{grid-template-columns:1fr}}#roomHistoryButton:disabled{opacity:.45;cursor:not-allowed;filter:grayscale(1)}#roomHistoryDialog{width:min(750px,95vw);max-height:85dvh;overflow:auto;background:var(--panel-bg,#fff);color:var(--text-color,#111);border:1px solid var(--border-color,#888);border-radius:16px;padding:20px}.room-history-card{padding:16px 0;border-bottom:1px solid var(--border-color,#888)}.room-history-heading{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}.room-history-members{margin-top:12px}.room-history-top{display:flex;align-items:center;justify-content:space-between}';document.head.append(style);
const dialog=document.createElement('dialog');dialog.id='roomHistoryDialog';dialog.innerHTML='<div class="room-history-top"><h2>ルーム参加履歴</h2><button type="button" id="roomHistoryClose" aria-label="閉じる">✕</button></div><p>直近10件のルームと、参加中に確認したメンバーを表示します。</p><button type="button" id="roomHistoryRefresh">更新</button><p id="roomHistoryStatus" role="status"></p><div id="roomHistoryList"></div>';document.body.append(dialog);
function user(){const u=auth.currentUser;return u&&!u.isAnonymous&&u.providerData?.some(p=>p.providerId==='google.com')&&signedInUser?.uid===u.uid?u:null;}
let sequence=0,recording=false,dirty=false,seenUid='',joinedAt=0,lastSignature='',favoriteRef=null,favoriteHandler=null;
function note(text){$('roomHistoryStatus').textContent=text;}
window.rememberRoomHistory=async()=>{
 const u=user();if(!u||!currentRoomId||!mySessionId||!roomMembersRaw?.[mySessionId])return;
 if(recording){dirty=true;return;}
 if(seenUid!==u.uid){seenUid=u.uid;joinedAt=Date.now();lastSignature='';}
 const members={};for(const [session,m]of Object.entries(roomMembersRaw||{})){
  if(!m||typeof m!=='object')continue;
  const google=m.guest===false&&!!m.uid,key=google?'u_'+m.uid:'s_'+session;
  members[key]={name:String(m.name||'メンバー').slice(0,40),uid:google?String(m.uid):'',google};
 }
 const signature=JSON.stringify(members);if(signature===lastSignature)return;
 recording=true;dirty=false;
 try{
  const result=await db.ref(`users/${u.uid}/roomHistory`).transaction(history=>{
   if(user()?.uid!==u.uid)return;
   const records=history&&typeof history==='object'?{...history}:{};
   records[currentRoomId]={roomId:currentRoomId,lastJoinedAt:joinedAt,members:{...(records[currentRoomId]?.members||{}),...members}};
   const entries=Object.entries(records).sort((a,b)=>(Number(b[1]?.lastJoinedAt)||0)-(Number(a[1]?.lastJoinedAt)||0));
   return Object.fromEntries(entries.slice(0,10));
  },undefined,false);
  if(result.committed&&user()?.uid===u.uid)lastSignature=signature;
 }catch(e){console.warn('ルーム参加履歴の保存に失敗:',e);note('参加履歴を保存できませんでした。通信状況・本人用データのアクセス権限を確認してください。');}
 finally{recording=false;if(dirty)void window.rememberRoomHistory();}
};
async function join(id,status,btn){
 const u=user();if(!u)return note('ログインユーザーのみ可能です。');
 btn.disabled=true;status.textContent='ルームを確認しています…';
 try{
  const snap=await db.ref('rooms/'+id+'/settings').once('value');if(user()?.uid!==u.uid)return;
  if(!snap.exists()){status.textContent='このルームは削除済みにより入室できません。';return;}
  const target=new URL(location.href);target.searchParams.set('room',id);target.searchParams.delete('_refresh');location.assign(target.pathname+target.search+target.hash);
 }catch(e){status.textContent='ルームを確認できませんでした。通信状況を確認して再試行してください。';}
 finally{btn.disabled=false;}
}
async function load(){
 const u=user(),version=++sequence;$('roomHistoryList').replaceChildren();if(!u)return note('ログインユーザーのみ可能です。');note('履歴を読み込み中…');
 try{
  const [h,p,f]=await Promise.all([db.ref(`users/${u.uid}/roomHistory`).once('value'),db.ref('publicProfiles').once('value'),db.ref(`userFavorites/${u.uid}`).once('value')]);
  if(version!==sequence||user()?.uid!==u.uid)return;
  const profiles=p.val()||{},favorites=f.val()||{},entries=Object.entries(h.val()||{}).filter(([id])=>/^[A-Za-z0-9]{4,32}$/.test(id)).sort((a,b)=>(Number(b[1]?.lastJoinedAt)||0)-(Number(a[1]?.lastJoinedAt)||0)).slice(0,10);
  for(const [id,record] of entries){
   const card=document.createElement('section');card.className='room-history-card';const heading=document.createElement('div');heading.className='room-history-heading';const title=document.createElement('strong');title.textContent='ルームID：'+id;const btn=document.createElement('button');btn.type='button';btn.textContent='このルームに参加';const status=document.createElement('p');status.setAttribute('role','status');btn.onclick=()=>join(id,status,btn);heading.append(title,btn);card.append(heading,status);
   const members=document.createElement('div');members.className='room-history-members';
   for(const m of Object.values(record.members||{})){
    if(m.google&&m.uid){const row=favoriteUserRow(m.uid,{...profiles,[m.uid]:profiles[m.uid]||{displayName:m.name}},favorites,true);
     row.querySelector('.friend-commands button')?.addEventListener('click',()=>dialog.close(),{capture:true});members.append(row);}
    else{const name=document.createElement('p');name.textContent=String(m.name||'メンバー')+'（ゲスト）';members.append(name);}
   }
   if(!members.childElementCount)members.textContent='メンバー情報はありません。';card.append(members);$('roomHistoryList').append(card);
  }
  note(entries.length?entries.length+'件の参加履歴を表示しています。':'参加履歴はまだありません。今後参加したルームから記録されます。');
 }catch(e){if(version===sequence&&user()?.uid===u.uid)note('参加履歴を取得できませんでした。通信状況・本人用データのアクセス権限を確認してください。');}
}
button.onclick=()=>{if(!user())return;if(!dialog.open)dialog.showModal();void load();};$('roomHistoryRefresh').onclick=load;$('roomHistoryClose').onclick=()=>dialog.close();
auth.onAuthStateChanged(()=>{
 sequence++;const u=user();button.disabled=!u;$('roomHistoryHint').textContent=u?'直近10件のルーム・メンバーを確認':'ログインユーザーのみ可能';
 if(favoriteRef){favoriteRef.off('value',favoriteHandler);favoriteRef=null;favoriteHandler=null;}
 $('roomHistoryList').replaceChildren();if(dialog.open)dialog.close();seenUid='';lastSignature='';
 if(u){favoriteRef=db.ref(`userFavorites/${u.uid}`);favoriteHandler=()=>{if(dialog.open)void load();};favoriteRef.on('value',favoriteHandler);void window.rememberRoomHistory();}
});
void window.rememberRoomHistory();
})();
