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
const [csvPath,masterPath]=process.argv.slice(2);
if(!csvPath||!masterPath)throw Error('Usage: node scripts/check-clipboard-process.cjs list.csv public-master.json');
const papaPath=process.env.PAPAPARSE_PATH||require.resolve('papaparse');
const parser=require(papaPath);
const csvRows=parser.parse(fs.readFileSync(csvPath,'utf8'),{skipEmptyLines:'greedy'}).data;
const tsv=parser.unparse(csvRows,{delimiter:'\t',newline:'\n'});
const fixtures=Object.entries(JSON.parse(fs.readFileSync(masterPath,'utf8'))).map(([id,s])=>({_id:id,'曲名':s.title||'','アーティスト':s.artist||'','コードwiki':s.chordwiki||'',genre:s.genre||''}));
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
    var writes=[],proposals=[],promotionCount=0,rejectNextUpdate=false;
    var db={ref:p=>({update:async updates=>{if(rejectNextUpdate){rejectNextUpdate=false;throw Error('Simulated connection failure');}writes.push(JSON.parse(JSON.stringify(updates)));},set:async value=>proposals.push({path:p,value})})};
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

  `});
  await page.addScriptTag({content:fs.readFileSync(path.join(root,'ui-translations.js'),'utf8')});
  await page.addScriptTag({content:i18n});
  await page.addScriptTag({content:fs.readFileSync(papaPath,'utf8')});
  await page.addScriptTag({content:html.slice(html.indexOf('    function openModal(id)'),html.indexOf('    function escapeHtml(',html.indexOf('    function openModal(id)')))});
  await page.addScriptTag({content:clipboard});

  await page.evaluate(text=>Object.defineProperty(navigator,'clipboard',{value:{readText:async()=>text},configurable:true}),tsv);
  await page.evaluate(()=>openClipboardImportModal());
  await page.getByRole('button',{name:'📋 クリップボードの表を読み取る',exact:true}).click();
  await page.getByRole('button',{name:'✅ この列設定で確定',exact:true}).click();
  const report=await page.evaluate(()=>({rows:clipboardImportRows.length,counts:clipboardImportRows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{})}));
  console.log('Source list:',JSON.stringify(report));
  assert.ok(report.rows>0);assert.ok(report.counts.ok>0);
  if(report.counts.candidate){
    assert.equal(await page.locator('#clipboardAnalysisRegister').isDisabled(),true);
    assert.match(await page.locator('#clipboardAnalysisActionStatus').textContent(),new RegExp(String(report.counts.candidate)));
  }
  for(const [width,height] of [[1440,844],[390,844],[390,600]]){
    await page.setViewportSize({width,height});
    const button=await page.locator('#clipboardAnalysisRegister').boundingBox();
    if(!button||button.y<0||button.y+button.height>height+1)console.log(await page.locator('#clipboardAnalysisModal .modal').evaluate(el=>({box:el.getBoundingClientRect().toJSON(),scroll:el.scrollHeight,style:{height:getComputedStyle(el).height,padding:getComputedStyle(el).padding,boxSizing:getComputedStyle(el).boxSizing},children:[...el.children].map(c=>({tag:c.tagName,id:c.id,cls:c.className,box:c.getBoundingClientRect().toJSON(),font:getComputedStyle(c).fontSize,flex:getComputedStyle(c).flexShrink}))})));assert.ok(button&&button.y>=0&&button.y+button.height<=height+1,JSON.stringify({width,height,button}));
  }
  async function resolveCandidates(){
    while(await page.evaluate(()=>clipboardImportRows.some(row=>row.status==='candidate'))){
      const line=await page.evaluate(()=>clipboardImportRows.find(row=>row.status==='candidate').line);
      await page.locator('#clipboardNextCandidate').click();
      assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('data-clipboard-candidate-line')),String(line));
      const select=page.locator(`[data-clipboard-candidate-line="${line}"]`);
      const value=await select.locator('option[translate=no]').first().getAttribute('value');
      await select.selectOption(value);
    }
  }
  await resolveCandidates();
  assert.equal(await page.locator('#clipboardAnalysisRegister').isDisabled(),false);
  const matched=await page.evaluate(()=>clipboardImportRows.filter(row=>['ok','conflict'].includes(row.status)).map(row=>row.songId));
  // Preserve an existing song's instruments and favorite flag even while updating its key.
  await page.evaluate(id=>{personalSongs[id]={registered:true,key:3,parts:['🎸','🎹'],part:'🎸',liked:true};},matched[0]);
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:844});
    const rect=await page.locator('#clipboardAnalysisRegister').boundingBox();
    assert.ok(rect&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width+1&&rect.y+rect.height<=844+1,JSON.stringify(rect));
  }
  await page.locator('#clipboardAnalysisRegister').click();
  assert.equal(await page.locator('#clipboardAnalysisModal').isVisible(),false);
  assert.equal(await page.locator('#clipboardConfirmModal').isVisible(),true);
  await page.getByRole('button',{name:'照合結果に戻る',exact:true}).click();
  assert.equal(await page.locator('#clipboardConfirmModal').isVisible(),false);
  assert.equal(await page.locator('#clipboardAnalysisModal').isVisible(),true);
  await page.locator('#clipboardAnalysisRegister').click();
  await page.evaluate(()=>{rejectNextUpdate=true;});
  await page.locator('#clipboardConfirmApply').click();
  await page.waitForFunction(()=>document.getElementById('clipboardConfirmFeedback').textContent.includes('登録できませんでした'));
  assert.equal(await page.evaluate(()=>writes.length),0);
  assert.equal(await page.locator('#clipboardConfirmApply').isEnabled(),true);
  await page.locator('#clipboardConfirmApply').click();
  await page.waitForFunction(()=>document.getElementById('clipboardResultModal').style.display==='flex');
  const packet=await page.evaluate(()=>writes[0]);
  assert.equal(Object.keys(packet).length,new Set(matched).size);
  assert.ok(Object.keys(packet).every(key=>key.startsWith('users/tester/songs/')));
  assert.deepEqual(packet['users/tester/songs/'+matched[0]].parts,['🎸','🎹']);
  assert.equal(packet['users/tester/songs/'+matched[0]].liked,true);
  assert.ok(Object.values(packet).every(song=>song.key===0&&song.registered));
  await page.locator('#clipboardResultModal').getByRole('button',{name:'完了',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('.modal-overlay')].filter(el=>el.id.startsWith('clipboard')&&getComputedStyle(el).display!=='none').map(el=>el.id)),[]);
  assert.equal(await page.evaluate(()=>clipboardImportRows.length),0);
  assert.equal(await page.evaluate(()=>clipboardCandidateSelections.size),0);
  // Start a fresh import; selections from the completed run must not leak into it.
  await page.evaluate(()=>openClipboardImportModal());
  await page.getByRole('button',{name:'📋 クリップボードの表を読み取る',exact:true}).click();
  await page.getByRole('button',{name:'✅ この列設定で確定',exact:true}).click();
  assert.equal(await page.evaluate(()=>clipboardImportRows.filter(row=>row.status==='candidate').length),report.counts.candidate||0);
  await resolveCandidates();await page.locator('#clipboardAnalysisRegister').click();
  await page.evaluate(()=>{auth.currentUser={uid:'another-user'};});
  await page.locator('#clipboardConfirmApply').click();
  await page.waitForFunction(()=>document.getElementById('clipboardConfirmFeedback').textContent.includes('ログインアカウント'));
  assert.equal(await page.evaluate(()=>writes.length),1);
  await page.evaluate(()=>clipboardFinish());
  await page.evaluate(()=>{auth.currentUser={uid:'tester'};navigator.clipboard.readText=async()=>{throw Error('Clipboard permission denied');};});
  await page.evaluate(()=>openClipboardImportModal());
  await page.getByRole('button',{name:'📋 クリップボードの表を読み取る',exact:true}).click();
  assert.match(await page.locator('#clipboardImportSummary').textContent(),/クリップボードを読み取れませんでした/);
  assert.equal(await page.locator('#clipboardImportRegister').isDisabled(),true);
  console.log('PASS: actual clipboard reader and parser, column confirmation, pending-match navigation, analysis/confirmation back-and-forth, mobile button visibility, save failure/retry, '+matched.length+' saved songs, metadata preservation, clean completion, fresh re-import, account-change prevention, and clipboard denial. Database writes were mocked.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
