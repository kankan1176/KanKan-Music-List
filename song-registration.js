/* Registration controls map user-facing categories onto the existing master schema. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./sort-master.js'):root.SLSortMaster,typeof module==='object'&&module.exports?require('./artist-classification.js'):root.SLArtistClassification);if(typeof module==='object'&&module.exports)module.exports=api;else root.SLSongRegistration=api;})(typeof globalThis!=='undefined'?globalThis:this,(master,artists)=>{
 'use strict';
 const basic=['J-POP','K-POP','洋楽'];
 const categories=[['アニソン','genre2','アニソン'],['ボカロ','genre2','ボカロ'],['Vtuber','genre2','Vtuber'],['ドラマ主題歌','genre3','ドラマ主題歌'],['映画主題歌','genre3','映画主題歌'],['ゲーム','genre2','ゲーム'],['アイドル','genre4','アイドル'],['TV','genre3','TV（CM・バラエティ）主題歌']];
 const music=master.choices('genre6'),voices=master.definitions.filter(row=>row.enabled&&row.field==='vocal_synths').sort((a,b)=>a.groupOrder-b.groupOrder||a.order-b.order),publishers=master.definitions.filter(row=>row.enabled&&row.field==='genre5').sort((a,b)=>a.groupOrder-b.groupOrder||a.order-b.order);
 const unique=values=>[...new Set(values||[])];
 function allowed(values,options){const result=unique(values);if(result.some(value=>!options.includes(value)))throw Error('分類を選択肢から選んでください。');return result;}
 function classify(input){
  const base=String(input.base||'');if(base&&!basic.includes(base))throw Error('基本ジャンルを選択肢から選んでください。');
  const detected=artists.match(input.artist),selected=allowed(input.categories,categories.map(row=>row[0]));if(detected.matches.length&&!selected.includes('Vtuber'))selected.push('Vtuber');const out={genre1:base,genre2:'',genre3:'',genre4:'',genre5:'',genre6:allowed(input.music,music).join('、'),vocal_synths:''};
  for(const field of ['genre2','genre3','genre4'])out[field]=categories.filter(row=>row[1]===field&&selected.includes(row[0])).map(row=>row[2]).join('、');
  out.genre4=artists.appendTags(out.genre4,detected.groups);
  if(selected.includes('ボカロ'))out.vocal_synths=allowed(input.voices,voices.map(row=>row.name)).join('、');
  if(selected.includes('アニソン')){const publisher=String(input.publisher||'');if(publisher&&!publishers.some(row=>row.name===publisher))throw Error('掲載媒体を選択肢から選んでください。');out.genre5=publisher;}
  return out;
 }
 function mount(document){
  const form=document.getElementById('addSongForm');if(form.dataset.registrationMounted)return;
  form.dataset.registrationMounted='true';
  const basicSelect=document.getElementById('newGenre1');basicSelect.replaceChildren(new Option('選択しない',''),...basic.map(value=>new Option(value,value)));
  function checks(host,name,values){for(const value of values){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.name=name;input.value=value;if(name==='vocal_synths'){
    const text=document.createElement('span'),primary=document.createElement('span'),match=/^(.*?)([（(].*[）)])$/.exec(value);
    text.className='sl-vocal-choice-text';primary.className='sl-vocal-choice-primary';primary.textContent=match?match[1].trim():value;text.append(primary);
    if(match){const note=document.createElement('small');note.textContent=match[2];text.append(note);}
    label.append(input,text);
   }else label.append(input,document.createTextNode(value));host.append(label);}}
  checks(document.getElementById('newCategoryChoices'),'registrationCategory',categories.map(row=>row[0]));checks(document.getElementById('newGenre6'),'registrationMusic',music);
  const voiceHost=document.getElementById('newVocalChoices');
  for(const group of unique(voices.map(row=>row.group))){const section=document.createElement('section'),heading=document.createElement('h4'),list=document.createElement('div');section.className='sl-registration-group';heading.textContent=group;list.className='sl-genre-checks';list.dataset.voiceGroup=group;checks(list,'vocal_synths',voices.filter(row=>row.group===group).map(row=>row.name));section.append(heading,list);voiceHost.append(section);}
  // The master has one singer-name field; duplicate names across software groups share a value.
  voiceHost.addEventListener('change',event=>{if(event.target.name!=='vocal_synths')return;for(const input of voiceHost.querySelectorAll('input'))if(input.value===event.target.value)input.checked=event.target.checked;});
  const publisherSelect=document.getElementById('newPublisher');publisherSelect.replaceChildren(new Option('選択しない',''));
  for(const group of unique(publishers.map(row=>row.group))){const section=document.createElement('optgroup');section.label=group;for(const row of publishers.filter(row=>row.group===group))section.append(new Option(row.name,row.name));publisherSelect.append(section);}
  function sync(){const selected=[...form.querySelectorAll('[name="registrationCategory"]:checked')].map(input=>input.value);for(const[id,category]of [['newVocalSection','ボカロ'],['newAnimeSection','アニソン'],['newPublisherSection','アニソン']]){const section=document.getElementById(id);section.hidden=!selected.includes(category);section.disabled=section.hidden;}}
  const artistInput=document.getElementById('newArtist'),vtuber=form.querySelector('[name="registrationCategory"][value="Vtuber"]'),status=document.getElementById('newArtistClassification');
  let manualVtuber=vtuber.checked,automatic=false;
  function syncArtist(){
   if(!automatic)manualVtuber=vtuber.checked;
   const detected=artists.match(artistInput.value);automatic=detected.matches.length>0;
   vtuber.disabled=automatic;vtuber.checked=automatic||manualVtuber;
   status.hidden=!automatic;status.textContent=automatic?'Vtuberを自動設定 · 所属：'+detected.groups.join('、'):'';
  }
  for(const event of ['input','change'])artistInput.addEventListener(event,()=>{syncArtist();sync();});
  document.getElementById('newCategoryChoices').addEventListener('change',()=>{if(!automatic)manualVtuber=vtuber.checked;sync();});
  form.addEventListener('reset',()=>queueMicrotask(()=>{automatic=false;manualVtuber=false;vtuber.disabled=false;syncArtist();sync();}));syncArtist();sync();
 }
 function read(form){const values=new FormData(form);return classify({artist:values.get('artist'),base:values.get('genre1'),categories:values.getAll('registrationCategory'),music:values.getAll('registrationMusic'),voices:values.getAll('vocal_synths'),publisher:values.get('publisher')});}
 return{basic,categories,music,voices,publishers,classify,mount,read};
});
