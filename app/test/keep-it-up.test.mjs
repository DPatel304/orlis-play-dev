import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import keepItUp, { FLOOR, LIFT, BALL_EVERY, MAX_BALLS, ROUND } from '../src/games/keep-it-up.js';

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
  assert.ok(b.vy < -0.4 && b.vy >= -LIFT - 0.2, 'sent up, as far as this player reaches: ' + b.vy);
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

test('a new ball joins every 10 in a row, up to ten, and they all go when the ground is touched', () => {
  players(1);
  const g = keepItUp.create(1);
  g.streak = BALL_EVERY - 1;
  const b = g.balls[0]; Object.assign(b, { x: 0.5, y: 0.6, vx: 0, vy: 0.3 });
  bat(g, 0, b.x, b.y);
  assert.equal(g.balls.length, 2, 'the second at 10');
  assert.ok(Math.abs(g.balls[1].x - g.balls[0].x) > 0.2, 'it starts away from the other');
  /* every 10 more adds one, and no more than the most */
  for (let n = 3; n <= MAX_BALLS + 2; n++){
    g.streak = BALL_EVERY * (n - 1) - 1;
    const x = g.balls[0]; Object.assign(x, { y: 0.6, vx: 0, vy: 0.3, cool: 0 });
    bat(g, 0, x.x, x.y);
    assert.equal(g.balls.length, Math.min(n, MAX_BALLS), 'ball ' + n);
  }
  assert.equal(g.balls.length, MAX_BALLS);
});

test('a ball that touches the ground is lost on its own - the others and the streak carry on - and the last one just bounces', () => {
  players(1);
  const g = keepItUp.create(1);
  g.balls.push(g._ball(0.2), g._ball(0.8), g._ball(0.5));
  g.balls.forEach(b => Object.assign(b, { y: 0.4, vy: 0, vx: 0 }));
  g.streak = 37;
  Object.assign(g.balls[1], { y: FLOOR - 0.01, vy: 0.8 });
  g.step(DT, W, H);
  assert.equal(g.balls.length, 3, 'only that ball went');
  assert.equal(g.streak, 37, 'the streak carries on');
  /* two touch down in the same moment: one stays */
  const h = keepItUp.create(1);
  h.balls.push(h._ball(0.8));
  h.balls.forEach(b => Object.assign(b, { y: FLOOR - 0.01, vy: 0.8, vx: 0 }));
  h.streak = 12;
  h.step(DT, W, H);
  assert.equal(h.balls.length, 1, 'never none');
  /* the last ball: it bounces and the count starts again */
  Object.assign(h.balls[0], { y: FLOOR - 0.01, vy: 0.8 });
  h.step(DT, W, H);
  assert.equal(h.balls.length, 1); assert.equal(h.streak, 0); assert.ok(h.balls[0].vy < 0, 'bouncing back up');
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

test('the results speak of the best run, so the "New best!" is about the same thing', () => {
  players(1);
  const g = keepItUp.create(1);
  assert.equal(g.summary(1), null, 'nothing to say before a run');
  g.best = 17;
  assert.equal(g.summary(1), 'Your best run: 17 in a row');
  assert.equal(g.summary(2), 'Your best run together: 17 in a row');
});

/* ---------- a ball each ---------- */
import { PLAYER_COLORS } from '../src/tracking/pose.js';
import { RALLY, OWN_AFTER, RESPAWN } from '../src/games/keep-it-up.js';
const run = (g, secs) => { for (let t = 0; t < secs; t += DT) g.step(DT, W, H); };

test('with two or more, everyone has a ball of their own colour, in their part of the picture', () => {
  players(3);
  const g = keepItUp.create(3);
  run(g, OWN_AFTER + 0.5);
  assert.equal(g.balls.length, 3, 'one each');
  g.balls.sort((a, b) => a.owner - b.owner);
  g.balls.forEach((b, i) => assert.equal(b.owner, i));
  for (let t = 0; t < 20; t += DT){
    g.step(DT, W, H);
    for (const b of g.balls){
      const l = g._lane(b.owner);
      assert.ok(b.x >= l.lo - 0.05 && b.x <= l.hi + 0.05, `ball ${b.owner} at ${b.x.toFixed(2)} stays in ${l.lo.toFixed(2)}-${l.hi.toFixed(2)}`);
    }
  }
  /* they're drawn in their players' colours (and the lanes don't cross) */
  const lanes = [0, 1, 2].map(i => g._lane(i));
  assert.ok(lanes[0].hi <= lanes[1].lo + 0.05 && lanes[1].hi <= lanes[2].lo + 0.05);
  const fills = new Set();
  const c = new Proxy({ f: null }, { get(t, k){ return k === 'fillStyle' ? t.f : () => {}; }, set(t, k, v){ if (k === 'fillStyle'){ t.f = v; fills.add(v); } return true; } });
  g._ballAt(c, 100, 100, 50, 0, 1);
  assert.ok(fills.has(PLAYER_COLORS[1]) && !fills.has(PLAYER_COLORS[0]), 'player 2\'s ball is player 2\'s colour');
});

test('a ball is only its own player\'s to bat: another hand can\'t keep it up', () => {
  players(2);
  const g = keepItUp.create(2);
  run(g, OWN_AFTER + 0.5);
  const mine = g.balls.find(b => b.owner === 0);
  Object.assign(mine, { x: 0.5, y: 0.6, vx: 0, vy: 0.3, up: false, cool: 0 });
  /* player 2's hand right on it, moving up: nothing */
  bat(g, 1, mine.x, mine.y);
  assert.equal(g.score[1], 0); assert.ok(mine.vy > 0, 'still falling');
  /* player 1's hand: up it goes */
  Object.assign(mine, { x: 0.5, y: 0.6, vx: 0, vy: 0.3, cool: 0 });
  bat(g, 0, mine.x, mine.y);
  assert.equal(g.score[0], 1); assert.ok(mine.vy < 0);
  /* and not again while it's still on its way up, however a hand moves under it */
  mine.cool = 0;
  bat(g, 0, mine.x, mine.y);
  assert.equal(g.score[0], 1);
});

test('a ball that touches the ground pops and floats back in; the run goes on while others are up', () => {
  players(2);
  const g = keepItUp.create(2);
  run(g, OWN_AFTER + 0.5);
  g.streak = 9;
  const b = g.balls.find(x => x.owner === 1), other = g.balls.find(x => x.owner === 0);
  Object.assign(other, { y: 0.2, vy: 0 });
  Object.assign(b, { y: FLOOR - 0.01, vy: 0.8 });
  g.step(DT, W, H);
  assert.ok(!g.balls.includes(b), 'popped');
  assert.equal(g.streak, 9, 'the run goes on');
  run(g, RESPAWN + 0.1);
  assert.ok(g.balls.some(x => x.owner === 1), 'a new one for player 2');
  assert.equal(g.balls.length, 2);
});

test('after a drop the ball bounces up to where its player can meet it, higher for the tall', () => {
  players(1);
  const tall = keepItUp.create(1), short = keepItUp.create(1);
  pose.players[0].centre = { x: 0.5, y: 0.35 }; tall.step(DT, W, H);
  pose.players[0].centre = { x: 0.5, y: 0.65 }; short.step(DT, W, H);
  assert.ok(short._bounce(short.balls[0]) >= 0.55, 'never lower than it was');
  assert.ok(tall._bounce(tall.balls[0]) > short._bounce(short.balls[0]));
  assert.ok(tall._bounce(tall.balls[0]) > 0.7, 'a grown-up doesn\'t have to stoop');
});

test('with a ball each, no ball goes up faster than RALLY: a tall player\'s hangs about as long as a short one\'s', () => {
  players(2);
  const g = keepItUp.create(2);
  run(g, OWN_AFTER + 0.5);
  for (const i of [0, 1]){
    const b = g.balls.find(x => x.owner === i);
    Object.assign(b, { x: g._lane(i).x, y: 0.7, vx: 0, vy: 0.3, up: false, cool: 0 });
    bat(g, i, b.x, b.y);
    assert.ok(b.vy < 0 && -b.vy <= RALLY + 1e-9, `player ${i + 1}: ${b.vy}`);
  }
});

test('a bat sends the ball up as far as its player can reach - a short player\'s ball stays where they can meet it', () => {
  players(1);
  pose.players[0].centre = { x: 0.5, y: 0.65 };           /* a small body, low in the picture */
  const g = keepItUp.create(1);
  g.step(DT, W, H);
  const top = g.reach[0].top;
  assert.ok(top > 0.4, `its reach tops out at ${top.toFixed(2)}`);
  const b = g.balls[0]; Object.assign(b, { x: 0.5, y: 0.75, vx: 0, vy: 0.3, cool: 0 });
  bat(g, 0, b.x, b.y);
  const apex = 0.75 - b.vy * b.vy / (2 * 0.5);
  assert.ok(apex >= top - 0.03 && apex <= top + 0.03, `the ball peaks at ${apex.toFixed(2)}, the reach ends at ${top.toFixed(2)}`);
});
