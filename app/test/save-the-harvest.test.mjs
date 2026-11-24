import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import harvest, { TIME_LIMIT, HOP_FALLBACK, SPIN, RESULT, MOVE_MAX, END, FRUIT_EACH } from '../src/games/save-the-harvest.js';

const DT = 1 / 30, W = 1920, H = 1080;
const fakeCtx = () => new Proxy({}, { get(t, k){ if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop(){} }); if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set(t, k, v){ t[k] = v; return true; } });

/* n players with no landmarks (the mouse): a fast hand is a try; `fast` says whether they are trying right now */
function mice(n, fast = 0){
  pose.mouse.active = false;
  pose.players.forEach((q, i) => {
    q.present = i < n; q.lm = null; q.centre = { x: 0.3 + i * 0.4, y: 0.5 }; q.scale = 0.3;
    q.hands = { left: { x: 0.1, y: 0.2, vx: 0, vy: 0, speed: 0 }, right: { x: 0.9, y: 0.2, vx: 0, vy: 0, speed: fast } };
  });
}
/* a standing body that can reach up (raise a wrist above the nose) but does not hop */
function body(x){
  const lm = Array.from({ length: 33 }, () => ({ x, y: 0.5, v: 1 }));
  Object.assign(lm[0], { x, y: 0.2 });
  Object.assign(lm[11], { x: x - 0.05, y: 0.3 }); Object.assign(lm[12], { x: x + 0.05, y: 0.3 });
  Object.assign(lm[15], { x: x - 0.1, y: 0.55 }); Object.assign(lm[16], { x: x + 0.1, y: 0.55 });
  Object.assign(lm[23], { x: x - 0.03, y: 0.55 }); Object.assign(lm[24], { x: x + 0.03, y: 0.55 });
  Object.assign(lm[25], { x: x - 0.03, y: 0.72 }); Object.assign(lm[26], { x: x + 0.03, y: 0.72 });
  return lm;
}
function standers(n){
  pose.mouse.active = false;
  pose.players.forEach((q, i) => { q.present = i < n; q.lm = i < n ? body(0.3 + i * 0.4) : null; q.centre = { x: 0.3 + i * 0.4, y: 0.45 }; q.scale = 0.3; q.hands = { left: { speed: 0 }, right: { speed: 0 } }; });
}
const to = (g, phase, max = 20) => { let t = 0; while (g.phase !== phase && t < max){ g.step(DT, W, H); t += DT; } return t; };

test('the round has a time limit and always ends warmly: nobody hopping, nobody reaching, nothing done at all', () => {
  standers(1);                                     /* a grown-up standing there whose every try fails */
  const g = harvest.create(1);
  let t = 0;
  while (!g.over && t < 400){ g.step(DT, W, H); t += DT; }
  assert.ok(g.over, 'it ended');
  assert.ok(t >= TIME_LIMIT && t <= TIME_LIMIT + MOVE_MAX + RESULT + SPIN + END + 2, 'in about two to three minutes: ' + t.toFixed(0) + ' s');
  assert.ok(t <= 180, 'under three minutes');
  assert.equal(g.win, false);
  assert.equal(g.say.text, 'What a team!', 'warm, even with nothing saved');
  assert.equal(g.summary(), null);
});

test('when time is up with some fruit saved, it says how many', () => {
  mice(1, 3);                                      /* a hand that is always fast: every move is tried */
  const g = harvest.create(1);
  g.taken.apple = 2; g.picked.apple = 2;           /* two apples are in the basket already */
  g.t = TIME_LIMIT - 0.5; g.phase = 'result'; g.pt = RESULT;
  let t = 0; while (g.phase !== 'end' && t < 5){ g.step(DT, W, H); t += DT; }
  assert.equal(g.phase, 'end');
  assert.equal(g.win, false);
  assert.equal(g.value(), 2);
  assert.equal(g.say.text, 'You saved 2 fruit!');
  assert.equal(g.summary(), 'You saved 2 fruit!');
  assert.doesNotThrow(() => g.draw(fakeCtx(), W, H));
  for (t = 0; t < END + 0.2; t += DT) g.step(DT, W, H);
  assert.ok(g.over);
});

test('a full basket is still a win, and still ends with the whole harvest saved', () => {
  mice(2, 3);
  const g = harvest.create(2);
  let t = 0;
  while (!g.over && t < TIME_LIMIT + 60){ g.step(DT, W, H); t += DT; }
  assert.ok(g.over);
  assert.equal(g.win, true, 'two keen players saved it all');
  assert.equal(g.value(), FRUIT_EACH * 3);
  assert.equal(g.summary(), 'You saved the whole harvest together!');
  assert.ok(t < TIME_LIMIT, 'well within the limit: ' + t.toFixed(0) + ' s');
});

test('if the hop is not being seen, after a few seconds a reach up counts for the pear', () => {
  standers(1);
  const g = harvest.create(1);
  g.kind = 'pear'; g.last = 'pear'; g.phase = 'spin'; g.pt = SPIN;
  g.step(DT, W, H);
  assert.equal(g.phase, 'move'); assert.equal(g.kind, 'pear');
  /* the player reaches up all the time, but never hops */
  const reach = (up) => { pose.players[0].lm[15].y = up ? 0.05 : 0.55; };
  let t = 0, n = 0;
  while (t < HOP_FALLBACK - 0.3){ reach(Math.floor(t * 2) % 2 === 0); g.step(DT, W, H); t += DT; n++; }
  assert.equal(g.tries, 0, 'before the fallback, reaching is not a try');
  assert.equal(g.reachOk, false);
  while (t < HOP_FALLBACK + 1.2){ reach(Math.floor(t * 2) % 2 === 0); g.step(DT, W, H); t += DT; }
  assert.equal(g.reachOk, true);
  assert.match(g.say.text, /reach up/i, 'and the words say so');
  assert.ok(g.tries > 0 || g.phase !== 'move', 'a reach up is a try now: ' + g.tries);
});

test('the waiting is short: the wheel and the cheer take about two seconds between moves', () => {
  assert.ok(SPIN + RESULT <= 2.2, 'was 4.6 s: ' + (SPIN + RESULT));
});

test('the game draws the players\' hand marker like every other game does', () => {
  mice(2, 0);
  const g = harvest.create(2);
  const seen = [];
  g.avatars.drawMitts = (c, w, h, n) => seen.push(n);
  g.draw(fakeCtx(), W, H);
  assert.deepEqual(seen, [2]);
});
