/** Sync public songs from Firebase's publicly readable RTDB paths.
 * No Firebase service-account key, browser token, or third-party dependencies.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const DB_URL = 'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app';
const OUTPUT = 'public/songs.json';
const MAX_ATTEMPTS = 4;

async function readPublic(pathName) {
  const response = await fetch(`${DB_URL}/${pathName}.json`, {
    headers: {accept: 'application/json'},
    signal: AbortSignal.timeout(120000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`${pathName}: HTTP ${response.status}`);
  return response.json();
}
function validateMaster(master) {
  if (!master || typeof master !== 'object' || Array.isArray(master)) throw new Error('Firebase songs is not an object');
  const entries = Object.entries(master);
  if (!entries.length) throw new Error('Firebase songs is empty');
  for (const [id, song] of entries) {
    if (!song || typeof song !== 'object' || Array.isArray(song) ||
        typeof song.title !== 'string' || !song.title.trim() ||
        (Object.hasOwn(song, 'id') && song.id !== id)) {
      throw new Error(`Invalid song at UUID: ${id}`);
    }
  }
  return entries.length;
}
async function currentPublished() {
  try {
    const parsed = JSON.parse(await fs.readFile(OUTPUT, 'utf8'));
    return parsed?.schema === 3 && typeof parsed.revision === 'string' ? parsed.revision : null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error('Existing public/songs.json is invalid; inspect it before replacing: ' + error.message);
  }
}
async function main() {
  const existingRevision = await currentPublished();
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const before = await readPublic('masterMeta/revision');
    if (typeof before !== 'string' || !before) throw new Error('masterMeta/revision is missing; set it using admin.html');
    if (before === existingRevision) {
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
    await fs.mkdir(path.dirname(OUTPUT), {recursive: true});
    // Exactly the schema consumed by stage-3 index.html; UUID remains each object's key.
    await fs.writeFile(OUTPUT, JSON.stringify({schema: 3, revision: after, songs}), 'utf8');
    console.log(`Exported ${count} songs at revision ${after} to ${OUTPUT}`);
    return;
  }
  throw new Error('Master revision changed during every fetch; retry the workflow after the upload finishes');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
