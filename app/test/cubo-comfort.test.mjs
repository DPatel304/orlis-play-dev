/* Cubo's Create comfort zone (decision 0061): targets sit between chest and just above head height of the first player, around where they stand and as far
   out as an arm reaches, never below the hips, steady against a jittery tracker; a default for no body; the magnet that draws a hand marker in. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { L } from '../src/tracking/pose-shared.js';
const C = await import('../src/create/comfort.js');
const { magnet, MAGNET_REACH } = await import('../src/ui/magnet.js');

/* a standing person: head top y0, height `span` (picture heights), standing at x; the same proportions as the e2e rig's scripted body */
const person = ({ x = 0.5, top = 0.15, span = 0.72 } = {}) => {
  const K = (px, f) => ({ x: px, y: top + span * f, v: 0.95 });
  const lm = Array.from({ length: 33 }, () => K(x, 0.5));
  lm[L.NOSE] = K(x, 0); lm[L.L_SHOULDER] = K(x - 0.05 * span / 0.72, 0.22); lm[L.R_SHOULDER] = K(x + 0.05 * span / 0.72, 0.22);
  lm[L.L_HIP] = K(x - 0.03, 0.55); lm[L.R_HIP] = K(x + 0.03, 0.55);
  lm[L.L_ELBOW] = K(x - 0.07, 0.4); lm[L.R_ELBOW] = K(x + 0.07, 0.4); lm[L.L_WRIST] = K(x - 0.09, 0.55); lm[L.R_WRIST] = K(x + 0.09, 0.55);
  lm[L.L_KNEE] = K(x - 0.03, 0.78); lm[L.R_KNEE] = K(x + 0.03, 0.78);
  return { present: true, lm, centre: { x, y: top + span * 0.4 } };
};
const settle = (c, p, secs = 4, mouse = false) => { for (let t = 0; t < secs; t += 1 / 30) c.step(1 / 30, p, mouse); return c.z; };
const hips = (p) => (p.lm[L.L_HIP].y + p.lm[L.R_HIP].y) / 2;

test('the zone is between the chest and just above the head, never below the hips, for a grown-up and for a child', () => {
  for (const [who, p] of [['grown-up', person()], ['child', person({ top: 0.38, span: 0.5 })]]){
    const z = settle(new C.Comfort(), p);
    const shoulder = p.lm[L.L_SHOULDER].y, nose = p.lm[L.NOSE].y;
    assert.equal(z.body, true);
    assert.ok(z.top <= shoulder, `${who}: the top is above the shoulders`);
    assert.ok(z.top >= C.TOP_LIMIT - 1e-9 && z.top <= nose + 0.01, `${who}: about head height (top ${z.top.toFixed(3)}, nose ${nose})`);
    assert.ok(z.bottom > shoulder && z.bottom < hips(p), `${who}: the bottom is chest height, above the hips (bottom ${z.bottom.toFixed(3)})`);
    assert.ok(z.floor <= hips(p) + 1e-9, `${who}: nothing below the hips`);
    assert.ok(z.bottom - z.top >= C.MIN_BAND - 1e-9);
  }
  const grown = settle(new C.Comfort(), person()), child = settle(new C.Comfort(), person({ top: 0.38, span: 0.5 }));
  assert.ok(child.top > grown.top && child.bottom > grown.top, 'a child’s zone is lower in the picture');
  assert.ok(child.half < grown.half, 'and narrower: a shorter arm reaches less far to the side');
});

test('every target in a row is inside the zone, every layout stays above the hips, and the row follows where the player stands', () => {
  for (const p of [person(), person({ top: 0.38, span: 0.5 }), person({ x: 0.2 }), person({ x: 0.85, top: 0.38, span: 0.5 })]){
    const z = settle(new C.Comfort(), p), hip = hips(p);
    for (const [n, kind] of [[4, 'cards'], [5, 'tiles']]){
      const row = C.rowOf(z, n, n === 4 ? { minW: 0.1, maxW: 0.17, gap: 0.015 } : { minW: 0.07, maxW: 0.13, gap: 0.006 }), band = C.cardsBand(z, kind);
      assert.equal(row.length, n);
      assert.ok(row[0].x >= 0.02 - 1e-9 && row[n - 1].x + row[n - 1].w <= 0.98 + 1e-9, 'on the screen');
      assert.ok(band.y + band.h <= hip + 1e-9, `${kind}: the bottom edge is above the hips (${(band.y + band.h).toFixed(3)} vs ${hip})`);
      const mid = band.y + band.h / 2;
      assert.ok(mid >= z.top - 1e-9 && mid <= z.bottom + 1e-9, `${kind}: the middle is in the zone`);
      for (let i = 1; i < n; i++) assert.ok(row[i].x >= row[i - 1].x + row[i - 1].w, 'no two overlap');
    }
  }
  const left = C.rowOf(settle(new C.Comfort(), person({ x: 0.25 })), 5), right = C.rowOf(settle(new C.Comfort(), person({ x: 0.75 })), 5);
  assert.ok(left[2].x < right[2].x, 'the row follows them');
});

test('a child can reach the ends of a row from where they stand (within an arm and a bit)', () => {
  const p = person({ top: 0.38, span: 0.5 }), z = settle(new C.Comfort(), p);
  const row = C.rowOf(z, 5, { minW: 0.07, maxW: 0.13, gap: 0.006 }), arm = z.arm / C.ASPECT * C.ARM_SLACK * 1.1;
  for (const r of row){ const d = Math.max(r.x - z.x, 0, z.x - (r.x + r.w)); assert.ok(d <= arm, `a tile ${d.toFixed(3)} away, an arm is ${arm.toFixed(3)}`); }
});

test('the zone is steady: tracker jitter does not move it; a real move glides', () => {
  const c = new C.Comfort(); let p = person(); settle(c, p, 2);
  const before = { ...c.z };
  let worst = 0;
  for (let i = 0; i < 90; i++){
    const j = person({ x: 0.5 + (i % 2 ? 0.004 : -0.004), top: 0.15 + (i % 3 ? 0.003 : -0.003) });
    c.step(1 / 30, j); worst = Math.max(worst, Math.abs(c.z.x - before.x), Math.abs(c.z.top - before.top), Math.abs(c.z.bottom - before.bottom));
  }
  assert.ok(worst < C.DEAD + 0.004, `jitter moved it by ${worst}`);
  /* a step to the side: it follows, but not in one jump */
  c.step(1 / 30, person({ x: 0.3 })); const one = c.z.x; assert.ok(Math.abs(one - before.x) < 0.05, 'a frame moves it only a little');
  settle(c, person({ x: 0.3 }), 4); assert.ok(Math.abs(c.z.x - 0.3) < 0.03, 'and in a few seconds it is there');
});

test('with no body (the remote, the mouse) the zone is the default, centred on the screen', () => {
  const d = settle(new C.Comfort(), null);
  assert.deepEqual({ x: d.x, body: d.body }, { x: 0.5, body: false });
  assert.ok(d.top < d.bottom && d.bottom <= d.floor && d.floor < 0.9);
  assert.equal(settle(new C.Comfort(), person({ x: 0.2 }), 1, true).x, 0.5, 'the mouse stands in for the camera: the default');
  assert.equal(settle(new C.Comfort(), { present: false }, 1).body, false);
});

test('the meter runs from the hips up to the top of the zone', () => {
  const z = settle(new C.Comfort(), person({ top: 0.38, span: 0.5 })), m = C.meterBand(z);
  assert.ok(m.bottom <= z.floor + 1e-9 && m.top < m.bottom - 0.25 && m.top >= 0.12 - 1e-9);
});

test('near: 1 on a target, falling to 0 a little away', () => {
  assert.equal(C.near(0, 100), 1); assert.ok(C.near(45, 100) < 0.6 && C.near(45, 100) > 0.4); assert.equal(C.near(200, 100), 0);
});

test('the magnet draws a hand marker toward the centre of a target near it, and does nothing far away', () => {
  magnet.set([{ x: 0.5, y: 0.5, r: 0.1 }]);
  const far = magnet.pull(0.9, 0.9); assert.deepEqual(far, { x: 0.9, y: 0.9 });
  const edge = magnet.pull(0.5 + 0.1 * MAGNET_REACH / 1.7778, 0.5); assert.ok(Math.abs(edge.x - (0.5 + 0.1 * MAGNET_REACH / 1.7778)) < 1e-6, 'none at the edge of its reach');
  const nearish = magnet.pull(0.53, 0.5), start = 0.53;
  assert.ok(nearish.x < start && nearish.x > 0.5, 'drawn toward the centre, not onto it: ' + nearish.x);
  const on = magnet.pull(0.5, 0.5); assert.deepEqual(on, { x: 0.5, y: 0.5 });
  /* two targets: the nearest wins */
  magnet.set([{ x: 0.2, y: 0.5, r: 0.12 }, { x: 0.3, y: 0.5, r: 0.12 }]);
  const two = magnet.pull(0.28, 0.5); assert.ok(two.x > 0.28, 'toward the nearer centre (0.3)');
  magnet.clear(); assert.deepEqual(magnet.pull(0.28, 0.5), { x: 0.28, y: 0.5 });
});
