/* Home is the remote's, the keyboard's and the mouse's (decision 0049): no hand mode, no camera. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resetDom } from './harness/browser.mjs';
resetDom();
const { cursor } = await import('../src/ui/cursor.js');
const { pose } = await import('../src/tracking/pose.js');
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('home has no hand mode: no hand.js, no hand cursor, no pose use, no ?hand=1', () => {
  assert.ok(!existsSync(new URL('../src/ui/hand.js', import.meta.url)), 'hand.js is gone');
  const home = read('../src/ui/home.js');
  assert.ok(!/hand\.js|handWanted|hand=1|Driver|EdgeHold|mapHand/.test(home), 'home does not use hand mode');
  assert.ok(!/cursor\.(map|gate|skin|enabled)\s*=/.test(home), 'home never sets up the cursor');
  assert.ok(!/pose\.(lite|pointing|wake|on)\b/.test(home), 'home never touches tracking');
  assert.ok(!/hedge|hcur|hsay|sface/.test(home), 'no hand-mode elements');
  const css = read('../src/clean-home.css');
  assert.ok(!/\.hedge|\.hcur|\.hsay|\.sface|\.home\.hand/.test(css), 'no hand-mode CSS');
});

test('the camera never starts for home, whatever the build or address says', () => {
  const main = read('../src/main.js');
  assert.ok(!/handWanted|pose\.lite|LOOKS/.test(main), 'main has no home hand mode');
  assert.ok(!/'menu'/.test(main.match(/const CAMERA = new Set\(\[([^\]]*)\]\)/)[1]), 'menu is not a camera page');
  assert.match(main, /if \(CAMERA\.has\(next\)\) pose\.wake\(\); else pose\.sleep\(\)/);
  assert.match(main, /if \(!away && !CALM\.has\(mode\)\) pose\.update/, 'calm pages (home) never run the tracker');
});

test('nothing left over: the cursor and the pose have no home-only switches', () => {
  for (const k of ['map', 'gate', 'skin']) assert.ok(!(k in cursor), `cursor.${k} is gone`);
  assert.ok(!('lite' in pose) && !('pointing' in pose), 'pose has no light home mode');
});
