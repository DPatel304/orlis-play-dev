/* Decision 0063: a Dodge game made in Create has no score; each player has a health bar. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlay } from '../src/games/play/engine.js';
import { hudZones, layoutDocks } from '../src/games/hud.js';
import { validate } from '../src/games/play/validate.js';
import { playEnv } from '../src/games/play/env.js';
import { build, clean } from '../src/create/recipe.js';
import { healthLine } from '../src/create/made-game.js';

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

test('full at the start; a hit takes a chunk, then they are safe for a moment; things pass through a safe player', () => {
  const { round, sounds } = game();
  assert.equal(round.hud().health[0].fill, 1);
  round.things.length = 0; hit(round);
  assert.ok(round.hp[0] < 1 && round.hp[0] > 0.7, 'a chunk, not all of it'); assert.ok(sounds.includes('ouch'));
  const after = round.hp[0], h = round.hud().health[0];
  assert.ok(h.hit > 0.5, 'a flash');
  const second = hit(round); assert.equal(round.hp[0], after, 'safe: no second chunk');
  assert.ok(round.things.includes(second), 'the thing goes through them');
  assert.equal(round.score[0], 0); assert.equal(round.value(), 0);
});

test('an empty bar means a few dizzy seconds with nothing counting, then half full and on; nobody is out', () => {
  const { round } = game();
  round.things.length = 0;
  for (let k = 0; k < 40 && round.dizzy[0] === 0; k++){ round.safe[0] = 0; hit(round); }
  assert.equal(round.hp[0], 0); assert.ok(round.dizzy[0] > 2 && round.dizzy[0] <= 3.01); assert.equal(round.lost[0], 1);
  const hits = round.hits[0]; hit(round); assert.equal(round.hits[0], hits, 'no hit counts while dizzy');
  assert.equal(round.hud().health[0].dizzy, true);
  run(round, 3.2);
  assert.equal(round.hp[0], 0.5, 'refilled to half'); assert.equal(round.lost[0], 1); assert.ok(!round.over);
});

test('things steer toward the players, so standing still is not safe, and the round ends on time', () => {
  const { round } = game();
  run(round, 40);
  assert.ok(round.hits[0] > 3, 'a player who stands still is hit (' + round.hits[0] + ')');
  assert.equal(round.score[0], 0, 'and nothing is earned');
  const { round: r2 } = game(); run(r2, 121); assert.ok(r2.over, 'ends on time');
});

test('the bars are in the corner where the scores would be, and results rows carry the bar, not a number', () => {
  const { round } = game(2);
  const pieces = layoutDocks(W, H, round.hud(), { players: [0, 1] });
  assert.ok(pieces.filter(p => p.kind === 'health').length === 2 && !pieces.some(p => p.kind === 'score'));
  assert.equal(healthLine(0), 'Nobody got dizzy!'); assert.match(healthLine(3), /kept going/);
});
