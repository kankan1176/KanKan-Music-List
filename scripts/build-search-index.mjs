/**
 * Build a versioned substring-search index in Firebase Realtime Database.
 *
 * The index does NOT contain full song records. Each row is:
 *   <hex-encoded suffix>_<stable hash> : "<songId>"
 *
 * Because UTF-8 hex preserves prefixes, the browser can use orderByKey()
 * + startAt()/endAt() + limitToFirst(100) for substring search.
 *
 * Required GitHub Actions secret:
 *   FIREBASE_SERVICE_ACCOUNT = complete Firebase service-account JSON
 */

import crypto from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const DB_URL =
  process.env.FIREBASE_DB_URL ||
  'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app';

const rawCredential = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!rawCredential) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT is missing.');
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(rawCredential);
} catch {
  throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.');
}

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: DB_URL,
});

const db = getDatabase();

const SEARCH_FIELDS = [
  'title',
  'artist',
  'tieup',
  'search',
  'lyrics',
  'composition',
  'arrangement',
  'genre',
  'genre2',
  'genre3',
];

const WRITE_BATCH_SIZE = 5000;
const MAX_ATTEMPTS = 3;
const MAX_TERM_UTF8_BYTES = 300;

function sha256(value, length = 40) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, length);
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('ja')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim();
}

function searchableWords(song) {
  const text = normalizeSearchText(
    SEARCH_FIELDS.map(field => song?.[field] ?? '').join(' ')
  );
  return text ? text.split(/\s+/u).filter(Boolean) : [];
}

function fitUtf8Prefix(text, maxBytes = MAX_TERM_UTF8_BYTES) {
  const chars = Array.from(text);
  while (chars.length && Buffer.byteLength(chars.join(''), 'utf8') > maxBytes) {
    chars.pop();
  }
  return chars.join('');
}

/**
 * Any substring is a prefix of a suffix.
 *
 * "chicken"
 * -> chicken / hicken / icken / cken / ken / en / n
 *
 * Query "chic" therefore finds "chicken".
 * Query "icken" finds "icken".
 */
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

function encodeTerm(term) {
  return Buffer.from(term, 'utf8').toString('hex');
}

function validateSongs(songs) {
  if (!songs || typeof songs !== 'object' || Array.isArray(songs)) {
    throw new Error('/songs is not an object');
  }

  const entries = Object.entries(songs);
  if (!entries.length) throw new Error('/songs is empty');

  for (const [id, song] of entries) {
    if (
      !/^[A-Za-z0-9_-]{1,80}$/.test(id) ||
      !song ||
      typeof song !== 'object' ||
      Array.isArray(song) ||
      typeof song.title !== 'string' ||
      !song.title.trim()
    ) {
      throw new Error(`Invalid song: ${id}`);
    }
  }

  return entries;
}

async function writeBatch(indexKey, batch) {
  if (!Object.keys(batch).length) return;
  await db.ref(`songSearchRows/${indexKey}`).update(batch);
}

async function buildOnce(sourceRevision, songs) {
  const entries = validateSongs(songs);
  const indexKey = sha256(`shareliscore-search-v2\0${sourceRevision}`, 24);

  // Retry-safe: this unpublished version is cleared before rebuilding.
  await db.ref(`songSearchRows/${indexKey}`).remove();

  let batch = {};
  let batchCount = 0;
  let rowCount = 0;
  let processed = 0;

  for (const [songId, song] of entries) {
    const terms = suffixTermsForSong(song);

    for (const term of terms) {
      const encoded = encodeTerm(term);
      const rowId = `${encoded}_${sha256(`${songId}\0${term}`, 24)}`;

      // The value is only the UUID. Full song data remains under /songs.
      batch[rowId] = songId;
      batchCount++;
      rowCount++;

      if (batchCount >= WRITE_BATCH_SIZE) {
        await writeBatch(indexKey, batch);
        batch = {};
        batchCount = 0;
      }
    }

    processed++;
    if (processed % 1000 === 0) {
      console.log(`Indexed ${processed}/${entries.length} songs; rows=${rowCount}`);
    }
  }

  await writeBatch(indexKey, batch);

  return { indexKey, rowCount, songCount: entries.length };
}

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const before = (await db.ref('masterMeta/revision').get()).val();
    if (typeof before !== 'string' || !before) {
      throw new Error('masterMeta/revision is missing.');
    }

    const currentMeta = (await db.ref('songSearchMeta').get()).val() || {};

    if (
      currentMeta.sourceRevision === before &&
      typeof currentMeta.currentIndexKey === 'string' &&
      currentMeta.currentIndexKey
    ) {
      console.log(`Search index is already current: ${before}`);
      return;
    }

    console.log(`Building search index for ${before} (${attempt}/${MAX_ATTEMPTS})`);

    const songs = (await db.ref('songs').get()).val();
    const built = await buildOnce(before, songs);

    const after = (await db.ref('masterMeta/revision').get()).val();
    if (after !== before) {
      console.warn('Master changed while building; discarding this version.');
      await db.ref(`songSearchRows/${built.indexKey}`).remove();
      continue;
    }

    const previousIndexKey =
      typeof currentMeta.currentIndexKey === 'string'
        ? currentMeta.currentIndexKey
        : '';

    // Atomic publication point for clients.
    await db.ref('songSearchMeta').set({
      currentIndexKey: built.indexKey,
      sourceRevision: before,
      rowCount: built.rowCount,
      songCount: built.songCount,
      updatedAt: Date.now(),
    });

    // Only after publication succeeds, remove the previously published version.
    if (previousIndexKey && previousIndexKey !== built.indexKey) {
      await db.ref(`songSearchRows/${previousIndexKey}`).remove();
    }

    console.log(
      `Published ${built.indexKey}: songs=${built.songCount}, rows=${built.rowCount}`
    );
    return;
  }

  throw new Error('Master revision changed during every build attempt.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
