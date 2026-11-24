import test from 'node:test';
import assert from 'node:assert/strict';
import { frameOf, sayFor, FramingWatch, framingShown, markFramingShown } from '../src/ui/framing.js';

/* A standing body, mirrored screen coordinates, every point plainly seen. cx: where; top: the nose's y; span: nose to ankle. */
function body({ cx = 0.5, top = 0.15, span = 0.72, vis = 0.9 } = {}){
  const lm = Array.from({ length: 33 }, () => ({ x: cx, y: 0.5, z: 0, v: vis }));
  const at = (i, dx, f) => { lm[i] = { x: cx + dx, y: top + span * f, z: 0, v: vis }; };
  at(0, 0, 0);
  at(11, -0.05, 0.22); at(12, 0.05, 0.22); at(23, -0.03, 0.55); at(24, 0.03, 0.55);
  at(25, -0.03, 0.78); at(26, 0.03, 0.78); at(27, -0.03, 1); at(28, 0.03, 1);
  for (const i of [29, 30, 31, 32]) at(i, i % 2 ? 0.03 : -0.03, 1.03);
  return lm;
}
const person = (lm) => ({ present: true, lm });

test('framed: head to ankles in, room above the head', () => {
  const f = frameOf(body());
  assert.equal(f.ok, true);
  assert.equal(sayFor(f), null);
});

test('too close: the body cannot fit, so "step back"', () => {
  const lm = body({ top: 0.04, span: 1.3 });       /* a face and shoulders filling the picture */
  const f = frameOf(lm);
  assert.equal(f.ok, false); assert.equal(f.close, true);
  assert.equal(sayFor(f), 'Step back until you fit in the frame');
});

test('cut at the feet, with the body small enough: tilt the camera down', () => {
  const f = frameOf(body({ top: 0.4, span: 0.62 }));      /* feet at 1.02 */
  assert.equal(f.feet, true); assert.equal(f.close, false);
  assert.equal(sayFor(f), 'Tilt the camera down');
});

test('feet never seen counts as cut', () => {
  const lm = body();
  for (const i of [27, 28, 29, 30, 31, 32]) lm[i].v = 0.05;
  assert.equal(frameOf(lm).feet, true);
});

test('a flickering ankle is not a cut while a foot point is seen', () => {
  const lm = body();
  lm[27].v = 0.1; lm[28].v = 0.1;                         /* heels and toes still seen */
  assert.equal(frameOf(lm).ok, true);
});

test('head cut with room below: raise the camera', () => {
  const f = frameOf(body({ top: 0.03, span: 0.7 }));
  assert.equal(f.top, true); assert.equal(f.feet, false);
  assert.equal(sayFor(f), 'Raise the camera');
});

test('off the left edge: move right; off the right edge: move left', () => {
  assert.equal(sayFor(frameOf(body({ cx: 0.03 }))), 'Move right a little');
  assert.equal(sayFor(frameOf(body({ cx: 0.97 }))), 'Move left a little');
});

test('the watch: two players, one out; the other stays framed', () => {
  const w = new FramingWatch();
  const players = [person(body({ cx: 0.3 })), person(body({ cx: 0.98 }))];
  for (let i = 0; i < 30; i++) w.step(0.05, players);
  const r = w.report(players);
  assert.equal(r.ok, false); assert.equal(r.present, 2);
  assert.deepEqual(r.bad.map(b => b.i), [1]);
  assert.equal(r.bad[0].say, 'Move left a little');
});

test('the watch: nobody is nobody, not a failure', () => {
  const w = new FramingWatch();
  const players = [{ present: false, lm: null }, { present: false, lm: null }];
  w.step(0.5, players);
  const r = w.report(players);
  assert.equal(r.nobody, true); assert.equal(r.ok, true);
});

test('the watch: one bad frame does not flip a framed player; a few seconds of it does', () => {
  const w = new FramingWatch();
  const good = [person(body())];
  for (let i = 0; i < 20; i++) w.step(0.05, good);
  w.step(0.05, [person(body({ top: 0.02 }))]);
  assert.equal(w.report(good).ok, true);
  for (let i = 0; i < 20; i++) w.step(0.05, [person(body({ top: 0.02 }))]);
  assert.equal(w.report(good).ok, false);
});

test('the watch: someone just seen is not judged yet', () => {
  const w = new FramingWatch();
  const ps = [person(body({ cx: 0.98 }))];
  w.step(0.1, ps);
  assert.equal(w.report(ps).ok, true); assert.equal(w.report(ps).pending, 1);
  w.step(0.5, ps);
  assert.equal(w.report(ps).ok, false);
});

test('first-time flag: remembered when storage works, never throws when it does not', () => {
  const saved = globalThis.localStorage;
  const mem = {};
  globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  assert.equal(framingShown(), false); markFramingShown(); assert.equal(framingShown(), true);
  globalThis.localStorage = { getItem(){ throw new Error('blocked'); }, setItem(){ throw new Error('blocked'); } };
  assert.equal(framingShown(), false); markFramingShown();
  if (saved === undefined) delete globalThis.localStorage; else globalThis.localStorage = saved;
});
