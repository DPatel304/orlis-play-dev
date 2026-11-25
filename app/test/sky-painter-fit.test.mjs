/* Sky Painter after the playtest (docs/playtest/REPORT.md): the paper fits who's playing, a stalled picture is helped along (slowly, and only after a real start), the move card's
   corner is not paper, and a child sees pictures and stars, not "bits of sky". */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import skyPainter, { ALIVE, GRID, STALL, STARTED, HELPED, reachTop } from '../src/games/sky-painter.js';
import { hudZones } from '../src/games/hud.js';

const DT = 1 / 30, W = 1920, H = 1080;
function players(n){
  pose.mouse.active = false;
  pose.players.forEach((p, i) => {
    p.present = i < n; p.lm = null;
    p.hands.left = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 };
  });
}
/* a body whose shoulders are at shY and hips `torso` lower (the landmarks as the tracker gives them) */
function body(i, shY, torso, x = 0.5){
  const p = pose.players[i], lm = Array.from({ length: 33 }, () => ({ x, y: 0.5, v: 1 }));
  Object.assign(lm[11], { x: x - 0.05, y: shY }); Object.assign(lm[12], { x: x + 0.05, y: shY });
  Object.assign(lm[23], { x: x - 0.04, y: shY + torso }); Object.assign(lm[24], { x: x + 0.04, y: shY + torso });
  p.present = true; p.lm = lm;
  p.hands.left = { x: x - 0.1, y: shY + torso, vx: 0, vy: 0, speed: 0 }; p.hands.right = { x: x + 0.1, y: shY + torso, vx: 0, vy: 0, speed: 0 };
}
/* player i's hands scrub the screen row by row, again and again, until the picture is alive */
function paintAll(g, i, rows = 10, rounds = 40){
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
/* a good scrub of a patch of the paper: back and forth over it, `n` times (or until this much of the paper is clear) */
function scrubPatch(g, x0, x1, y0, y1, n, upTo = 1){
  const h = pose.players[0].hands;
  for (let r = 0; r < n; r++) for (let row = 0; row < 5; row++) for (let k = 0; k <= 30; k++){
    const f = (r + row) % 2 ? 1 - k / 30 : k / 30;
    h.right = { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * row / 4, vx: 1, vy: 0, speed: 1 }; h.left = { x: 0.5, y: 0.95, vx: 0, vy: 0, speed: 0 }; g.step(DT, W, H);
    if (g.covered >= upTo || g.alive) return;
  }
}

test('the paper is fitted to the shortest player: its top is the highest they can reach', () => {
  players(2);
  body(0, 0.25, 0.25);        /* a grown-up: reaches the top of the screen */
  body(1, 0.62, 0.15, 0.3);   /* a child: shoulders at 0.62, an arm (about a torso) above them */
  const g = skyPainter.create(2);
  g.which = 1;                /* (the hot-air balloon: tall) */
  g.step(DT, W, H);
  assert.ok(Math.abs(g.top - 0.47) < 0.05, 'the top is about 0.47: ' + g.top);
  assert.ok(reachTop(pose.players[1]) > reachTop(pose.players[0]), 'the child reaches less high');
  const [gx, gy] = GRID;
  for (let c = 0; c < gx * gy; c++) if (((c / gx) | 0) / gy < g.top - 0.001) assert.ok(g.out[c], 'above the paper is already sky');
  assert.ok(g.live < gx * gy * 0.6 && g.live > gx * gy * 0.3, 'about half the screen is paper: ' + g.live);
  assert.ok(g.fit.s < H / 900, 'the picture is scaled down to sit on the paper');
  assert.ok(g.fit.y > g.top * H, 'and sits below its top');
});

test('with someone tall alone, the paper is (nearly) the whole sky and the picture is full size', () => {
  players(1); body(0, 0.2, 0.25);
  const g = skyPainter.create(1); g.step(DT, W, H);
  assert.ok(g.top <= 0.06, 'top ' + g.top);
  assert.ok(Math.abs(g.fit.s - H / 900) < 1e-9);
});

test('a hop or a stoop is a moment, not the reach: the paper does not jump about', () => {
  players(1); body(0, 0.62, 0.15);
  const g = skyPainter.create(1);
  for (let k = 0; k < 60; k++) g.step(DT, W, H);
  const top = g.top;
  body(0, 0.8, 0.15);                                   /* a stoop to paint low, for half a second */
  for (let k = 0; k < 15; k++) g.step(DT, W, H);
  assert.ok(Math.abs(g.top - top) < 0.12, `the top moved from ${top} to ${g.top}`);
});

test('a child alone finishes a picture by reaching only what they can reach', () => {
  players(1); body(0, 0.62, 0.15);
  const g = skyPainter.create(1);
  const h = pose.players[0].hands;
  for (let r = 0; r < 2000 && !g.alive; r++){
    const y = 0.47 + ((r * 0.047) % 0.5);                 /* back and forth, never above the child's reach */
    for (let k = 0; k <= 40; k++){ h.right = { x: r % 2 ? 1 - k / 40 : k / 40, y, vx: 1, vy: 0, speed: 1 }; h.left = { x: 0.5, y: 0.9, vx: 0, vy: 0, speed: 0 }; g.step(DT, W, H); if (g.alive) break; }
  }
  assert.ok(g.alive > 0 && g.done === 1, 'the picture finishes with hands only below 0.47');
  assert.equal(g.spreadN, 0, 'without any help from the spreading');
});

test('the move card does not cover paper: its corner is already sky', () => {
  players(1);
  const g = skyPainter.create(1); g.step(DT, W, H);
  const card = hudZones(W, H).card, [gx, gy] = GRID;
  const at = (fx, fy) => Math.floor((card.y + card.h * fy) / H * gy) * gx + Math.floor((card.x + card.w * fx) / W * gx);
  assert.ok(g.out[at(0.5, 0.5)], 'the middle of the move card is not paper');
  assert.ok(g.out[at(0.9, 0.9)], 'nor its far corner');
  assert.ok(g.live < gx * gy && g.live > gx * gy * 0.85, 'a small corner, no more');
});

test('a picture nobody is adding to is helped along after STALL seconds, from what is clear, and finishes', () => {
  players(1);
  const g = skyPainter.create(1);
  const h = pose.players[0].hands;
  scrubPatch(g, 0.05, 0.6, 0.1, 0.9, 400, STARTED + 0.05);
  assert.ok(g.covered >= STARTED && g.covered < 0.5, 'a real start: ' + g.covered);
  h.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 }; h.left = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 };
  g.step(DT, W, H);
  const hand = g.score[0];
  for (let t = 0; t < STALL - 1; t += DT) g.step(DT, W, H);
  assert.equal(g.spreadN, 0, 'not yet: ' + g.spreadN);
  for (let t = 0; t < 12; t += DT) g.step(DT, W, H);
  assert.ok(g.spreadN > 0, 'the spreading has started');
  for (let t = 0; t < 150 && !g.alive; t += DT) g.step(DT, W, H);
  assert.ok(g.alive > 0, 'a picture always finishes');
  assert.equal(g.score[0], hand, 'the spread is nobody’s: no hand score from it');
});

test('the spreading is slow: a stuck picture takes a good while longer than the stall itself', () => {
  players(1);
  const g = skyPainter.create(1);
  const h = pose.players[0].hands;
  scrubPatch(g, 0.05, 0.4, 0.1, 0.9, 400, STARTED + 0.05);
  assert.ok(g.covered >= STARTED, 'a start: ' + g.covered);
  h.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 };
  let t = 0;
  while (!g.alive && t < 300){ g.step(DT, W, H); t += DT; }
  assert.ok(g.alive > 0 && t > STALL + 10, 'finished after ' + t.toFixed(0) + ' s');
});

test('a hand resting on one spot does not get a whole picture done for it', () => {
  players(1);
  const g = skyPainter.create(1);
  for (let t = 0; t < STALL * 3; t += DT) g.step(DT, W, H);
  assert.equal(g.painted, 0);
  assert.equal(g.spreadN, 0);
  assert.equal(g.done, 0);
  players(0);
  const e = skyPainter.create(2);
  for (let t = 0; t < STALL * 3; t += DT) e.step(DT, W, H);
  assert.equal(e.painted, 0, 'and an empty room wears nothing');
});

test('a hand wearing through new paper holds the spreading back; one going over the same bit does not', () => {
  players(1);
  const g = skyPainter.create(1);
  const h = pose.players[0].hands;
  scrubPatch(g, 0.05, 0.5, 0.1, 0.9, 400, STARTED + 0.05);       /* a real start */
  assert.ok(g.covered >= STARTED);
  /* keep scrubbing fresh paper, a patch at a time: it never stalls for STALL seconds */
  for (let n = 0; n < 3; n++) scrubPatch(g, 0.5 + n * 0.15, 0.65 + n * 0.15, 0.1, 0.9, 3, 0.6);
  assert.ok(!g.alive, 'not finished yet: ' + g.covered);
  assert.equal(g.spreadN, 0, 'still wearing new bits: no help needed');
  for (let t = 0; t < STALL + 5; t += DT){ h.right = { x: 0.2 + Math.sin(t * 9) * 0.00002, y: 0.5, vx: 0, vy: 0, speed: 0 }; g.step(DT, W, H); }
  assert.ok(g.spreadN > 0, 'jiggling on one spot is not scrubbing');
});

test('what a child sees: pictures finished and a star for each one you helped with (no "bits of sky")', () => {
  players(2);
  const g = skyPainter.create(2);
  pose.players[1].present = true;
  paintAll(g, 0); for (let t = 0; t < ALIVE + 0.5; t += DT) g.step(DT, W, H);
  assert.equal(g.done, 1);
  assert.equal(g.stars[0], 1, 'the painter has a star');
  assert.equal(g.stars[1], 0, 'someone who only stood there wore less than ' + HELPED + ' bits and has none');
  assert.deepEqual(g.tally().map(r => r.value), [1, 0]);
  assert.match(g.summary(2), /^Together you finished 1 picture!/);
  assert.match(g.summary(1), /^You finished 1 picture!/);
  assert.doesNotMatch(JSON.stringify([skyPainter.unit, skyPainter.done, g.summary(1), g.hud()]), /bits? of sky/);
  assert.deepEqual(skyPainter.done, ['stars', 'earned']);
  assert.equal(g.hud().badge.value, 1, 'and the pictures so far are on screen');
  assert.equal(g.winner(), -1, 'nobody beats anybody');
  assert.match(skyPainter.create(1).summary(1), /scrubbing/);
});
