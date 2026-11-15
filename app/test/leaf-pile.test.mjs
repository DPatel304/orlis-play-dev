import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import leafPile, { PILE, PILE_FULL, PILE_MORE, JUMP_WAIT, SWEEP_SPEED } from '../src/games/leaf-pile.js';

const DT = 1 / 30, W = 1920, H = 1080;
function players(n){
  pose.mouse.active = false;
  pose.players.forEach((p, i) => {
    p.present = i < n; p.lm = null; p.centre = { x: 0.3 + i * 0.4, y: 0.5 }; p.scale = 0.3;
    p.hands.left = { x: 0.1, y: 0.2, vx: 0, vy: 0, speed: 0 }; p.hands.right = { x: 0.9, y: 0.2, vx: 0, vy: 0, speed: 0 };
  });
}
/* player i's right hand sweeps through (x, y), moving toward the pile */
function sweep(g, i, x, y){
  const h = pose.players[i].hands.right, vx = Math.sign(PILE.x - x) * 1.2;
  Object.assign(h, { x, y, vx, vy: 0, speed: Math.abs(vx) });
  g.step(DT, W, H);
  Object.assign(h, { x: 0.9, y: 0.2, vx: 0, vy: 0, speed: 0 });
}

test('a sweeping hand pushes a leaf toward the pile, and it goes in', () => {
  players(1);
  const g = leafPile.create(1);
  g.leaves = []; g._leaf(true, 0.3, 0.86); g.fallT = 99;
  const L = g.leaves[0];
  sweep(g, 0, L.x, L.y);
  assert.ok(g.leaves[0].vx > 0, 'pushed the way the hand went');
  for (let k = 0; k < 120; k++) g.step(DT, W, H);
  assert.equal(g.pile, 1); assert.equal(g.score[0], 1);
});

test('a slow hand resting on a leaf does not push it', () => {
  players(1);
  const g = leafPile.create(1);
  g.leaves = []; g._leaf(true, 0.3, 0.86); g.fallT = 99;
  const L = g.leaves[0], h = pose.players[0].hands.right;
  Object.assign(h, { x: L.x, y: L.y, vx: SWEEP_SPEED * 0.5, vy: 0, speed: SWEEP_SPEED * 0.5 });
  g.step(DT, W, H);
  assert.equal(g.leaves.find(x => x === L).vx, 0);
});

test('a full pile waits for a jump - and bursts by itself if nobody jumps', () => {
  players(2);
  const g = leafPile.create(2);
  g.pile = PILE_FULL - 1; g.leaves = []; g._leaf(true); Object.assign(g.leaves[0], { x: PILE.x, y: PILE.y, who: 1 }); g.fallT = 99;
  g.step(DT, W, H);
  assert.ok(g.ready > 0, 'ready to jump in');
  for (let t = 0; t < JUMP_WAIT + 0.5; t += DT) g.step(DT, W, H);
  assert.equal(g.ready, 0); assert.equal(g.piles, 1); assert.equal(g.pile, 0);
  assert.equal(g.need, PILE_FULL + PILE_MORE, 'the next pile is a bit bigger');
  assert.ok(g.leaves.some(L => L.air), 'leaves fly up and come back down');
});
