import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import keepItUp, { FLOOR, LIFT, SECOND_BALL_AT, ROUND } from '../src/games/keep-it-up.js';

const DT = 1 / 30, W = 1920, H = 1080;
function players(n){
  pose.mouse.active = false;
  pose.players.forEach((p, i) => {
    p.present = i < n; p.lm = null; p.centre = { x: 0.3 + i * 0.4, y: 0.5 }; p.scale = 0.3;
    p.hands.left = { x: 0.1, y: 0.2, vx: 0, vy: 0, speed: 0 }; p.hands.right = { x: 0.9, y: 0.2, vx: 0, vy: 0, speed: 0 };
  });
}
/* player i's right hand meets (x, y), moving up a little */
const bat = (g, i, x, y) => {
  const h = pose.players[i].hands.right;
  Object.assign(h, { x, y, vx: 0.2, vy: -0.8, speed: 0.8 });
  g.step(DT, W, H);
  Object.assign(h, { x: 0.9, y: 0.2, vx: 0, vy: 0, speed: 0 });
};

test('a hand meeting the ball sends it up, and the run grows', () => {
  players(1);
  const g = keepItUp.create(1);
  const b = g.balls[0]; Object.assign(b, { x: 0.5, y: 0.6, vx: 0, vy: 0.3 });
  bat(g, 0, b.x, b.y);
  assert.ok(b.vy < -LIFT * 0.9, 'sent up: ' + b.vy);
  assert.equal(g.streak, 1); assert.equal(g.score[0], 1);
  /* the same touch is one hit, not a dozen */
  bat(g, 0, b.x, b.y);
  assert.equal(g.streak, 1);
});

test('a resting hand does not bat a ball that is not falling onto it', () => {
  players(1);
  const g = keepItUp.create(1);
  const b = g.balls[0]; Object.assign(b, { x: 0.5, y: 0.5, vx: 0, vy: -0.4 });
  const h = pose.players[0].hands.right; Object.assign(h, { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 });
  g.step(DT, W, H);
  assert.equal(g.streak, 0);
});

test('the ground is soft: the ball bounces back up, the run starts again, the best is kept', () => {
  players(1);
  const g = keepItUp.create(1);
  g.streak = 7; g.best = 7;
  Object.assign(g.balls[0], { x: 0.5, y: FLOOR - 0.01, vx: 0, vy: 0.8 });
  g.step(DT, W, H);
  assert.equal(g.streak, 0);
  assert.ok(g.balls[0].vy < 0, 'bouncing back up');
  assert.equal(g.value(), 7, 'the best run is the round\'s best');
});

test('a second ball joins at 15 in a row, and goes when the ground is touched', () => {
  players(1);
  const g = keepItUp.create(1);
  g.streak = SECOND_BALL_AT - 1;
  const b = g.balls[0]; Object.assign(b, { x: 0.5, y: 0.6, vx: 0, vy: 0.3 });
  bat(g, 0, b.x, b.y);
  assert.equal(g.balls.length, 2);
  Object.assign(g.balls[1], { y: FLOOR - 0.01, vy: 0.8 });
  g.step(DT, W, H);
  assert.equal(g.balls.length, 1, 'back to one');
});

test('a hit never sends the ball down, and it stays on screen', () => {
  players(2);
  const g = keepItUp.create(2);
  for (let k = 0; k < 600; k++){
    const b = g.balls[0];
    if (k % 20 === 0) bat(g, k % 2, b.x, b.y); else g.step(DT, W, H);
    for (const x of g.balls){ assert.ok(x.x >= 0.04 && x.x <= 0.96 && x.y >= 0.09 && x.y <= FLOOR + 1e-9, `on screen: ${x.x}, ${x.y}`); }
  }
});

test('the round is three minutes', () => {
  players(1);
  const g = keepItUp.create(1);
  assert.equal(ROUND, 180);
  for (let t = 0; t < ROUND - 1; t += DT) g.step(DT, W, H);
  assert.equal(g.over, false);
  for (let t = 0; t < 2; t += DT) g.step(DT, W, H);
  assert.equal(g.over, true);
  assert.equal(g.winner(), null, 'one player: nobody to beat');
});
