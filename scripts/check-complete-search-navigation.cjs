'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const core = require('../song-search-core.js');
const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('    async function searchServerIndex(');
const searchFunction = html.slice(start, html.indexOf('    async function loadServerMasterPage(', start));
const keyStart = html.indexOf('    async function currentServerSearchIndexKey()');
const keyFunction = html.slice(keyStart, html.indexOf('    function serverGenreKeyForName(', keyStart));

function fixture() {
  const songs = {};
  for (let i = 0; i < 137; i++) songs['b' + i] = {title: i ? 'B song ' + i : '天体観測', artist: 'BUMP OF CHICKEN', search: 'バンプ'};
  for (let i = 0; i < 124; i++) songs['r' + i] = {title: i ? 'R song ' + i : '前前前世', artist: 'RADWIMPS', search: 'ラッド'};
  for (let i = 0; i < 192; i++) songs['m' + i] = {title: 'M song ' + i, artist: 'Mr.Children', search: 'ミスチル 桜井和寿'};
  songs.anime = {title: 'Daydream café', artist: 'Petit Rabbit’s', search: 'ごちうさ ご注文はうさぎですか', tieup: 'ご注文はうさぎですか？'};
  const entries = [];
  for (const [id, song] of Object.entries(songs)) {
    const suffixes = new Set();
    for (const word of core.text(song).split(/\s+/)) {
      const chars = Array.from(word);
      for (let i = 0; i < chars.length; i++) suffixes.add(chars.slice(i).join(''));
    }
    for (const suffix of suffixes) entries.push([Buffer.from(suffix).toString('hex') + '_' + id, id]);
  }
  entries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  let displayed = {};
  const db = { ref(path) {
    if (path.startsWith('songs/')) {
      const id = path.slice(6);
      return { once: async () => ({ key: id, val: () => songs[id] }) };
    }
    let lower = '', upper = '', inclusive = true, limit = 0;
    return {
      orderByKey() { return this; },
      startAt(value) { lower = value; return this; },
      startAfter(value) { lower = value; inclusive = false; return this; },
      endAt(value) { upper = value; return this; },
      limitToFirst(value) { assert(value <= 100); limit = value; return this; },
      once: async () => ({ forEach: callback => entries.filter(([key]) => (inclusive ? key >= lower : key > lower) && key <= upper).slice(0, limit).forEach(([key, id]) => callback({key, val: () => id})) }),
    };
  }};
  const context = {
    console, Set, Map, masterLoaded: false, serverPageLoadPromise: null, searchInput: {value: ''},
    normalizeServerSearchText: core.normalize, serverSearchSongText: core.text,
    serverSearchUtf8Hex: value => Buffer.from(value).toString('hex'), currentServerSearchIndexKey: async () => 'current',
    serverSearchRequestSeq: 0, serverSearchBusy: false, serverSearchHasNext: false, serverSearchPage: 1,
    serverSearchHistory: [{cursor: '', seen: []}], serverSearchActiveQuery: '', serverSearchMode: false,
    serverPagedMasterMode: false, genreServerMode: false, currentGenre: 'すべて', selectedGenres: {}, genreFilterVersion: 0,
    loadingArea: {style: {}}, renderCurrentSongPage() {}, renderTable() {}, db, MASTER_DB_PATH: 'songs',
    serverSearchMasterToRawRows: rows => rows, loadRowsIntoApp: rows => { displayed = rows; }, tableBodyWrapper: {}, masterLoadNotice() {},
    promoteServerPageToFullMaster: async () => { throw Error('Unexpected fallback'); }, updateSortIcons() {},
  };
  vm.createContext(context);
  vm.runInContext(searchFunction + ';this.search=searchServerIndex', context);
  return {context, songs, displayed: () => displayed};
}

(async () => {
  const f = fixture();
  for (const query of ['BUMP', 'RADWIMPS', 'ＲＡＤＷＩＭＰＳ', '天体観測', '前前前世', 'ミスチル', '桜井', 'ごちうさ', 'ミスチル M song']) {
    f.context.searchInput.value = query;
    await f.context.search(query);
    const found = new Set(Object.keys(f.displayed()));
    while (f.context.serverSearchHasNext) {
      await f.context.search(query, 'older');
      for (const id of Object.keys(f.displayed())) { assert(!found.has(id), 'Duplicate page song'); found.add(id); }
    }
    const expected = new Set(Object.keys(f.songs).filter(id => core.matches(f.songs[id], query)));
    assert.deepEqual([...found].sort(), [...expected].sort(), query);
  }
  let freshReads = 0;
  const context = {serverSearchIndexKey: 'retired-index', db: {ref: () => ({get: async () => {freshReads++; return {val: () => 'published-index'};}, once: () => {throw Error('Stale cache used');}})}};
  vm.createContext(context);
  vm.runInContext(keyFunction + ';this.getKey=currentServerSearchIndexKey', context);
  assert.equal(await context.getKey(), 'published-index');
  assert.equal(await context.getKey(), 'published-index');
  assert.equal(freshReads, 2);
  console.log('PASS actual search: all artists, titles, Q keywords, partial/full-width/multiple terms, 100-song pagination and fresh published index reads.');
})().catch(error => {console.error(error); process.exitCode = 1;});
