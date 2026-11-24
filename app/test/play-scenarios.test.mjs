/* Every game on Home, played properly - by scripted children who try (chase
   the balloons, hold still in a freeze, sweep the leaves, carry the blocks,
   paint) - alone, together, and with people coming and going the way they
   do in a living room: a second child running in mid-round, one wandering
   off and back, the camera losing someone for a few frames at a time, the
   room emptying, hands flung off the edge of the picture.

   After every frame: nothing in the game is NaN, nobody's score ever goes
   down (nothing in these games takes anything away), and nobody scores
   while they're not there. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pose, L } from '../src/tracking/pose.js';
import { music } from '../src/audio/sound.js';
import popParty from '../src/games/pop-party.js';
import sleepyBear from '../src/games/sleepy-bear.js';
import leafPile, { PILE, SWEEP_END } from '../src/games/leaf-pile.js';
import stackItHigh, { TOWER_FULL } from '../src/games/stack-it-high.js';
import skyPainter from '../src/games/sky-painter.js';

const W = 1920, H = 1080, DT = 1 / 30;
/* The games roll dice (where a balloon rises, when the music stops); each
   test rolls the same ones every run, so a comparison is like for like and
   a failure is a real one, not bad luck. */
let seed = 1;
const realRandom = Math.random;
const reseed = (n) => { seed = n; Math.random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
test.beforeEach((t) => reseed([...t.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)));
test.after(() => { Math.random = realRandom; });
let held = false;
music.hold = (on) => { held = !!on; };

/* ---------- the pretend children ---------- */
/* A child at x: a body (landmarks), its middle and size, and two hands. */
function kid(i, x){
  return { i, x, here: false, hands: { l: { x: x - 0.08, y: 0.6 }, r: { x: x + 0.08, y: 0.6 } }, lift: 0, wiggle: 0 };
}
function body(k){
  const s = 0.3, x = k.x, y0 = 0.55 - k.lift;
  const lm = Array.from({ length: 33 }, () => ({ x, y: y0, v: 0.9 }));
  const at = (n, dx, dy) => { lm[n] = { x: x + dx * s * 0.34 + Math.sin(k.wiggle + n) * 0.01 * (k.wiggle ? 1 : 0), y: y0 + dy * s, v: 0.9 }; };
  at(L.NOSE, 0, -0.45); at(L.L_EYE, 0.04, -0.48); at(L.R_EYE, -0.04, -0.48); at(7, 0.08, -0.46); at(8, -0.08, -0.46);
  at(L.L_SHOULDER, 0.2, -0.25); at(L.R_SHOULDER, -0.2, -0.25); at(L.L_ELBOW, 0.3, -0.05); at(L.R_ELBOW, -0.3, -0.05);
  at(L.L_HIP, 0.13, 0.25); at(L.R_HIP, -0.13, 0.25); at(L.L_KNEE, 0.15, 0.55); at(L.R_KNEE, -0.15, 0.55); at(L.L_ANKLE, 0.15, 0.85); at(L.R_ANKLE, -0.15, 0.85);
  lm[L.L_WRIST] = { x: k.hands.l.x, y: k.hands.l.y, v: 0.9 }; lm[L.R_WRIST] = { x: k.hands.r.x, y: k.hands.r.y, v: 0.9 };
  return lm;
}
/* Put the children into pose, hands with the speeds their movement gives. */
function apply(kids, dt){
  pose.mouse.active = false;
  pose.players.forEach((p, i) => {
    const k = kids[i];
    if (!k || !k.here){ p.present = false; p.lm = null; return; }
    p.present = true; p.lm = body(k); p.centre = { x: k.x, y: 0.55 - k.lift }; p.scale = 0.3;
    for (const [side, key] of [['left', 'l'], ['right', 'r']]){
      const was = p.hands[side] || { x: k.hands[key].x, y: k.hands[key].y }, h = k.hands[key];
      const vx = (h.x - was.x) / dt, vy = (h.y - was.y) / dt;
      p.hands[side] = { x: h.x, y: h.y, vx, vy, speed: Math.hypot(vx, vy) };
    }
  });
  pose.personCount = kids.filter(k => k && k.here).length;
}
const toward = (h, x, y, speed, dt) => { const dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy); if (d < 1e-6) return; const m = Math.min(d, speed * dt); h.x += dx / d * m; h.y += dy / d * m; };

/* How each game is played well: move the kid's hands (and body) for a frame. */
const PLAY = {
  'pop-party'(g, k, t, dt){
    const mine = (g.balloons || []).filter(b => (k.i ? b.x > 0.45 : b.x < 0.55) && b.y > 0.1 && b.y < 0.95);
    const b = mine.sort((a, c) => a.y - c.y)[0];
    if (b){ toward(k.hands.r, b.x, b.y, 1.6, dt); toward(k.hands.l, b.x - 0.05, b.y + 0.05, 1.6, dt); }
    else { toward(k.hands.r, k.x + 0.1, 0.5, 0.8, dt); toward(k.hands.l, k.x - 0.1, 0.5, 0.8, dt); }
  },
  'sleepy-bear'(g, k, t, dt){
    if (g.phase === 'freeze'){ k.wiggle = 0; return; }       /* hold still */
    k.wiggle = t * 8;
    k.hands.r.x = k.x + 0.12 + Math.sin(t * 6 + k.i) * 0.08; k.hands.r.y = 0.35 + Math.cos(t * 5) * 0.1;
    k.hands.l.x = k.x - 0.12 + Math.sin(t * 6 + 1) * 0.08; k.hands.l.y = 0.35 + Math.sin(t * 5) * 0.1;
  },
  'leaf-pile'(g, k, t, dt){
    if (g.ready){ k.lift = (Math.sin(t * 8) > 0.6) ? 0.12 : 0; return; }   /* jump in! */
    k.lift = 0;
    /* sweep low, from the outside in toward the pile, and back out */
    const side = k.i ? 1 : -1, ph = (t * 0.7 + k.i * 0.3) % 1, inward = ph < 0.5;
    const x = PILE.x + side * (inward ? 0.42 - ph * 0.7 : 0.07 + (ph - 0.5) * 0.7);
    k.hands.r.x = x; k.hands.r.y = 0.86 + Math.sin(t * 3) * 0.05; k.hands.l.x = x - side * 0.04; k.hands.l.y = 0.8;
  },
  'stack-it-high'(g, k, t, dt){
    /* (each child has their own blocks and tower) */
    const key = k.i + 'r', mine = g.blocks.find(b => b.held && b.held.key === key);
    if (mine) toward(k.hands.r, g.towerX(k.i), g._top(k.i) + 0.09, 1.2, dt);
    else {
      const free = g.blocks.filter(b => !b.held && b.owner === k.i).sort((a, b) => b.y - a.y)[0];
      if (free) toward(k.hands.r, free.x, free.y, 1.2, dt); else toward(k.hands.r, k.x, 0.4, 0.8, dt);
    }
    toward(k.hands.l, k.x - 0.15, 0.7, 0.5, dt);   /* the other hand out of the way */
  },
  'sky-painter'(g, k, t, dt){
    const x = k.x + Math.sin(t * 1.4 + k.i * 1.7) * 0.28, y = 0.47 + Math.sin(t * 0.33 + k.i) * 0.45;
    k.hands.r.x = x; k.hands.r.y = y; k.hands.l.x = x - 0.07; k.hands.l.y = y + 0.1;
  }
};
const GAMES = [popParty, sleepyBear, leafPile, stackItHigh, skyPainter];

/* ---------- the checks ---------- */
function finite(obj, path = 'game', seen = new Set(), depth = 0){
  if (obj == null || depth > 4 || seen.has(obj)) return;
  if (typeof obj === 'number'){ assert.ok(Number.isFinite(obj), `${path} is ${obj}`); return; }
  if (typeof obj !== 'object' || ArrayBuffer.isView(obj)) return;
  seen.add(obj);
  if (obj.getContext || obj.nodeType) return;      /* (canvases) */
  for (const [k, v] of Object.entries(obj)){
    if (['scene', 'avatars', 'j', 'jumps', 'mask', 'bg', 'tmp', 'prev', 'last'].includes(k)) continue;
    finite(v, `${path}.${k}`, seen, depth + 1);
  }
}
/* Play `secs` of a game, calling `script(t)` each frame first (to bring
   people in and out), and checking the rules each frame. */
function play(g, game, kids, secs, script = () => {}, opts = {}){
  const start = g.t || 0;
  for (let s = 0; s < secs; s += DT){
    script(s);
    for (const k of kids) if (k.here) PLAY[game.id](g, k, start + s, DT);
    apply(kids, DT);
    const before = g.score.slice();
    g.step(DT, W, H);
    for (let i = 0; i < 2; i++){
      assert.ok(g.score[i] >= before[i], `${game.id}: player ${i + 1}'s score went down`);
      if (!kids[i].here && !opts.lateCredit) assert.equal(g.score[i], before[i], `${game.id}: player ${i + 1} scored while away`);
    }
  }
  finite(g, game.id);
}
const fresh = (n, game) => { const kids = [kid(0, 0.3), kid(1, 0.7)]; kids.forEach((k, i) => { k.here = i < n; }); apply(kids, DT); return [game.create(2), kids]; };
/* (a pushed leaf, a carried block or a thrown balloon can land after its
   kid has gone - credit for their own sweep, a moment later) */
const LATE = { 'leaf-pile': true, 'pop-party': false, 'stack-it-high': false, 'sleepy-bear': false, 'sky-painter': false };

for (const game of GAMES){
  test(`${game.id}: one player, a whole round - they get somewhere, alone`, () => {
    const [g, kids] = fresh(1, game);
    play(g, game, kids, game.secs + 2);
    assert.ok(g.score[0] > 0, `scored ${g.score[0]}`);
    assert.equal(g.score[1], 0);
    assert.equal(g.tally().length, 1); assert.equal(g.winner(), null);
    assert.ok(g.over || g.t >= game.secs, 'the round ends');
    assert.equal(held, false, 'no music left stopped');
  });

  test(`${game.id}: two players, a whole round - both of them get somewhere`, () => {
    const [g, kids] = fresh(2, game);
    play(g, game, kids, game.secs + 2);
    assert.ok(g.score[0] > 0 && g.score[1] > 0, `scores ${g.score.slice(0, 2)}`);
    assert.equal(g.tally().length, 2);
    assert.ok([-1, 0, 1].includes(g.winner()));
  });

  test(`${game.id}: a second child runs in partway, and joins in`, () => {
    const [g, kids] = fresh(1, game);
    play(g, game, kids, 25);
    assert.equal(g.score[1], 0);
    kids[1].here = true;
    play(g, game, kids, 50);
    assert.ok(g.score[1] > 0, 'the newcomer scores');
    assert.equal(g.tally().length, 2);
  });

  test(`${game.id}: one wanders off and comes back`, () => {
    const [g, kids] = fresh(2, game);
    play(g, game, kids, 25);
    kids[1].here = false;
    const away = g.score[1];
    play(g, game, kids, 20, () => {}, { lateCredit: LATE[game.id] });
    const p0 = g.score[0];
    if (!LATE[game.id]) assert.equal(g.score[1], away, 'nothing while away');
    assert.equal(g.tally().length, 2, 'still in the scores - they played');
    kids[1].here = true;
    play(g, game, kids, 40);
    assert.ok(g.score[1] > away, 'scoring again once back');
    assert.ok(g.score[0] >= p0);
  });

  test(`${game.id}: the camera keeps losing someone for a few frames`, () => {
    reseed(42);
    const [g, kids] = fresh(2, game);
    play(g, game, kids, 10);
    const s1 = g.score[1];
    /* player 2 flickers: here a few frames, gone a few */
    play(g, game, kids, 30, (s) => { kids[1].here = Math.floor(s / DT) % 9 < 5; }, { lateCredit: true });
    kids[1].here = true;
    play(g, game, kids, 5);
    /* (no runaway scoring from jumps between where a hand was and is): the
       same stretch of a round, played steadily, for comparison - generously,
       since balloons and blocks pile up while someone's away */
    reseed(42); const [sg, sk] = fresh(2, game);
    play(sg, game, sk, 10);
    const t0 = sg.score[1];
    play(sg, game, sk, 35);
    const steadyGain = sg.score[1] - t0;
    assert.ok(g.score[1] - s1 <= Math.max(15, steadyGain * 4), `flicker scored ${g.score[1] - s1} vs ${steadyGain} steady`);
  });

  test(`${game.id}: everyone leaves, the room's empty for a while, then they're back`, () => {
    const [g, kids] = fresh(2, game);
    play(g, game, kids, 20);
    const before = g.score.slice(0, 2);
    kids[0].here = kids[1].here = false;
    play(g, game, kids, 15, () => {}, { lateCredit: LATE[game.id] });
    if (!LATE[game.id]) assert.deepEqual(g.score.slice(0, 2), before, 'nothing scored by an empty room');
    kids[0].here = kids[1].here = true;
    play(g, game, kids, 30);
    assert.ok(g.score[0] + g.score[1] > before[0] + before[1], 'carries on once they’re back');
  });

  test(`${game.id}: hands flung off the edges of the picture`, () => {
    const [g, kids] = fresh(2, game);
    const wild = [[-0.6, 0.5], [1.6, 0.5], [0.5, -0.7], [0.5, 1.8], [-0.3, -0.3], [1.4, 1.4]];
    for (let n = 0; n < 240; n++){
      const [x, y] = wild[n % wild.length];
      for (const k of kids){ k.hands.r.x = x; k.hands.r.y = y; k.hands.l.x = 1 - x; k.hands.l.y = 1 - y; }
      apply(kids, DT);
      g.step(DT, W, H);
    }
    finite(g, game.id);
    play(g, game, kids, 30);
    assert.ok(g.score[0] + g.score[1] >= 0);
  });

  test(`${game.id}: mouse mode (no camera: the mouse is player one)`, () => {
    const [g] = fresh(1, game);
    pose.mouse.active = true;
    const p = pose.players[0];
    p.present = true; p.lm = null;
    for (let n = 0; n < 900; n++){
      const x = 0.5 + Math.sin(n * 0.05) * 0.4, y = 0.5 + Math.cos(n * 0.03) * 0.4;
      p.hands.right = { x, y, vx: 1, vy: 1, speed: 1.2 }; p.hands.left = { ...p.hands.right };
      g.step(DT, W, H);
    }
    pose.mouse.active = false;
    finite(g, game.id);
  });
}

/* ---------- things particular to each game ---------- */

test('sleepy-bear: a child away for a whole freeze gets no star for it; one who joins mid-freeze is not caught for arriving', () => {
  const [g, kids] = fresh(2, sleepyBear);
  play(g, sleepyBear, kids, 1);
  while (g.phase !== 'freeze') play(g, sleepyBear, kids, DT);
  kids[1].here = false;
  while (g.phase === 'freeze') play(g, sleepyBear, kids, DT);
  assert.equal(g.score[1], 0); assert.equal(g.score[0], 1);
  while (g.phase !== 'freeze') play(g, sleepyBear, kids, DT);
  play(g, sleepyBear, kids, 1);
  kids[1].here = true; kids[1].x = 0.75;          /* runs in, then stands still */
  play(g, sleepyBear, kids, 0.5);
  assert.equal(g.caught[1], false, 'arriving is not a wobble');
});

test('stack-it-high: a child who walks off carrying a block drops it, and the other can pick it up', () => {
  const [g, kids] = fresh(2, stackItHigh);
  let carried = null;
  for (let n = 0; n < 900 && !carried; n++){ play(g, stackItHigh, kids, DT); carried = g.blocks.find(b => b.held && b.held.who === 1); }
  assert.ok(carried, 'player 2 picked one up');
  kids[1].here = false;
  play(g, stackItHigh, kids, DT * 2);
  assert.equal(carried.held, null, 'dropped');
  play(g, stackItHigh, kids, 30);
  assert.ok(g.lanes.every(l => l.tower.length <= TOWER_FULL));
  assert.ok(g.towers >= 0 && g.blocks.length < 20, 'no pile-up of blocks');
});

test('leaf-pile: at the end it bursts even with nobody left to jump, and one child alone only has to jump once', () => {
  const [g, kids] = fresh(2, leafPile);
  g.t = SWEEP_END - 0.2;
  while (!g.ready) play(g, leafPile, kids, DT);
  kids[0].here = kids[1].here = false;
  play(g, leafPile, kids, 7, () => {}, { lateCredit: true });
  assert.equal(g.ready, 0, 'burst by itself');
  /* alone */
  const [h, k2] = fresh(1, leafPile);
  h.t = SWEEP_END - 0.2;
  let n = 0; while (!h.ready && n++ < 3000) play(h, leafPile, k2, DT);
  assert.ok(h.ready, 'ready');
  play(h, leafPile, k2, 2);
  assert.ok(h.piles >= 1, 'one child jumping is everyone');
  assert.ok(h.leaves.length <= 180, 'leaves stay bounded');
});

test('sky-painter: a hand that vanishes and reappears across the screen does not paint a line between', () => {
  const [g, kids] = fresh(1, skyPainter);
  const k = kids[0];
  k.hands.r = { x: 0.1, y: 0.2 }; k.hands.l = { x: 0.1, y: 0.25 };
  apply(kids, DT); g.step(DT, W, H);
  k.here = false; apply(kids, DT); g.step(DT, W, H);
  const before = g.painted;
  k.here = true; k.hands.r = { x: 0.9, y: 0.8 }; k.hands.l = { x: 0.9, y: 0.85 };
  apply(kids, DT); g.step(DT, W, H);
  assert.ok(g.painted - before < 80, `painted ${g.painted - before} cells - a line across would be hundreds`);
});

test('pop-party: a child who joins late can pop, and an empty room pops nothing', () => {
  const [g, kids] = fresh(0, popParty);
  play(g, popParty, kids, 30);
  assert.deepEqual(g.score.slice(0, 2), [0, 0]);
  kids[1].here = true;
  play(g, popParty, kids, 30);
  assert.ok(g.score[1] > 0);
});

/* ---------- enough, and all the way through ----------
   Not just "more than nothing": a child playing alone gets through the
   game's whole loop more than once, and is still getting somewhere in the
   last minute (the stalls these caught: Leaf Pile's leaves drifting where
   no hand reaches, Sky Painter unfinishable by a child who stays on one
   side). */
const ENOUGH = {
  'pop-party': (g) => g.score[0] >= 150,
  'sleepy-bear': (g) => g.score[0] >= 6,
  'leaf-pile': (g) => g.piles >= 1 && g.peak >= 40,
  'stack-it-high': (g) => g.towers >= 3,
  'sky-painter': (g) => g.done >= 2
};
for (const game of GAMES){
  test(`${game.id}: alone, you get through it more than once - and you're still getting somewhere at the end`, () => {
    const [g, kids] = fresh(1, game);
    play(g, game, kids, game.secs - 60);
    const late = g.score[0];
    play(g, game, kids, 58);
    assert.ok(ENOUGH[game.id](g), `${game.id}: score ${g.score[0]}, piles ${g.piles}, towers ${g.towers}, pictures ${g.done}`);
    assert.ok(g.score[0] > late, `stalled: nothing in the last minute (${late} -> ${g.score[0]})`);
  });
}
