/* Cubo's Create gestures (decisions 0060, 0061): both arms up, a hand held on a target, worlds by position, the meter's stops from a hand's height, the comfort zone
   and its layouts, the magnet, and only the first player building. (No swipe: reach-and-hold and arms up are the two gestures.) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { L } from '../src/tracking/pose-shared.js';
const G = await import('../src/create/gestures.js');

const body = ({ up = false, x = 0.5 } = {}) => {
  const lm = Array.from({ length: 33 }, () => ({ x, y: 0.5, v: 0.95 }));
  lm[L.NOSE] = { x, y: 0.2, v: 0.95 };
  lm[L.L_WRIST] = { x: x - 0.1, y: up ? 0.08 : 0.55, v: 0.95 };
  lm[L.R_WRIST] = { x: x + 0.1, y: up ? 0.08 : 0.55, v: 0.95 };
  lm[L.L_HIP] = { x: x - 0.03, y: 0.55, v: 0.95 }; lm[L.R_HIP] = { x: x + 0.03, y: 0.55, v: 0.95 };
  return { present: true, lm, centre: { x, y: 0.45 }, hands: { left: { x: x - 0.1, y: up ? 0.08 : 0.55 }, right: { x: x + 0.1, y: up ? 0.08 : 0.55 } } };
};
const run = (fn, secs, dt = 1 / 30) => { let out = []; for (let t = 0; t < secs - 1e-9; t += dt) out.push(fn(dt)); return out; };

test('armsUp: both wrists above the nose; one is not enough', () => {
  assert.ok(G.armsUp(body({ up: true }).lm));
  assert.ok(!G.armsUp(body().lm));
  const one = body({ up: true }).lm; one[L.R_WRIST].y = 0.55;
  assert.ok(!G.armsUp(one), 'one arm up is not it');
  const lost = body({ up: true }).lm; lost[L.L_WRIST].v = 0.1;
  assert.ok(!G.armsUp(lost), 'a wrist that is not seen does not count');
  assert.ok(!G.armsUp(null));
});

test('ArmsWatch: held for 0.6 s fires once, and the arms must come down before it can fire again', () => {
  const w = new G.ArmsWatch(), up = body({ up: true }).lm, down = body().lm;
  assert.equal(G.ARMS_HOLD, 0.6);
  assert.equal(run((dt) => w.step(dt, up), 0.5).filter(Boolean).length, 0, 'half a second is not enough');
  assert.equal(run((dt) => w.step(dt, up), 0.3).filter(Boolean).length, 1, 'it fires at 0.6 s');
  assert.equal(run((dt) => w.step(dt, up), 2).filter(Boolean).length, 0, 'once only while they stay up');
  run((dt) => w.step(dt, down), 0.2);
  assert.equal(run((dt) => w.step(dt, up), 0.7).filter(Boolean).length, 1, 'down and up again: again');
  /* a wave that dips resets it */
  const v = new G.ArmsWatch();
  run((dt) => v.step(dt, up), 0.4); v.step(0.05, down);
  assert.equal(run((dt) => v.step(dt, up), 0.4).filter(Boolean).length, 0);
});

test('Dwell: 0.7 s in one target touches it once; leaving and coming back counts again; a wobble out does not start over', () => {
  const d = new G.Dwell();
  assert.equal(G.DWELL, 0.7);
  let r = run((dt) => d.step(dt, 'a'), 0.6);
  assert.ok(r.every(x => !x.fired) && r.at(-1).progress > 0.8);
  r = run((dt) => d.step(dt, 'a'), 0.2);
  assert.equal(r.filter(x => x.fired).length, 1);
  assert.equal(run((dt) => d.step(dt, 'a'), 2).filter(x => x.fired).length, 0, 'staying does not touch it again');
  run((dt) => d.step(dt, null), 0.5);
  assert.equal(run((dt) => d.step(dt, 'a'), 0.8).filter(x => x.fired).length, 1, 'left and came back');
  /* moving to another target starts that one fresh */
  const e = new G.Dwell(); run((dt) => e.step(dt, 'a'), 0.5);
  assert.equal(run((dt) => e.step(dt, 'b'), 0.5).filter(x => x.fired).length, 0, 'a different target does not inherit the time');
  assert.equal(run((dt) => e.step(dt, 'b'), 0.3).filter(x => x.fired).length, 1);
  /* a 0.1 s wobble off the target keeps the time */
  const f = new G.Dwell(); run((dt) => f.step(dt, 'a'), 0.5); f.step(0.1, null);
  assert.equal(run((dt) => f.step(dt, 'a'), 0.3).filter(x => x.fired).length, 1);
});

test('Dwell.block: a hand already resting in a target when a step opens does not touch it until it has left and come back', () => {
  const d = new G.Dwell(); d.block();
  assert.equal(run((dt) => d.step(dt, 'a'), 2).filter(x => x.fired).length, 0, 'resting there: nothing');
  run((dt) => d.step(dt, null), 0.1);
  assert.equal(run((dt) => d.step(dt, 'a'), 0.8).filter(x => x.fired).length, 1, 'left and came back: it counts');
});

test('handActive: a hand hanging at the side never touches anything; a forearm reaching out does', () => {
  const lm = body().lm;
  lm[L.R_ELBOW] = { x: 0.6, y: 0.4, v: 0.95 };
  lm[L.R_WRIST] = { x: 0.61, y: 0.55, v: 0.95 };
  assert.ok(!G.handActive(lm, 'right'), 'wrist right under the elbow: hanging');
  lm[L.R_WRIST] = { x: 0.7, y: 0.42, v: 0.95 };
  assert.ok(G.handActive(lm, 'right'), 'forearm out sideways: reaching');
  lm[L.R_WRIST] = { x: 0.7, y: 0.5, v: 0.95 };
  assert.ok(G.handActive(lm, 'right'), 'reaching down and out: reaching');
  lm[L.R_WRIST] = { x: 0.6, y: 0.3, v: 0.95 };
  assert.ok(G.handActive(lm, 'right'), 'hand up high: reaching');
  lm[L.R_WRIST].v = 0.1; assert.ok(!G.handActive(lm, 'right'), 'not seen: no');
  assert.ok(G.handActive(null, 'left'), 'the mouse has no body: always');
  const r = new G.BodyReader(), q = body(); q.lm[L.L_ELBOW] = { x: 0.4, y: 0.4, v: 0.95 }; q.lm[L.L_WRIST] = { x: 0.4, y: 0.56, v: 0.95 };
  q.lm[L.R_ELBOW] = { x: 0.6, y: 0.4, v: 0.95 }; q.lm[L.R_WRIST] = { x: 0.7, y: 0.4, v: 0.95 };
  q.hands = { left: { x: 0.4, y: 0.56 }, right: { x: 0.7, y: 0.4 } };
  assert.deepEqual(r.step(0.03, [q]).hands.map(h => h.active), [false, true]);
});

test('worldAt: hips across the picture pick the worlds in order, with hysteresis at the boundaries', () => {
  const n = 6, at = (x, c) => G.worldAt(x, n, c);
  assert.equal(at(0.0, 0), 0); assert.equal(at(0.2, 0), 0);
  assert.equal(at(0.8, 0), 5); assert.equal(at(1, 0), 5);
  const seen = []; for (let x = 0.2; x <= 0.8; x += 0.01) seen.push(G.worldAt(x, n, seen.at(-1) ?? 0));
  assert.deepEqual([...new Set(seen)], [0, 1, 2, 3, 4, 5], 'walking right goes through every world in order');
  /* standing on a boundary does not flicker */
  const span = G.WORLD_SPAN, w = (span[1] - span[0]) / n, edge = span[0] + w * 2;
  let cur = G.worldAt(edge + 0.01 * w, n, 2);
  assert.equal(cur, 2);
  const flips = []; for (let i = 0; i < 20; i++){ cur = G.worldAt(edge + (i % 2 ? 0.1 : -0.1) * w, n, cur); flips.push(cur); }
  assert.ok(flips.every(x => x === 2), 'jitter either side of the boundary stays put');
  assert.equal(G.worldAt(edge + 1.3 * w, n, 2), 3, 'far enough past it, it changes');
  assert.equal(G.worldAt(0.5, 1, 0), 0);
});

test('meterStop: a raised hand’s height gives the stop, the lowest at the bottom, with a little stickiness', () => {
  const at = (y, c) => G.meterStop(y, 0.2, 0.8, 7, c);          /* the meter runs from y 0.8 (stop 0) up to y 0.2 (stop 6) */
  assert.equal(at(0.8, 3), 0); assert.equal(at(0.9, 3), 0, 'below the bottom: the bottom stop');
  assert.equal(at(0.2, 3), 6); assert.equal(at(0.05, 3), 6, 'above the top: the top stop');
  assert.equal(at(0.5, 0), 3, 'the middle');
  const stop = (i) => 0.8 - 0.6 * i / 6;
  assert.equal(at(stop(3) - 0.6 / 6 * 0.55, 3), 3, 'just past halfway to the next: still here');
  assert.equal(at(stop(3) - 0.6 / 6 * 0.9, 3), 4, 'past the stickiness: the next');
  const seen = []; for (let y = 0.8; y >= 0.2; y -= 0.01) seen.push(G.meterStop(y, 0.2, 0.8, 7, seen.at(-1) ?? 0));
  assert.deepEqual([...new Set(seen)], [0, 1, 2, 3, 4, 5, 6], 'raising a hand goes up through every stop in order');
  assert.equal(G.METER_HOLD, 1, 'hold still about a second to set it');
  assert.equal(G.HOLD, 0.7);
});

test('Builder: the first player builds; the others only watch, and the next takes over only after they have been gone a while', () => {
  const b = new G.Builder(), a = body(), c = { present: false };
  assert.equal(b.step(0.03, [c, c]), null);
  assert.equal(b.step(0.03, [c, a]), 1, 'the only one there');
  assert.equal(b.step(0.03, [a, a]), 1, 'a second body appears (earlier seat): the builder stays');
  assert.equal(b.step(1, [c, a]), 1);
  assert.equal(b.step(0.03, [a, c]), 1, 'the builder is gone a moment: still theirs');
  assert.equal(b.step(G.LOST_BUILDER, [a, c]), 0, 'gone for good: the next present body');
});

test('BodyReader: reads the builder only: their arms and hands; a second player does nothing', () => {
  const r = new G.BodyReader();
  const first = body({ x: 0.3 }), second = body({ up: true, x: 0.7 });
  const seen = run((dt) => r.step(dt, [first, second]), 1.5);
  assert.ok(seen.every(s => s.index === 0));
  assert.equal(seen.filter(s => s.arms).length, 0, 'the second player holding both arms up does nothing');
  assert.ok(Math.abs(seen.at(-1).hipX - 0.3) < 1e-9, 'where is read from the builder');
  const up = body({ up: true, x: 0.3 });
  assert.equal(run((dt) => r.step(dt, [up, second]), 1).filter(s => s.arms).length, 1, 'the builder with arms up does it, once');
  assert.equal(seen[0].hands.length, 2);
});
