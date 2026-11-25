/* Decisions 0063 and 0064: a Dodge game made in Create has no score; each player has a health bar, and an empty bar puts that player out for the round. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlay } from '../src/games/play/engine.js';
import { hudZones, layoutDocks } from '../src/games/hud.js';
import { validate } from '../src/games/play/validate.js';
import { playEnv } from '../src/games/play/env.js';
import { build, clean } from '../src/create/recipe.js';
import { healthLine } from '../src/create/made-game.js';
import { healthOf, lastedText } from '../src/ui/screens.js';

const DT = 1 / 30, W = 1920, H = 1080;
function game(n = 1){
  let s = 5; const random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const hand = (x) => ({ x, y: 0.6, vx: 0, vy: 0, speed: 0 });
  const pose = { players: Array.from({ length: 4 }, (_, i) => ({ present: i < n, hands: { left: hand(0.45), right: hand(0.5) } })), mouse: { active: false } };
  const sounds = [];
  const g = makePlay(build(clean({ things: [{ id: 'bee', job: 'dodge' }] })), { pose, sfx: new Proxy({}, { get: (_, k) => () => sounds.push(k) }), assets: { scene() {}, draw() {}, text() {}, color: () => '#fff' }, ui: { say() {}, goal() {}, zones: hudZones }, colors: ['#3da9ff', '#ff8a3d', '#3fcf7f', '#c46bff'], max: 4, random });
  return { round: g.create(n), pose, sounds };
}
const run = (r, secs) => { for (let t = 0; t < secs; t += DT) r.step(DT, W, H); };
const thing = (round, x, y) => ({ ...round.things[0] || round._make(round.defs[0], { x, y }), x, y });
function hit(round, i = 0){ const th = round._make(round.defs[0], { x: 0.5, y: 0.6 }); th.x = 0.5; th.y = 0.6; th.ang = 0; round.step(DT, W, H); return th; }

test('the game is valid and has no score: health, seek and hurt are words', () => {
  const g = build(clean({ things: [{ id: 'bee', job: 'dodge' }] }));
  assert.deepEqual(validate(g, playEnv()), []);
  assert.match(validate({ ...g, health: 'yes' }, playEnv()).join(' '), /"health" is true or false/);
  assert.match(validate({ ...g, things: [{ ...g.things[0], rules: [{ when: 'touched', then: [{ hurt: 9 }] }] }] }, playEnv()).join(' '), /"hurt" is a number from 1 to 4/);
});

test('full at the start; a hit takes a tenth, then they are safe for a moment; things pass through a safe player', () => {
  const { round, sounds } = game();
  assert.equal(round.hud().health[0].fill, 1);
  round.things.length = 0; hit(round);
  assert.ok(Math.abs(round.hp[0] - 0.9) < 1e-9, 'a tenth of the bar, not a fifth (' + round.hp[0] + ')'); assert.ok(sounds.includes('ouch'));
  const after = round.hp[0], h = round.hud().health[0];
  assert.ok(h.hit > 0.5, 'a flash');
  const second = hit(round); assert.equal(round.hp[0], after, 'safe: no second chunk');
  assert.ok(round.things.includes(second), 'the thing goes through them');
  assert.equal(round.score[0], 0); assert.equal(round.value(), 0);
});

test('ten hits empty the bar and put that player out for the rest of the round: no dizzy spell, no refill', () => {
  const { round, sounds } = game(2);
  round.things.length = 0; run(round, 1);
  for (let k = 0; k < 9; k++){ round.safe[0] = 0; hit(round); }
  assert.ok(round.hp[0] > 0.05 && !round.out[0], 'nine hits is not enough');
  round.safe[0] = 0; hit(round);
  assert.equal(round.hp[0], 0); assert.equal(round.out[0], true); assert.ok(round.outAt[0] > 0); assert.equal(round.hits[0], 10);
  assert.ok(sounds.includes('ouch')); assert.equal(round.hud().health[0].out, true); assert.equal(round.hud().health[1].out, false);
  assert.equal(round.dizzy, undefined, 'no dizzy spell'); assert.equal(round.lost, undefined, 'no lost-star count');
  const hits = round.hits[0]; round.safe[0] = 0; hit(round); assert.equal(round.hits[0], hits, 'nothing hurts an out player');
  run(round, 10); assert.equal(round.hp[0], 0, 'no refill'); assert.equal(round.out[0], true); assert.ok(!round.over, 'the other player is still in');
});

test('an out player: their hands grey, their things stop counting, and nothing drifts toward them', () => {
  const { round } = game(2);
  run(round, 1); round.out[0] = true; round.outAt[0] = 5;
  assert.notEqual(round._colorOf(0), round._colorOf(1)); assert.equal(round._colorOf(0), round._grey()); assert.equal(round._colorOf(1), '#ff8a3d');
  round.things.length = 0;
  const th = round._make(round.defs[0], { x: 0.47, y: 0.6 }); th.x = 0.47; th.y = 0.6; th.cool = 0; th.target = 0;
  round.step(DT, W, H);
  assert.equal(round.hp[0], 1, 'a thing at an out player\'s hand does not touch them');
  assert.equal(th.target, 1, 'it heads for the player still in');
  for (let k = 0; k < 30; k++) assert.equal(round._nextTarget(), 1);
});

test('the round ends as soon as everyone playing is out, after a short beat and a sound, not a cut', () => {
  const { round, sounds } = game(2);
  run(round, 1); round.things.length = 0;
  round.out[0] = round.out[1] = true; round.hp[0] = round.hp[1] = 0;
  round.step(DT, W, H);
  assert.equal(round.allOut, true); assert.ok(!round.over, 'a beat first'); assert.ok(sounds.includes('slowmo'), 'and a sound');
  run(round, 0.8); assert.ok(!round.over);
  run(round, 1.2); assert.ok(round.over, 'then it is over, long before time');
  assert.ok(round.t < 10);
});

test('a player who joins late starts full; a player who leaves and comes back stays out; one who is away and not out does not hold the round', () => {
  const { round, pose } = game(2);
  pose.players[1].present = false; run(round, 2);
  assert.equal(round.hp[1], 1, 'not here yet: a full bar'); assert.equal(round.out[1], false);
  pose.players[1].present = true; run(round, 0.5); assert.equal(round.hud().health[1].fill, 1, 'joined mid-round with a full bar');
  round.out[0] = true; round.outAt[0] = 3; round.hp[0] = 0;
  pose.players[0].present = false; run(round, 0.5); pose.players[0].present = true; run(round, 0.5);
  assert.equal(round.out[0], true, 'still out'); assert.equal(round.hp[0], 0);
  assert.ok(!round.allOut, 'the other one is still in');
  pose.players[1].present = false; run(round, 0.2); assert.equal(round.allOut, true);
});

test('time still ends the round when nobody is out', () => {
  const { round } = game(); round.things.length = 0; round.defs.forEach(d => { d.timer = 1e9; });
  run(round, 121); assert.ok(round.over); assert.ok(!round.out[0]);
});

test('things steer toward the players, so standing still is not safe, and the round ends on time', () => {
  const { round } = game();
  run(round, 40);
  assert.ok(round.hits[0] > 2, 'a player who stands still is hit (' + round.hits[0] + ')');
  assert.equal(round.score[0], 0, 'and nothing is earned');
  const { round: r2 } = game(); run(r2, 121); assert.ok(r2.over, 'ends on time, or when they were all out');
});

test('the bars are in the corner where the scores would be, and results rows carry the bar, not a number', () => {
  const { round } = game(2);
  const pieces = layoutDocks(W, H, round.hud(), { players: [0, 1] });
  assert.ok(pieces.filter(p => p.kind === 'health').length === 2 && !pieces.some(p => p.kind === 'score'));
  assert.equal(healthLine([]), 'Everybody made it!');
});

test('the headline names the last ones standing; "Everybody made it!" when nobody was out; a plain line for three or more', () => {
  const nm = (i) => ['Mia', 'Leo', 'Ana', 'Sam'][i], P = (i, out, at = null) => ({ i, out, at });
  assert.equal(healthLine([P(0, false), P(1, false)], nm), 'Everybody made it!');
  assert.equal(healthLine([P(0, false), P(1, true, 40)], nm), 'Mia lasted longest!');
  assert.equal(healthLine([P(0, false), P(1, false), P(2, true, 40)], nm), 'Mia and Leo lasted longest!');
  assert.equal(healthLine([P(0, false), P(1, false), P(2, false), P(3, true, 40)], nm), 'Most of you made it!');
  assert.equal(healthLine([P(0, true, 50), P(1, true, 72), P(2, true, 31)], nm), 'Leo lasted longest!', 'everyone out: the one who lasted longest');
  assert.equal(healthLine([P(1, true, 50)], nm), 'Good try!');
});

test('results show the bar as it ended, or "Out at 1:12"; no number, no stars', () => {
  assert.equal(lastedText(72), '1:12'); assert.equal(lastedText(9), '0:09'); assert.equal(lastedText(null), '0:00');
  const bar = healthOf({ fill: 0.6 }); assert.ok(bar.querySelector('.ghfill'), 'a bar'); assert.equal(bar.querySelector('.ghfill').style.width, '60%');
  assert.ok(!bar.querySelector('.ghlost') && !bar.querySelector('.ghout'));
  const out = healthOf({ fill: 0, out: true, at: 72 }); assert.equal(out.querySelector('.ghout').textContent, 'Out at 1:12'); assert.ok(!out.querySelector('.ghfill'));
});
