/**
 * Share List Score: search index + genre index builder.
 */

import crypto from 'node:crypto';
import genreCore from '../song-genres.js';
import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const DB_URL =
  process.env.FIREBASE_DB_URL ||
  'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app';

const rawCredential = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!rawCredential) throw new Error('FIREBASE_SERVICE_ACCOUNT is missing.');

let serviceAccount;
try {
  serviceAccount = JSON.parse(rawCredential);
} catch {
  throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.');
}

const app = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: DB_URL,
});
const db = getDatabase(app);

const SEARCH_FIELDS = [
  'title','artist','tieup','search','lyrics','composition','arrangement',
  'genre1','genre2','genre3','genre4','genre5','genre6','vocal_synths','release_year','anime_year',
];
const GENRE_FIELDS = ['genre','genre2','genre3'];

// Realtime Database has a maximum size for a single write.
 // Count-only batching can still exceed that limit when search suffix keys are long,
 // so keep both an entry limit and an approximate byte limit.
const WRITE_BATCH_SIZE = 750;
const WRITE_BATCH_MAX_BYTES = 2 * 1024 * 1024; // ~2 MiB safety margin
const MAX_ATTEMPTS = 3;
const MAX_TERM_UTF8_BYTES = 300;
const INDEX_VERSION = 6;

function sha256(value, length = 40) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, length);
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('ja')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim();
}

function normalizeGenre(value) {
  return String(value ?? '').normalize('NFKC').trim();
}

function searchableWords(song) {
  const text = normalize(SEARCH_FIELDS.map(field => genreCore.fields.includes(field)?genreCore.value(song,field):song?.[field] ?? '').join(' '));
  return text ? text.split(/\s+/u).filter(Boolean) : [];
}

function fitUtf8Prefix(text, maxBytes = MAX_TERM_UTF8_BYTES) {
  const chars = Array.from(text);
  while (chars.length && Buffer.byteLength(chars.join(''), 'utf8') > maxBytes) chars.pop();
  return chars.join('');
}

function suffixTermsForSong(song) {
  const terms = new Set();
  for (const word of searchableWords(song)) {
    const chars = Array.from(word);
    for (let i = 0; i < chars.length; i++) {
      const fitted = fitUtf8Prefix(chars.slice(i).join(''));
      if (fitted) terms.add(fitted);
    }
  }
  return terms;
}

function encodeUtf8(value) {
  return Buffer.from(value, 'utf8').toString('hex');
}

function genresForSong(song){const tags=new Set();for(const[field,values]of Object.entries(genreCore.filterGroups(song)))for(const value of values){tags.add(value);tags.add(field+'::'+value);}return [...tags];}

function validateSongs(songs) {
  if (!songs || typeof songs !== 'object' || Array.isArray(songs)) {
    throw new Error('/songs is not an object');
  }

  const entries = Object.entries(songs);
  if (!entries.length) throw new Error('/songs is empty');

  for (const [id, song] of entries) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) ||
        !song || typeof song !== 'object' || Array.isArray(song) ||
        typeof song.title !== 'string' || !song.title.trim()) {
      throw new Error(`Invalid song: ${id}`);
    }
  }

  return entries;
}

async function flush(pathName, batch) {
  if (!Object.keys(batch).length) return;
  await db.ref(pathName).update(batch);
}

// Removing a large index at once also counts toward RTDB's write size limit.
async function removeIndex(pathName) {
  const ref=db.ref(pathName);
  for (;;) {
    const snapshot=await ref.orderByKey().limitToFirst(750).get();
    if (!snapshot.exists()) return;
    const batch={};snapshot.forEach(child=>{batch[child.key]=null;});
    await ref.update(batch);
  }
}

async function cleanRetiredIndexes() {
  const [queue,search,genre]=await Promise.all(['songIndexCleanup','songSearchMeta/currentIndexKey','songGenreMeta/currentIndexKey'].map(path=>db.ref(path).get()));
  for(const key of Object.keys(queue.val()||{})){
    if(!/^[a-f0-9]{24}$/.test(key)||key===search.val()||key===genre.val())continue;
    await removeIndex('songSearchRows/'+key);
    await removeIndex('songGenreRows/'+key);
    await db.ref('songIndexCleanup/'+key).remove();
    console.log('Retired index removed in bounded batches: '+key);
  }
}

function approxEntryBytes(key, value) {
  // Conservative UTF-8 estimate including JSON punctuation / path overhead.
  return Buffer.byteLength(String(key), 'utf8')
    + Buffer.byteLength(String(value ?? ''), 'utf8')
    + 32;
}

function genreOrderKey(songId, updatedAt) {
  const raw = Number(updatedAt);
  const ts = Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
  const capped = Math.min(ts, 9999999999999);
  const inverted = 9999999999999 - capped;
  return `${String(inverted).padStart(13,'0')}_${songId}`;
}

async function buildOnce(sourceRevision, songs) {
  const entries = validateSongs(songs);
  const indexKey = sha256(`shareliscore-index-v${INDEX_VERSION}\0${sourceRevision}`, 24);

  await Promise.all([
    removeIndex(`songSearchRows/${indexKey}`),
    removeIndex(`songGenreRows/${indexKey}`),
  ]);

  let searchBatch = {};
  let searchBatchCount = 0;
  let searchBatchBytes = 0;
  let genreBatch = {};
  let genreBatchCount = 0;
  let genreBatchBytes = 0;
  let searchRowCount = 0;
  let genreRowCount = 0;
  let processed = 0;

  const genreCounts = new Map();

  for (const [songId, song] of entries) {
    for (const term of suffixTermsForSong(song)) {
      const rowId = `${encodeUtf8(term)}_${sha256(`${songId}\0${term}`, 24)}`;
      searchBatch[rowId] = songId;
      searchBatchCount++;
      searchBatchBytes += approxEntryBytes(rowId, songId);
      searchRowCount++;

      if (
        searchBatchCount >= WRITE_BATCH_SIZE ||
        searchBatchBytes >= WRITE_BATCH_MAX_BYTES
      ) {
        await flush(`songSearchRows/${indexKey}`, searchBatch);
        searchBatch = {};
        searchBatchCount = 0;
        searchBatchBytes = 0;
      }
    }

    for (const genre of genresForSong(song)) {
      const genreKey = encodeUtf8(genre);
      const rowKey = genreOrderKey(songId, song.updatedAt);

      const genrePath = `${genreKey}/${rowKey}`;
      genreBatch[genrePath] = songId;
      genreBatchCount++;
      genreBatchBytes += approxEntryBytes(genrePath, songId);
      genreRowCount++;
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);

      if (
        genreBatchCount >= WRITE_BATCH_SIZE ||
        genreBatchBytes >= WRITE_BATCH_MAX_BYTES
      ) {
        await flush(`songGenreRows/${indexKey}`, genreBatch);
        genreBatch = {};
        genreBatchCount = 0;
        genreBatchBytes = 0;
      }
    }

    processed++;
    if (processed % 1000 === 0) {
      console.log(
        `Indexed ${processed}/${entries.length}; searchRows=${searchRowCount}; genreRows=${genreRowCount}`
      );
    }
  }

  await flush(`songSearchRows/${indexKey}`, searchBatch);
  await flush(`songGenreRows/${indexKey}`, genreBatch);

  const genres = {},groups=Object.fromEntries(genreCore.metadataFields.map(field=>[field,{}]));
  for (const [name, count] of [...genreCounts.entries()].sort((a,b)=>a[0].localeCompare(b[0],'ja'))) {
    const field=genreCore.metadataFields.find(field=>name.startsWith(field+'::'));
    if(field)groups[field][encodeUtf8(name.slice(field.length+2))]={name:name.slice(field.length+2),count};else genres[encodeUtf8(name)] = {name,count};
  }

  return {
    indexKey,
    searchRowCount,
    genreRowCount,
    songCount: entries.length,
    genres,groups,facets:genreCore.facets(Object.values(songs)),
  };
}

async function main() {
  // Recovery for the old index whose single-request deletion hit WRITE_TOO_BIG.
  const retired=process.env.RETIRED_INDEX_KEY;
  if(retired){if(!/^[a-f0-9]{24}$/.test(retired))throw Error('Invalid retired index key');await db.ref('songIndexCleanup/'+retired).set(true);}
  await cleanRetiredIndexes();
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const before = (await db.ref('masterMeta/revision').get()).val();
    if (typeof before !== 'string' || !before) {
      throw new Error('masterMeta/revision is missing.');
    }

    const searchMeta = (await db.ref('songSearchMeta').get()).val() || {};
    const genreMeta = (await db.ref('songGenreMeta').get()).val() || {};

    if (
      searchMeta.sourceRevision === before &&
      searchMeta.indexVersion === INDEX_VERSION &&
      genreMeta.sourceRevision === before &&
      genreMeta.indexVersion === INDEX_VERSION &&
      typeof searchMeta.currentIndexKey === 'string' &&
      searchMeta.currentIndexKey &&
      searchMeta.currentIndexKey === genreMeta.currentIndexKey
    ) {
      console.log(`Search/genre indexes are already current: ${before}`);
      return;
    }

    console.log(`Building search/genre indexes for ${before} (${attempt}/${MAX_ATTEMPTS})`);

    const songs = (await db.ref('songs').get()).val();
    const built = await buildOnce(before, songs);

    const after = (await db.ref('masterMeta/revision').get()).val();
    if (after !== before) {
      console.warn('Master changed while building; discarding this version.');
      await Promise.all([
        removeIndex(`songSearchRows/${built.indexKey}`),
        removeIndex(`songGenreRows/${built.indexKey}`),
      ]);
      continue;
    }

    const oldSearchKey =
      typeof searchMeta.currentIndexKey === 'string' ? searchMeta.currentIndexKey : '';
    const oldGenreKey =
      typeof genreMeta.currentIndexKey === 'string' ? genreMeta.currentIndexKey : '';

    const now = Date.now();

    const retiredIndexes={};
    for(const key of [oldSearchKey,oldGenreKey])if(key&&key!==built.indexKey)retiredIndexes['songIndexCleanup/'+key]=true;
    await db.ref().update({
      ...retiredIndexes,
      songSearchMeta: {
        currentIndexKey: built.indexKey,
        sourceRevision: before,
        indexVersion: INDEX_VERSION,
        rowCount: built.searchRowCount,
        songCount: built.songCount,
        updatedAt: now,
      },
      songGenreMeta: {
        currentIndexKey: built.indexKey,
        sourceRevision: before,
        indexVersion: INDEX_VERSION,
        rowCount: built.genreRowCount,
        songCount: built.songCount,
        updatedAt: now,
        genres: built.genres,
        groups: built.groups,
      facets: built.facets,
      },
    });

    console.log(
      `Published ${built.indexKey}: songs=${built.songCount}, searchRows=${built.searchRowCount}, genreRows=${built.genreRowCount}, genres=${Object.keys(built.genres).length}`
    );
    await cleanRetiredIndexes();
    return;
  }

  throw new Error('Master revision changed during every build attempt.');
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await deleteApp(app).catch(error => {
    console.warn('Firebase Admin cleanup warning:', error?.message || error);
  });
}
