import test from 'node:test';
import assert from 'node:assert/strict';
import { hudZones, underHud, badge, hud } from '../src/games/hud.js';

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('the shell\'s areas never overlap each other, on a wide screen or a squarer one', () => {
  for (const [W, H] of [[1920, 1080], [1280, 720], [1024, 768], [800, 600]]){
    const z = hudZones(W, H), names = Object.keys(z);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++)
      assert.ok(!overlap(z[names[i]], z[names[j]]), `${names[i]} and ${names[j]} at ${W}x${H}`);
    for (const n of names){ const r = z[n]; assert.ok(r.x >= -1 && r.y >= -1 && r.x + r.w <= W + 1 && r.y + r.h <= H + 1, `${n} stays on screen at ${W}x${H}`); }
  }
});

test('underHud says where a target must not go', () => {
  assert.ok(underHud(1600, 900, 800, 40), 'under the clock');
  assert.ok(underHud(1600, 900, 80, 100), 'under the scores');
  assert.ok(underHud(1600, 900, 1368, 170), 'under the move card');
  assert.ok(underHud(1600, 900, 1450, 335), 'under the badge');
  assert.ok(!underHud(1600, 900, 800, 600), 'the middle of the screen is the game\'s');
});

test('the badge draws a pill, and nothing on the results screen or with nothing to say', () => {
  const calls = []; const c = new Proxy({}, { get: (_, k) => k === 'measureText' ? () => ({ width: 40 }) : (...a) => { calls.push(k); }, set: () => true });
  hud.quiet = false; badge(c, 1600, 900, { icon: '\u{1F525}', value: 3 });
  assert.ok(calls.includes('roundRect') && calls.includes('fillText'), 'a pill with its number');
  calls.length = 0; badge(c, 1600, 900, {}); assert.equal(calls.length, 0, 'nothing to say, nothing drawn');
  hud.quiet = true; badge(c, 1600, 900, { value: 3 }); assert.equal(calls.length, 0, 'quiet: no badge'); hud.quiet = false;
});
