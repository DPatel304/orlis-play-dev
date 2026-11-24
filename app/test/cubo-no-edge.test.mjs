/* The owner (2026-11-24): the floating Cubo head in the top-right corner (Home, Discover, Create) and the sleepy Cubo on the
   "Orlis is asleep" screen must never get the white paper edge. They are drawn bare (only the black outline): faceOf(..., { tile: false,
   bare: true }). This guards every place that draws one. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (f) => readFileSync(new URL('../src/ui/' + f, import.meta.url), 'utf8');
const PLACES = [
  ['home.js', /faceCv = faceOf\(([^)]*\)?[^;]*)\);/],
  ['create-page.js', /\.hface'\)\.appendChild\(faceOf\(([^;]*)\)\);/],
  ['create-home.js', /chcubo'\);\s*cubo\.appendChild\(faceOf\(([^;]*)\)\);/],
  ['account.js', /el\.appendChild\(faceOf\(\{ look: \{ \.\.\.CUBO([^;]*)\)\);/]
];

test('every floating Cubo head is drawn bare: no tile, no white paper edge', () => {
  for (const [file, re] of PLACES){
    const m = src(file).match(re);
    assert.ok(m, `${file}: the Cubo head is still drawn where this test expects`);
    assert.match(m[1], /tile:\s*false/, `${file}: no tile behind the head`);
    assert.match(m[1], /bare:\s*true/, `${file}: bare (no white edge)`);
  }
});
