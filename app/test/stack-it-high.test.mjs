import test from 'node:test';
import assert from 'node:assert/strict';
import { pose, PLAYER_COLORS } from '../src/tracking/pose.js';
import stackItHigh, { TOWER, TOWER_FULL, MIN_TOWER, BLOCK, HAND_OVER, towerHeight } from '../src/games/stack-it-high.js';

const DT = 1 / 30, W = 1920, H = 1080;
/* n players, standing at x = 0.25 and 0.75 (or in the middle when alone), hands out of the way */
function players(n){
  pose.mouse.active = false;
  pose.players.forEach((p, i) => {
    p.present = i < n; p.lm = null;
    p.centre = { x: n === 1 ? 0.5 : 0.25 + i * 0.5, y: 0.55 }; p.scale = 0.3;
    p.hands.left = { x: 0.05, y: 0.05, vx: 0, vy: 0, speed: 0 }; p.hands.right = { x: 0.95, y: 0.05, vx: 0, vy: 0, speed: 0 };
  });
}
const hand = (i) => pose.players[i].hands.right;
/* a block of player `who` waiting at (x, y), nobody near */
function blockAt(g, who, x, y){ const b = g._spawn(who); Object.assign(b, { x, y, vy: 0, settle: y }); return b; }
/* a game a moment in, so the players' reach and towers are known */
function start(n){ players(n); const g = stackItHigh.create(n); for (let k = 0; k < 3; k++) g.step(DT, W, H); for (const l of g.lanes) l.spawnT = 99; g.blocks = []; return g; }

test('a hand touching its own block picks it up and carries it', () => {
  const g = start(1);
  const b = blockAt(g, 0, 0.2, 0.4);
  Object.assign(hand(0), { x: 0.2, y: 0.42 });
  g.step(DT, W, H);
  assert.ok(b.held, 'held');
  Object.assign(hand(0), { x: 0.3, y: 0.5 });
  for (let k = 0; k < 20; k++) g.step(DT, W, H);
  assert.ok(Math.abs(b.x - 0.3) < 0.02, 'it follows the hand');
});

test('every block is its builder\'s colour, and only its builder can pick it up', () => {
  const g = start(2);
  const a = blockAt(g, 0, 0.5, 0.4), b = blockAt(g, 1, 0.5, 0.4);
  assert.equal(a.col, PLAYER_COLORS[0]); assert.equal(b.col, PLAYER_COLORS[1]);
  assert.notEqual(a.col, b.col);
  /* player 2's hand on player 1's block (and on its own: only the second is taken) */
  Object.assign(hand(1), { x: 0.5, y: 0.4 });
  g.step(DT, W, H);
  assert.ok(!a.held, 'not player 1\'s block to take');
  assert.ok(b.held && b.held.who === 1, 'their own is');
  /* and the other way: player 1's hand takes theirs, though both are there */
  Object.assign(hand(0), { x: 0.5, y: 0.4 });
  g.step(DT, W, H);
  assert.ok(a.held && a.held.who === 0);
});

test('carried over its own tower, a block goes on - for whoever carried it, and on nobody else\'s', () => {
  const g = start(2);
  const x0 = g.towerX(0), x1 = g.towerX(1);
  assert.ok(Math.abs(x0 - x1) >= 0.11, 'two towers, with room between');
  const b = blockAt(g, 1, x1 - 0.05, 0.5);
  Object.assign(hand(1), { x: x1 - 0.05, y: 0.5 });
  g.step(DT, W, H);
  /* over the other player's tower: nothing */
  Object.assign(hand(1), { x: x0, y: TOWER.base - BLOCK * 1.2 });
  for (let k = 0; k < 30; k++) g.step(DT, W, H);
  assert.equal(g.lanes[0].tower.length, 0); assert.equal(g.lanes[1].tower.length, 0); assert.ok(b.held, 'still carried');
  /* over their own */
  Object.assign(hand(1), { x: x1 + 0.03, y: TOWER.base - BLOCK * 1.2 });
  for (let k = 0; k < 30; k++) g.step(DT, W, H);
  assert.equal(g.lanes[1].tower.length, 1); assert.equal(g.score[1], 1); assert.equal(g.score[0], 0);
  assert.equal(g.lanes[1].tower[0].col, PLAYER_COLORS[1], 'the tower is its builder\'s colour');
});

test('new blocks come down in their player\'s part of the picture, and wait where that player can reach', () => {
  players(2);
  const g = stackItHigh.create(2);
  for (let t = 0; t < 10; t += DT) g.step(DT, W, H);
  for (const i of [0, 1]){
    const mine = g.blocks.filter(b => b.owner === i);
    assert.ok(mine.length >= 1, `player ${i + 1} has blocks`);
    assert.ok(mine.length <= 2, 'a couple at a time');
    for (const b of mine){
      assert.equal(b.col, PLAYER_COLORS[i]);
      assert.ok(Math.abs(b.x - g.towerX(i)) < 0.12, `beside their tower: ${b.x} vs ${g.towerX(i)}`);
      const r = g.reach[i];
      assert.ok(b.settle >= r.top - 1e-9 && b.settle <= r.bottom, `waits inside the reach band ${r.top.toFixed(2)}-${r.bottom.toFixed(2)}: ${b.settle}`);
    }
  }
  /* uncaught, a block hangs there (it doesn't go to the grass), and goes with a player who has left */
  const b = g.blocks.find(x => x.owner === 0);
  for (let t = 0; t < 20; t += DT) g.step(DT, W, H);
  assert.ok(g.blocks.includes(b) && b.y < TOWER.base - BLOCK * 2, 'still hanging in the air');
  pose.players[0].present = false;
  for (let t = 0; t < 9; t += DT) g.step(DT, W, H);
  assert.ok(!g.blocks.some(x => x.owner === 0), 'gone with its player');
});

test('a tower is as tall as its builder reaches: the last block is always where a hand can get without a hop', () => {
  assert.equal(towerHeight({ top: 0.1 }), TOWER_FULL, 'a tall player builds the full tower');
  assert.ok(towerHeight({ top: 0.5 }) < TOWER_FULL, 'a child builds a shorter one');
  assert.ok(towerHeight({ top: 0.9 }) >= MIN_TOWER, 'but never a stub');
  let last = TOWER_FULL;
  for (let top = 0.1; top <= 0.6; top += 0.02){
    const n = towerHeight({ top }), under = TOWER.base - (n - 1) * BLOCK;     /* the top of the blocks the last one goes on */
    assert.ok(n <= last, 'the lower the reach, the shorter the tower'); last = n;
    assert.ok(under + HAND_OVER >= top, `top ${top.toFixed(2)}: ${n} blocks, hand needs ${(under + HAND_OVER).toFixed(3)}`);
  }
  /* in the game: each tower's height follows its player's reach */
  players(2);
  const lo = pose.players[1];
  lo.lm = null; lo.centre = { x: 0.75, y: 0.8 }; lo.scale = 0.2;           /* a smaller body, lower in the picture */
  const g = stackItHigh.create(2);
  for (let k = 0; k < 90; k++) g.step(DT, W, H);
  assert.ok(g.lanes[1].full < g.lanes[0].full, `the short one's tower is shorter: ${g.lanes[1].full} vs ${g.lanes[0].full}`);
});

test('a full tower blasts off as a rocket, and a new one starts', () => {
  const g = start(1);
  const full = g.lanes[0].full;
  for (let n = 0; n < full; n++){
    blockAt(g, 0, 0.2, 0.4);
    Object.assign(hand(0), { x: 0.2, y: 0.4 }); g.step(DT, W, H);
    Object.assign(hand(0), { x: g.towerX(0), y: 0.1 }); for (let k = 0; k < 20; k++) g.step(DT, W, H);
    Object.assign(hand(0), { x: 0.95, y: 0.05 });
  }
  assert.equal(g.towers, 1); assert.ok(g.lanes[0].rocket); assert.equal(g.lanes[0].tower.length, 0);
  for (let t = 0; t < 8; t += DT) g.step(DT, W, H);
  assert.equal(g.lanes[0].rocket, null, 'gone into the sky');
});

test('a block dropped when its hand goes waits for its player again', () => {
  const g = start(1);
  const b = blockAt(g, 0, 0.2, 0.4);
  Object.assign(hand(0), { x: 0.2, y: 0.4 }); g.step(DT, W, H);
  assert.ok(b.held);
  pose.players[0].present = false; g.step(DT, W, H);
  assert.equal(b.held, null, 'dropped');
  pose.players[0].present = true;
  Object.assign(hand(0), { x: 0.2, y: 0.9 });
  for (let k = 0; k < 60; k++) g.step(DT, W, H);
  assert.ok(b.y < TOWER.base - BLOCK, 'it settled in the air, not the grass');
});
