const fs=require('fs');
const path=require('path');
const assert=require('assert');
const vm=require('vm');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
const clipboard=html.slice(html.indexOf('    const bulkCsvAliases='),html.indexOf('    function bulkCsvAlreadyPersonal('));
const i18n=html.slice(html.indexOf('    const UI_I18N ='),html.indexOf('    let resolveInitialAuth;'));
const fixtures=[
 {_id:'mrs','曲名':'青と夏','アーティスト':'Mrs. GREEN APPLE','コードwiki':'https://ja.chordwiki.org/wiki/AoToNatsu'},
 {_id:'yui-original','曲名':'Rolling star','アーティスト':'YUI','コードwiki':'https://ja.chordwiki.org/wiki/RollingStarOriginal'},
 {_id:'yui-band','曲名':'Rolling star','アーティスト':'yui','コードwiki':'https://ja.chordwiki.org/wiki/RollingStarBand'},
 {_id:'empty-artist','曲名':'空欄','アーティスト':'','コードwiki':'https://ja.chordwiki.org/wiki/EmptyArtist'},
 {_id:'other','曲名':'Rolling start','アーティスト':'YUK','コードwiki':'https://ja.chordwiki.org/wiki/Other'}
];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 const page=await browser.newPage();
 try{
  await page.route('**/*',route=>route.abort());
  await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''));
  await page.evaluate(()=>document.body.classList.add('sl-redesign'));
  await page.addScriptTag({content:`
    var fixtureSongs=${JSON.stringify(fixtures)},allData=[fixtureSongs[0]],masterLoaded=false;
    var signedInUser={uid:'tester',isAnonymous:false},auth={currentUser:{uid:'tester'}},currentRoomId='';
    var personalSongs={'yui-band':{registered:true,key:3,parts:['🎸','🎹'],part:'🎸',liked:true}},pendingSongs={},draftRegistrationKeys={},defaultPart='';
    var writes=[],proposals=[],promotionCount=0;
    var db={ref:p=>({update:async updates=>writes.push(JSON.parse(JSON.stringify(updates))),set:async value=>proposals.push({path:p,value})})};
    var firebase={database:{ServerValue:{TIMESTAMP:123}}};
    var Papa={parse:text=>({data:text.split(/\\r?\\n/).filter(Boolean).map(line=>line.split('\\t'))})};
    async function promoteServerPageToFullMaster(){promotionCount++;allData=fixtureSongs.slice();masterLoaded=true;}
    function effectivePersonalSong(id){return personalSongs[id]||{};}
    function getSelectedParts(value){return value.parts||[];}
    function bulkCsvAlreadyPersonal(id){const s=effectivePersonalSong(id);return !!s.registered&&!s.excluded;}
    async function saveMyListChanges(){return true;}
    function queueFriendSharedSync(){}
    function renderTable(){}
    function genreOf(s){return s.genre||'';}
    function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
    function openModal(id){document.getElementById(id).style.display='flex';}
    function closeModal(event,id){document.getElementById(id).style.display='none';}
  `});
  await page.addScriptTag({content:fs.readFileSync(path.join(root,'ui-translations.js'),'utf8')});
  await page.addScriptTag({content:i18n});
  await page.addScriptTag({content:clipboard});
  await page.evaluate(()=>openClipboardImportModal());
  assert.equal(await page.evaluate(()=>promotionCount),1);
  assert.equal(await page.evaluate(()=>allData.length),fixtures.length);
  const analyze=async(text,mapping=['title','artist'])=>page.evaluate(({text,mapping})=>{clipboardRawText=text;clipboardEnsureMapping(text);clipboardTableMapping=mapping;clipboardMappingConfirmed=true;return clipboardAnalyze(text);},{text,mapping});
  for(const artist of ['Mrs. GREEN APPLE','Mrs GREEN APPLE','mrsgreenapple','Ｍｒｓ．　ＧＲＥＥＮ　ＡＰＰＬＥ']){
   const result=await analyze(' 青 と 夏 \t'+artist);
   assert.equal(result.rows[0].songId,'mrs');assert.equal(result.rows[0].status,'ok');
  }
  const unknown=await analyze('Rolling star\tYUK');assert.equal(unknown.rows[0].status,'error');
  const empty=await analyze('...\tMrs GREEN APPLE');assert.equal(empty.rows[0].status,'error');
  await analyze('青と夏\tMrs GREEN APPLE\nRolling star\tYUI');
  await page.evaluate(()=>clipboardPreview());
  assert.equal(await page.locator('.clipboard-candidate-select').count(),1);
  assert.equal(await page.locator('#clipboardAnalysisRegister').isDisabled(),true);
  assert.equal(await page.evaluate(()=>clipboardImportRows[1].status),'candidate');
  assert.equal(await page.locator('.clipboard-candidate-select option[translate=no]').count(),2);
  await page.evaluate(()=>clipboardSelectCandidate(2,'not-a-candidate'));
  assert.equal(await page.locator('#clipboardAnalysisRegister').isDisabled(),true);
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:844});
   const box=await page.locator('.clipboard-candidate-select').evaluate(el=>({width:el.getBoundingClientRect().width,parent:el.parentElement.getBoundingClientRect().width}));
   assert.ok(box.width<=box.parent+1);
  }
  await page.locator('.clipboard-candidate-select').selectOption('__skip__');
  assert.equal(await page.evaluate(()=>clipboardImportRows[1].status),'skipped');
  assert.equal(await page.locator('#clipboardAnalysisRegister').isDisabled(),false);
  await page.locator('.clipboard-candidate-select').selectOption('yui-band');
  assert.equal(await page.evaluate(()=>clipboardImportRows[1].songId),'yui-band');
  for(const lang of ['en','ko','zh-TW','ja']){
   await page.evaluate(lang=>applyLanguage(lang),lang);
   assert.equal(await page.locator('.clipboard-candidate-select').inputValue(),'yui-band');
   assert.match(await page.locator('.clipboard-candidate-select option[value="yui-original"]').textContent(),/YUI/);
   assert.match(await page.locator('.clipboard-candidate-select option[value="yui-band"]').textContent(),/yui/);
  }
  await page.evaluate(()=>clipboardOpenConfirmation());
  await page.evaluate(()=>clipboardCommit());
  const writes=await page.evaluate(()=>window.writes);
  assert.equal(writes.length,1);
  assert.deepEqual(Object.keys(writes[0]).sort(),['users/tester/songs/mrs','users/tester/songs/yui-band']);
  assert.equal(writes[0]['users/tester/songs/yui-band'].key,0);
  assert.equal(writes[0]['users/tester/songs/yui-band'].liked,true);
  assert.deepEqual(writes[0]['users/tester/songs/yui-band'].parts,['🎸','🎹']);
  assert.deepEqual(await page.evaluate(()=>fixtureSongs),fixtures);
  // Explicit URL disambiguates case-colliding artists and preserves key conflict handling.
  const conflict=await analyze('Rolling star\tyui\thttps://ja.chordwiki.org/wiki.cgi?c=view&t=RollingStarBand&key=2\t-2',['title','artist','url','key']);
  assert.equal(conflict.rows[0].songId,'yui-band');assert.equal(conflict.rows[0].status,'conflict');
  await page.evaluate(()=>clipboardOpenConfirmation());
  await page.locator('.clipboard-key-conflict').selectOption('url');
  await page.evaluate(()=>clipboardCommit());
  assert.equal(await page.evaluate(()=>writes.at(-1)['users/tester/songs/yui-band'].key),2);
  const invalidUrl=await analyze('青と夏\tmrsgreenapple\thttps://example.com/test',['title','artist','url']);
  assert.equal(invalidUrl.rows[0].status,'error');
  const duplicate=await analyze('青と夏\tMrs GREEN APPLE\n青と夏\tmrsgreenapple');
  assert.equal(duplicate.rows[0].status,'ok');assert.equal(duplicate.rows[1].status,'error');
  // A second normalized result makes the row ambiguous even if one is an exact spelling match.
  await analyze('Rolling star\tYUI');await page.evaluate(()=>clipboardPreview());
  await page.locator('.clipboard-candidate-select').selectOption('yui-original');
  const replaced=await analyze('ROLLING STAR\tyui');assert.equal(replaced.rows[0].status,'candidate');
  await page.evaluate(()=>clipboardPreview());await page.locator('.clipboard-candidate-select').selectOption('yui-original');
  await page.evaluate(()=>clipboardOpenConfirmation());
  const before=await page.evaluate(()=>writes.length);
  await page.evaluate(()=>{allData=allData.filter(song=>song._id!=='yui-original');});
  await page.evaluate(()=>clipboardCommit());
  assert.equal(await page.evaluate(()=>writes.length),before);
  assert.match(await page.locator('#clipboardConfirmFeedback').textContent(),/照合結果が変わりました/);
  const fill=await analyze(' 空 欄 \tNew Artist\thttps://ja.chordwiki.org/wiki/EmptyArtist',['title','artist','url']);
  assert.equal(fill.rows[0].artistProposal,true);
  await page.evaluate(()=>clipboardOpenConfirmation());await page.evaluate(()=>clipboardCommit());
  assert.equal(await page.evaluate(()=>proposals[0].path),'songEditRequests/empty-artist/tester');
  await page.evaluate(()=>{masterLoaded=false;});
  const partial=await analyze('青と夏\tMrs GREEN APPLE');assert.equal(partial.rows.length,0);assert.match(partial.error,/全曲マスター/);
  console.log('PASS: normalized names, candidate selection/exclusion, full catalog, duplicate prevention, URL/key handling, metadata preservation, stale-match guard, approved import paths, and localized mobile UI');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
