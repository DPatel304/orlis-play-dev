import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import skyPainter, { DONE, ALIVE, GRID, PICTURES } from '../src/games/sky-painter.js';

const DT = 1 / 30, W = 1920, H = 1080;
function players(n){
  pose.mouse.active = false;
  pose.players.forEach((p, i) => {
    p.present = i < n; p.lm = null;
    p.hands.left = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 };
  });
}
/* player i's hands sweep row by row across the screen */
function paintAll(g, i, rows = 10){
  const h = pose.players[i].hands;
  for (let r = 0; r <= rows; r++){
    const y = r / rows;
    for (let k = 0; k <= 40; k++){
      const x = r % 2 ? 1 - k / 40 : k / 40;
      h.right = { x, y, vx: 1, vy: 0, speed: 1 }; h.left = { x, y: Math.min(1, y + 0.05), vx: 1, vy: 0, speed: 1 };
      g.step(DT, W, H);
      if (g.alive) return;
    }
  }
}

test('a hand moving across the sky paints it, and counts for that player', () => {
  players(2);
  const g = skyPainter.create(2);
  const h = pose.players[1].hands.right;
  for (let k = 0; k <= 20; k++){ h.x = 0.1 + k * 0.04; h.y = 0.3; g.step(DT, W, H); }
  assert.ok(g.covered > 0.02 && g.covered < 0.5);
  assert.ok(g.score[1] > 0);
  assert.equal(g.painted, g.score[0] + g.score[1], 'every painted bit is someone’s');
});

test('painting most of the sky brings the picture alive, then fresh paper and the next picture', () => {
  players(1);
  const g = skyPainter.create(1);
  paintAll(g, 0);
  assert.ok(g.alive > 0, 'alive'); assert.equal(g.done, 1);
  assert.ok(g.covered >= DONE);
  for (let t = 0; t < ALIVE + 0.5; t += DT) g.step(DT, W, H);
  assert.equal(g.alive, 0); assert.ok(g.covered < 0.05, 'fresh paper (bar the spot under the hands)');
  assert.equal(g.which, 1 % PICTURES.length);
});

test('a hand resting in one place paints one round spot, not more', () => {
  players(1);
  const g = skyPainter.create(1);
  for (let k = 0; k < 60; k++) g.step(DT, W, H);
  const once = g.painted;
  assert.ok(once > 0 && once < GRID[0] * GRID[1] * 0.05);
});
