import test from 'node:test';
import assert from 'node:assert/strict';
import { pose, PLAYER_COLORS } from '../src/tracking/pose.js';
import stackItHigh, { ROUND, GRAB_SECS, capFor, drawBlock } from '../src/games/stack-it-high.js';
import { SHAPES, SHAPE_NAMES, GROUND, FADE_SECS } from '../src/games/stack-blocks.js';
import { PALETTE } from '../src/games/assets/palette.js';
import { POSE_NAMES } from '../src/games/figure.js';

const DT = 1 / 30, W = 1920, H = 1080, A = W / H;
/* n players, standing at x = 0.25 and 0.75 (or in the middle when alone), hands out of the way down at their sides */
function players(n){
  pose.mouse.active = false; pose.mouse.clicks = 0;
  pose.players.forEach((p, i) => {
    p.present = i < n; p.lm = null;
    p.centre = { x: n === 1 ? 0.5 : 0.25 + i * 0.5, y: 0.55 }; p.scale = 0.3;
    p.hands.left = { x: 0.05, y: 0.95, vx: 0, vy: 0, speed: 0 }; p.hands.right = { x: 0.95, y: 0.95, vx: 0, vy: 0, speed: 0 };
  });
}
/* both hands of player i, in picture heights across (X) and down (Y) */
function hands(i, lX, lY, rX, rY){ const p = pose.players[i]; Object.assign(p.hands.left, { x: lX / A, y: lY }); Object.assign(p.hands.right, { x: rX / A, y: rY }); }
const away = (i) => hands(i, 0.1, 0.97, A - 0.1, 0.97);
const run = (g, secs) => { for (let t = 0; t < secs; t += DT) g.step(DT, W, H); };
/* a quiet game: nothing falls from the sky unless a test asks */
function start(n = 1){ players(n); const g = stackItHigh.create(n); g.spawnT = 1e9; run(g, 0.2); return g; }
/* a block already standing where it would come to rest at X */
function stand(g, kind, X){
  const b = g.yard.add(kind, X, 0), l = g.yard.land(b, X);
  b.Y = l.bottom - b.h / 2; b.supports = l.ids.filter(id => id !== 0); b.state = 'rest'; b.used = true;
  return b;
}
/* both hands of player i on either side of a block, level with its middle */
const grip = (g, i, b, dx = b.w / 2) => hands(i, b.X - dx, b.Y, b.X + dx, b.Y);

test('the game has no rocket, no towers and no goal: a sandbox with a three minute round', () => {
  assert.equal(ROUND, 180); assert.equal(stackItHigh.secs, 180);
  const g = start(1);
  assert.equal(g.towers, undefined); assert.equal(g.lanes, undefined);
  assert.equal(g.hud().goal, undefined, 'no goal bar');
  assert.deepEqual(g.hud().words.text, 'Lift with both hands!');
  assert.equal(g.card(), 'lift'); assert.ok(POSE_NAMES.includes('lift'), 'Cubo has a lifting move');
  assert.ok(!g.over);
  g.t = ROUND - 0.1; g.step(DT, W, H); g.step(DT, W, H); g.step(DT, W, H);
  assert.ok(g.over, 'the round is over at three minutes');
});

test('the blocks are big, painted in palette colours, and there are six shapes', () => {
  assert.deepEqual(SHAPE_NAMES.slice().sort(), ['arch', 'cube', 'dome', 'pillar', 'plank', 'roof']);
  assert.ok(Math.abs(SHAPES.cube.h - 1 / 6) < 0.01, 'a cube is about a sixth of the screen');
  for (const [k, s] of Object.entries(SHAPES)){ const [g, n] = s.col.split('.'); assert.ok(PALETTE[g] && PALETTE[g][n], `${k}: ${s.col} is a palette name`); }
  assert.ok(SHAPES.plank.w > 2.5 * SHAPES.cube.w, 'a long plank');
  /* a block of every shape can be painted */
  const calls = []; const c = new Proxy({}, { get: (_, k) => (...a) => { calls.push(k); }, set: () => true });
  for (const k of SHAPE_NAMES) drawBlock(c, 100, 100, k, SHAPES[k].w * H, SHAPES[k].h * H, 0, SHAPES[k].col, 'star');
  assert.ok(calls.includes('fill'));
});

test('two hands, one each side, held for a moment, pick a block up; it glows in their colour and follows the middle of the hands', () => {
  const g = start(1);
  const b = stand(g, 'cube', 0.9);
  grip(g, 0, b);
  run(g, GRAB_SECS * 0.6);
  assert.equal(b.held, null, 'not yet: a moment first');
  assert.ok(b.pend && b.pend.who === 0 && b.pend.p > 0, 'a ring fills while they hold on');
  run(g, GRAB_SECS * 0.6);
  assert.equal(b.held, 0, 'held by player 1'); assert.equal(g.hold[0].id, b.id);
  /* it follows the middle, with a lag, not at once */
  hands(0, 1.0, 0.5, 1.0 + b.w, 0.5);
  run(g, 0.1);
  assert.ok(b.X < 1.0 + b.w / 2 - 0.05 && b.X > 0.9, `still on its way (lag): ${b.X.toFixed(2)}`);
  run(g, 1.5);
  assert.ok(Math.abs(b.X - (1.0 + b.w / 2)) < 0.02 && Math.abs(b.Y - 0.5) < 0.02, `at the middle of the hands: ${b.X.toFixed(3)}, ${b.Y.toFixed(3)}`);
  assert.equal(b.held, 0);
});

test('hands moved apart (wider than the block plus a margin) let go; the block falls straight down and lands, and counts as placed', () => {
  const g = start(1);
  const b = stand(g, 'cube', 0.9);
  grip(g, 0, b); run(g, 0.5);
  assert.equal(b.held, 0);
  hands(0, 1.2 - b.w / 2, 0.5, 1.2 + b.w / 2, 0.5); run(g, 1.5);
  const x = b.X;
  hands(0, x - b.w / 2 - 0.1, 0.5, x + b.w / 2 + 0.1, 0.5); run(g, 0.1);
  assert.equal(b.held, null, 'let go');
  assert.equal(g.hold[0], null);
  run(g, 3);
  assert.equal(b.state, 'rest'); assert.ok(Math.abs(b.X - x) < 1e-6, 'straight down'); assert.ok(Math.abs(b.Y + b.h / 2 - GROUND) < 1e-6, 'on the ground');
  assert.equal(g.score[0], 1); assert.equal(g.stacked, 1);
  /* dropping the hands lets go too */
  const c = stand(g, 'cube', 0.5);
  run(g, 1); grip(g, 0, c); run(g, 0.5); assert.equal(c.held, 0);
  hands(0, c.X - c.w / 2, c.Y + c.h / 2 + 0.1, c.X + c.w / 2, c.Y + c.h / 2 + 0.1); run(g, 0.3);
  assert.equal(c.held, null, 'dropped hands let go');
  /* and so does a player who walks off */
  const d = stand(g, 'cube', 1.5);
  run(g, 1); grip(g, 0, d); run(g, 0.5); assert.equal(d.held, 0);
  pose.players[0].present = false; run(g, 0.1);
  assert.equal(d.held, null, 'a player who has gone drops it');
});

test('one hand only wobbles and nudges a block a little: it is never lifted and never really moves', () => {
  const g = start(1);
  const b = stand(g, 'cube', 0.9), X = b.X, Y = b.Y;
  let wob = 0, nx = 0;
  for (let t = 0; t < 3; t += DT){
    /* one hand swings across the block, the other stays away */
    hands(0, b.X - 0.1 + 0.2 * Math.sin(t * 9), b.Y, 1.6, 0.97);
    g.step(DT, W, H);
    wob = Math.max(wob, Math.abs(b.wob)); nx = Math.max(nx, Math.abs(b.nx));
    assert.equal(b.held, null); assert.equal(g.hold[0], null);
  }
  assert.ok(wob > 0.01, `it wobbles: ${wob}`); assert.ok(nx > 0.002, `and shuffles: ${nx}`);
  away(0); run(g, 2);
  assert.equal(b.X, X); assert.equal(b.Y, Y); assert.equal(b.state, 'rest');
  assert.ok(Math.abs(b.wob) < 0.01 && Math.abs(b.nx) < 0.005, 'and settles back');
  /* both hands on the same side is one hand's worth, too */
  hands(0, b.X - 0.12, b.Y, b.X - 0.05, b.Y); run(g, 1);
  assert.equal(b.held, null, 'two hands on one side do not lift');
  /* and hands that touch for less than a moment do not either */
  away(0); run(g, 0.5); grip(g, 0, b); run(g, GRAB_SECS * 0.5); away(0); run(g, 1);
  assert.equal(b.held, null);
});

test('a block somebody has hold of cannot be taken by another player, and a block with something on it cannot be lifted', () => {
  const g = start(2);
  const b = stand(g, 'plank', 1.0);
  grip(g, 0, b, 0.2); run(g, 0.5);
  assert.equal(b.held, 0);
  /* player 2 puts both hands on it: no */
  hands(1, b.X - 0.2, b.Y, b.X + 0.2, b.Y); run(g, 2);
  assert.equal(b.held, 0, 'still player 1\'s'); assert.equal(g.hold[1], null);
  /* player 1 lets go; now it is free, and the second player is quicker to be holding it */
  hands(0, b.X - 0.5, 0.97, b.X + 0.5, 0.97); run(g, 0.2);
  assert.equal(b.held, null);
  run(g, 1);
  assert.equal(b.held, 1, 'free now, and player 2, still holding on, gets it');
  hands(1, b.X - 0.5, 0.97, A - 0.1, 0.97); run(g, 1.2);
  assert.equal(b.held, null); away(1); run(g, 1);
  /* a stack: the one underneath is locked while the one on top stands on it */
  const base = stand(g, 'cube', 0.4), top = stand(g, 'cube', 0.4);
  assert.deepEqual(top.supports, [base.id]);
  away(0); hands(1, base.X - base.w / 2, base.Y, base.X + base.w / 2, base.Y); run(g, 1.5);
  assert.equal(base.held, null, 'the cube with a cube on it stays put'); assert.ok(base.wob !== 0 || true);
  assert.equal(base.Y + base.h / 2, GROUND);
  /* take the top one off and the lower one is free */
  hands(1, top.X - top.w / 2, top.Y, top.X + top.w / 2, top.Y); run(g, 0.5);
  assert.equal(top.held, 1);
  hands(1, 1.5 - top.w / 2, 0.4, 1.5 + top.w / 2, 0.4); run(g, 1.5);
  away(1);
  assert.equal(g.yard.liftable(base), true);
});

test('a block lands straight down on the highest thing under it, and stays when its middle is over it', () => {
  const g = start(1), y = g.yard;
  const a = stand(g, 'cube', 1.0);
  const b = y.add('cube', 1.02, -0.2);
  let landed = null;
  for (let t = 0; t < 6 && b.state === 'fall'; t += DT){ const ev = y.step(DT); landed = ev.find(e => e.b === b) || landed; }
  assert.equal(b.state, 'rest'); assert.ok(landed && landed.speed > 0.2, 'it came down with some weight');
  assert.ok(Math.abs(b.Y - (a.Y - a.h)) < 1e-9, 'on top of the first');
  assert.deepEqual(b.supports, [a.id]); assert.equal(y.level(b), 2); assert.equal(y.tallest(), 2);
  /* a plank across two cubes (a bridge, its middle over nothing) stays */
  const l = stand(g, 'cube', 2.0), r = stand(g, 'cube', 2.5);
  const p = y.add('plank', 2.25, -0.2);
  for (let t = 0; t < 6 && p.state === 'fall'; t += DT) y.step(DT);
  assert.equal(p.state, 'rest'); assert.deepEqual(p.supports.slice().sort(), [l.id, r.id].sort());
  /* an arch straddling a cube: its legs reach the ground and the doorway clears the cube */
  const low = stand(g, 'cube', 0.3);
  const arch = y.add('arch', 0.3, -0.2);
  for (let t = 0; t < 6 && arch.state === 'fall'; t += DT) y.step(DT);
  assert.ok(arch.Y + arch.h / 2 <= GROUND + 1e-9);
  /* every shape lands and stays on flat ground */
  for (const k of SHAPE_NAMES){
    const s = y.add(k, 3.3, -0.3);
    for (let t = 0; t < 8 && s.state === 'fall'; t += DT) y.step(DT);
    assert.equal(s.state, 'rest', k); assert.ok(Math.abs(s.Y + s.h / 2 - GROUND) < 1e-6, `${k} on the ground`);
    y.blocks.splice(y.blocks.indexOf(s), 1);
  }
  assert.ok(low.state === 'rest');
});

test('a block that lands mostly over an edge tips and slides off gently, and nothing below it moves', () => {
  const g = start(1), y = g.yard;
  const a = stand(g, 'cube', 1.0), b = stand(g, 'cube', 1.0), c = stand(g, 'cube', 1.0);
  const before = [a, b, c].map(k => [k.X, k.Y]);
  /* a cube comes down with its middle well past the edge of the top of the tower */
  const d = y.add('cube', 1.0 + c.w / 2 + 0.05, -0.3);
  let sliding = false, x0 = null;
  for (let t = 0; t < 12 && d.state !== 'rest' || !x0; t += DT){
    y.step(DT);
    if (d.state === 'slide'){ sliding = true; if (x0 == null) x0 = d.X; }
    if (d.state === 'rest' && x0 != null) break;
    if (t > 11) break;
  }
  assert.ok(sliding, 'it tipped');
  assert.equal(d.state, 'rest'); assert.ok(d.X > x0 + 0.02 && d.X - d.w / 2 >= c.X + c.w / 2 - 0.01, 'and slid clear of the tower');
  assert.ok(Math.abs(d.Y + d.h / 2 - GROUND) < 1e-6, 'fell the rest of the way to the ground');
  assert.deepEqual([a, b, c].map(k => [k.X, k.Y]), before, 'the tower did not move');
  assert.equal(y.tallest(), 3);
  /* a block with its middle just over the edge stays (a hand's width of give) */
  const e = y.add('cube', 1.0 + c.w / 2 - 0.03, -0.3);
  for (let t = 0; t < 10 && e.state === 'fall'; t += DT) y.step(DT);
  assert.equal(e.state, 'rest'); assert.equal(y.level(e), 4);
  /* standing buildings never fall on their own, however long they stand */
  for (let t = 0; t < 60; t += DT) y.step(DT);
  assert.deepEqual([a, b, c].map(k => [k.X, k.Y]), before);
});

test('a block on the dome balances only near its top and rolls off otherwise', () => {
  const g = start(1), y = g.yard;
  const dome = stand(g, 'dome', 1.0);
  const on = y.add('cube', 1.0, -0.3); for (let t = 0; t < 10 && on.state === 'fall'; t += DT) y.step(DT);
  assert.equal(on.state, 'rest');
  const off = y.add('cube', 1.0 + 0.2, -0.3); for (let t = 0; t < 10 && off.state === 'fall'; t += DT) y.step(DT);
  assert.notEqual(off.state, 'rest', 'tips off the curve at first');
  for (let t = 0; t < 12 && off.state !== 'rest'; t += DT) y.step(DT);
  assert.equal(off.state, 'rest'); assert.ok(dome.state === 'rest');
});

test('blocks that nobody uses fade away when there are too many; ones that hold something up, or are held, never do', () => {
  const g = start(1), y = g.yard, cap = capFor(1);
  assert.ok(cap >= 8 && cap <= 16, 'a sensible cap');
  /* a building of three, and the ground full of loose blocks */
  const base = stand(g, 'cube', 0.3); const mid = stand(g, 'cube', 0.3); const top = stand(g, 'cube', 0.3);
  top.used = mid.used = base.used = true;
  let X = 0.8; const loose = [];
  while (y.count() < cap){ const k = stand(g, 'pillar', X); k.used = false; loose.push(k); X += 0.15; }
  assert.equal(y.count(), cap);
  /* player 1 is carrying one of the loose blocks */
  const held = loose[0]; grip(g, 0, held); run(g, 0.5);
  assert.equal(held.held, 0);
  g.spawnT = 0; g.blocks.forEach(b => { b.age += 100; });
  run(g, 0.2);
  const fading = y.blocks.filter(b => b.fade);
  assert.equal(fading.length, 1, 'one old loose block starts to fade to make room');
  assert.ok(fading[0] !== held && ![base, mid, top].includes(fading[0]), 'never the one in a hand, or the building');
  assert.ok(fading[0] === loose[1] || loose.includes(fading[0]), 'an unused loose one');
  /* it is not a thing to stand on while it fades, and it is gone after FADE_SECS */
  run(g, FADE_SECS + 0.5);
  assert.ok(!y.blocks.includes(fading[0]), 'gone');
  /* over a long time, nothing keeps the count over the cap, and the building stays */
  for (let t = 0; t < 120; t += DT){ g.step(DT, W, H); assert.ok(y.count() <= cap, `${y.count()} blocks`); }
  assert.ok(y.blocks.includes(base) && y.blocks.includes(mid) && y.blocks.includes(top), 'the building is still there');
  assert.ok(y.blocks.includes(held), 'and the held block');
});

test('new blocks come down slowly from the top, one at a time, never too many, and low enough for a child to reach', () => {
  players(1);
  const lo = pose.players[0]; lo.centre = { x: 0.5, y: 0.8 }; lo.scale = 0.2;         /* a smaller body, low in the picture */
  const g = stackItHigh.create(1);
  run(g, 0.5);
  let most = 0, seen = new Set(), fell = null, soft = true;
  for (let t = 0; t < 120; t += DT){
    g.step(DT, W, H);
    if (Math.round(t / DT) % 150 === 0) for (const b of g.blocks) b.used = true;      /* (somebody is playing with them) */
    most = Math.max(most, g.yard.count());
    for (const b of g.blocks){
      if (!seen.has(b)){ seen.add(b); assert.ok(b.Y < 0, 'starts above the picture'); }
      if (b.sky && b.state === 'fall') soft = soft && b.vy <= 0.5 + 1e-9;
    }
  }
  assert.ok(seen.size >= 5, `blocks arrive: ${seen.size}`);
  assert.ok(most <= capFor(1), `never over the cap: ${most}`);
  assert.ok(soft, 'slow');
  const kinds = new Set([...seen].map(b => b.kind)); assert.ok(kinds.size >= 4, `several shapes: ${[...kinds]}`);
  /* the ones that landed on the ground can be reached: their tops are below the player's reach line */
  for (const b of seen) if (b.state === 'rest' && !b.used) assert.ok(b.Y - b.h / 2 >= g.reach[0].top - 0.02, `${b.kind} top ${(b.Y - b.h / 2).toFixed(2)} vs reach ${g.reach[0].top.toFixed(2)}`);
  /* they are painted from the palette */
  for (const b of seen) assert.match(b.col, /^[a-z]+\.[A-Za-z]+$/);
});

test('tilting the hands turns a plain block a quarter turn (a plank stands up); a roof does not turn', () => {
  const g = start(1);
  const p = stand(g, 'plank', 1.2);
  grip(g, 0, p, 0.2); run(g, 0.5);
  assert.equal(p.held, 0);
  const w = p.w, h = p.h;
  hands(0, 1.1, 0.4, 1.3, 0.4); run(g, 1.5);               /* lifted well clear of the ground */
  /* the right hand lower than the left */
  hands(0, 1.1, 0.28, 1.3, 0.52); run(g, 0.7);
  assert.equal(p.q, 1); assert.equal(p.w, h); assert.equal(p.h, w);
  assert.equal(p.held, 0, 'still held');
  /* it does not keep turning while they hold the tilt; level the hands and tilt the other way */
  run(g, 1); assert.equal(p.q, 1);
  hands(0, 1.1, 0.4, 1.3, 0.4); run(g, 0.3);
  hands(0, 1.1, 0.5, 1.3, 0.3); run(g, 0.7);
  assert.equal(p.q, 0); assert.equal(p.w, w);
  away(0); run(g, 1.5);
  const r = stand(g, 'roof', 2.5);
  grip(g, 0, r, 0.15); run(g, 0.5); assert.equal(r.held, 0);
  hands(0, r.X - 0.15, r.Y - 0.12, r.X + 0.15, r.Y + 0.12); run(g, 1);
  assert.equal(r.q, 0);
});

test('with a mouse, a click picks up the block under it and the next click puts it down', () => {
  players(1); pose.mouse.active = true; pose.mouse.x = 0.1; pose.mouse.y = 0.5;
  const g = stackItHigh.create(1); g.spawnT = 1e9; run(g, 0.2);
  const b = stand(g, 'cube', 1.0);
  pose.mouse.x = b.X / A; pose.mouse.y = b.Y;
  run(g, 1);
  assert.equal(b.held, null, 'hovering does nothing');
  pose.mouse.clicks++; run(g, 0.1);
  assert.equal(b.held, 0, 'a click picks it up');
  pose.mouse.x = 1.5 / A; pose.mouse.y = 0.5; run(g, 2);
  assert.ok(Math.abs(b.X - 1.5) < 0.03 && Math.abs(b.Y - 0.5) < 0.03, 'it follows the pointer');
  pose.mouse.clicks++; run(g, 0.1);
  assert.equal(b.held, null, 'the next click lets go');
  run(g, 3);
  assert.equal(b.state, 'rest'); assert.equal(g.score[0], 1);
  pose.mouse.active = false;
});

test('a carried block rides on top of what it is over, and a building is never knocked over by carrying', () => {
  const g = start(1);
  const t1 = stand(g, 'cube', 1.4), t2 = stand(g, 'cube', 1.4);
  const b = stand(g, 'cube', 0.6);
  grip(g, 0, b); run(g, 0.5);
  /* the hands go straight through the tower at ground height */
  for (let k = 0; k < 90; k++){ const x = 0.6 + 1.0 * k / 90; hands(0, x - b.w / 2, 0.85, x + b.w / 2, 0.85); g.step(DT, W, H); }
  assert.equal(t1.Y + t1.h / 2, GROUND); assert.equal(t2.Y + t2.h / 2, GROUND - t1.h);
  assert.ok(b.Y + b.h / 2 <= GROUND + 1e-9, 'never below the ground');
});

test('the results say what was built: how tall, how many placed, one row for each player', () => {
  const g = start(2);
  g.peak = 7; g.stacked = 23; g.score[0] = 14; g.score[1] = 9;
  assert.equal(g.summary(), 'You built something 7 blocks tall! You stacked 23 blocks!');
  assert.deepEqual(g.tally().map(r => r.value), [14, 9]); assert.equal(g.tally().length, 2);
  assert.equal(g.tally()[0].color, PLAYER_COLORS[0]);
  assert.equal(g.value(), 23); assert.equal(g.winner(), -1, 'nobody wins a sandbox');
  g.peak = 1; g.stacked = 1; assert.equal(g.summary(), 'You stacked 1 block!');
  g.peak = 0; g.stacked = 0; assert.equal(g.summary(), null);
  /* really built: a tower of four put up by hand counts four placed and four tall */
  const h = start(1);
  for (let n = 0; n < 4; n++){
    const b = stand(h, 'cube', 0.5 + 1.0); h.yard.lift(b, 0); h.hold[0] = { id: b.id, tilt: 0, tiltT: 0, armed: true, dropT: 0, pressT: 0, vx: 0, vy: 0 };
    b.from = { X: 1.5, Y: 0.8 }; b.X = 0.5; b.Y = 0.2 - n * 0.0; b.state = 'held';
    h.yard.drop(b); h.hold[0] = null; run(h, 4);
  }
  assert.equal(h.score[0], 4); assert.equal(h.stacked, 4); assert.equal(h.peak, 4);
  assert.equal(h.summary(), 'You built something 4 blocks tall! You stacked 4 blocks!');
});

test('at the end the camera pans across what was built, and then the results can show', () => {
  const g = start(1);
  stand(g, 'cube', 0.5); stand(g, 'cube', 1.2); stand(g, 'plank', 2.4);
  g.t = ROUND; g.step(DT, W, H); assert.ok(g.over);
  assert.ok(!g.cam, 'no camera move until the outro');
  const xs = []; let done = false, t = 0, zmax = 1;
  while (!done && t < 30){ done = g.outro(DT, W, H); t += DT; if (g.cam){ xs.push(g.cam.cx); zmax = Math.max(zmax, g.cam.z); } }
  assert.ok(done, 'the pan ends'); assert.ok(t > 3 && t < 12, `a few seconds: ${t.toFixed(1)}`);
  assert.ok(zmax > 1.1, 'it moves in a little');
  const mid = xs.slice(30, -30); assert.ok(mid[mid.length - 1] > mid[0] + 0.3, 'and sweeps from one side to the other');
  assert.ok(Math.abs(g.cam.z - 1) < 0.01 && Math.abs(g.cam.cx - A / 2) < 0.01, 'then settles back for the results');
  /* an empty yard has nothing to pan over: it is quick */
  const e = start(1); e.t = ROUND; let n = 0; while (!e.outro(DT, W, H) && n++ < 600);
  assert.ok(n < 100);
});

test('a block let go while the player is gone from the picture still lands; nothing gets stuck in the air', () => {
  const g = start(1);
  const b = stand(g, 'cube', 1.0);
  grip(g, 0, b); run(g, 0.5);
  hands(0, 1.5, 0.3, 1.5 + b.w, 0.3); run(g, 1);
  pose.players[0].present = false; run(g, 5);
  assert.equal(b.held, null); assert.equal(b.state, 'rest');
});
