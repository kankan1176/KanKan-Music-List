'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  let page, stage = 'startup';
  try {
    page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('console', message => { if (['error','warning'].includes(message.type())) console.log('BROWSER_CONSOLE ' + message.text().slice(0, 800)); });
    page.on('pageerror', error => console.error('BROWSER_PAGE_ERROR ' + error.message));
    for (let attempt = 0; attempt < 30; attempt++) {
      const response = await page.request.get('https://kankan1176.com/?deployment-check=20261106');
      if ((await response.text()).includes('Prefer the server so a previously read index key')) break;
      assert(attempt < 29, 'Updated search page was not deployed');
      await page.waitForTimeout(10000);
    }
    await page.goto('https://kankan1176.com/?search-verification=20261106', { waitUntil: 'domcontentloaded' });
    stage = 'initial-list';
    await page.locator('#slNavAll').click();
    await page.waitForFunction(() => typeof allData !== 'undefined' && allData.length > 0 && !serverPageBusy, null, { timeout: 120000 });
    console.log('BROWSER_READY');
    const reports = [];
    for (const query of ['RADWIMPS', 'BUMP', '天体観測', '前前前世', 'ミスチル', 'ヒゲダン', 'ごちうさ']) {
      stage = query;
      console.log('BROWSER_START_QUERY ' + query);
      await page.locator('#searchInput').fill(query);
      await page.waitForFunction(q => !serverSearchBusy && (serverSearchActiveQuery === normalizeServerSearchText(q) || masterLoaded), query, { timeout: 120000 });
      const result = await page.evaluate(() => ({ rows: allData.length, rendered: tableBody.querySelectorAll('tr').length, hasNext: serverSearchHasNext, indexKey: serverSearchIndexKey }));
      reports.push({ query, ...result });
      console.log('BROWSER_QUERY ' + JSON.stringify({query, ...result}));
      assert(result.rows > 0, query + ' returned no songs');
      if (query === 'RADWIMPS') assert(result.rows > 1, 'RADWIMPS remains incomplete');
      if (query === 'BUMP') assert(result.hasNext, 'BUMP pagination missing');
    }
    console.log('BROWSER_SEARCH_REPORT ' + JSON.stringify(reports));
    await page.screenshot({ path: 'public-search-verification.png', fullPage: true });
  } catch (error) {
    console.log('BROWSER_FAILED_STAGE ' + stage);
    if (page) {
      await page.screenshot({path: 'public-search-verification.png', fullPage: true}).catch(() => {});
      console.log('BROWSER_FAILURE_STATE ' + JSON.stringify(await page.evaluate(() => ({
        rows: typeof allData === 'undefined' ? -1 : allData.length,
        masterLoaded: typeof masterLoaded === 'undefined' ? null : masterLoaded,
        busy: typeof serverPageBusy === 'undefined' ? null : serverPageBusy,
        searchBusy: typeof serverSearchBusy === 'undefined' ? null : serverSearchBusy,
        active: typeof serverSearchActiveQuery === 'undefined' ? null : serverSearchActiveQuery,
        input: document.querySelector('#searchInput')?.value,
        notice: document.querySelector('#masterLoadNotice')?.textContent,
        loading: document.querySelector('#loadingArea')?.textContent,
        table: document.querySelector('#tableBody')?.textContent?.slice(0, 500),
      }))).catch(() => null)));
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
