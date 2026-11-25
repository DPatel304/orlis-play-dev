/* "Still there?" (session/idle.js): a quiet minute with nobody in view or moving; stepping in, moving or the mouse starts it over. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { IdleWatch, IDLE_AFTER, MOVE } from '../src/session/idle.js';
import castle from '../src/games/castle-defense.js';
import lkp from '../src/games/lkp-game.js';

const KEYS = [0, 11, 12, 15, 16, 23, 24, 27, 28];
const body = (dx = 0) => { const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 1 })); for (const k of KEYS) lm[k] = { x: 0.5 + dx, y: 0.5, v: 1 }; return { present: true, lm }; };
const gone = { present: false, lm: null };
const run = (w, secs, players, mouse) => { for (let t = 0; t < secs; t += 0.1) w.step(0.1, players, 4, mouse); };

test('nobody in view: idle after a minute, not before', () => {
  const w = new IdleWatch(); run(w, IDLE_AFTER - 2, [gone, gone]); assert.equal(w.idle, false);
  run(w, 3, [gone, gone]); assert.equal(w.idle, true);
});

test('somebody standing in view but not moving (only jittering) is idle too', () => {
  const w = new IdleWatch(); w.step(0.1, [body()], 4);
  for (let t = 0; t < 61; t += 0.1) w.step(0.1, [body((t * 7 % 1 - 0.5) * MOVE * 0.5)], 4);
  assert.equal(w.idle, true);
});

test('moving, or stepping in, starts the minute over', () => {
  const w = new IdleWatch(); run(w, 50, [gone]);
  assert.equal(w.step(0.1, [body()], 4), true, 'stepping in counts'); assert.equal(w.still, 0);
  run(w, 30, [body()]); assert.ok(w.still > 25);
  assert.equal(w.step(0.1, [body(MOVE * 2)], 4), true, 'a real move counts'); assert.equal(w.still, 0);
  run(w, 58, [body(MOVE * 2)]); assert.equal(w.idle, false); run(w, 3, [body(MOVE * 2)]); assert.equal(w.idle, true);
});

test('players beyond the round\'s count are ignored; the mouse counts', () => {
  const w = new IdleWatch(); w.step(0.1, [gone, gone, body()], 2); run(w, 61, [gone, gone, body(0.3)]); assert.equal(w.idle, true);
  const m = { active: true, x: 0.2, y: 0.2, clicks: 0 }, v = new IdleWatch(); v.step(0.1, [gone], 1, m); run(v, 30, [gone], m);
  assert.equal(v.step(0.1, [gone], 1, { ...m, x: 0.6 }), true);
});

test('Tower Defense and Last Known Position ask for it; the Last Known Position opening is a cutscene', () => {
  assert.equal(castle.idleAfter, 60); assert.equal(lkp.idleAfter, 60);
  const g = lkp.create(2); g.scene = { kind: 'intro' }; assert.equal(g.cutscene(), true);
  g.scene = null; g.inIntro = false; g.demo = false; assert.equal(g.cutscene(), false);
});
