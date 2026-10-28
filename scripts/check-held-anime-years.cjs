'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
const { validate, restore } = require('./hold-unverified-anime-years.cjs');
const patch = validate(JSON.parse(fs.readFileSync('maintenance/held-anime-years-20261028.json', 'utf8')));
for (const entry of patch.entries) {
  const before = Object.freeze({ title: entry.title, chordwiki: entry.chordwiki, anime_year: entry.old, artist: 'preserve', metadata: { value: 1 } });
  assert.equal(restore(before, entry, false), undefined, 'No proof or original nonblank must be preserved');
  const after = restore(before, entry, true); assert(!Object.hasOwn(after, 'anime_year'));
  assert.deepEqual(after, { title: entry.title, chordwiki: entry.chordwiki, artist: 'preserve', metadata: { value: 1 } });
  assert.equal(restore(after, entry, true), undefined, 'Idempotence');
  assert.equal(restore({ ...before, anime_year: '2000、2001' }, entry, true), undefined, 'Preserve a later corrected year');
  assert.equal(restore({ ...before, title: 'other song' }, entry, true), undefined);
  assert.equal(restore(null, entry, true), null);
}
console.log('PASS 256 year holds: original blank proof, identity, exact candidate, unrelated fields, idempotence and concurrent corrections protected.');
