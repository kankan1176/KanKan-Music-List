'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { empty, identityMatches } = require('./apply-catalog-enrichment.cjs');
const OPERATION = 'hold-unverified-anime-years-20261028';
function validate(patch) {
  assert.equal(patch.operation, OPERATION);
  assert.equal(patch.sourceOperation, 'catalog-enrichment-20261028');
  assert.equal(patch.sourceRunId, 40730809922);
  assert.equal(patch.entries.length, 256);
  const ids = new Set();
  for (const entry of patch.entries) {
    assert.match(entry.id, /^[A-Za-z0-9_-]{1,80}$/); assert(!ids.has(entry.id)); ids.add(entry.id);
    assert(typeof entry.title === 'string' && entry.title);
    assert.match(entry.chordwiki, /^https:\/\/ja\.chordwiki\.org\/wiki\//);
    assert(typeof entry.old === 'string' && entry.old.split('、').every(y => /^(19|20)\d\d$/.test(y)));
  }
  return patch;
}
function restore(current, entry, provenOriginallyBlank) {
  if (current === null) return null; // Cold SDK transactions retry on a server hash mismatch.
  if (!provenOriginallyBlank || !identityMatches(current, entry) || current.anime_year !== entry.old) return undefined;
  const next = { ...current }; delete next.anime_year; return next;
}
async function main() {
  const { initializeApp, cert, deleteApp } = require('firebase-admin/app');
  const { getDatabase } = require('firebase-admin/database');
  const patch = validate(JSON.parse(fs.readFileSync('maintenance/held-anime-years-20261028.json', 'utf8')));
  // This artifact comes from the exact prior catalog operation, not user-profile or list exports.
  const prior = JSON.parse(fs.readFileSync('.prior-catalog-verification/verification.json', 'utf8'));
  assert.equal(prior.operation, patch.sourceOperation); assert.equal(prior.requestedSongs, 9915);
  assert.equal(prior.requestedCells, 24926); assert.equal(prior.failures.length, 0);
  const backups = new Map(fs.readFileSync('.prior-catalog-verification/before.jsonl', 'utf8').trim().split('\n').filter(Boolean).map(line => { const b = JSON.parse(line); return [b.id, b]; }));
  let credential; try { credential = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); }
  catch { throw new Error('Firebase service account JSON is missing or invalid.'); }
  const app = initializeApp({ credential: cert(credential), databaseURL: 'https://kankan-session-room-default-rtdb.asia-southeast1.firebasedatabase.app' });
  const db = getDatabase(app); const results = [];
  fs.mkdirSync('.anime-year-hold-verification', { recursive: true });
  let cursor = 0;
  try {
    async function worker() {
      while (cursor < patch.entries.length) {
        const entry = patch.entries[cursor++], backup = backups.get(entry.id);
        // A nonblank value predating this task must never be removed, even if it equals our candidate.
        const proof = !!backup && Object.hasOwn(backup.fields, 'anime_year') && empty(backup.fields.anime_year);
        if (!proof) { results.push({ id: entry.id, status: 'original_nonblank_or_no_proof_preserved' }); continue; }
        const ref = db.ref('songs/' + entry.id), initial = (await ref.get()).val();
        if (!identityMatches(initial, entry)) { results.push({ id: entry.id, status: 'identity_or_missing_id_preserved' }); continue; }
        let transactionBefore;
        const result = await ref.transaction(current => { if (current !== null) transactionBefore = current; return restore(current, entry, proof); }, undefined, false);
        const after = (await ref.get()).val(); assert(identityMatches(after, entry));
        if (result.committed) {
          assert(empty(after.anime_year));
          for (const [field,value] of Object.entries(transactionBefore)) if (field !== 'anime_year') assert.deepEqual(after[field], value, 'Unrelated field changed: ' + entry.id + '/' + field);
          results.push({ id: entry.id, status: 'restored_original_blank' });
        } else results.push({ id: entry.id, status: empty(after.anime_year) ? 'already_blank' : 'different_current_value_preserved' });
      }
    }
    const outcomes = await Promise.allSettled(Array.from({ length: 6 }, worker));
    const errors = outcomes.filter(r => r.status === 'rejected').map(r => r.reason.message);
    const restored = results.filter(r => r.status === 'restored_original_blank').length;
    if (restored) await db.ref('masterMeta/revision').set(db.ref('masterMeta').push().key);
    const report = { operation: OPERATION, sourceRunId: patch.sourceRunId, requested: patch.entries.length, verified: results.length, restored, alreadyBlank: results.filter(r => r.status === 'already_blank').length, originalValuesPreserved: results.filter(r => r.status === 'original_nonblank_or_no_proof_preserved').length, otherPreserved: results.filter(r => ['identity_or_missing_id_preserved','different_current_value_preserved'].includes(r.status)).length, failures: errors, appliedAt: Date.now() };
    await db.ref('maintenanceOperations/' + OPERATION).set(report);
    fs.writeFileSync('.anime-year-hold-verification/verification.json', JSON.stringify(report, null, 2));
    fs.writeFileSync('.anime-year-hold-verification/results.json', JSON.stringify(results, null, 2));
    console.log('YEAR_HOLD_RESULT ' + JSON.stringify(report));
    if (errors.length || results.length !== patch.entries.length) throw new Error('Incomplete year-hold verification');
  } finally { await deleteApp(app); }
}
module.exports = { validate, restore };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
