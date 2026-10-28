'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { ALLOWED, empty, loadPatch, validatePatch, identityMatches, fieldValue, updateSong, verifyResult } = require('./apply-catalog-enrichment.cjs');
const patch = loadPatch();
if (fs.existsSync('maintenance/held-anime-years-20261028.json')) {
  assert.equal(patch.songCount, 9906); assert.equal(patch.cellCount, 24670);
  assert(patch.entries.every(entry => !Object.hasOwn(entry.set, 'anime_year')), 'Withdrawn years must not be replayed');
}
const copy = x => JSON.parse(JSON.stringify(x));
const withHash = p => { p.entriesSha256 = crypto.createHash('sha256').update(JSON.stringify(p.entries)).digest('hex'); return p; };
for (const entry of patch.entries) {
  const before = Object.freeze({ title: entry.title, chordwiki: entry.chordwiki, updatedAt: 123, arbitraryPublicMetadata: 'preserve' });
  const after = updateSong(before, entry);
  verifyResult(before, after, entry);
  assert.equal(updateSong(after, entry), undefined, 'Idempotence');
  const populated = { ...after, ...Object.fromEntries(Object.keys(entry.set).map(f => [f, 'existing value'])) };
  assert.equal(updateSong(populated, entry), undefined, 'Nonblank fields must be preserved');
  assert.equal(updateSong({ ...before, title: entry.title + ' other' }, entry), undefined, 'Wrong title');
  assert.equal(updateSong({ ...before, chordwiki: entry.chordwiki + '?other' }, entry), undefined, 'Wrong score URL');
  assert.equal(updateSong(null, entry), null, 'Cold transactions never create a song');
}
const entry = { id: 'synthetic-test', title: 'test', chordwiki: '', set: { genre1: 'J-POP', bpm: '100' } };
assert.equal(updateSong({ title: 'test', chordwiki: '', genre: '洋楽', bpm: 0 }, entry), undefined);
assert.equal(fieldValue({ genre: '洋楽' }, 'genre1'), '洋楽');
assert(!empty(0) && !empty(false) && !empty({}) && !empty([]));
assert(empty(null) && empty(undefined) && empty('  '));
assert(!identityMatches([], entry));
for (const field of ['title','id','chordwiki','release_date','uid','public','privateLists']) {
  const changed = copy(patch); changed.entries[0].set[field] = 'do not write'; changed.cellCount++;
  assert.throws(() => validatePatch(withHash(changed)), 'Reject ' + field);
}
const duplicate = copy(patch); duplicate.entries.push(duplicate.entries[0]); duplicate.songCount++;
assert.throws(() => validatePatch(withHash(duplicate)));
const invalidYear = copy(patch); const target = invalidYear.entries.find(e => 'release_year' in e.set);
assert(target); target.set.release_year = '2027'; assert.throws(() => validatePatch(withHash(invalidYear)));
assert.deepEqual(ALLOWED.filter(f => ['release_date','search','title','chordwiki'].includes(f)), []);
console.log('PASS ' + patch.songCount + ' songs / ' + patch.cellCount + ' fields; blank-only, identity, legacy genre, idempotence, immutable values, allowed fields and years.');
