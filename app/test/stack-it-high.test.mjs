import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import stackItHigh, { TOWER, TOWER_FULL, BLOCK } from '../src/games/stack-it-high.js';

const DT = 1 / 30, W = 1920, H = 1080;
function players(n){
  pose.mouse.active = false;
  pose.players.forEach((p, i) => {
    p.present = i < n; p.lm = null;
    p.hands.left = { x: 0.05, y: 0.05, vx: 0, vy: 0, speed: 0 }; p.hands.right = { x: 0.95, y: 0.05, vx: 0, vy: 0, speed: 0 };
  });
}
const hand = (i) => pose.players[i].hands.right;
/* a block floating at (x, y), nobody near */
function blockAt(g, x, y){ g._spawn(); const b = g.blocks[g.blocks.length - 1]; Object.assign(b, { x, y, vy: 0 }); return b; }

test('a hand touching a block picks it up and carries it', () => {
  players(1);
  const g = stackItHigh.create(1); g.spawnT = 99;
  const b = blockAt(g, 0.2, 0.4);
  Object.assign(hand(0), { x: 0.2, y: 0.42 });
  g.step(DT, W, H);
  assert.ok(b.held, 'held');
  Object.assign(hand(0), { x: 0.3, y: 0.5 });
  for (let k = 0; k < 20; k++) g.step(DT, W, H);
  assert.ok(Math.abs(b.x - 0.3) < 0.02, 'it follows the hand');
});

test('carried over the tower, it goes on - for whoever carried it', () => {
  players(2);
  const g = stackItHigh.create(2); g.spawnT = 99;
  const b = blockAt(g, 0.25, 0.5);
  Object.assign(hand(1), { x: 0.25, y: 0.5 });
  g.step(DT, W, H);
  Object.assign(hand(1), { x: TOWER.x + 0.03, y: TOWER.base - BLOCK * 1.2 });
  for (let k = 0; k < 30; k++) g.step(DT, W, H);
  assert.equal(g.tower.length, 1); assert.equal(g.score[1], 1); assert.equal(g.score[0], 0);
});

test('a full tower blasts off as a rocket, and a new one starts', () => {
  players(1);
  const g = stackItHigh.create(1); g.spawnT = 99;
  for (let n = 0; n < TOWER_FULL; n++){
    const b = blockAt(g, 0.2, 0.4);
    Object.assign(hand(0), { x: 0.2, y: 0.4 }); g.step(DT, W, H);
    Object.assign(hand(0), { x: TOWER.x, y: 0.1 }); for (let k = 0; k < 20; k++) g.step(DT, W, H);
    Object.assign(hand(0), { x: 0.95, y: 0.05 });
  }
  assert.equal(g.towers, 1); assert.ok(g.rocket); assert.equal(g.tower.length, 0);
  for (let t = 0; t < 8; t += DT) g.step(DT, W, H);
  assert.equal(g.rocket, null, 'gone into the sky');
});

test('a block nobody catches lands in the grass, and can be picked up there', () => {
  players(1);
  const g = stackItHigh.create(1); g.spawnT = 99;
  const b = blockAt(g, 0.2, 0.8); b.vy = 0.2;
  for (let k = 0; k < 60; k++) g.step(DT, W, H);
  assert.ok(b.grass > 0);
  Object.assign(hand(0), { x: b.x, y: b.y }); g.step(DT, W, H);
  assert.ok(b.held);
});
