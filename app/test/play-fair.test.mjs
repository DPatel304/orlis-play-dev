/* Playtest 2, finding 4: things a made game drops or floats are fair for the player who reaches least (games/reach.js): they are only there to
   touch once in that player's reach, come down the lanes where people stand a turn each, go no faster than that reach can be crossed, are a little
   bigger for a short arm, and are a player's own first. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlay } from '../src/games/play/engine.js';
import { hudZones } from '../src/games/hud.js';

const DT = 1 / 30, W = 1920, H = 1080;
/* a child (low and small) and a grown-up (tall), standing where the camera would put them (no landmarks: the tracker's centre and scale) */
const KID = { centre: { x: 0.3, y: 0.66 }, scale: 0.3 }, ADULT = { centre: { x: 0.7, y: 0.5 }, scale: 0.55 };
function game(spec, bodies = [KID, ADULT]){
  let s = 7; const random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const hand = () => ({ x: 0.5, y: 1.6, vx: 0, vy: 0, speed: 0 });
  const pose = { players: Array.from({ length: 4 }, (_, i) => bodies[i] ? { present: true, ...bodies[i], hands: { left: hand(), right: hand() } } : { present: false, hands: { left: hand(), right: hand() } }), mouse: { active: false } };
  const A = { scene() {}, draw() {}, text() {}, color: () => '#ffd35c' };
  const g = makePlay(spec, { pose, sfx: new Proxy({}, { get: () => () => {} }), assets: A, ui: { say() {}, goal() {}, zones: hudZones }, colors: ['#3da9ff', '#ff8a3d', '#3fcf7f', '#c46bff'], max: 4, random });
  const round = g.create(bodies.length);
  for (let k = 0; k < 40; k++) round.step(DT, W, H);   /* (the bands settle) */
  if (!spec.things[0].at) round.things.length = 0;
  return { round, pose };
}
const run = (round, secs, each) => { for (let t = 0; t < secs; t += DT){ round.step(DT, W, H); if (each) each(); } };
const falling = (extra = {}) => ({ secs: 300, things: [{ name: 'a', piece: 'apple', size: 0.09, moves: 'fall', speed: 0.11, appears: { every: 0.4, max: 20, from: 'top' }, rules: [{ when: 'touched', then: ['score', 'vanish'] }], ...extra }] });
const still = (x, y, extra = {}) => ({ secs: 300, things: [{ name: 'a', piece: 'apple', size: 0.09, count: 1, at: { x, y }, moves: 'fall', speed: 0, rules: [{ when: 'touched', then: ['score', 'vanish'] }], ...extra }] });
const handOn = (pose, i, x, y) => Object.assign(pose.players[i].hands.right, { x, y, speed: 0.1 });

test('the reach of the smallest player sets the band: the child is lower and has a shorter arm', () => {
  const { round } = game(falling());
  const [kid, adult] = round.here;
  assert.ok(kid.top > adult.top + 0.2, `the child's top (${kid.top.toFixed(2)}) is well below the grown-up's (${adult.top.toFixed(2)})`);
  assert.ok(kid.arm < adult.arm);
  assert.equal(round.low.top, kid.top); assert.ok(round.low.arm === kid.arm);
});

test('a grown-up cannot take a falling thing the child cannot reach yet', () => {
  const { round, pose } = game(still(0.7, 0.3));
  handOn(pose, 1, 0.7, 0.3);                               /* the grown-up's hand right on it, high up: in the grown-up's reach, not the child's */
  run(round, 1);
  assert.equal(round.score[1], 0, 'not yet there to touch');
  assert.equal(round.things.length, 1);
  round.things[0].y = round.low.top + 0.05; handOn(pose, 1, 0.7, round.things[0].y);   /* down in the child's reach */
  run(round, 0.2);
  assert.equal(round.score[1], 1, 'in the child\'s reach it is anyone\'s');
});

test('with only grown-ups, things are there to touch from high up', () => {
  const { round, pose } = game(still(0.5, 0.3), [ADULT]);
  handOn(pose, 0, 0.5, 0.3); run(round, 0.3);
  assert.equal(round.score[0], 1);
});

test('things come down where people stand, a turn each', () => {
  const { round } = game(falling(), [KID, ADULT, { centre: { x: 0.5, y: 0.66 }, scale: 0.3 }]);
  const lanes = [0, 0, 0];
  run(round, 60, () => { for (const th of round.things) if (th.age < DT * 1.01 && th.owner != null) lanes[th.owner]++; });
  const total = lanes.reduce((a, b) => a + b, 0);
  assert.ok(total > 40, 'most things come down somebody\'s lane (' + total + ')');
  for (const n of lanes) assert.ok(n > total / 3 * 0.7 && n < total / 3 * 1.3, 'each has about a third: ' + lanes);
  const near = [];
  for (const th of round.things) if (th.owner != null) near.push(Math.abs(th.x - round.here.find(h => h.i === th.owner).x));
  assert.ok(near.every(d => d < 0.4), 'and they stay near their own player');
});

test('a thing that came down somebody\'s lane is theirs for its first moments in reach, then anyone\'s', () => {
  const { round, pose } = game(still(0.5, 0.7), [KID, ADULT]);
  const th = round.things[0]; th.owner = 0; th.resv = 1.4;
  handOn(pose, 1, 0.5, 0.7); run(round, 0.5);
  assert.equal(round.score[1], 0, 'the grown-up cannot take the child\'s');
  th.resv = 0; run(round, 0.2);
  assert.equal(round.score[1], 1, 'after that it is anyone\'s');
  const own = game(still(0.5, 0.7), [KID, ADULT]); own.round.things[0].owner = 0; own.round.things[0].resv = 1.4;
  handOn(own.pose, 0, 0.5, 0.7); run(own.round, 0.2);
  assert.equal(own.round.score[0], 1, 'and the child can touch it at once');
  const gone = game(still(0.5, 0.7), [ADULT, ADULT]); gone.round.things[0].owner = 3; gone.round.things[0].resv = 1.4;
  handOn(gone.pose, 0, 0.5, 0.7); run(gone.round, 0.2);
  assert.equal(gone.round.score[0], 1, 'nobody holds a thing for a player who is not there');
});

test('things are never faster than the smallest reach is crossed in about three seconds, and a short arm gets bigger ones', () => {
  const quick = game(falling({ speed: 0.6, size: 0.09 }), [KID, ADULT]);
  run(quick.round, 20);
  const band = quick.round.low.bottom - quick.round.low.top;
  assert.ok(quick.round.things.length > 5);
  for (const th of quick.round.things) assert.ok(th.sp <= band / 3 + 1e-9, `speed ${th.sp.toFixed(3)} against a reach of ${band.toFixed(2)}`);
  const big = quick.round.things[0].sz, plain = game(falling({ speed: 0.6, size: 0.09 }), [ADULT]);
  run(plain.round, 20);
  assert.ok(big > 0.09 * 1.2 && big <= 0.09 * 1.35 + 1e-9, 'bigger for a short arm: ' + big);
  assert.equal(plain.round.things[0].sz, 0.09, 'unchanged for a grown-up');
  assert.ok(plain.round.things[0].sp > band / 3, 'and not slowed');
});

test('a Dodge thing is not made bigger or slower for a short player, and is always there to hit', () => {
  const spec = { secs: 300, things: [{ name: 'd', piece: 'rock', size: 0.09, moves: 'fall', speed: 0.5, appears: { every: 0.4, max: 20, from: 'top' }, rules: [{ when: 'touched', then: [{ score: -1 }, 'vanish'] }] }] };
  const { round } = game(spec, [KID, ADULT]);
  run(round, 10);
  assert.ok(round.things.every(th => th.sz === 0.09), 'size as written');
  assert.ok(round.things.every(th => round._live(th)), 'always live');
});
