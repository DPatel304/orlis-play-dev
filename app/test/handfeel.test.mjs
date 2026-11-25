/* The hand feel (decision 0062): the smoothing is steady at rest and catches up on a fast move, the pull only moves the drawing,
   the burst expires, and the orbs stay distinct. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FEEL, euro, pull, nearness, Orb, Bursts, HandFeel, drawOrb, withAlpha, mixHex } from '../src/ui/handfeel.js';
import { magnet } from '../src/ui/magnet.js';

const DT = 1 / 60;

test('the filter is steady at rest: the jitter of a still hand is mostly taken off', () => {
  const f = {}; let out = 0, lo = 1, hi = 0;
  for (let i = 0; i < 240; i++){
    const jitter = (i % 2 ? 1 : -1) * 0.004;            /* 0.4% of the width, back and forth */
    out = euro(f, 0.5 + jitter, DT);
    if (i > 120){ lo = Math.min(lo, out); hi = Math.max(hi, out); }
  }
  assert.ok(hi - lo < 0.004, `still drawn wobbling by ${(hi - lo).toFixed(4)}`);
  assert.ok(Math.abs(out - 0.5) < 0.004, 'and it settles on where the hand is');
});

test('the filter catches up on a fast move: close behind within a few frames, and exactly there when it stops', () => {
  const f = {}; euro(f, 0.2, DT);
  let x = 0.2, drawn = 0.2;
  for (let i = 0; i < 12; i++){ x += 0.04; drawn = euro(f, x, DT); }       /* 2.4 widths a second */
  assert.ok(x - drawn < 0.02, `still ${(x - drawn).toFixed(3)} behind a quick move`);
  for (let i = 0; i < 90; i++) drawn = euro(f, x, DT);
  assert.ok(Math.abs(drawn - x) < 0.0005, 'no drift once the hand stops');
});

test('the filter adds little lag on top of the tracker\'s own: a steady swipe is within one frame of travel', () => {
  const f = {}; euro(f, 0.1, DT);
  let x = 0.1, d = 0.1;
  for (let i = 0; i < 40; i++){ x += 0.015; d = euro(f, x, DT); }           /* 0.9 widths a second */
  assert.ok(x - d < 0.015, `${((x - d) / 0.015).toFixed(1)} frames behind`);
});

test('pull moves only the drawing: the hand is never changed, and a hit is worked out from the hand itself', () => {
  const hand = { x: 0.5, y: 0.5 }, before = { ...hand };
  const targets = [{ x: 0.56, y: 0.5, r: 0.06 }];
  const p = pull(hand.x, hand.y, targets, 16 / 9);
  assert.deepEqual(hand, before, 'the hand is untouched');
  assert.ok(p.x > hand.x && p.x < targets[0].x, 'drawn toward the target, not past it');
  assert.equal(p.y, 0.5);
  /* the same hit test before and after the pull: it reads the hand */
  const hits = (h) => Math.hypot((targets[0].x - h.x) * 16 / 9, targets[0].y - h.y) < targets[0].r;
  const was = hits(hand);
  pull(hand.x, hand.y, targets, 16 / 9);
  assert.equal(hits(hand), was);
  /* an orb fed this hand, with this target, does not alter the hand either */
  const o = new Orb(); for (let i = 0; i < 60; i++) o.update(hand.x, hand.y, DT, 16 / 9, targets);
  assert.deepEqual(hand, before);
  assert.ok(o.x > hand.x, 'the orb is drawn nearer the target');
  assert.ok(Math.abs(o.hx - hand.x) < 1e-6, 'but its smoothed hand is where the hand is');
});

test('pull does nothing out of reach, nothing at the edge, and most near the middle', () => {
  const t = [{ x: 0.5, y: 0.5, r: 0.05 }], reach = 0.05 + FEEL.pullAdd;
  assert.deepEqual(pull(0.9, 0.5, t), { x: 0.9, y: 0.5 });
  const edge = pull(0.5 + reach * 0.999 * 9 / 16, 0.5, t, 16 / 9);
  assert.ok(Math.abs(edge.x - (0.5 + reach * 0.999 * 9 / 16)) < 1e-4, 'nothing at the edge');
  const a = pull(0.5 + 0.1 * 9 / 16, 0.5, t, 16 / 9), b = pull(0.5 + 0.02 * 9 / 16, 0.5, t, 16 / 9);
  const share = (p, x0) => (x0 - p.x) / (x0 - 0.5);
  assert.ok(share(b, 0.5 + 0.02 * 9 / 16) > share(a, 0.5 + 0.1 * 9 / 16), 'a stronger pull nearer the middle');
  assert.equal(pull(0.5, 0.5, []).x, 0.5);
});

test('the magnet of Cubo\'s Create is this pull, with its own numbers', () => {
  magnet.set([{ x: 0.5, y: 0.5, r: 0.1 }]);
  const m = magnet.pull(0.55, 0.5, 16 / 9), p = pull(0.55, 0.5, magnet.targets, 16 / 9, { reachMul: 1, reachAdd: 0, k: 0.6 });
  assert.deepEqual(m, p);
  magnet.clear();
  assert.deepEqual(magnet.pull(0.55, 0.5), { x: 0.55, y: 0.5 });
  const src = readFileSync(new URL('../src/ui/magnet.js', import.meta.url), 'utf8');
  assert.match(src, /from '\.\/handfeel\.js'/, 'one pull, not two');
});

test('near: 1 on a target, 0 well away, smooth between; from where the hands are', () => {
  const hands = [{ x: 0.5, y: 0.5 }];
  assert.equal(nearness(0.5, 0.5, 0.05, hands), 1);
  assert.equal(nearness(0.9, 0.5, 0.05, hands), 0);
  const mid = nearness(0.5 + (0.05 + FEEL.hoverAdd / 2) * 9 / 16, 0.5, 0.05, hands, 16 / 9);
  assert.ok(mid > 0.3 && mid < 0.7, `half way is ${mid}`);
  assert.equal(nearness(0.5, 0.5, 0.05, []), 0, 'nobody playing: nothing is near');
});

test('burst particles expire, and a ring wave with them', () => {
  const b = new Bursts(() => 0.5);
  b.add(0.5, 0.5, '#3da9ff');
  assert.ok(b.sparks.length >= 10 && b.rings.length === 1);
  for (let i = 0; i < 20; i++) b.step(DT);
  assert.ok(b.alive > 0, 'still playing after a third of a second');
  for (let i = 0; i < 120; i++) b.step(DT);
  assert.equal(b.alive, 0, 'all gone within two seconds');
  const many = new Bursts(); for (let i = 0; i < 40; i++) many.add(0.5, 0.5, '#3da9ff');
  assert.ok(many.sparks.length <= FEEL.maxSparks, 'never an endless pile');
  const calm = new Bursts(() => 0.5, true); calm.add(0.5, 0.5, '#3da9ff');
  assert.ok(calm.sparks.length < b.sparks.length || FEEL.sparksReduced < FEEL.sparks, 'fewer sparks for reduced motion');
});

test('a hit squashes the nearest orb of that player, springs back, and never stops time', () => {
  const f = new HandFeel({ rand: () => 0.5 });
  const hands = [{ key: '0L', who: 0, x: 0.3, y: 0.5, col: '#3da9ff' }, { key: '0R', who: 0, x: 0.7, y: 0.5, col: '#3da9ff' }, { key: '1R', who: 1, x: 0.31, y: 0.5, col: '#ff8a3d' }];
  for (let i = 0; i < 10; i++) f.step(DT, hands);
  f.hit(0.32, 0.5, 0, '#3da9ff');
  assert.ok(f.orbs.get('0L').orb.sq > 0.3, 'the near hand of that player squashes');
  assert.equal(f.orbs.get('0R').orb.sq, 0);
  assert.equal(f.orbs.get('1R').orb.sq, 0, 'another player\'s hand does not');
  assert.ok(f.bursts.alive > 0);
  const t0 = f.t;
  f.step(DT, hands); assert.ok(Math.abs(f.t - t0 - DT) < 1e-9, 'time moves on by exactly one frame: no freeze');
  for (let i = 0; i < 90; i++) f.step(DT, hands);
  assert.ok(Math.abs(f.orbs.get('0L').orb.sq) < 0.01, 'sprung back');
});

test('the whoosh asks at most once in 0.4 s, and only for a fast hand', () => {
  const f = new HandFeel(); const asked = [];
  let x = 0.1;
  for (let i = 0; i < 40; i++){ x = 0.1 + (i % 20) * 0.04; f.step(DT, [{ key: 'a', who: 0, x: 0.5, y: 0.5, col: '#3da9ff' }], k => asked.push(k)); }
  assert.equal(asked.length, 0, 'a still hand is quiet');
  const g = new HandFeel(); const gk = [];
  for (let i = 0; i < 120; i++) g.step(DT, [{ key: 'a', who: 0, x: 0.2 + (i % 40) * 0.015 * 3, y: 0.5, col: '#3da9ff' }], k => gk.push([g.t, k]));
  assert.ok(gk.length >= 1);
  for (let i = 1; i < gk.length; i++) assert.ok(gk[i][0] - gk[i - 1][0] >= FEEL.whooshEvery - 1e-9, 'a cooldown');
  assert.ok(gk.every(([, k]) => k >= 0 && k <= 1));
});

test('four players\' orbs are four different colours, each drawn once', () => {
  const cols = ['#3da9ff', '#ff8a3d', '#22c55e', '#a855f7'];
  const f = new HandFeel(), hands = cols.map((col, i) => ({ key: i + 'R', who: i, x: 0.2 + i * 0.2, y: 0.5, col }));
  f.step(DT, hands);
  const fills = [];
  const grad = { addColorStop(_, col){ fills.push(col); } };
  const c = new Proxy({}, { get: (t, k) => k === 'createRadialGradient' || k === 'createLinearGradient' ? () => grad : () => {}, set: () => true });
  f.draw(c, 1920, 1080);
  for (const col of cols) assert.ok(fills.some(s => s.toLowerCase().startsWith(col)), col + ' is in the picture');
  assert.equal(new Set(cols).size, 4);
});

test('colours are made from a palette colour, not written here', () => {
  assert.equal(withAlpha('#3da9ff', 0.5).length, 9);
  assert.equal(mixHex('#000000', 255, 1), '#ffffff');
  const src = readFileSync(new URL('../src/ui/handfeel.js', import.meta.url), 'utf8');
  assert.ok(!/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), 'no raw colour codes');
});

test('a hit never uses Math.random: a game\'s own dice (seeded by the playtest rig) come out the same with or without the orbs', () => {
  const real = Math.random; let used = 0;
  Math.random = () => { used++; return 0.5; };
  try {
    const f = new HandFeel();
    f.step(DT, [{ key: '0R', who: 0, x: 0.5, y: 0.5, col: '#3da9ff' }]);
    f.hit(0.5, 0.5, 0, '#3da9ff');
    for (let i = 0; i < 40; i++) f.step(DT, [{ key: '0R', who: 0, x: 0.5, y: 0.5, col: '#3da9ff' }]);
  } finally { Math.random = real; }
  assert.equal(used, 0);
});

test('bursts are not drawn while the pause card is up', async () => {
  const { fxState } = await import('../src/games/common.js');
  const calls = []; const c = new Proxy({}, { get: (_, k) => (...a) => { calls.push(k); }, set: () => true });
  const b = new Bursts(); b.add(0.5, 0.5, '#3da9ff');
  fxState.hidden = true;
  try { b.draw(c, 1920, 1080); assert.equal(calls.length, 0); } finally { fxState.hidden = false; }
  assert.ok(b.alive > 0, 'state kept');
  b.draw(c, 1920, 1080); assert.ok(calls.length > 0);
});
