/* Playtest 2, finding 2: Keep up in a made game gives every player a ball of their own ("each"): it floats in their part of the screen, only they can bat
   it, it goes up only as high as they can reach, and it comes back a moment after it drops - so a child beside a grown-up has a fair game. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlay } from '../src/games/play/engine.js';
import { hudZones } from '../src/games/hud.js';
import { validate } from '../src/games/play/validate.js';
import { playEnv } from '../src/games/play/env.js';
import { build, defaultPicks, FLOAT_BACK } from '../src/create/recipe.js';

const DT = 1 / 30, W = 1920, H = 1080;
const KID = { centre: { x: 0.3, y: 0.66 }, scale: 0.3 }, ADULT = { centre: { x: 0.7, y: 0.5 }, scale: 0.55 };
function game(spec, bodies = [KID, ADULT]){
  let s = 3; const random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const hand = () => ({ x: 0.5, y: 1.6, vx: 0, vy: 0, speed: 0 });
  const pose = { players: Array.from({ length: 4 }, (_, i) => bodies[i] ? { present: true, ...bodies[i], hands: { left: hand(), right: hand() } } : { present: false, hands: { left: hand(), right: hand() } }), mouse: { active: false } };
  const sounds = [], A = { scene() {}, draw() {}, text() {}, color: () => '#ffd35c' };
  const g = makePlay(spec, { pose, sfx: new Proxy({}, { get: (_, k) => () => sounds.push(k) }), assets: A, ui: { say() {}, goal() {}, zones: hudZones }, colors: ['#3da9ff', '#ff8a3d', '#3fcf7f', '#c46bff'], max: 4, random });
  return { round: g.create(bodies.length), pose, sounds };
}
const run = (round, secs, each) => { for (let t = 0; t < secs; t += DT){ round.step(DT, W, H); if (each) each(); } };
const ballSpec = (extra = {}) => ({ secs: 300, things: [{ name: 'ball', piece: 'beachball', size: 0.12, moves: 'bounce', spins: true, each: true, appears: { every: 1, everyEnd: 1, max: 1, from: 'anywhere', wait: 1 }, rules: [{ when: 'touched', then: ['kickUp', 'score'] }, { when: 'lands', then: ['pop', 'vanish'] }], ...extra }] });
const bat = (round, pose, i, th) => { Object.assign(pose.players[i].hands.right, { x: th.x, y: th.y, speed: 0.5, vx: 0, vy: -1 }); round.step(DT, W, H); Object.assign(pose.players[i].hands.right, { x: 0.5, y: 1.6, speed: 0 }); };

test('"each" is a word: a ball only, true or false', () => {
  const env = playEnv();
  assert.deepEqual(validate(ballSpec(), env), []);
  assert.match(validate(ballSpec({ moves: 'fall', rules: [{ when: 'touched', then: ['vanish'] }] }), env).join(' '), /"each" is for a ball/);
  assert.match(validate(ballSpec({ each: 'yes' }), env).join(' '), /"each" is true or false/);
  const g = build({ ...defaultPicks(), things: [{ id: 'beachball', job: 'keepup' }] });
  assert.equal(g.things[0].each, true, 'a Keep up game made in Create gives everyone a ball');
  assert.deepEqual(validate(g, env), []);
  assert.equal(FLOAT_BACK, 1);
});

test('every player here has a ball in their colour of their own, in their own part of the screen', () => {
  const { round } = game(ballSpec(), [KID, ADULT, { centre: { x: 0.5, y: 0.66 }, scale: 0.3 }]);
  run(round, 1.2);
  assert.equal(round.things.length, 3, 'one each');
  assert.deepEqual(round.things.map(t => t.owner).sort(), [0, 1, 2]);
  for (const th of round.things) assert.ok(Math.abs(th.x - round.reach[th.owner].x) < 0.25, `ball ${th.owner} is near its player`);
  const absent = game(ballSpec(), [KID]); run(absent.round, 1.2);
  assert.equal(absent.round.things.length, 1, 'no ball for a place nobody stands in');
});

test('only a ball\'s own player can bat it', () => {
  const { round, pose } = game(ballSpec());
  run(round, 1.5);
  const mine = round.things.find(t => t.owner === 0);
  mine.y = 0.7; mine.vy = 0;
  bat(round, pose, 1, mine);
  assert.equal(round.score[1], 0, 'the grown-up cannot take the child\'s ball');
  bat(round, pose, 0, mine);
  assert.equal(round.score[0], 1, 'the child can');
  assert.ok(mine.vy < 0 && mine.up);
});

test('a ball goes up as far as its own player can reach - no further - and is not batted again until it has come down, nor within a moment', () => {
  const { round, pose } = game(ballSpec());
  run(round, 1.5);
  const apex = (i) => {
    let th = round.things.find(t => t.owner === i);
    for (let k = 0; !th && k < 200; k++){ round.step(DT, W, H); th = round.things.find(t => t.owner === i); }
    th.y = 0.6; th.vy = 0; th.x = round.reach[i].x; bat(round, pose, i, th);
    let top = th.y; for (let k = 0; k < 90 && th.vy < 0; k++){ round.step(DT, W, H); top = Math.min(top, th.y); }
    return { top, th };
  };
  const { top: kidTop, th: kid } = apex(0), { top: adultTop } = apex(1);
  assert.ok(kidTop > round.reach[0].top - 0.06, `the child's ball (${kidTop.toFixed(2)}) stays within the child's reach (${round.reach[0].top.toFixed(2)})`);
  assert.ok(adultTop < kidTop - 0.1, 'the grown-up\'s ball goes higher, to the grown-up\'s reach');
  /* no second bat while it is still going up (or within BAT of the first) */
  const s1 = round.score[0]; kid.y = 0.7; kid.vy = -0.2; kid.up = true; kid.cool = 0.5;
  bat(round, pose, 0, kid);
  assert.equal(round.score[0], s1, 'not again until it has come down');
});

test('a dropped ball pops with no point lost and a new one floats in about a second later, for that player only', () => {
  const { round, sounds } = game(ballSpec());
  run(round, 1.5);
  const kid = round.things.find(t => t.owner === 0), adult = round.things.find(t => t.owner === 1);
  kid.y = 0.89; kid.vy = 0.5;
  let gone = -1, t0 = 0; for (let t = 0; t < 3 && gone < 0; t += DT){ round.step(DT, W, H); if (kid.dead || !round.things.includes(kid)){ gone = t; } }
  assert.ok(gone >= 0, 'it popped');
  assert.ok(round.things.includes(adult), 'the grown-up\'s ball carries on');
  let back = 0; while (!round.things.some(t => t.owner === 0) && back < 4){ round.step(DT, W, H); back += DT; }
  assert.ok(back >= 0.9 && back <= 1.5, `a new one floats in about a second later (${back.toFixed(2)})`);
  void t0; void sounds;
});

test('a player who leaves takes their ball with them; a more of them each when asked, up to three', () => {
  const { round, pose } = game(ballSpec());
  run(round, 1.5);
  pose.players[0].present = false;
  let kidBall = 0, adultBall = 0;
  run(round, 8, () => { if (round.things.some(t => t.owner === 0)) kidBall++; if (round.things.some(t => t.owner === 1)) adultBall++; });
  assert.ok(kidBall < 30 * 3, 'the ball goes with its player (a few seconds at most)');
  assert.ok(!round.things.some(t => t.owner === 0), 'and no new one floats in');
  assert.ok(adultBall > 30 * 4, 'the other player\'s stays (and comes back when it drops)');
  const most = (max) => { const g = game(ballSpec({ appears: { every: 1, max, from: 'anywhere', wait: 1 } })); let m = 0; run(g.round, 12, () => { m = Math.max(m, g.round.things.filter(t => t.owner === 0).length); }); return m; };
  assert.equal(most(3), 3, 'three each when asked');
  assert.equal(most(40), 3, 'and three is the most each');
  assert.equal(most(1), 1);
});

test('with no body to measure (a stand-in) a ball each still plays: one per player, batted as before', () => {
  const { round, pose } = game(ballSpec(), [{}, {}]);
  run(round, 1.5);
  assert.equal(round.things.length, 2);
  const b = round.things.find(t => t.owner === 0); b.y = 0.6; b.vy = 0;
  bat(round, pose, 0, b);
  assert.equal(round.score[0], 1); assert.ok(b.vy < 0);
});
