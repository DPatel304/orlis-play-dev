import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import animalGym, { SCHEDULE, ROUND, REPS, triesOf } from '../src/games/animal-gym.js';

const DT = 1 / 30, W = 1920, H = 1080;
/* a standing player: nose, shoulders, hips, knees, wrists - in screen shares, 0.3 body size */
const stand = () => {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 1 }));
  Object.assign(lm[0], { x: 0.5, y: 0.2 });
  Object.assign(lm[11], { x: 0.45, y: 0.3 }); Object.assign(lm[12], { x: 0.55, y: 0.3 });
  Object.assign(lm[15], { x: 0.4, y: 0.55 }); Object.assign(lm[16], { x: 0.6, y: 0.55 });
  Object.assign(lm[23], { x: 0.47, y: 0.55 }); Object.assign(lm[24], { x: 0.53, y: 0.55 });
  Object.assign(lm[25], { x: 0.47, y: 0.72 }); Object.assign(lm[26], { x: 0.53, y: 0.72 });
  return { present: true, lm, scale: 0.3, centre: { x: 0.5, y: 0.45 }, hands: { left: { speed: 0 }, right: { speed: 0 } } };
};

test('the workout is three minutes: a warm-up, six animals and a cool-down', () => {
  assert.equal(SCHEDULE.reduce((a, s) => a + s.len, 0), ROUND);
  assert.equal(ROUND, 180);
  assert.equal(SCHEDULE.length, 8);
});

test('stretching up tall is one try each time the arms go up', () => {
  const p = stand(), st = {};
  assert.equal(triesOf('reach', p, st, DT), 0);
  p.lm[15].y = 0.1;                                  /* a wrist well above the nose */
  assert.equal(triesOf('reach', p, st, DT), 1);
  assert.equal(triesOf('reach', p, st, DT), 0, 'staying up is the same try');
  p.lm[15].y = 0.55; triesOf('reach', p, st, DT);
  p.lm[16].y = 0.1;
  assert.equal(triesOf('reach', p, st, DT), 1, 'down and up again is another');
});

test('flapping: arms up past the shoulders, then down, then up again', () => {
  const p = stand(), st = {};
  p.lm[15].y = 0.5; p.lm[16].y = 0.5;               /* both wrists below the shoulders */
  assert.equal(triesOf('flap', p, st, DT), 0);
  p.lm[15].y = 0.2; p.lm[16].y = 0.2;               /* a flap up */
  assert.equal(triesOf('flap', p, st, DT), 1);
  assert.equal(triesOf('flap', p, st, DT), 0);
  p.lm[15].y = 0.5; p.lm[16].y = 0.5; triesOf('flap', p, st, DT);
  p.lm[15].y = 0.2;
  assert.equal(triesOf('flap', p, st, DT), 1);
});

test('a squat: down low, and back up, is one try', () => {
  const p = stand(), st = {};
  triesOf('squat', p, st, DT);
  p.centre.y = 0.45 + 0.3 * 0.2;                    /* lower by a fifth of a body */
  assert.equal(triesOf('squat', p, st, DT), 0, 'down: not yet');
  p.centre.y = 0.45;
  assert.equal(triesOf('squat', p, st, DT), 1, 'standing up again: a squat');
});

test('knee lifts: each leg that comes up is a try', () => {
  const p = stand(), st = {};
  assert.equal(triesOf('march', p, st, DT), 0);
  p.lm[25].y = 0.6;                                 /* the left knee up toward the hip */
  assert.equal(triesOf('march', p, st, DT), 1);
  assert.equal(triesOf('march', p, st, DT), 0, 'held up: the same try');
  p.lm[26].y = 0.6;
  assert.equal(triesOf('march', p, st, DT), 1, 'the other knee');
});

test('a wobble: leaning one way, then the other', () => {
  const p = stand(), st = {};
  assert.equal(triesOf('lean', p, st, DT), 0);
  p.lm[11].x = 0.52; p.lm[12].x = 0.62;             /* shoulders over to the right */
  assert.equal(triesOf('lean', p, st, DT), 1);
  assert.equal(triesOf('lean', p, st, DT), 0, 'still leaning: the same wobble');
  p.lm[11].x = 0.38; p.lm[12].x = 0.48;
  assert.equal(triesOf('lean', p, st, DT), 1, 'the other way');
});

test('with no landmarks (the mouse) a fast hand is a try, a few a second at most', () => {
  const p = { present: true, lm: null, hands: { left: { speed: 0 }, right: { speed: 2 } } }, st = {};
  assert.equal(triesOf('squat', p, st, DT), 1);
  assert.equal(triesOf('squat', p, st, DT), 0, 'not every frame');
});

test('everyone fills one bar; when it is full the coach cheers; time moves the animals on; nothing is ever lost', () => {
  pose.mouse.active = false;
  pose.players.forEach((q, i) => { q.present = i < 2; q.lm = null; q.centre = { x: 0.3 + i * 0.4, y: 0.5 }; q.scale = 0.3; q.hands = { left: { x: 0.1, y: 0.2, vx: 0, vy: 0, speed: 0 }, right: { x: 0.9, y: 0.2, vx: 0, vy: 0, speed: 2 } }; });
  const g = animalGym.create(2);
  assert.equal(g.move, 'reach');
  let t = 0;
  while (!g.cheered && t < 14){ g.step(DT, W, H); t += DT; }
  assert.ok(g.cheered, 'the first bar filled');
  assert.ok(g.score[0] > 0 && g.score[1] > 0, 'both children counted');
  assert.ok(g.score[0] + g.score[1] >= REPS * 2 - 1);
  /* time moves on to the next animal, whether or not the bar was full */
  while (t < SCHEDULE[0].len + 1){ g.step(DT, W, H); t += DT; }
  assert.equal(g.move, 'jump'); assert.equal(g.fill >= 0, true);
  while (t < ROUND - 0.5){ g.step(DT, W, H); t += DT; }
  assert.equal(g.over, false);
  while (t < ROUND + 0.5){ g.step(DT, W, H); t += DT; }
  assert.equal(g.over, true);
  assert.equal(g.value(), g.score[0] + g.score[1]);
  assert.ok([-1, 0, 1].includes(g.winner()), 'the contract every game keeps (the shell shows no winner)');
});
