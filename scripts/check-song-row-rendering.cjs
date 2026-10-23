'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),genres=require('../song-genres.js');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8'),start=html.indexOf('    function appendRenderedSongRows('),end=html.indexOf('</script>',start);assert(start>0&&end>start);const source=html.slice(start,end);
function render(code,mode,tieup){
 const collected=[],node=()=>({children:[],innerHTML:'',dataset:{},classList:{add(){},toggle(){}},appendChild(n){this.children.push(n)},prepend(n){this.children.unshift(n)}});
 const scope={document:{createDocumentFragment:node,createElement:node},currentRoomId:mode==='room'?'ROOM':null,myListMode:mode==='mine',roomListView:'all',roomSharedLists:{},roomQueue:{},signedInUser:null,selectedMySongIds:new Set(),roomOwnersOfSong:()=>[],SLSongGenres:genres,getPersonalKey:()=>0,chordWikiTitle:()=>'',keyDropdownOptions:()=>'',myListRegistrationButton:()=>'',myListPartButtons:()=>'',escapeHtml:value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),tableBody:{appendChild(fragment){collected.push(...fragment.children)}}};
 vm.createContext(scope);vm.runInContext(code,scope);scope.appendRenderedSongRows([{_id:'song','曲名':'Song','アーティスト':'Artist','タイアップ情報':tieup,genre1:'J-POP',genre2:'アニソン',genre3:'ロック',genre4:'ジャンプ',genre5:'Example label'}]);return collected;
}
assert.throws(()=>render(source.replace(/let displayGenre\s*=/,'const displayGenre='),'all','Anime tieup'),/Assignment to constant/);
for(const mode of ['all','mine','room'])for(const tieup of ['', 'Anime tieup <text>']){const rows=render(source,mode,tieup);assert.equal(rows.length,1);assert.match(rows[0].innerHTML,/J-POP.*アニソン.*ロック.*ジャンプ.*Example label/);if(tieup)assert(rows[0].innerHTML.includes('Anime tieup &lt;text&gt;'));assert.equal(rows[0].children[0].textContent,'1');}
console.log('PASS: reproduced constant reassignment with nonempty tieup; actual all-song/My List/room row renderer displays all five genres and escaped tieup text without exceptions.');
