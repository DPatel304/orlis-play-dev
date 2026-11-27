import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { FaceCam } from '../src/ui/faces.js';

/* The camera is for finding the body's points. Its picture is never shown,
   kept or sent - the only code that touches the video element is the
   tracker itself (and the page that holds it). The tracker alone may copy it into its own small offscreen canvases, to read
   clothes colours and to look closer at a small player (Settings > Testing); those copies are never put on the page, saved or sent. */
const TRACKER = 'src/tracking/pose.js';
const walk = (d) => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

test('nothing draws the camera video anywhere', () => {
  const bad = [];
  for (const f of walk('src').filter(f => f.endsWith('.js'))){
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/drawImage\(\s*([\w.]+)/g)){
      if (/video|^v$|^cam$/i.test(m[1]) && f.replaceAll('\\', '/') !== TRACKER) bad.push(f + ': drawImage(' + m[1]);
    }
  }
  assert.deepEqual(bad, []);
});

test('the tracker\'s own copies of the picture never leave it: not on the page, not saved, not sent', () => {
  const src = readFileSync(TRACKER, 'utf8');
  for (const no of [/appendChild\(/, /toDataURL\(/, /toBlob\(/, /convertToBlob\(/, /localStorage\.setItem\([^)]*(?:image|pix|frame)/i, /postMessage\([^)]*getImageData/])
    assert.ok(!no.test(src), `pose.js must not ${no}`);
});

test('no face is ever taken: every game draws its avatar', () => {
  const f = new FaceCam();
  assert.equal(f.has(0), false); assert.equal(f.draw(null, 0, 0, 0, 1, '#fff'), false);
  assert.equal(f.photo(0, true), false); assert.equal(f.drawMoment(null, 0, 0, 0, 1, '#fff'), false);
});
