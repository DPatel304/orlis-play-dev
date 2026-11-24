import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import leafPile, { bandOf, BAND, ROUND, PILE, GROW, BIG, SWEEP_END, FINALE, JUMP_WAIT, SWEEP_SPEED, SWEEP_GAP, MAX_SLIDE } from '../src/games/leaf-pile.js';

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

test('the pile grows a little with every leaf, steadily, and keeps growing - and there is no jumping in before the end', () => {
  players(1);
  const g = leafPile.create(1);
  g.fallT = 99;
  let last = g._k();
  for (let n = 1; n <= BIG * 2; n++){
    g.leaves = []; g._leaf(true); Object.assign(g.leaves[0], { x: PILE.x, y: PILE.y, who: 0 }); g.fallT = 99;
    g.step(DT, W, H);
    assert.equal(g.ready, 0, 'no jump-in while sweeping (pile ' + g.pile + ')');
    const k = g._k();
    assert.ok(k > last && k - last < 0.03, 'steady: a leaf adds only a little (' + (k - last) + ')');
    last = k;
  }
  assert.ok(g.pile >= BIG * 2 - 2, 'it kept taking leaves: ' + g.pile);
  assert.ok(g._k() > 0.9, 'and it got really big');
  assert.ok(g._k() < 1, 'never quite full');
  assert.ok(GROW >= 40, 'slow: it takes a lot of leaves');
});

test('at the end of the sweeping it is "Jump in!", and the whole pile bursts by itself if nobody jumps - then it ends', () => {
  players(2);
  const g = leafPile.create(2);
  g.pile = 80; g.fallT = 99;
  g.t = SWEEP_END - 0.1;
  g.step(DT, W, H); g.step(DT, W, H); g.step(DT, W, H);
  assert.ok(g.ready > 0, 'ready to jump in at the end');
  assert.equal(g.piles, 0, 'not burst yet');
  for (let t = 0; t < JUMP_WAIT + 0.5; t += DT) g.step(DT, W, H);
  assert.equal(g.ready, 0); assert.equal(g.piles, 1); assert.equal(g.pile, 0); assert.equal(g.peak, 80);
  assert.ok(g.leaves.some(L => L.air), 'leaves fly up and come back down');
  assert.ok(!g.over, 'the leaves are still coming down');
  for (let t = 0; t < FINALE + 0.5; t += DT) g.step(DT, W, H);
  assert.ok(g.over, 'then it is over');
});

test('one child alone only has to jump once, and the pile bursts the moment they do', () => {
  players(1);
  const g = leafPile.create(1);
  g.pile = 30; g.fallT = 99; g.t = SWEEP_END;
  g.step(DT, W, H);
  assert.ok(g.ready > 0);
  const h = pose.players[0];
  /* (a jump: the body rises fast above where it has been standing) */
  for (let k = 0; k < 20; k++){ h.centre = { x: 0.3, y: 0.5 }; g.step(DT, W, H); }
  for (let k = 0; k < 6; k++){ h.centre = { x: 0.3, y: 0.5 - 0.06 * (k + 1) }; g.step(DT, W, H); }
  assert.ok(g.piles === 1 || g.ready > 0, 'jumped in (or waiting on the last frames)');
});

test('a sweep is one gentle push: capped speed, once per sweep, only the way in, along the ground', () => {
  players(1);
  /* however fast the hand, the leaf never leaves faster than MAX_SLIDE */
  let g = leafPile.create(1);
  g.leaves = []; g._leaf(true, 0.3, 0.86); g.fallT = 99;
  let L = g.leaves[0];
  const h = pose.players[0].hands.right;
  Object.assign(h, { x: L.x, y: L.y, vx: 6, vy: -4, speed: 6 });
  g.step(DT, W, H);
  assert.ok(Math.hypot(L.vx, L.vy) <= MAX_SLIDE + 1e-9, 'capped: ' + Math.hypot(L.vx, L.vy));
  assert.ok(!L.air, 'it slides, it does not fly up');
  /* the hand stays over it: no second push for a while */
  const first = L.vx;
  Object.assign(h, { x: L.x, y: L.y, vx: 6, vy: 0, speed: 6 });
  g.step(DT, W, H);
  assert.ok(L.vx <= first, 'not pushed again at once');
  assert.ok(SWEEP_GAP > DT * 3);
  /* sweeping the wrong way (away from the pile) does nothing */
  g = leafPile.create(1);
  g.leaves = []; g._leaf(true, 0.3, 0.86); g.fallT = 99;
  L = g.leaves[0];
  Object.assign(pose.players[0].hands.right, { x: L.x, y: L.y, vx: -1.5, vy: 0, speed: 1.5 });
  g.step(DT, W, H);
  assert.equal(L.vx, 0, 'the way out does nothing');
  /* a push that is off to one side is bent toward the pile */
  g = leafPile.create(1);
  g.leaves = []; g._leaf(true, 0.3, 0.72); g.fallT = 99;
  L = g.leaves[0];
  Object.assign(pose.players[0].hands.right, { x: L.x, y: L.y, vx: 1, vy: 0, speed: 1 });
  g.step(DT, W, H);
  assert.ok(L.vy > 0, 'nudged down toward the pile, which is lower than the leaf');
});

test('the sweeping lasts most of the game, and the jump-in and the finale fill the rest: the round is exactly ROUND long', () => {
  assert.ok(SWEEP_END > 150);
  assert.equal(SWEEP_END + JUMP_WAIT + FINALE, ROUND);
  assert.equal(ROUND, 180);
});

test('the round runs its full length, however soon everyone jumped', () => {
  players(1);
  const g = leafPile.create(1);
  g.pile = 30; g.fallT = 99; g.t = SWEEP_END;
  g.step(DT, W, H);
  assert.ok(g.ready > 0);
  /* (a jump: the body rises fast above where it has been standing) */
  const h = pose.players[0];
  for (let k = 0; k < 20; k++){ h.centre = { x: 0.3, y: 0.5 }; g.step(DT, W, H); }
  for (let k = 0; k < 6; k++){ h.centre = { x: 0.3, y: 0.5 - 0.06 * (k + 1) }; g.step(DT, W, H); }
  for (let k = 0; k < 6; k++){ h.centre = { x: 0.3, y: 0.5 }; g.step(DT, W, H); }
  let t = g.t;
  while (t < ROUND - 0.1 && !g.over){ g.step(DT, W, H); t = g.t; }
  assert.equal(g.over, false, 'still going just before ROUND (burst: ' + g.piles + ')');
  while (t < ROUND + 0.2){ g.step(DT, W, H); t = g.t; }
  assert.equal(g.over, true);
});

/* a standing body: shoulders at y 0.3, hips at y hip, knees further down; the torso is the hips minus the shoulders */
const standing = (x, hip, torso) => {
  const lm = Array.from({ length: 33 }, () => ({ x, y: 0.5, v: 1 }));
  Object.assign(lm[11], { x: x - 0.04, y: hip - torso }); Object.assign(lm[12], { x: x + 0.04, y: hip - torso });
  Object.assign(lm[23], { x: x - 0.03, y: hip }); Object.assign(lm[24], { x: x + 0.03, y: hip });
  return lm;
};

test('each player has their own reach band, from their hips, so a grown-up sweeps higher than a child', () => {
  pose.mouse.active = false;
  const adult = { present: true, lm: standing(0.25, 0.575, 0.25), centre: { x: 0.25, y: 0.45 }, scale: 0.6 };
  const child = { present: true, lm: standing(0.7, 0.77, 0.15), centre: { x: 0.7, y: 0.7 }, scale: 0.36 };
  const a = bandOf(adult), c = bandOf(child);
  assert.ok(a.top < 0.6 && a.bottom < 0.68, 'a grown-up: about hip to upper thigh ' + JSON.stringify(a));
  assert.ok(c.top > 0.7, 'a child: lower ' + JSON.stringify(c));
  assert.ok(a.bottom < c.top, 'and the two bands are different heights');
  assert.ok(a.bottom - a.top > 0.05 && BAND[0] < 0 && BAND[1] > 0);
  assert.equal(bandOf({ present: false }), null);
});

test('leaves land and settle in the reach band of the player they are for', () => {
  pose.mouse.active = false;
  pose.players.forEach((p, i) => { p.present = i < 2; p.lm = null; p.hands.left = { x: 0.1, y: 0.2, vx: 0, vy: 0, speed: 0 }; p.hands.right = { x: 0.9, y: 0.2, vx: 0, vy: 0, speed: 0 }; });
  pose.players[0].lm = standing(0.25, 0.575, 0.25); pose.players[0].centre = { x: 0.25, y: 0.45 }; pose.players[0].scale = 0.6;
  pose.players[1].lm = standing(0.7, 0.77, 0.15); pose.players[1].centre = { x: 0.7, y: 0.7 }; pose.players[1].scale = 0.36;
  const g = leafPile.create(2);
  g.step(DT, W, H);
  const A = bandOf(pose.players[0]), C = bandOf(pose.players[1]);
  g.leaves = [];
  for (let k = 0; k < 40; k++){ g._leaf(true, 0.25, null, 0); g._leaf(true, 0.7, null, 1); }
  for (const L of g.leaves.filter(L => L.own === 0)) assert.ok(L.y >= A.top - 1e-9 && L.y <= A.bottom + 1e-9, 'the grown-up\'s leaf at ' + L.y);
  for (const L of g.leaves.filter(L => L.own === 1)) assert.ok(L.y >= C.top - 1e-9 && L.y <= C.bottom + 1e-9, 'the child\'s leaf at ' + L.y);
  /* falling leaves come to rest there too */
  g.leaves = []; g.fallT = 0; g.step(DT, W, H);
  const fell = g.leaves.find(L => L.air);
  assert.ok(fell, 'one came down');
  const b = fell.own === 0 ? A : C;
  assert.ok(fell.rest >= b.top - 1e-9 && fell.rest <= b.bottom + 1e-9, 'it will lie in the band of the player it came down for');
  /* a leaf lying out of its player's band drifts into it, even a leaf left over from the start of the game */
  g.leaves = []; g.fallT = 99; g._leaf(true, 0.25, 0.86, 0);
  for (let k = 0; k < 30 * 8; k++) g.step(DT, W, H);
  const L0 = g.leaves.find(L => L.own === 0);
  assert.ok(L0 && L0.y <= A.bottom + 0.01, 'it settled up to ' + (L0 && L0.y));
});
