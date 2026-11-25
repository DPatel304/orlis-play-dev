import test from 'node:test';
import assert from 'node:assert/strict';
import { MOVES } from '../src/games/animal-gym.js';
import { poseAt, COACH_OF, COACHES, REST, LIMITS, BEATS, EXTENT, RISE, coachUnit } from '../src/games/animal-coaches.js';

test('every move in Animal Gym has its coach, the same animal as the move names, and a loop length', () => {
  for (const [mv, m] of Object.entries(MOVES)){
    assert.equal(COACH_OF[mv], m.animal, mv);
    assert.ok(BEATS[mv] > 0);
    assert.ok(EXTENT[m.animal] > 0 && RISE[m.animal] > 0);
  }
  assert.equal(COACHES.length, Object.keys(MOVES).length);
});

test('poses stay inside sane ranges, in every mode, over a whole loop', () => {
  for (const a of COACHES) for (const o of [{}, { slow: true }, { reduced: true }, { tryK: 1 }, { joy: 0.3 }, { joy: 1.1, reduced: true }]){
    for (let t = 0; t < 12; t += 0.037){
      const q = poseAt(a, t, o);
      for (const k of Object.keys(REST)){
        assert.ok(Number.isFinite(q[k]), `${a} ${k}`);
        assert.ok(q[k] >= LIMITS[k][0] && q[k] <= LIMITS[k][1], `${a} ${k}=${q[k]} at ${t}`);
      }
    }
  }
});

test('poseAt is pure and loops: the same time gives the same pose, a loop later too', () => {
  for (const a of COACHES){
    const mv = Object.keys(COACH_OF).find(k => COACH_OF[k] === a), loop = BEATS[mv] * 60 / 140;
    assert.deepEqual(poseAt(a, 1.3), poseAt(a, 1.3));
    const x = poseAt(a, 0.7), y = poseAt(a, 0.7 + loop);
    for (const k of Object.keys(REST)) assert.ok(Math.abs(x[k] - y[k]) < 1e-6, `${a} ${k}`);
  }
});

test('each coach really does its move: the pose changes a lot over the loop', () => {
  const span = (a, k, o = {}) => { let lo = 9, hi = -9; for (let t = 0; t < 8; t += 0.02){ const v = poseAt(a, t, o)[k]; lo = Math.min(lo, v); hi = Math.max(hi, v); } return hi - lo; };
  assert.ok(span('giraffe', 'neck') > 0.9);
  assert.ok(span('bunny', 'lift') > 0.2);
  assert.ok(span('bird', 'wing') > 1.5);
  assert.ok(span('frog', 'squash') > 0.3 && span('frog', 'lift') > 0.15);
  assert.ok(span('elephant', 'legL') > 0.15 && span('elephant', 'legR') > 0.15);
  assert.ok(span('penguin', 'lean') > 0.3);
  /* reduced motion: smaller, but still there */
  assert.ok(span('giraffe', 'neck', { reduced: true }) < span('giraffe', 'neck'));
  assert.ok(span('giraffe', 'neck', { reduced: true }) > 0.4);
});

test('a try gives a tiny hop and Great job a flourish; the coach is sized to fit under the HUD', () => {
  assert.ok(poseAt('penguin', 0, { tryK: 1 }).lift > poseAt('penguin', 0).lift);
  assert.ok(poseAt('bird', 0, { joy: 0.5 }).wing > 1.8);
  for (const a of COACHES){
    const H = 1080, top = H * 0.79 - (EXTENT[a] + RISE[a]) * coachUnit(a, H);
    assert.ok(top >= H * 0.27, `${a} top ${top}`);
    assert.ok(EXTENT[a] * coachUnit(a, H) >= H * 0.3, `${a} standing height`);
  }
});
