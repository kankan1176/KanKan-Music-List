'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ALLOWED = ['artist','bpm','genre2','genre6','vocal_synths','release_year','lyrics','composition','arrangement'];
const OPERATION = 'vocadb-enrichment-20261029';
const PATCH_PATH = 'maintenance/vocadb-enrichment-20261029.json';
const BACKUP_DIR = '.vocadb-enrichment-backup';
const empty = value => value === undefined || value === null || (typeof value === 'string' && !value.trim());
function loadPatch() {
  const patch = JSON.parse(fs.readFileSync(PATCH_PATH, 'utf8'));
  return validatePatch(patch);
}
function validatePatch(patch) {
  assert.equal(patch.operation, OPERATION);
  assert.equal(patch.schemaVersion, 1);
  assert(Array.isArray(patch.entries) && patch.entries.length > 0 && patch.entries.length <= 11000);
  assert.equal(patch.songCount, patch.entries.length);
  const ids = new Set(); let cells = 0;
  for (const entry of patch.entries) {
    assert.match(entry.id, /^[A-Za-z0-9_-]{1,80}$/);
    assert(!ids.has(entry.id)); ids.add(entry.id);
    assert(typeof entry.title === 'string' && entry.title.trim());
    assert(typeof entry.chordwiki === 'string' && (!entry.chordwiki || /^https:\/\/(?:ja|beta)\.chordwiki\.org\/wiki\//.test(entry.chordwiki)));
    assert(entry.set && typeof entry.set === 'object' && !Array.isArray(entry.set) && Object.keys(entry.set).length);
    for (const [field,value] of Object.entries(entry.set)) {
      assert(ALLOWED.includes(field), 'Disallowed catalog field: ' + field);
      assert(typeof value === 'string' && value.trim() && value.length < 250);
      if (field === 'genre1') assert(['J-POP','K-POP','洋楽'].includes(value));
      if (field === 'release_year' || field === 'anime_year') {
        assert(value.split('、').every(year => /^(?:19|20)\d\d$/.test(year) && Number(year) <= 2026));
      }
      cells++;
    }
  }
  assert.equal(patch.cellCount, cells);
  assert.equal(patch.entriesSha256, crypto.createHash('sha256').update(JSON.stringify(patch.entries)).digest('hex'));
  return patch;
}
function identityMatches(song, entry) {
  return !!song && typeof song === 'object' && !Array.isArray(song) && song.title === entry.title && String(song.chordwiki ?? '') === entry.chordwiki;
}
function fieldValue(song, field) {
  // Preserve the effective legacy main genre when no canonical field exists.
  if (field === 'genre1' && !Object.hasOwn(song, 'genre1')) {
    for (const key of ['genre','ジャンル①','ジャンル','ジャンル1']) if (!empty(song[key])) return song[key];
  }
  return song[field];
}
function updateSong(current, entry) {
  // A cold RTDB transaction can start with null; the server retries on a hash mismatch.
  // Returning null never creates a missing song and cannot replace an existing server value without a retry.
  if (current === null) return null;
  if (!identityMatches(current, entry)) return undefined;
  const next = { ...current }; let changed = false;
  for (const [field,value] of Object.entries(entry.set)) {
    if (empty(fieldValue(current, field))) { next[field] = value; changed = true; }
  }
  return changed ? next : undefined;
}
function verifyResult(before, after, entry) {
  assert(identityMatches(after, entry), 'Song identity changed: ' + entry.id);
  for (const [field,value] of Object.entries(entry.set)) {
    if (empty(fieldValue(before, field))) assert.equal(after[field], value, 'Readback mismatch: ' + entry.id + '/' + field);
    else assert.deepEqual(after[field], before[field], 'Existing value changed: ' + entry.id + '/' + field);
  }
  for (const [field,value] of Object.entries(before)) if (!Object.hasOwn(entry.set, field)) assert.deepEqual(after[field], value, 'Unrelated song field changed: ' + entry.id + '/' + field);
}
async function retry(fn) {
  for (let attempt = 0; ; attempt++) {
    try { return await fn(); } catch (error) {
      if (attempt >= 3 || !/timeout|network|ECONNRESET|unavailable|disconnected|503|429/i.test(error.message)) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
}
async function main() {
  const { initializeApp, cert, deleteApp } = require('firebase-admin/app');
  const { getDatabase } = require('firebase-admin/database');
  const patch = loadPatch();
  let credential;
  try { credential = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); }
  catch { throw new Error('Firebase service account JSON is missing or invalid.'); }
  const app = initializeApp({ credential: cert(credential), databaseURL: 'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app' });
  const db = getDatabase(app);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backups = [], results = [];
  const backupLog = fs.openSync(BACKUP_DIR + '/before.jsonl', 'a', 0o600);
  const resultLog = fs.openSync(BACKUP_DIR + '/results.jsonl', 'a', 0o600);
  let cursor = 0, completed = 0;
  try {
    async function worker() {
      while (cursor < patch.entries.length) {
        const entry = patch.entries[cursor++];
        // Only the named public song IDs are accessed. No profiles, lists, or rooms are read.
        const ref = db.ref('songs/' + entry.id);
        const initial = (await retry(() => ref.get())).val();
        if (!identityMatches(initial, entry)) {
          const result = { id: entry.id, status: initial ? 'identity_conflict_preserved' : 'missing_id_not_created' };
          results.push(result); fs.writeSync(resultLog, JSON.stringify(result) + '\n'); completed++; continue;
        }
        const backup = { id: entry.id, fields: Object.fromEntries(Object.keys(entry.set).map(field => [field, initial[field] ?? null])) };
        backups.push(backup); fs.writeSync(backupLog, JSON.stringify(backup) + '\n');
        let transactionBefore;
        const transaction = await retry(() => ref.transaction(current => {
          if (current !== null) transactionBefore = current;
          return updateSong(current, entry);
        }, undefined, false));
        const after = (await retry(() => ref.get())).val();
        if (!identityMatches(after, entry)) throw new Error('Concurrent identity change: ' + entry.id);
        const before = transactionBefore || initial;
        verifyResult(before, after, entry);
        const written = Object.keys(entry.set).filter(field => empty(fieldValue(before, field)) && after[field] === entry.set[field]);
        const preserved = Object.keys(entry.set).filter(field => !empty(fieldValue(before, field)) && fieldValue(before, field) !== entry.set[field]);
        const result = { id: entry.id, status: 'verified', committed: transaction.committed, writtenFields: written, preservedExistingFields: preserved };
        results.push(result); fs.writeSync(resultLog, JSON.stringify(result) + '\n'); completed++;
        if (completed % 500 === 0) console.log('Verified ' + completed + '/' + patch.entries.length);
      }
    }
    // One SDK connection, with bounded requests to existing public catalog entries.
    const workers = await Promise.allSettled(Array.from({ length: 12 }, worker));
    const failures = workers.filter(result => result.status === 'rejected');
    const report = { operation: OPERATION, requestedSongs: patch.songCount, requestedCells: patch.cellCount, verifiedSongs: results.filter(r => r.status === 'verified').length, updatedSongs: results.filter(r => r.committed).length, writtenCells: results.reduce((n,r) => n + (r.writtenFields?.length || 0), 0), preservedExistingCells: results.reduce((n,r) => n + (r.preservedExistingFields?.length || 0), 0), missingIds: results.filter(r => r.status === 'missing_id_not_created').map(r => r.id), identityConflicts: results.filter(r => r.status === 'identity_conflict_preserved').map(r => r.id), failures: failures.map(r => r.reason.message), allowedFields: ALLOWED, appliedAt: Date.now() };
    if (report.updatedSongs) await db.ref('masterMeta/revision').set(db.ref('masterMeta').push().key);
    await db.ref('maintenanceOperations/' + OPERATION).set(report);
    fs.writeFileSync(BACKUP_DIR + '/verification.json', JSON.stringify(report, null, 2), { mode: 0o600 });
    console.log('RESULT ' + JSON.stringify(report));
    if (failures.length || report.verifiedSongs + report.missingIds.length + report.identityConflicts.length !== patch.songCount) throw new Error('Incomplete verification; see catalog-only artifact.');
  } finally {
    fs.closeSync(backupLog); fs.closeSync(resultLog); await deleteApp(app);
  }
}
module.exports = { ALLOWED, OPERATION, empty, loadPatch, validatePatch, identityMatches, fieldValue, updateSong, verifyResult };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
