'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('pageerror', error => console.error('BROWSER_PAGE_ERROR ' + error.message));
    for (let attempt = 0; attempt < 30; attempt++) {
      const response = await page.request.get('https://kankan1176.com/?deployment-check=20261106');
      if ((await response.text()).includes('Prefer the server so a previously read index key')) break;
      assert(attempt < 29, 'Updated search page was not deployed');
      await page.waitForTimeout(10000);
    }
    await page.goto('https://kankan1176.com/?search-verification=20261106', { waitUntil: 'domcontentloaded' });
    await page.locator('#slNavAll').click();
    await page.waitForFunction(() => typeof allData !== 'undefined' && allData.length > 0 && !serverPageBusy, null, { timeout: 120000 });
    const reports = [];
    for (const query of ['RADWIMPS', 'BUMP', '天体観測', '前前前世', 'ミスチル', 'ヒゲダン', 'ごちうさ']) {
      await page.locator('#searchInput').fill(query);
      await page.waitForFunction(q => !serverSearchBusy && serverSearchActiveQuery === normalizeServerSearchText(q), query, { timeout: 120000 });
      const result = await page.evaluate(() => ({ rows: allData.length, rendered: tableBody.querySelectorAll('tr').length, hasNext: serverSearchHasNext, indexKey: serverSearchIndexKey }));
      reports.push({ query, ...result });
      assert(result.rows > 0, query + ' returned no songs');
      if (query === 'RADWIMPS') assert(result.rows > 1, 'RADWIMPS remains incomplete');
      if (query === 'BUMP') assert(result.hasNext, 'BUMP pagination missing');
    }
    console.log('BROWSER_SEARCH_REPORT ' + JSON.stringify(reports));
    await page.screenshot({ path: 'public-search-verification.png', fullPage: true });
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
