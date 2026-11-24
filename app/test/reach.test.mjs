import test from 'node:test';
import assert from 'node:assert/strict';
import { L } from '../src/tracking/pose-shared.js';
import { measure, Reach, reaches, ARM_UP, TAU_Y, MIN_BAND, HIGHEST, LOWEST } from '../src/games/reach.js';

const A = 16 / 9;
/* a standing body: `h` tall in the picture (picture heights), feet at `feet`, middle at `x`; its arm hangs straight down, or
   - with `bent` - with the elbow out to the side and the hand up (the arm is just as long) */
function body(h, feet, x = 0.5, { bent = false } = {}){
  const top = feet - h, y = (f) => top + f * h;
  const lm = Array.from({ length: 33 }, () => ({ x, y: y(0.5), z: 0, v: 0.95 }));
  const sw = 0.115 * h / A, hw = 0.085 * h / A, arm = 0.31 * h;
  const set = (i, px, py) => { lm[i] = { x: px, y: py, z: 0, v: 0.95 }; };
  set(L.L_SHOULDER, x - sw, y(0.185)); set(L.R_SHOULDER, x + sw, y(0.185));
  for (const [s, e, w, d] of [[L.L_SHOULDER, L.L_ELBOW, L.L_WRIST, -1], [L.R_SHOULDER, L.R_ELBOW, L.R_WRIST, 1]]){
    const sh = lm[s];
    if (bent){ set(e, sh.x + d * arm / 2 / A, sh.y); set(w, sh.x + d * arm / 2 / A, sh.y - arm / 2); }
    else { set(e, sh.x, sh.y + arm / 2); set(w, sh.x, sh.y + arm); }
  }
  set(L.L_HIP, x - hw, y(0.52)); set(L.R_HIP, x + hw, y(0.52));
  set(L.L_KNEE, x - hw, y(0.74)); set(L.R_KNEE, x + hw, y(0.74));
  set(L.L_ANKLE, x - hw, y(0.955)); set(L.R_ANKLE, x + hw, y(0.955));
  return { lm, centre: { x, y: 0.5 }, scale: 0.3, shoulderY: y(0.185), kneeY: y(0.74), arm };
}
const adult = () => body(0.74, 0.93, 0.3), child = () => body(0.444, 0.97, 0.7);

test('the top is where the wrist gets with an arm raised: the shoulder less 0.9 of the arm, measured on the body', () => {
  for (const b of [adult(), child()]){
    const m = measure(b);
    assert.ok(Math.abs(m.top - (b.shoulderY - ARM_UP * b.arm)) < 1e-6, `top ${m.top} for shoulder ${b.shoulderY}, arm ${b.arm}`);
    assert.ok(Math.abs(m.bottom - b.kneeY) < 1e-6, 'the bottom is the knees');
    assert.ok(Math.abs(m.arm - b.arm) < 1e-6);
  }
  const a = measure(adult()), c = measure(child());
  assert.ok(c.top > a.top + 0.25, `a child's top is much lower on the screen: ${c.top.toFixed(2)} vs ${a.top.toFixed(2)}`);
  assert.ok(Math.abs(a.x - 0.3) < 0.01 && Math.abs(c.x - 0.7) < 0.01, 'x is the middle of the body');
});

test('a bent arm is as long as a straight one: the band does not move when the hands do', () => {
  const s = measure(body(0.444, 0.97)), b = measure(body(0.444, 0.97, 0.5, { bent: true }));
  assert.ok(Math.abs(s.top - b.top) < 1e-6 && Math.abs(s.arm - b.arm) < 1e-6);
});

test('when the arms or knees are out of sight, a torso stands in for them', () => {
  const full = measure(adult());
  const hid = adult();
  for (const k of [L.L_ELBOW, L.R_ELBOW, L.L_WRIST, L.R_WRIST, L.L_KNEE, L.R_KNEE, L.L_ANKLE, L.R_ANKLE]) hid.lm[k].v = 0.1;
  const m = measure(hid);
  assert.ok(Math.abs(m.top - full.top) < 0.04, `top ${m.top.toFixed(3)} vs ${full.top.toFixed(3)}`);
  assert.ok(Math.abs(m.bottom - full.bottom) < 0.04, `bottom ${m.bottom.toFixed(3)} vs ${full.bottom.toFixed(3)}`);
  /* no body at all */
  assert.equal(measure(null), null);
  const gone = adult(); gone.lm[L.L_SHOULDER].v = 0; gone.lm[L.R_SHOULDER].v = 0;
  assert.equal(measure(gone), null);
});

test('with no landmarks (a test, a pointer) it falls back on the centre and size the tracker keeps', () => {
  const m = measure({ lm: null, centre: { x: 0.4, y: 0.5 }, scale: 0.3 });
  assert.ok(Number.isFinite(m.top) && Number.isFinite(m.bottom) && m.top < 0.5 && m.bottom > 0.5);
  assert.ok(Math.abs(m.x - 0.4) < 1e-9);
  const small = measure({ lm: null, centre: { x: 0.4, y: 0.7 }, scale: 0.2 });
  assert.ok(small.top > m.top, 'a smaller, lower body reaches less high');
});

test('it is smoothed: a hop, a squat or a bad frame moves the band a little, not all at once', () => {
  const r = new Reach(), p = adult();
  r.step(1 / 30, p);
  assert.ok(r.ready);
  const top0 = r.top;
  /* one frame with the whole body 0.2 lower (a glitch) */
  const g = adult(); for (const k of g.lm) k.y += 0.2;
  r.step(1 / 30, g);
  assert.ok(Math.abs(r.top - top0) < 0.2 * (1 / 30) / TAU_Y * 1.2, `moved ${(r.top - top0).toFixed(3)} in a frame`);
  /* and it settles where the body is */
  for (let k = 0; k < 300; k++) r.step(1 / 30, g);
  assert.ok(Math.abs(r.top - (top0 + 0.2)) < 0.01);
  /* a player nobody can see keeps the band they had */
  const before = { top: r.top, bottom: r.bottom, x: r.x };
  r.step(1 / 30, null); r.step(1 / 30, { lm: null });
  assert.deepEqual({ top: r.top, bottom: r.bottom, x: r.x }, before);
});

test('the band is always a band: not thinner than MIN_BAND, and on the screen', () => {
  const r = new Reach();
  const low = { lm: null, centre: { x: 0.5, y: 1.2 }, scale: 0.5 };
  r.step(1, low);
  assert.ok(r.bottom <= LOWEST && r.bottom - r.top >= MIN_BAND - 1e-9);
  const high = new Reach().step(1, { lm: null, centre: { x: 0.5, y: -0.4 }, scale: 0.5 });
  assert.ok(high.top >= HIGHEST - 1e-9);
});

test('a pointer reaches the whole picture; a Reach can be asked about heights', () => {
  const r = new Reach().step(1, { lm: null, centre: { x: 0.5, y: 0.5 }, scale: 0.3 }, true);
  assert.ok(r.top < 0.1 && r.bottom > 0.9);
  const c = new Reach().step(1, child());
  assert.ok(c.has(c.at(0.5)) && !c.has(c.top - 0.1) && c.has(c.top - 0.1, 0.2));
  assert.ok(c.at(0) === c.top && Math.abs(c.at(1) - c.bottom) < 1e-12);
  assert.equal(reaches(4).length, 4);
});
