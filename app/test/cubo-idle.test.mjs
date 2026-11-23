import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPRESSIONS, IDLE_AFTER, GAP, pick, planNext, tick, startIdleFace } from '../src/ui/cubo-idle.js';

const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

test('idle faces: nothing plays until 8 s without input', () => {
  const r = seeded(1);
  let st = { plan: null };
  for (const now of [0, 1, 4, 7.9]){ const o = tick(st, now, 0, r); st = o.state; assert.equal(o.playing, null); }
  const o = tick(st, 8.05, 0, r); assert.ok(o.playing, 'the first one plays as the idle time reaches 8 s'); assert.ok(EXPRESSIONS[o.playing]);
});

test('idle faces: one at a time, about a second, then 4 to 9 s of rest', () => {
  const r = seeded(7); let st = { plan: null }; const plays = [];
  let cur = null;
  for (let now = 0; now < 120; now += 0.05){
    const o = tick(st, now, 0, r); st = o.state;
    if (o.playing !== (cur && cur.name)){ if (cur){ cur.end = now; plays.push(cur); } cur = o.playing ? { name: o.playing, start: now } : null; }
  }
  assert.ok(plays.length >= 8, 'many in two minutes: ' + plays.length);
  assert.ok(plays[0].start >= IDLE_AFTER - 0.06 && plays[0].start < IDLE_AFTER + 0.1);
  for (const p of plays){ const d = p.end - p.start, e = EXPRESSIONS[p.name].dur; assert.ok(d >= e[0] - 0.1 && d <= e[1] + 0.1, `${p.name} lasts ${d}`); }
  for (let i = 1; i < plays.length; i++){ const gap = plays[i].start - plays[i - 1].end; assert.ok(gap >= GAP[0] - 0.1 && gap <= GAP[1] + 0.1, 'gap ' + gap); }
  assert.ok(new Set(plays.map(p => p.name)).size >= 4, 'a mix of expressions');
  assert.ok(plays.filter(p => p.name === 'blink').length > plays.length / 4, 'blinks most often');
});

test('idle faces: input stops it at once and the 8 s start over', () => {
  const r = seeded(3); let st = { plan: null };
  let o = tick(st, 8.1, 0, r); st = o.state; assert.ok(o.playing);
  o = tick(st, 9, 8.9, r); st = o.state; assert.equal(o.playing, null, 'input a moment ago: normal face');
  o = tick(st, 16, 8.9, r); assert.equal(o.playing, null, 'not yet 8 s since the input');
  o = tick(o.state, 17, 8.9, r); assert.ok(o.playing, 'then it begins again');
});

test('idle faces: reduced motion blinks only; the pick is weighted', () => {
  const r = seeded(9);
  for (let i = 0; i < 50; i++) assert.equal(pick(r, true), 'blink');
  assert.equal(planNext(0, r, true).name, 'blink');
  const seen = new Set(); for (let i = 0; i < 300; i++) seen.add(pick(r));
  assert.deepEqual([...seen].sort(), Object.keys(EXPRESSIONS).sort());
});

test('idle faces: the live part redraws only on a change, input resets it, and stop() ends it (leaving home)', () => {
  let t = 0, drawn = [], handlers = {}, ticker = null, cancelled = false;
  const live = startIdleFace({
    redraw: f => drawn.push(f), rand: seeded(5), now: () => t,
    timer: { every: f => { ticker = f; return 1; }, cancel: () => { cancelled = true; } },
    listen: (ev, f) => { handlers[ev] = f; return () => { delete handlers[ev]; }; }
  });
  for (t = 0; t < 7.9; t += 0.1) ticker();
  assert.equal(drawn.length, 0, 'at rest: no redraw at all');
  t = 8.05; ticker(); assert.equal(drawn.length, 1); assert.ok(drawn[0], 'an expression is drawn');
  ticker(); ticker(); assert.equal(drawn.length, 1, 'the same expression is not redrawn');
  handlers.keydown(); assert.equal(drawn.length, 2); assert.equal(drawn[1], null, 'input: back to the normal face at once');
  t = 12; ticker(); assert.equal(drawn.length, 2, 'the idle timer restarted');
  for (t = 12; t < 30; t += 0.1) ticker();
  assert.ok(drawn.length >= 3, 'idle again: another expression');
  const n = drawn.length;
  live.stop();
  assert.ok(cancelled && live.stopped); assert.deepEqual(Object.keys(handlers), [], 'listeners removed');
  assert.equal(drawn[drawn.length - 1], null, 'normal face on leaving');
  const m = drawn.length; t = 60; ticker(); live.play('wink'); assert.equal(drawn.length, m, 'nothing after stop');
});
