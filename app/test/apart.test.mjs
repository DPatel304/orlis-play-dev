import test from 'node:test';
import assert from 'node:assert/strict';
import { pose, sizeOf, seated, CLOSE, STAY_CLOSE, WATCH_AFTER, headOf, L } from '../src/tracking/pose.js';
import { shapeOf, learnShape, shapeDistance, shapeCost, bestAssignment, Hold, SHAPE_COST, MATCH_BONUS } from '../src/tracking/shape.js';
import * as rig from '../tools/playtest/rig.mjs';
import { scenarios, run } from '../tools/playtest/trackcmp.mjs';
import { forceSwitches } from '../src/tracking/switches.js';
import { figure } from './harness/synth-frames.mjs';

const lib = { sizeOf, seated, CLOSE, STAY: STAY_CLOSE, WATCH_AFTER, headOf };
const body = (x, torso, { sw = 1, legs = 1, v = 0.95 } = {}) => {
  const lm = figure(x, 0.6, torso, { v });
  const cx = lm[L.NOSE].x, hip = lm[L.L_HIP].y;
  for (const k of [L.L_SHOULDER, L.R_SHOULDER]) lm[k].x = cx + (lm[k].x - cx) * sw;
  for (const k of [L.L_KNEE, L.R_KNEE, L.L_ANKLE, L.R_ANKLE]) lm[k].y = hip + (lm[k].y - hip) * legs;
  return lm;
};

test('bestAssignment: the cheapest whole pairing, not the greedy one; a body is not grabbed just to give another player one', () => {
  /* greedy takes (0,0) at 0.10 first and leaves player 1 with (1,0)=0.12 gone; the best total is 0.11 + 0.11 */
  const a = bestAssignment([[{ j: 0, cost: 0.10 }, { j: 1, cost: 0.11 }], [{ j: 0, cost: 0.11 }]]);
  assert.deepEqual([...a], [[0, 1], [1, 0]]);
  /* a far body (0.24) taken only so that a second player could have the near one: not worth it, leave that player for a look */
  const b = bestAssignment([[{ j: 0, cost: 0.01 }, { j: 1, cost: 0.24 }], [{ j: 0, cost: 0.05 }]]);
  assert.deepEqual([...b], [[0, 0]]);
  /* with no rival every gated body is taken, however dear */
  assert.deepEqual([...bestAssignment([[{ j: 0, cost: 0.6 }]])], [[0, 0]]);
  assert.equal(bestAssignment([[], []]).size, 0);
  assert.ok(MATCH_BONUS > 0);
});

test('shape: the same body gives the same shape; a stocky or long-legged one is told apart; twins are not', () => {
  const a = shapeOf(body(0.4, 0.14)), same = shapeOf(body(0.6, 0.14)), stocky = shapeOf(body(0.5, 0.14, { sw: 1.5 })), lanky = shapeOf(body(0.5, 0.14, { legs: 1.25 }));
  let sig = null; for (let i = 0; i < 6; i++) sig = learnShape(sig, a, i * 200);
  assert.ok(shapeDistance(sig, same) < 0.02);
  assert.ok(shapeDistance(sig, stocky) > 0.05, 'stocky ' + shapeDistance(sig, stocky));
  assert.ok(shapeDistance(sig, lanky) > 0.05, 'lanky ' + shapeDistance(sig, lanky));
  assert.equal(shapeCost(0.01), 0); assert.ok(Math.abs(shapeCost(0.5) - SHAPE_COST) < 1e-9);
  assert.equal(shapeDistance(null, same), null); assert.equal(shapeDistance(learnShape(null, a, 0), same), null, 'too few looks');
  const bent = body(0.5, 0.14); bent[L.L_SHOULDER].x += 0.1; bent[L.R_SHOULDER].x += 0.1;
  assert.equal(shapeOf(bent), null, 'leaning: not read');
});

test('Hold: decides "same" or "swapped" by where each was heading, once', () => {
  const h = new Hold(0, 1, { x: 0.40, y: 0.7, vx: 0.2, vy: 0 }, { x: 0.60, y: 0.7, vx: -0.2, vy: 0 });
  h.age = 1.5;         /* they walked through each other: 0 should now be on the right */
  const r = h.decide({ x: 0.45, y: 0.7 }, { x: 0.75, y: 0.7 });
  assert.equal(r.swapped, true); assert.equal(r.give[0].x, 0.75); assert.equal(r.give[1].x, 0.45);
  const g = new Hold(0, 1, { x: 0.40, y: 0.7, vx: 0, vy: 0 }, { x: 0.60, y: 0.7, vx: 0, vy: 0 });
  g.age = 1;           /* they stayed put and came apart again */
  const s = g.decide({ x: 0.38, y: 0.7 }, { x: 0.62, y: 0.7 });
  assert.equal(s.swapped, false); assert.equal(s.give[0].x, 0.38);
  /* clothes / shape can outvote a weak motion guess */
  const w = new Hold(0, 1, { x: 0.45, y: 0.7, vx: 0.01, vy: 0 }, { x: 0.55, y: 0.7, vx: -0.01, vy: 0 });
  w.age = 1;
  const t = w.decide({ x: 0.35, y: 0.7 }, { x: 0.65, y: 0.7 }, (who, d) => (who === 0) === (d.x < 0.5) ? 1 : 0);
  assert.equal(t.swapped, true);
});

const cross = (id, seeds, on) => seeds.map(seed => run({ pose, rig, lib, sc: scenarios(rig).find(s => s.id === id), seed, on, jitter: 0.0018 }));

test('crossing, two children in one shirt but built differently: Tell players apart better keeps everyone in their own place (the rig knows who is who)', () => {
  const seeds = [1, 2, 3, 4];
  const off = cross('cross-build', seeds, []), on = cross('cross-build', seeds, ['apart']);
  const wrong = (rs) => rs.reduce((s, r) => s + r.wrongEnd, 0), looks = (rs) => rs.reduce((s, r) => s + r.m.wrongLooks, 0);
  console.log('cross-build wrong at crossing end / looks with the wrong person: off', wrong(off), looks(off), ' apart', wrong(on), looks(on));
  assert.ok(wrong(off) > 0, 'without it children swap places (the scenario means something)');
  assert.equal(wrong(on), 0);
  assert.ok(looks(on) < looks(off) * 0.1);
});

test('nothing worse than before for a family wandering about (no overlap decisions needed, no one lost)', () => {
  const off = cross('family4-shirts', [1], []), on = cross('family4-shirts', [1], ['apart']);
  assert.equal(on[0].m.wrongLooks, 0); assert.equal(off[0].m.wrongLooks, 0);
  assert.ok(on[0].m.dropouts <= off[0].m.dropouts);
});

test('a player who leaves for 12 s and comes back gets their own place, and a stranger a free one (shape memory, 30 s)', () => {
  const seeds = [1, 2, 3];
  const sum = (rs, k) => rs.reduce((s, r) => s + r[k], 0);
  const off = cross('leave-return', seeds, []), on = cross('leave-return-same', seeds, ['apart']);
  assert.equal(sum(off, 'back'), 0, 'without it they come back to another place');
  assert.equal(sum(on, 'back'), seeds.length); assert.equal(sum(on, 'strangerOk'), seeds.length);
});

test('it fails safe: if the shape step throws, the look is paired the ordinary way', () => {
  const saved = pose._byShape;
  pose._byShape = () => { throw new Error('boom'); };
  try {
    const r = run({ pose, rig, lib, sc: { ...scenarios(rig).find(s => s.id === 'cross-same'), secs: 12 }, seed: 1, on: ['apart'], jitter: 0.0018 });
    assert.ok(r.m.looks > 300); assert.equal(r.m.dropouts, 0);
  } finally { pose._byShape = saved; forceSwitches(null); }
});
