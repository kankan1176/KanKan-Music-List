'use strict';

// Read-only audit of every public master search term and the published index.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { initializeApp, cert, deleteApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const core = require('../song-search-core.js');

function termsFor(song) {
  const terms = new Set();
  for (const word of core.text(song).split(/\s+/u).filter(Boolean)) {
    const chars = Array.from(word);
    for (let i = 0; i < chars.length; i++) {
      const suffix = chars.slice(i);
      while (suffix.length && Buffer.byteLength(suffix.join(''), 'utf8') > 300) suffix.pop();
      if (suffix.length) terms.add(suffix.join(''));
    }
  }
  return terms;
}

async function main() {
  const app = initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: 'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app',
  });
  try {
    const db = getDatabase(app);
    const songs = (await db.ref('songs').get()).val();
    const meta = (await db.ref('songSearchMeta').get()).val();
    const entries = Object.entries(songs);
    const index = (await db.ref('songSearchRows/' + meta.currentIndexKey).get()).val() || {};
    let checkedTerms = 0;
    let missing = 0;
    const affected = new Set();
    for (const [id, song] of entries) {
      for (const term of termsFor(song)) {
        const hash = crypto.createHash('sha256').update(id + '\0' + term).digest('hex').slice(0, 24);
        const key = Buffer.from(term).toString('hex') + '_' + hash;
        checkedTerms++;
        if (index[key] !== id) { missing++; affected.add(id); }
      }
    }
    console.log('ALL_SEARCH_COVERAGE ' + JSON.stringify({
      songs: entries.length,
      artistSongs: entries.filter(([,s]) => s.artist || s['アーティスト']).length,
      searchKeywordSongs: entries.filter(([,s]) => s.search || s['検索']).length,
      checkedTerms, actualRows: Object.keys(index).length,
      missingTerms: missing, affectedSongs: affected.size, indexVersion: meta.indexVersion,
    }));

    const exampleSongs = entries.filter(([, song]) => core.normalize(song.title).replace(/\s+/g, '') === 'sweetbitterbeautysong' && core.text(song).includes('桜高軽音部'));
    assert(exampleSongs.length > 0, 'Sweet Bitter Beauty Song master example is missing');
    const exampleQueries = ['けいおん', '平沢唯', '小森茂生', '日笠陽子'];
    console.log('COMMA_KEYWORD_EXAMPLE ' + JSON.stringify(exampleSongs.map(([id,song]) => ({id, title:song.title, artist:song.artist, search:song.search}))));
    for (const [id,song] of exampleSongs) for (const query of exampleQueries) assert(core.matches(song,query), 'Example keyword missing in master: '+query+' '+id);
    const queries = [...exampleQueries, 'RADWIMPS', 'BUMP', 'YOASOBI', '米津玄師', 'Ado', '天体観測', '前前前世', 'スパークル', 'ミスチル', 'ヒゲダン', 'ごちうさ', 'ジャンプスクエア'];
    for (const query of queries) {
      const expected = new Set(entries.filter(([,song]) => core.matches(song, query)).map(([id]) => id));
      assert(expected.size, 'No master example: ' + query);
      const prefix = Buffer.from(core.normalize(query)).toString('hex');
      const found = new Set();
      let cursor = '', pages = 0;
      for (;;) {
        let q = db.ref('songSearchRows/' + meta.currentIndexKey).orderByKey();
        q = cursor ? q.startAfter(cursor) : q.startAt(prefix);
        const snapshot = await q.endAt(prefix + '\uf8ff').limitToFirst(100).get();
        let count = 0;
        snapshot.forEach(child => {
          count++; cursor = child.key;
          const id = child.val();
          if (core.matches(songs[id], query)) found.add(id);
        });
        pages++;
        if (count < 100) break;
        assert(pages < 1000, 'Unbounded query');
      }
      if (exampleQueries.includes(query)) for (const [id] of exampleSongs) assert(found.has(id), 'Example not retrieved: '+query+' '+id);
      const absent = [...expected].filter(id => !found.has(id)).length;
      console.log('LIVE_SEARCH_QUERY ' + JSON.stringify({ query, expected: expected.size, actual: found.size, missing: absent, pages }));
      assert.equal(absent, 0, 'Search mismatch: ' + query);
    }
    assert.equal(missing, 0, 'Incomplete public search index');
    assert.equal((await db.ref('songSearchMeta/currentIndexKey').get()).val(), meta.currentIndexKey, 'Index changed during audit');
    console.log('ALL_SEARCH_VERIFIED');
  } finally { await deleteApp(app); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
