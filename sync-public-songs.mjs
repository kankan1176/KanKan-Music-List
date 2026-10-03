/** Sync public songs from Firebase's publicly readable RTDB paths.
 * No Firebase service-account key, browser token, or third-party dependencies.
 *
 * Env:
 *   FIREBASE_DB_URL  override the database URL (testing only)
 *   ALLOW_SHRINK     'true' to allow publishing a master with < 50% of the current song count
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const DB_URL = process.env.FIREBASE_DB_URL || 'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app';
const OUTPUT = 'public/songs.json';
const MAX_ATTEMPTS = 4;      // revision changed while fetching
const FETCH_RETRIES = 3;     // transient network / 5xx / 429
const ALLOW_SHRINK = process.env.ALLOW_SHRINK === 'true';
const OPTIONAL_STRING_FIELDS = ['artist', 'chordwiki', 'bpm', 'genre', 'genre2', 'genre3', 'tieup', 'search', 'lyrics', 'composition', 'arrangement'];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function readPublic(pathName) {
  let lastError;
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const response = await fetch(`${DB_URL}/${pathName}.json`, {
        headers: {accept: 'application/json'},
        signal: AbortSignal.timeout(120000),
        cache: 'no-store',
      });
      if (response.ok) return await response.json();
      const error = new Error(`${pathName}: HTTP ${response.status}`);
      // 4xx (except 429) will not fix itself: fail immediately.
      if (response.status < 500 && response.status !== 429) { error.fatal = true; throw error; }
      lastError = error;
    } catch (error) {
      if (error.fatal) throw error;
      lastError = error;
    }
    if (attempt < FETCH_RETRIES) {
      console.warn(`Fetch failed for ${pathName} (attempt ${attempt}/${FETCH_RETRIES}): ${lastError.message}; retrying`);
      await sleep(2000 * attempt);
    }
  }
  throw lastError;
}

function validateMaster(master) {
  if (!master || typeof master !== 'object' || Array.isArray(master)) throw new Error('Firebase songs is not an object');
  const entries = Object.entries(master);
  if (!entries.length) throw new Error('Firebase songs is empty');
  for (const [id, song] of entries) {
    if (!song || typeof song !== 'object' || Array.isArray(song) ||
        typeof song.title !== 'string' || !song.title.trim() ||
        (Object.hasOwn(song, 'id') && song.id !== id) ||
        OPTIONAL_STRING_FIELDS.some(field => Object.hasOwn(song, field) && typeof song[field] !== 'string')) {
      throw new Error(`Invalid song at UUID: ${id}`);
    }
  }
  return entries.length;
}

/** Returns the published revision/count. A missing or broken file is regenerated, never fatal. */
async function currentPublished() {
  let text;
  try {
    text = await fs.readFile(OUTPUT, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {revision: null, count: 0};
    throw error;
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed?.schema === 3 && typeof parsed.revision === 'string' && parsed.songs && typeof parsed.songs === 'object') {
      return {revision: parsed.revision, count: Object.keys(parsed.songs).length};
    }
    console.warn(`Existing ${OUTPUT} has an unexpected shape; it will be regenerated.`);
  } catch (error) {
    console.warn(`Existing ${OUTPUT} is not valid JSON; it will be regenerated: ${error.message}`);
  }
  return {revision: null, count: 0};
}

/** One song per line keeps git diffs small and compresses well. Output is plain JSON. */
function serialize(revision, songs) {
  const body = Object.entries(songs)
    .map(([id, song]) => `${JSON.stringify(id)}:${JSON.stringify(song)}`)
    .join(',\n');
  return `{"schema":3,"revision":${JSON.stringify(revision)},"songs":{\n${body}\n}}\n`;
}

async function main() {
  const existing = await currentPublished();
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const before = await readPublic('masterMeta/revision');
    if (typeof before !== 'string' || !before) throw new Error('masterMeta/revision is missing; set it using admin.html');
    if (before === existing.revision) {
      console.log('Already current; no public JSON change:', before);
      return;
    }
    const songs = await readPublic('songs');
    const count = validateMaster(songs);
    const after = await readPublic('masterMeta/revision');
    if (before !== after) {
      console.warn(`Revision changed while fetching (attempt ${attempt}/${MAX_ATTEMPTS}); retrying`);
      continue;
    }
    if (existing.count > 0 && count < existing.count * 0.5 && !ALLOW_SHRINK) {
      throw new Error(`Song count dropped from ${existing.count} to ${count}. Refusing to publish; re-run the workflow with allow_shrink=true if this is intended.`);
    }
    const text = serialize(after, songs);
    // Sanity check: what we are about to write must parse back to the same data.
    const check = JSON.parse(text);
    if (check.revision !== after || Object.keys(check.songs).length !== count) throw new Error('Serialized JSON failed the round-trip check');
    await fs.mkdir(path.dirname(OUTPUT), {recursive: true});
    const tmp = `${OUTPUT}.tmp`;
    await fs.writeFile(tmp, text, 'utf8');
    await fs.rename(tmp, OUTPUT); // atomic replace: never leaves a half-written public JSON
    console.log(`Exported ${count} songs at revision ${after} to ${OUTPUT}`);
    return;
  }
  throw new Error('Master revision changed during every fetch; retry the workflow after the upload finishes');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
