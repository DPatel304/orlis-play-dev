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
/* player i's hands scrub the screen row by row, again and again, until the picture is alive (a cover takes many passes) */
function scrubAll(g, i, rows = 10, rounds = 40){
  const h = pose.players[i].hands;
  for (let n = 0; n < rounds; n++) for (let r = 0; r <= rows; r++){
    const y = r / rows;
    for (let k = 0; k <= 40; k++){
      const x = r % 2 ? 1 - k / 40 : k / 40;
      h.right = { x, y, vx: 1, vy: 0, speed: 1 }; h.left = { x, y: Math.min(1, y + 0.05), vx: 1, vy: 0, speed: 1 };
      g.step(DT, W, H);
      if (g.alive) return;
    }
  }
}

test('a hand moving across the sky wears it, and counts for that player', () => {
  players(2);
  const g = skyPainter.create(2);
  const h = pose.players[1].hands.right;
  for (let k = 0; k <= 20; k++){ h.x = 0.1 + k * 0.04; h.y = 0.3; g.step(DT, W, H); }
  const worn = g.wear.reduce((a, b, i) => a + (g.out[i] ? 0 : b), 0);
  assert.ok(worn > 1, 'something is worn: ' + worn);
  assert.ok(g.mine[1] > 0 && g.mine[0] === 0);
  assert.equal(g.painted, 0, 'but one sweep does not take a whole cover off a spot');
});

test('scrubbing the sky through brings the picture alive, then fresh paper, a new cover and the next picture', () => {
  players(1);
  const g = skyPainter.create(1);
  const first = g.cover.id;
  scrubAll(g, 0);
  assert.ok(g.alive > 0, 'alive'); assert.equal(g.done, 1);
  assert.ok(g.covered >= DONE);
  assert.equal(g.painted, g.score[0], 'every cleared bit is someone’s');
  for (let t = 0; t < ALIVE + 0.5; t += DT) g.step(DT, W, H);
  assert.equal(g.alive, 0); assert.ok(g.covered < 0.05, 'fresh paper (bar the spot under the hands)');
  assert.equal(g.which, 1 % PICTURES.length);
  assert.notEqual(g.cover.id, first, 'and a different cover');
});

test('a hand resting in one place wears nothing: scrubbing is travelling, not standing', () => {
  players(1);
  const g = skyPainter.create(1);
  for (let k = 0; k < 120; k++) g.step(DT, W, H);
  assert.equal(g.painted, 0);
  assert.ok(g.wear.every((w, i) => g.out[i] || w < 0.05), 'next to nothing');
});

test('wearing is by how far a hand travels: twice the way, twice the wear (and a hand too fast to follow counts for no more)', () => {
  const run = (len, frames = 30) => {
    players(1);
    const g = skyPainter.create(1), h = pose.players[0].hands.right;
    for (let k = 0; k <= frames; k++){ h.x = 0.1 + len * k / frames; h.y = 0.5; g.step(DT, W, H); }
    return g.wear.reduce((a, b, i) => a + (g.out[i] ? 0 : b), 0);
  };
  const a = run(0.2), b = run(0.4);
  assert.ok(b / a > 1.8 && b / a < 2.2, `twice as far: ${(b / a).toFixed(2)} times`);
  assert.ok(run(0.8, 6) < run(0.8, 30) * 0.9, 'a mad dash across in a fifth of a second is not worth more than a good scrub');
});
