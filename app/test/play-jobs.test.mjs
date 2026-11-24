/* The words Orlis.play learned for Create's jobs (decision 0059): "stack" (a thing flies onto a tower; a full tower blasts off for a bonus),
   "wobble" (a bump), appears.wait (a thing that has gone is replaced no sooner than that), and what each job does in a round. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../src/games/play/validate.js';
import { playEnv } from '../src/games/play/env.js';
import { makePlay } from '../src/games/play/engine.js';
import { RESULTS, LIMITS } from '../src/games/play/vocabulary.js';
import { build, addThing, setJob, defaultPicks, TOWER, FLOAT_BACK } from '../src/create/recipe.js';

const env0 = playEnv(), DT = 1 / 30, W = 1920, H = 1080;
function game(spec, n = 1){
  let s = 5; const random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pose = { players: Array.from({ length: 4 }, (_, i) => ({ present: i < n, hands: { left: { x: 0.1, y: 1.6, vx: 0, vy: 0, speed: 0 }, right: { x: 0.9, y: 1.6, vx: 0, vy: 0, speed: 0 } } })), mouse: { active: false } };
  const sounds = [], sfx = new Proxy({}, { get: (_, k) => () => sounds.push(k) });
  const drawn = [];
  const A = { scene() {}, draw: (c, id, x, y, size) => drawn.push([id, x, y, size]), text() {}, color: () => '#ffd35c' };
  const g = makePlay(spec, { pose, sfx, assets: A, ui: { say() {}, goal() {} }, colors: ['#3da9ff', '#ff8a3d', '#3fcf7f', '#c46bff'], max: 4, random });
  return { round: g.create(n), pose, sounds, drawn };
}
const run = (round, secs) => { for (let t = 0; t < secs; t += DT) round.step(DT, W, H); };
const touch = (pose, x, y) => Object.assign(pose.players[0].hands.right, { x, y, speed: 0.1, vx: 0, vy: 0 });
const away = (pose) => Object.assign(pose.players[0].hands.right, { x: 0.9, y: 1.6, speed: 0, vx: 0, vy: 0 });
/* a still thing that stacks when touched: three of them, side by side */
const stackSpec = (full = 3) => ({
  secs: 60, scene: 'meadow', things: [0.2, 0.4, 0.6, 0.8].map((x, i) => ({ name: 'stack-' + i, piece: 'apple', count: 1, at: { x, y: 0.3 }, moves: 'stay', size: 0.09, rules: [{ when: 'touched', then: [{ stack: full }, 'score', { sound: 'whoosh' }, 'vanish'] }] }))
});

test('the new words are in the vocabulary and the check knows their limits', () => {
  assert.ok(RESULTS.stack && RESULTS.wobble, 'stack and wobble are words');
  assert.deepEqual(LIMITS.tower, [3, 10]); assert.deepEqual(LIMITS.wait, [0.2, 10]);
  const spec = (then, appears = { every: 1, from: 'top' }) => ({ things: [{ piece: 'apple', moves: 'fall', appears, rules: [{ when: 'touched', then }] }] });
  assert.deepEqual(validate(spec(['stack', 'score', 'wobble', 'vanish']), env0), [], 'a plain "stack" and "wobble" are fine');
  assert.deepEqual(validate(spec([{ stack: 6 }, 'vanish']), env0), []);
  assert.deepEqual(validate(spec([{ stack: 3 }, { stack: 10 }]), env0), [], 'the least and most');
  for (const bad of [2, 11, 'six', null, 0.5]) assert.match(validate(spec([{ stack: bad }]), env0).join(' '), /"tower" must be a number from 3 to 10/, String(bad));
  assert.deepEqual(validate(spec(['vanish'], { every: 1, wait: 1 }), env0), []);
  for (const bad of [0, 0.1, 11, 'x']) assert.match(validate(spec(['vanish'], { every: 1, wait: bad }), env0).join(' '), /"wait" must be a number from 0.2 to 10/, String(bad));
  assert.match(validate(spec(['vanish'], { every: 1, waiting: 1 }), env0).join(' '), /appears setting/, 'other keys are still turned away');
});

test('stack: a touched thing flies to the tower and lands on it', () => {
  const { round, pose, sounds, drawn } = game(stackSpec(6));
  touch(pose, 0.2, 0.3); round.step(DT, W, H); away(pose);
  assert.equal(round.fliers.length, 1, 'it is flying'); assert.equal(round.tower.length, 0); assert.equal(round.score[0], 1, 'a point for each block');
  assert.equal(round.counts['stack-0'], 1, 'counted for the results');
  assert.ok(sounds.includes('whoosh'));
  /* drawn on its way, on top of the picture */
  round.draw(new Proxy({}, { get: () => () => {}, set: () => true }), W, H);
  assert.ok(drawn.some(d => d[0] === 'apple'), 'the flying block is drawn');
  run(round, 0.6);
  assert.equal(round.fliers.length, 0); assert.equal(round.tower.length, 1); assert.equal(round.tower[0].piece, 'apple');
  assert.ok(sounds.includes('pop'), 'a sound as it lands');
  /* it stands at the bottom of the screen */
  drawn.length = 0; round.draw(new Proxy({}, { get: () => () => {}, set: () => true }), W, H);
  const block = drawn.find(d => d[0] === 'apple'); assert.ok(block[2] > 0.8 * H, 'low on the screen');
});

test('stack: a full tower blasts off for a bonus, a new tower starts, the rocket leaves', () => {
  const { round, pose, sounds } = game(stackSpec(3));
  for (const x of [0.2, 0.4]){ touch(pose, x, 0.3); round.step(DT, W, H); away(pose); run(round, 0.6); }
  assert.equal(round.tower.length, 2); assert.equal(round.rockets.length, 0);
  touch(pose, 0.6, 0.3); round.step(DT, W, H); away(pose);
  assert.equal(round.score[0], 3, 'one point a block so far');
  run(round, 0.6);
  assert.equal(round.rockets.length, 1, 'three blocks: it is a rocket'); assert.equal(round.rockets[0].blocks.length, 3); assert.equal(round.tower.length, 0, 'a new tower');
  assert.equal(round.score[0], 3 + 5, 'the bonus is 5'); assert.equal(round.towers, 1);
  assert.ok(sounds.includes('liftoff') && sounds.includes('hooray'));
  assert.equal(round.hint, 'Blast off!');
  run(round, 5);
  assert.equal(round.rockets.length, 0, 'the rocket is gone');
  /* and the new tower can be built */
  touch(pose, 0.8, 0.3); round.step(DT, W, H); away(pose); run(round, 0.6);
  assert.equal(round.tower.length, 1);
});

test('stack: the tower is as tall as the thing says (3 to 10), 6 when it does not', () => {
  const t6 = game({ secs: 60, things: [{ name: 'a', piece: 'apple', count: 1, at: { x: 0.5, y: 0.3 }, moves: 'stay', rules: [{ when: 'touched', then: ['stack', 'vanish'] }] }, ...[0.1, 0.2, 0.3, 0.4, 0.7, 0.8].map((x, i) => ({ name: 'b' + i, piece: 'apple', count: 1, at: { x, y: 0.3 }, moves: 'stay', rules: [{ when: 'touched', then: ['stack', 'vanish'] }] }))] });
  for (const x of [0.5, 0.1, 0.2, 0.3, 0.4]){ touch(t6.pose, x, 0.3); t6.round.step(DT, W, H); away(t6.pose); run(t6.round, 0.6); }
  assert.equal(t6.round.tower.length, 5); assert.equal(t6.round.rockets.length, 0, 'five is not yet six');
  touch(t6.pose, 0.7, 0.3); t6.round.step(DT, W, H); away(t6.pose); run(t6.round, 0.6);
  assert.equal(t6.round.rockets.length, 1, 'the sixth blasts off');
});

test('wobble: a quick bump that fades', () => {
  const { round, pose } = game({ secs: 60, things: [{ piece: 'apple', count: 1, at: { x: 0.5, y: 0.5 }, moves: 'stay', rules: [{ when: 'touched', then: ['wobble', 'vanish'] }] }] });
  assert.equal(round.wob, 0);
  touch(pose, 0.5, 0.5); round.step(DT, W, H); away(pose);
  assert.ok(round.wob > 0.3, 'wobbling');
  const moved = []; const c = { save() {}, restore() {}, translate: (x, y) => moved.push([x, y]) };
  round.draw(c, W, H); assert.ok(moved.length === 1 && (moved[0][0] !== 0 || moved[0][1] !== 0), 'the picture is nudged');
  run(round, 1); assert.equal(round.wob, 0); moved.length = 0; round.draw(c, W, H); assert.equal(moved.length, 0, 'still again');
});

test('appears.wait: a thing that has gone is replaced no sooner than that', () => {
  const spec = { secs: 60, things: [{ name: 'ball', piece: 'beachball', moves: 'bounce', appears: { every: 0.2, max: 1, from: 'anywhere', wait: 1 }, rules: [{ when: 'touched', then: ['vanish'] }] }] };
  const { round, pose } = game(spec);
  run(round, 1); assert.equal(round.things.length, 1, 'one comes in');
  const b = round.things[0]; touch(pose, b.x, b.y); round.step(DT, W, H); away(pose);
  assert.equal(round.things.length, 0, 'gone');
  run(round, 0.8); assert.equal(round.things.length, 0, 'not yet - it waits');
  run(round, 0.5); assert.equal(round.things.length, 1, 'then a new one floats in');
  /* without "wait" a quick thing comes straight back */
  const quick = game({ ...spec, things: [{ ...spec.things[0], appears: { every: 0.2, max: 1, from: 'anywhere' } }] });
  run(quick.round, 1); const q = quick.round.things[0]; touch(quick.pose, q.x, q.y); quick.round.step(DT, W, H); away(quick.pose); run(quick.round, 0.5);
  assert.equal(quick.round.things.length, 1);
});

/* ---------- what the four jobs do (create/recipe.js build) ---------- */
const withJobs = (...pairs) => { let p = { ...defaultPicks(), things: [], golden: false, bomb: false }; for (const [id, j] of pairs) p = setJob(addThing(p.things.length ? p : { ...p, things: [{ id, job: j }] }, id), id, j); return p; };

test('Collect: things come in and a touch scores one with a sparkle; some float, some fall', () => {
  const g = build(withJobs(['apple', 'collect'], ['balloon', 'collect']));
  assert.deepEqual(validate(g, env0), []);
  assert.equal(g.things[0].moves, 'fall'); assert.equal(g.things[1].moves, 'rise', 'a balloon floats in');
  assert.deepEqual(g.things[0].rules[0].then, ['sparkle', 'score', { sound: 'twinkle' }, 'vanish']);
  const { round, pose, sounds } = game(g); run(round, 8);
  const t = round.things.find(x => x.d.name === 'collect-apple'), was = round.score[0]; touch(pose, t.x, t.y); round.step(DT, W, H);
  assert.ok(round.score[0] > was); assert.ok(round.fx.some(f => f.kind === 'sparkle')); assert.ok(sounds.includes('twinkle')); assert.equal(round.counts['collect-apple'], 1);
});

test('Dodge: things drift through; a touch costs a point (never below zero) with a bump, a sound and a wobble; one let go by is a point', () => {
  const g = build(withJobs(['bee', 'dodge']));
  assert.equal(g.things[0].moves, 'drift');
  const { round, pose, sounds } = game(g); run(round, 30);
  const before = round.score[0]; assert.ok(before > 0, 'dodged things score');
  const t = round.things[0]; round.things = [t]; touch(pose, t.x, t.y); round.step(DT, W, H); away(pose);
  assert.equal(round.score[0], before - 1); assert.ok(sounds.includes('boing')); assert.ok(round.wob > 0, 'a wobble');
  /* a fresh round: nothing scored, a touch cannot go below zero */
  const z = game(g); run(z.round, 0.6); const tz = z.round.things[0]; touch(z.pose, tz.x, tz.y); z.round.step(DT, W, H);
  assert.equal(z.round.score[0], 0); assert.equal(z.round.total, 0);
});

test('Keep up: a ball bounces, each touch bats it up and scores, a drop pops it and a new one floats in about a second later', () => {
  const g = build(withJobs(['beachball', 'keepup']));
  assert.equal(g.things[0].moves, 'bounce'); assert.equal(g.things[0].appears.wait, FLOAT_BACK); assert.equal(FLOAT_BACK, 1);
  const { round, pose, sounds } = game(g);
  while (!round.things.length) round.step(DT, W, H);
  const ball = round.things[0]; ball.y = 0.5; ball.vy = 0;
  Object.assign(pose.players[0].hands.right, { x: ball.x, y: ball.y, speed: 0.5, vy: -1, vx: 0 }); round.step(DT, W, H); away(pose);
  assert.equal(round.score[0], 1); assert.ok(ball.vy < 0, 'batted up'); assert.equal(round.counts['keepup-beachball'], 1);
  /* let it fall: it pops (no point lost), and floats back in */
  let dropped = -1; for (let t = 0; t < 8 && dropped < 0; t += DT){ round.step(DT, W, H); if (!round.things.length) dropped = t; }
  assert.ok(dropped >= 0, 'it popped'); assert.ok(sounds.includes('plop')); assert.equal(round.score[0], 1, 'nothing lost');
  let back = 0; while (!round.things.length && back < 4){ round.step(DT, W, H); back += DT; }
  assert.ok(back >= 0.9 && back <= 1.4, `it floats back in about a second later (${back.toFixed(2)})`);
});

test('Stack (from Create): things fall, a touch sends one to the tower, and a full tower of six blasts off', () => {
  const g = build(withJobs(['banana', 'stack']));
  assert.deepEqual(validate(g, env0), []); assert.equal(g.things[0].moves, 'fall');
  assert.deepEqual(g.things[0].rules[0].then[0], { stack: TOWER }); assert.equal(TOWER, 6);
  const { round, pose } = game(g); run(round, 3);
  for (let k = 0; k < 6; k++){
    let t = round.things.find(x => x.d.name === 'stack-banana' && x.y > 0.05 && x.y < 0.9);
    for (let w = 0; !t && w < 200; w++){ round.step(DT, W, H); t = round.things.find(x => x.d.name === 'stack-banana' && x.y > 0.05 && x.y < 0.9); }
    assert.ok(t, 'a banana came'); touch(pose, t.x, t.y); round.step(DT, W, H); away(pose); run(round, 0.6);
  }
  assert.equal(round.towers, 1, 'six bananas: a rocket'); assert.equal(round.counts['stack-banana'], 6); assert.equal(round.score[0], 6 + 5);
});

test('a mix of all four jobs plays for a minute with hands in the way, and nothing goes wrong', () => {
  let p = { ...defaultPicks(), golden: true, bomb: true, many: 4, speed: 4 };
  for (const [id, j] of [['bee', 'dodge'], ['banana', 'stack'], ['beachball', 'keepup'], ['star', 'collect']]) p = setJob(addThing(p, id), id, j);
  const g = build(p); assert.deepEqual(validate(g, env0), []);
  const { round, pose } = game(g, 2);
  for (let k = 0; k < 60 * 30; k++){
    Object.assign(pose.players[0].hands.right, { x: 0.5 + 0.4 * Math.sin(k / 20), y: 0.5 + 0.3 * Math.sin(k / 7), speed: 0.6, vx: 0.5, vy: -0.5 });
    Object.assign(pose.players[1].hands.right, { x: 0.5 + 0.4 * Math.cos(k / 17), y: 0.7, speed: 0.2, vx: 0, vy: 0 });
    round.step(DT, W, H);
    assert.ok(round.score.every(v => v >= 0), 'no score below 0'); assert.ok(round.things.length <= 80);
  }
  assert.ok(round.total > 0); assert.ok(Object.keys(round.counts).length >= 2, 'several things scored');
});

test('the widest rules (3x speed, about 25 things up, 4 players) cost the engine far less than a frame at 30 fps', () => {
  for (const job of ['collect', 'dodge', 'stack', 'keepup']) for (const n of [1, 5]){
    const things = ['apple', 'bee', 'star', 'fish', 'pear'].slice(0, n).map(id => ({ id, job }));
    const g = build({ ...defaultPicks(), things, speed: 6, many: 6, golden: true, bomb: true });
    assert.deepEqual(validate(g, env0), []);
    const { round, pose } = game(g, 4), ctx = new Proxy({}, { get: () => () => {}, set: () => true });
    let peak = 0, worst = 0, total = 0, frames = 0;
    for (let k = 0; k < 40 * 30; k++){
      for (let i = 0; i < 4; i++) Object.assign(pose.players[i].hands.right, { x: 0.5 + 0.4 * Math.sin(k / (13 + i)), y: 0.5 + 0.3 * Math.sin(k / (7 + i)), speed: 0.6, vx: 0.5, vy: -0.5 });
      const t0 = performance.now(); round.step(DT, W, H); round.draw(ctx, W, H); const ms = performance.now() - t0;
      total += ms; frames++; worst = Math.max(worst, ms); peak = Math.max(peak, round.things.length);
    }
    assert.ok(peak <= 80, `${job} x${n}: at most 80 things (${peak})`);
    if (job !== 'keepup') assert.ok(peak >= 15, `${job} x${n}: a storm really is lots (${peak})`);
    assert.ok(total / frames < 8, `${job} x${n}: ${(total / frames).toFixed(2)} ms a frame on average (the budget at 30 fps is 33)`);
    assert.ok(worst < 33, `${job} x${n}: the worst frame ${worst.toFixed(1)} ms`);
  }
});
