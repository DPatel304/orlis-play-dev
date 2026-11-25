/* Playtest 2, finding 1: things in a made game spawn and travel where they can be touched, and are never touched (or looked for) under the
   clock, the goal bar or the score corner. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlay } from '../src/games/play/engine.js';
import { hudZones, underHud } from '../src/games/hud.js';

const DT = 1 / 30, W = 1920, H = 1080;
function game(spec, n = 1, { zones = true } = {}){
  let s = 11; const random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pose = { players: Array.from({ length: 4 }, (_, i) => ({ present: i < n, hands: { left: { x: 0.1, y: 1.6, vx: 0, vy: 0, speed: 0 }, right: { x: 0.9, y: 1.6, vx: 0, vy: 0, speed: 0 } } })), mouse: { active: false } };
  const sounds = [], sfx = new Proxy({}, { get: (_, k) => () => sounds.push(k) });
  const A = { scene() {}, draw() {}, text() {}, color: () => '#ffd35c' };
  const g = makePlay(spec, { pose, sfx, assets: A, ui: { say() {}, goal() {}, ...(zones ? { zones: hudZones } : {}) }, colors: ['#3da9ff', '#ff8a3d', '#3fcf7f', '#c46bff'], max: 4, random });
  return { round: g.create(n), pose, sounds };
}
const run = (round, secs, each) => { for (let t = 0; t < secs; t += DT){ round.step(DT, W, H); if (each) each(); } };
const fall = (extra = {}) => ({ secs: 120, things: [{ name: 'a', piece: 'apple', size: 0.095, sway: 0.02, moves: 'fall', speed: 0.11, appears: { every: 0.3, max: 30, from: 'top' }, rules: [{ when: 'touched', then: ['score', 'vanish'] }], ...extra }] });

test('things that fall start below the clock, goal bar and scores, grow in there, and are never under them', () => {
  const { round } = game(fall());
  let seen = 0, grown = 0, under = 0;
  run(round, 90, () => {
    for (const th of round.things){
      if (th.age > 0.05){ seen++; if (underHud(W, H, th.x * W, th.y * H, round.hud())) under++; }
      if (th.pop) grown++;
    }
  });
  assert.ok(seen > 500, 'plenty of things were looked at (' + seen + ')');
  assert.ok(grown > 20, 'some come in under the shell\'s areas and grow in below them');
  assert.ok(under / seen < 0.02, `under the shell's areas for ${(under / seen * 100).toFixed(1)}% of their time`);
});

test('a thing under the shell\'s areas is not touched, however close the hand; the same thing outside them is', () => {
  const still = (x, y) => ({ secs: 60, things: [{ name: 'a', piece: 'apple', size: 0.09, count: 1, at: { x, y }, moves: 'stay', rules: [{ when: 'touched', then: ['score', 'vanish'] }] }] });
  const clock = hudZones(W, H).clock, cx = (clock.x + clock.w / 2) / W, cy = (clock.y + clock.h / 2) / H;
  const a = game(still(cx, cy));
  Object.assign(a.pose.players[0].hands.right, { x: cx, y: cy, speed: 0.1 });
  run(a.round, 1);
  assert.equal(a.round.score[0], 0, 'under the clock: not caught');
  assert.equal(a.round.things.length, 1, 'and it stays');
  const b = game(still(0.5, 0.5));
  Object.assign(b.pose.players[0].hands.right, { x: 0.5, y: 0.5, speed: 0.1 });
  run(b.round, 1);
  assert.equal(b.round.score[0], 1, 'in the middle of the screen: caught');
  /* with no zones given (a stand-in screen) nothing is held back */
  const c = game(still(cx, cy), 1, { zones: false });
  Object.assign(c.pose.players[0].hands.right, { x: cx, y: cy, speed: 0.1 });
  run(c.round, 1);
  assert.equal(c.round.score[0], 1);
});

test('things floating up into the shell\'s areas go (and count as having left the screen) instead of being touchable there', () => {
  const spec = { secs: 120, things: [{ name: 'b', piece: 'balloon', size: 0.1, moves: 'rise', speed: 0.2, appears: { every: 0.5, max: 12, from: 'bottom' }, rules: [{ when: 'touched', then: ['score', 'vanish'] }, { when: 'leftScreen', then: ['sparkle'] }] }] };
  const { round } = game(spec);
  let leaving = 0, touchableUnder = 0;
  run(round, 60, () => { for (const th of round.things){ if (th.leaving > 0) leaving++; if (!th.leaving && underHud(W, H, th.x * W, th.y * H, round.hud()) && th.age > 0.5 && th.y < 0.5) touchableUnder++; } });
  assert.ok(leaving > 10, 'balloons that reach them are on their way out');
  assert.ok(touchableUnder < 10, 'and are not left sitting under them (' + touchableUnder + ' frames)');
  assert.ok(round.things.every(t => t.y > -0.2), 'none drifts off the top');
});

test('a ball goes round the shell\'s areas as off a wall, and drifting things cross at heights clear of them', () => {
  const ball = { secs: 120, things: [{ name: 'k', piece: 'beachball', size: 0.13, at: { x: 0.2, y: 0.3 }, moves: 'bounce', rules: [{ when: 'touched', then: ['kickUp', 'score'] }] }] };
  const { round } = game(ball);
  round.things[0].vx = 0.3; round.things[0].vy = -0.2;
  let under = 0, n = 0;
  run(round, 20, () => { const th = round.things[0]; n++; if (underHud(W, H, th.x * W, th.y * H, round.hud())) under++; });
  assert.ok(under / n < 0.03, `the ball spent ${(under / n * 100).toFixed(1)}% of the time under them`);
  const drift = { secs: 120, things: [{ name: 'd', piece: 'rock', size: 0.1, moves: 'drift', speed: 0.15, appears: { every: 0.5, max: 12 }, rules: [{ when: 'touched', then: ['score', 'vanish'] }] }] };
  const g = game(drift); let u = 0, m = 0;
  run(g.round, 60, () => { for (const th of g.round.things){ m++; if (underHud(W, H, th.x * W, th.y * H, g.round.hud())) u++; } });
  assert.ok(u / m < 0.03, `drifting things spent ${(u / m * 100).toFixed(1)}% of the time under them`);
});

test('the move card\'s and the badge\'s areas are the game\'s again when it shows neither', () => {
  const z = hudZones(W, H, { unused: ['badge', 'card'] });
  assert.ok(!z.badge && !z.card && z.top && z.clock && z.score);
  assert.ok(hudZones(W, H).badge && hudZones(W, H).card, 'unchanged for a game that does not say');
  const { round } = game({ secs: 60, card: 'reach', cardFor: 8, things: [{ name: 'a', piece: 'apple', count: 1, at: { x: 0.5, y: 0.5 }, moves: 'stay', rules: [] }] });
  assert.ok(round.hud().unused.includes('badge') && !round.hud().unused.includes('card'), 'the card is kept clear while it is up');
  run(round, 9);
  assert.deepEqual(round.hud().unused, ['badge', 'card']);
});
