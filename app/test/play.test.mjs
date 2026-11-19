import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate, parseGame, didYouMean } from '../src/games/play/validate.js';
import { playEnv } from '../src/games/play/env.js';
import { makePlay } from '../src/games/play/engine.js';
import { EXAMPLES, CATCH, POP, KEEP_UP } from '../src/games/play/examples.js';
import { MOVES, TRIGGERS, RESULTS, SOUNDS } from '../src/games/play/vocabulary.js';
import { assets, lock } from '../src/games/assets/index.js';
import { TEMPLATE } from '../src/ui/creator-kit.gen.js';

const env0 = playEnv(), DT = 1 / 30, W = 1920, H = 1080;
const people = () => ({ players: Array.from({ length: 4 }, (_, i) => ({ present: i < 2, hands: { left: { x: 0.1, y: 1.6, vx: 0, vy: 0, speed: 0 }, right: { x: 0.9, y: 1.6, vx: 0, vy: 0, speed: 0 } } })), mouse: { active: false } });
function game(spec, { n = 2, absent = false, seed = 1 } = {}){
  let s = seed; const random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pose = people(); if (absent) pose.players.forEach(p => { p.present = false; });
  const sounds = [], sfx = new Proxy({}, { get: (_, k) => () => sounds.push(k) });
  const drawn = [];
  const A = { scene: (c, w, h, id) => drawn.push(['scene', id]), draw: (c, id, x, y, size, o) => drawn.push(['draw', id, x, y, size, o]), text: (c, t) => drawn.push(['text', t]) };
  const ui = { say: (c, w, h, o) => drawn.push(['say', o.text]), goal: (c, w, h, k) => drawn.push(['goal', k]) };
  const g = makePlay(spec, { pose, sfx, assets: A, ui, colors: ['#3da9ff', '#ff8a3d', '#3fcf7f', '#c46bff'], max: 4, random });
  return { g, round: g.create(n), pose, sounds, drawn };
}
const run = (round, secs) => { for (let t = 0; t < secs; t += DT) round.step(DT, W, H); };
const touch = (pose, i, x, y, speed = 0.1, vx = 0, vy = 0) => Object.assign(pose.players[i].hands.right, { x, y, speed, vx, vy });
const away = (pose) => pose.players.forEach(p => Object.assign(p.hands.right, { x: 0.9, y: 1.6, speed: 0, vx: 0, vy: 0 }));

test('the three example games are in the vocabulary, and the starter template is the first one', () => {
  for (const [k, spec] of Object.entries(EXAMPLES)) assert.deepEqual(validate(spec, env0), [], k);
  const parsed = parseGame(TEMPLATE['game.js']);
  assert.ok(!parsed.error, parsed.error);
  assert.deepEqual(parsed.spec, CATCH, 'the starter is Catch');
});

test('wrong words say what is wrong and what was probably meant', () => {
  const bad = validate({ secs: 5, scene: 'medow', hint: 'one two three four five six', things: [{ piece: 'stra', moves: 'fal', rules: [{ when: 'touch', then: ['popp', { sound: 'x' }] }] }] }, env0).join('\n');
  for (const m of [/"secs" must be a number from 20 to 600/, /did you mean "meadow"/, /more than four words/, /did you mean "star"/, /did you mean "fall"/, /did you mean "touched"/, /did you mean "pop"/, /isn't a sound/, /needs "appears"/]) assert.match(bad, m);
  assert.equal(didYouMean('ballon', ['balloon', 'star']), 'balloon');
  assert.equal(didYouMean('xyzzy', ['balloon', 'star']), null);
  assert.match(validate('nope', env0)[0], /needs an object/);
  assert.match(validate({ things: [] }, env0).join(' '), /at least one thing/);
  assert.match(validate({ ...CATCH, extra: 1 }, env0).join(' '), /"extra" isn't a game setting/);
  assert.match(validate({ ...CATCH, things: [{ ...CATCH.things[0], rules: [{ when: 'touched', then: [{ spawn: 'nothing' }] }] }] }, env0).join(' '), /spawn/);
  assert.match(validate({ ...KEEP_UP, things: [{ ...POP.things[0], rules: [{ when: 'touched', then: ['kickUp'] }] }] }, env0).join(' '), /"kickUp" is for a ball/);
  assert.match(validate({ endless: true, things: CATCH.things }, env0).join(' '), /needs a goal/);
});

test('a game is plain JSON in Orlis.play( ... ): no code, nothing else', () => {
  assert.ok(parseGame('/* mine */\nOrlis.play({"things":[]});').spec);
  for (const bad of ['Orlis.run({})', 'const x = 1;\nOrlis.play({})', 'Orlis.play({ things: [] })', 'Orlis.play({"a": 1,})', 'Orlis.play({"a": () => 1})', 'x = 1; Orlis.play({}); y = 2'])
    assert.ok(parseGame(bad).error, bad);
});

test('every word in the vocabulary has a plain description, and the engine knows every one', () => {
  for (const o of [MOVES, TRIGGERS, RESULTS]) for (const [k, v] of Object.entries(o)) assert.ok(v.doc && v.doc.length > 8, k);
  const engine = readFileSync(new URL('../src/games/play/engine.js', import.meta.url), 'utf8');
  for (const k of Object.keys(RESULTS)) assert.ok(engine.includes(`case '${k}'`), 'the engine does ' + k);
  for (const k of Object.keys(MOVES)) assert.ok(k === 'stay' || engine.includes(`case '${k}'`), 'the engine moves ' + k);
  for (const k of Object.keys(TRIGGERS)) assert.ok(engine.includes(`'${k}'`), 'the engine watches for ' + k);
  for (const s of SOUNDS) assert.match(s, /^[a-z]+$/);
});

test('Catch: stars fall, a touching hand catches one - it scores for that player, sparkles, and goes', () => {
  const { round, pose, sounds } = game(CATCH);
  run(round, 4);
  assert.ok(round.things.length > 0 && round.things.length <= 9, 'stars keep coming, up to the most');
  const s = round.things[0];
  touch(pose, 1, s.x, s.y); round.step(DT, W, H);
  assert.equal(round.score[1], 1); assert.equal(round.score[0], 0);
  assert.ok(!round.things.includes(s), 'caught: gone');
  assert.ok(round.fx.some(f => f.kind === 'sparkle'), 'a sparkle'); assert.ok(sounds.includes('pop'));
  assert.equal(round.value(), 1); assert.deepEqual(round.hud().score.slice(0, 2), [0, 1]);
  /* stars that fall off the bottom just go */
  away(pose); run(round, 30);
  assert.ok(round.things.every(t => t.y < 1.15), 'nothing piles up off screen');
});

test('Catch: things come faster as the round goes on, and nobody scores in an empty room', () => {
  const early = game(CATCH, { seed: 3 }), late = game(CATCH, { seed: 3 });
  late.round.t = 80;     /* (late in the round: the gap is nearly everyEnd) */
  let a = 0, b = 0;
  for (let t = 0; t < 20; t += DT){ const na = early.round.things.length; early.round.step(DT, W, H); if (early.round.things.length > na) a++; const nb = late.round.things.length; late.round.step(DT, W, H); if (late.round.things.length > nb) b++; }
  assert.ok(b > a, `${b} late vs ${a} early`);
  const empty = game(CATCH, { absent: true }); run(empty.round, 60);
  assert.deepEqual(empty.round.score, [0, 0, 0, 0]); assert.equal(empty.round.value(), 0); assert.ok(!empty.round.over);
});

test('Pop: balloons rise, and a touch pops one - it scores, rings, and goes', () => {
  const { round, pose } = game(POP);
  run(round, 5);
  const up = round.things[0], y0 = up.y; run(round, 0.5); assert.ok(up.y < y0, 'it rises');
  round.things = [up];        /* (one balloon under the hand) */
  touch(pose, 0, up.x, up.y); round.step(DT, W, H);
  assert.equal(round.score[0], 1); assert.ok(round.fx.some(f => f.kind === 'popring'), 'a ring pops out');
  assert.ok(!round.things.includes(up));
  away(pose);
  run(round, 40); assert.ok(round.things.every(t => t.y > -0.15), 'balloons that float away are gone');
});

test('"swiped" needs a fast hand where "touched" does not', () => {
  const spec = { secs: 60, things: [{ piece: 'bunny', size: 0.1, count: 1, at: { x: 0.5, y: 0.5 }, moves: 'stay', rules: [{ when: 'swiped', then: ['score'] }] }] };
  const { round, pose } = game(spec);
  const b = round.things[0];
  touch(pose, 0, 0.5, 0.5, 0.1); round.step(DT, W, H); assert.equal(round.score[0], 0, 'a slow hand resting on it does nothing');
  b.cool = 0; touch(pose, 0, 0.5, 0.5, 0.9); round.step(DT, W, H); assert.equal(round.score[0], 1, 'a sweep does');
});

test('Keep it up: the ball is there from the start, falls, bounces and stays on screen; a hit sends it up and scores', () => {
  const { round, pose } = game(KEEP_UP);
  assert.equal(round.things.length, 1);
  const ball = round.things[0];
  let low = 0, high = 1;
  for (let t = 0; t < 12; t += DT){ round.step(DT, W, H); low = Math.max(low, ball.y); high = Math.min(high, ball.y); assert.ok(ball.x >= 0.05 && ball.x <= 0.95); }
  assert.ok(low <= 0.9 + 1e-9 && high >= 0.2 - 1e-9, `it stays between the ceiling and the floor (${high}..${low})`);
  Object.assign(ball, { y: 0.6, vy: 0.4, vx: 0, cool: 0 });
  touch(pose, 0, ball.x, ball.y, 0.5, 0.6, -0.8); round.step(DT, W, H);
  assert.ok(ball.vy < 0, 'sent up'); assert.ok(ball.vx > 0, 'a little the way the hand went'); assert.equal(round.score[0], 1);
});

test('rules: age, lands, leftScreen, become, grow, say, spawn, celebrate, sound and the goal', () => {
  const spec = { secs: 60, scene: 'meadow', hint: '\u{1F34E} Hello!', goal: { score: 3, ends: true }, things: [
    { name: 'apple', piece: 'apple', size: 0.1, appears: { every: 5, from: 'top', max: 1 }, moves: 'fall', speed: 0.3,
      rules: [{ when: 'touched', then: ['grow', { become: 'pear' }, { say: '\u{1F350} A pear!' }, { spawn: 'sparkler' }, 'score', { score: 2 }, 'celebrate'] }, { when: 'age', after: 1, then: [{ sound: 'chime' }] }] },
    { name: 'sparkler', piece: 'sparkles', size: 0.05, count: 0 + 1, at: { x: 0.2, y: 0.2 }, moves: 'bob', rules: [{ when: 'age', after: 0.5, then: ['vanish'] }] }
  ] };
  assert.deepEqual(validate(spec, env0), []);
  const { round, pose, sounds } = game(spec);
  run(round, 1.5);
  assert.ok(sounds.includes('chime'), 'age fires once after its time');
  assert.equal(round.things.filter(t => t.d.name === 'sparkler').length, 0, 'it vanished after half a second');
  const a = round.things.find(t => t.d.name === 'apple'), size = a.sz;
  touch(pose, 0, a.x, a.y); round.step(DT, W, H);
  assert.equal(a.piece, 'pear'); assert.ok(a.sz > size); assert.equal(round.hint, '\u{1F350} A pear!');
  assert.equal(round.score[0], 3); assert.ok(round.cheering > 0);
  assert.ok(round.things.some(t => t.d.name === 'sparkler'), 'it spawned another thing');
  /* the goal was reached: it ends a moment later, with a cheer */
  assert.ok(!round.over); run(round, 3); assert.ok(round.over);
});

test('a game that ends by the clock does, and one that is endless runs to its goal', () => {
  const a = game({ ...CATCH, secs: 20 }); run(a.round, 19); assert.ok(!a.round.over); run(a.round, 2); assert.ok(a.round.over);
  assert.equal(makePlay({ ...CATCH, secs: 45 }, { max: 4 }).secs, 45);
  assert.equal(makePlay({ ...CATCH, endless: true }, { max: 4 }).endless, true);
});

test('the move card shows for as long as asked, then goes', () => {
  const { round } = game(CATCH);
  assert.equal(round.card(), 'reach'); run(round, 9); assert.equal(round.card(), null);
  assert.equal(game({ ...CATCH, cardFor: undefined }).round.card(), 'reach');
  assert.equal(game({ ...CATCH, card: undefined }).round.card(), null);
});

test('it draws with the library only: scene, pieces, effects, words, the hint, the goal bar and the hands, through a locked canvas', () => {
  const { round, pose, drawn } = game(CATCH);
  run(round, 3);
  const s = round.things[0]; touch(pose, 0, s.x, s.y); round.step(DT, W, H);
  round.draw({}, W, H);
  const kinds = new Set(drawn.map(d => d[0]));
  for (const k of ['scene', 'draw', 'text', 'say', 'goal']) assert.ok(kinds.has(k), k);
  assert.ok(drawn.some(d => d[0] === 'draw' && d[1] === 'hand'), 'the hands, last');
  assert.equal(drawn.filter(d => d[0] !== 'scene' && d[0] !== 'text' && d[0] !== 'say' && d[0] !== 'goal').pop()[1], 'hand');
  /* and for real: the real library, drawing on a locked canvas, never throws */
  const fake = new Proxy({ globalAlpha: 1 }, { get(t, k){ if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop(){} }); if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set(t, k, v){ t[k] = v; return true; } });
  const pose2 = people(), g = makePlay(POP, { pose: pose2, sfx: new Proxy({}, { get: () => () => {} }), assets, ui: { say(){}, goal(){} }, colors: ['#3da9ff', '#ff8a3d', '#3fcf7f', '#c46bff'], max: 4 });
  const r2 = g.create(2); run(r2, 6);
  assert.doesNotThrow(() => r2.draw(lock(fake), W, H));
});
