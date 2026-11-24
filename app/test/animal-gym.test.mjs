import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import animalGym, { WARMUP, ORDER, BEAT, STUCK, CAP, COOL, ROUND, REPS, triesOf } from '../src/games/animal-gym.js';

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

test('the workout is three minutes: a warm-up, the animals in turn, and a cool-down for the last COOL seconds', () => {
  assert.equal(ROUND, 180);
  assert.equal(WARMUP, 'reach');
  assert.equal(new Set(ORDER).size, ORDER.length, 'a different move each time round');
  assert.ok(COOL >= 15 && COOL <= 25);
  assert.ok(BEAT >= 1 && BEAT <= 3, 'a short well-done beat');
  assert.ok(STUCK < CAP);
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

const asMice = (n, speed = 2) => {
  pose.mouse.active = false;
  pose.players.forEach((q, i) => { q.present = i < n; q.lm = null; q.centre = { x: 0.3 + i * 0.4, y: 0.5 }; q.scale = 0.3; q.hands = { left: { x: 0.1, y: 0.2, vx: 0, vy: 0, speed: 0 }, right: { x: 0.9, y: 0.2, vx: 0, vy: 0, speed }, }; });
};

test('everyone fills one bar; when it is full the coach cheers, and shortly after the next animal comes - nothing is ever lost', () => {
  asMice(2);
  const g = animalGym.create(2);
  assert.equal(g.move, 'reach');
  let t = 0;
  while (!g.cheered && t < 14){ g.step(DT, W, H); t += DT; }
  assert.ok(g.cheered, 'the first bar filled');
  assert.ok(g.score[0] > 0 && g.score[1] > 0, 'both children counted');
  assert.ok(g.score[0] + g.score[1] >= REPS * 2 - 1);
  const filledAt = t;
  while (g.seg === 0 && t < filledAt + BEAT + 1){ g.step(DT, W, H); t += DT; }
  assert.equal(g.seg, 1, 'on to the next animal');
  assert.ok(t - filledAt >= BEAT - 0.1 && t - filledAt <= BEAT + 0.3, 'after the beat, not before and not long after: ' + (t - filledAt));
  assert.equal(g.move, ORDER[0]); assert.ok(g.fill < 0.3, 'a fresh bar');
});

test('a move that is not being seen (no try at all) does not hold everyone up: on after STUCK seconds', () => {
  asMice(1, 0);                                    /* nobody tries */
  const g = animalGym.create(1);
  let t = 0;
  while (g.seg === 0 && t < 30){ g.step(DT, W, H); t += DT; }
  assert.ok(Math.abs(t - STUCK) < 0.2, 'moved on at ' + t.toFixed(1) + ' s');
  assert.ok(g.score[0] === 0 && !g.over, 'nothing lost');
});

test('an animal never stays longer than CAP, however slowly the bar fills', () => {
  asMice(1);
  const g = animalGym.create(1);
  let t = 0, seg = 0, longest = 0, at = 0;
  /* a try every 6 s: enough to keep STUCK from firing, far too slow to fill the bar */
  while (t < ROUND - COOL - 1){
    asMice(1, Math.floor(t / 6) !== Math.floor((t - DT) / 6) ? 2 : 0);
    g.step(DT, W, H); t += DT;
    if (g.seg !== seg){ longest = Math.max(longest, t - at); at = t; seg = g.seg; }
  }
  assert.ok(longest <= CAP + 0.2 && longest > STUCK, 'longest stay ' + longest.toFixed(1));
});

test('the cool-down fills the last COOL seconds, and the round is the full ROUND long', () => {
  asMice(2);
  const g = animalGym.create(2);
  let t = 0, animals = 0, seg = 0;
  while (t < ROUND - COOL - 0.2){ g.step(DT, W, H); t += DT; if (g.seg !== seg){ seg = g.seg; animals++; } }
  assert.equal(g.cool, false);
  while (t < ROUND - COOL + 0.3){ g.step(DT, W, H); t += DT; }
  assert.equal(g.cool, true); assert.equal(g.move, 'reach'); assert.equal(g.say.text, 'Slow stretch…');
  assert.ok(animals >= 10, 'more animals than the old eight: ' + animals);
  const stay = g.seg;
  while (t < ROUND - 0.5){ g.step(DT, W, H); t += DT; }
  assert.equal(g.seg, stay, 'the cool-down is one stretch'); assert.equal(g.over, false);
  while (t < ROUND + 0.5){ g.step(DT, W, H); t += DT; }
  assert.equal(g.over, true);
  assert.equal(g.value(), g.score[0] + g.score[1]);
  assert.ok([-1, 0, 1].includes(g.winner()), 'the contract every game keeps (the shell shows no winner)');
});

test('a squat is measured in the player\'s own size: a child and a grown-up squatting the same share of themselves both count', () => {
  for (const [scale, y0] of [[0.18, 0.62], [0.3, 0.45]]){            /* a small child far back, a tall grown-up */
    const p = stand(); p.scale = scale; p.centre.y = y0;
    const st = {};
    triesOf('squat', p, st, DT);
    p.centre.y = y0 + scale * 0.2;                                   /* lower by a fifth of their own size */
    triesOf('squat', p, st, DT);
    p.centre.y = y0;
    assert.equal(triesOf('squat', p, st, DT), 1, 'scale ' + scale);
  }
});
