/* The hands in Orlis.play games (decision 0062): glow orbs, a burst on a catch, a pull toward things to catch (never things to dodge),
   a glow on them - and the rules, hits and scores exactly as before: the pull and the glow are only drawn. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlay } from '../src/games/play/engine.js';
import { CATCH } from '../src/games/play/examples.js';
import { setHandsMode } from '../src/ui/handsmode.js';

const DT = 1 / 30, W = 1920, H = 1080;
const people = () => ({ players: Array.from({ length: 4 }, (_, i) => ({ present: i < 2, hands: { left: { x: 0.1, y: 1.6, vx: 0, vy: 0, speed: 0 }, right: { x: 0.9, y: 1.6, vx: 0, vy: 0, speed: 0 } } })), mouse: { active: false } });
function game(spec, seed = 1){
  let s = seed; const random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pose = people(), sounds = [], drawn = [];
  const sfx = new Proxy({}, { get: (_, k) => () => sounds.push(k) });
  const A = { scene(){}, draw: (c, id, x, y, size, o) => drawn.push(['draw', id, x, y, size, o]), text(){} };
  const g = makePlay(spec, { pose, sfx, assets: A, ui: { say(){}, goal(){} }, colors: ['#3da9ff', '#ff8a3d', '#3fcf7f', '#c46bff'], max: 4, random });
  return { round: g.create(2), pose, sounds, drawn };
}
const run = (round, secs) => { for (let t = 0; t < secs; t += DT) round.step(DT, W, H); };
const DODGE = { ...CATCH, things: [{ ...CATCH.things[0], rules: [{ when: 'touched', then: [{ score: -1 }, 'vanish'] }] }] };

test('the hands are glow orbs, drawn last, with the pose untouched', () => {
  setHandsMode('orb');
  const { round, pose, drawn } = game(CATCH);
  run(round, 3);
  round.draw({}, W, H);
  const hands = drawn.filter(d => d[1] === 'hand');
  assert.equal(hands.length, 4, 'two players, two hands each');
  assert.ok(hands.every(h => h[5].orb && h[5].W === W && h[5].H === H), 'each carries its orb');
  assert.equal(drawn[drawn.length - 1][1], 'hand');
  assert.equal(pose.players[0].hands.right.y, 1.6);
});

test('a catch squashes that player\'s orb and plays a burst where it happened; a good thing is a target, a thing to dodge is not', () => {
  setHandsMode('orb');
  const { round, pose } = game(CATCH);
  run(round, 3);
  const star = round.things[0];
  Object.assign(pose.players[0].hands.right, { x: star.x, y: star.y, speed: 0.1 });
  round.step(DT, W, H);
  assert.equal(round.score[0], 1, 'the catch itself, as ever');
  assert.ok(round.fx.some(f => f.kind === 'hitburst'), 'a burst where it was caught');
  assert.ok(round.feel.orbs.get('0R').orb.sq > 0.2, 'the orb squashed');
  const d = game(DODGE); run(d.round, 3);
  assert.equal(d.round._touchable(d.round.things[0]), false, 'a thing to dodge is not a target');
  assert.equal(round._touchable(round.things[0]), true);
});

test('the pull and the glow are only drawn: a hand just out of reach catches nothing, however near it is drawn', () => {
  setHandsMode('orb');
  const { round, pose, drawn } = game({ ...CATCH, things: [{ ...CATCH.things[0], appears: undefined, count: 1, at: { x: 0.5, y: 0.5 }, moves: 'stay' }] });
  run(round, 1);
  const th = round.things[0], out = th.sz / 2 + 0.045 + 0.03;       /* a hand's reach is the thing's radius + 0.045 */
  Object.assign(pose.players[0].hands.right, { x: th.x + out / (W / H), y: th.y, speed: 0.1 });
  for (let i = 0; i < 60; i++) round.step(DT, W, H);
  assert.equal(round.score[0], 0, 'not caught');
  const orb = round.feel.orbs.get('0R').orb;
  assert.ok(Math.hypot((orb.x - th.x) * W / H, orb.y - th.y) < out - 0.01, 'but the drawn orb leans toward it');
  drawn.length = 0; round.draw({}, W, H);
  assert.ok(drawn.some(d => d[1] === 'dot'), 'and the thing glows');
});
