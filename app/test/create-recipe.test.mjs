/* Create's picture-built games (decisions 0056, 0059): the menus, up to five things each with a job, what they build in the Orlis.play vocabulary,
   goofy names of 3 to 5 words, the one-line sentence, picks from before 0059, and the voice phrases. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { choices, defaultPicks, clean, build, suggestNames, sentence, voice, VOICE_PHRASES, addThing, removeThing, toggleThing, setJob, setAllJobs, gameJob, moveOf, hasThing, goldenOn, bombOn, isGoodName, MAX_THINGS, NAME_MAX, SPEED_X, ON_SCREEN } from '../src/create/recipe.js';
import { validate } from '../src/games/play/validate.js';
import { playEnv } from '../src/games/play/env.js';
import { makePlay } from '../src/games/play/engine.js';
import { LIMITS } from '../src/games/play/vocabulary.js';
import { badWords } from '../kit/creator/words.js';

const env0 = playEnv(), DT = 1 / 30, W = 1920, H = 1080;
const JOBS = choices.jobs.map(j => j.id), WHERES = choices.where.map(w => w.id);
const ALL = choices.what.flatMap(c => c.pieces.map(p => p.id));

/* a small seeded random, so every run is the same */
const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const oneOf = (r, list) => list[Math.floor(r() * list.length)];
function randomPicks(r){
  let p = { ...defaultPicks(), things: [] };
  const n = 1 + Math.floor(r() * MAX_THINGS), pool = [...ALL];
  for (let i = 0; i < n; i++){ const id = pool.splice(Math.floor(r() * pool.length), 1)[0]; p = { ...p, things: [...p.things, { id, job: oneOf(r, JOBS) }] }; }
  return { ...p, where: oneOf(r, WHERES), mode: oneOf(r, ['together', 'versus']), golden: r() < 0.5, bomb: r() < 0.5, speed: Math.floor(r() * 7), many: Math.floor(r() * 7), size: Math.floor(r() * 5), minutes: oneOf(r, [1, 2, 3]) };
}
const picksOf = (...things) => ({ ...defaultPicks(), things: things.map(([id, job]) => ({ id, job })) });

function headless(spec, n = 2){
  const random = rng(7);
  const pose = { players: Array.from({ length: 4 }, (_, i) => ({ present: i < n, hands: { left: { x: 0.1, y: 1.6, vx: 0, vy: 0, speed: 0 }, right: { x: 0.9, y: 1.6, vx: 0, vy: 0, speed: 0 } } })), mouse: { active: false } };
  const sounds = [], sfx = new Proxy({}, { get: (_, k) => () => sounds.push(k) });
  const A = { scene() {}, draw() {}, text() {} }, ui = { say() {}, goal() {} };
  const g = makePlay(spec, { pose, sfx, assets: A, ui, colors: ['#3da9ff', '#ff8a3d', '#3fcf7f', '#c46bff'], max: 4, random });
  return { round: g.create(n), pose, sounds };
}
const run = (round, secs) => { for (let t = 0; t < secs; t += DT) round.step(DT, W, H); };

test('the menus: four jobs, up to five things, pieces that exist in the library, worlds, moves and rules', () => {
  assert.deepEqual(JOBS, ['collect', 'dodge', 'keepup', 'stack']);
  assert.deepEqual(choices.jobs.map(j => j.label), ['Collect', 'Dodge', 'Keep up', 'Stack']);
  assert.equal(choices.maxThings, 5); assert.equal(MAX_THINGS, 5);
  assert.equal(choices.how, undefined, 'no "How it plays" any more');
  for (const c of choices.what){ assert.ok(c.pieces.length >= 6 && c.pieces.length <= 10, c.id); for (const p of c.pieces) assert.ok(env0.has(p.id), p.id + ' is in the library'); }
  assert.equal(new Set(ALL).size, ALL.length, 'no piece twice');
  for (const w of choices.where) assert.ok(env0.scenes.includes(w.id), w.id);
  assert.ok(choices.where.every(w => w.palette), 'every world is on the master palette (decision 0040)');
  assert.equal(choices.move, undefined, 'no "Your move" any more: the job says how you play');
  for (const j of JOBS) assert.ok(env0.poses.includes(moveOf({ things: [{ id: 'apple', job: j }] })), j + ' has a move card');
  assert.equal(choices.rules.speed.steps, 7); assert.equal(choices.rules.many.steps, 7); assert.equal(choices.rules.speed.labels.length, 7); assert.equal(choices.rules.many.labels.length, 7);
  assert.deepEqual(choices.rules.minutes.options, [1, 2, 3]);
  assert.deepEqual(choices.rules.mode.map(m => m.id), ['together', 'versus']);
  assert.deepEqual(choices.rules.specials.map(m => m.id), ['golden', 'bomb']);
});

test('every thing in every job, in every world, builds a game that passes validate.js', () => {
  let n = 0;
  for (const id of ALL) for (const job of JOBS) for (const where of WHERES){
    assert.deepEqual(validate(build({ ...defaultPicks(), things: [{ id, job }], where, golden: true, bomb: true }), env0), [], `${id} ${job} ${where}`); n++;
  }
  for (const mode of ['together', 'versus']) for (const [golden, bomb] of [[false, false], [true, false], [false, true], [true, true]]){
    assert.deepEqual(validate(build({ ...defaultPicks(), mode, golden, bomb }), env0), []); n++;
  }
  /* and mixes: 1500 random ones with up to five things, any jobs, any rules */
  const r = rng(99);
  for (let i = 0; i < 1500; i++){
    const p = randomPicks(r), g = build(p);
    assert.deepEqual(validate(g, env0), [], JSON.stringify(p)); n++;
    assert.ok(g.things.length >= p.things.length && g.things.length <= p.things.length + 2, 'a thing each, and at most a golden one and a bomb');
    assert.equal(g.secs, p.minutes * 60);
    for (const t of g.things){ assert.ok(t.size >= LIMITS.size[0] && t.size <= LIMITS.size[1]); if (t.appears) assert.ok(t.appears.max >= 1 && t.appears.max <= LIMITS.max[1] && t.appears.every >= LIMITS.every[0] && t.appears.every <= LIMITS.every[1]); }
    assert.ok(g.hint.split(/\s+/).length <= 4, g.hint);
  }
  assert.ok(n > 2000);
});

test('every speed, how many, size and length is in the limits, and they change the game', () => {
  for (const job of JOBS) for (let speed = 0; speed < 7; speed++) for (let many = 0; many < 7; many++) for (const size of [0, 2, 4]) for (const minutes of [1, 3]) for (const n of [1, 3, 5]){
    const things = ['apple', 'bee', 'star', 'fish', 'pear'].slice(0, n).map(id => ({ id, job }));
    const g = build({ ...defaultPicks(), things, speed, many, size, minutes, golden: true, bomb: true });
    assert.deepEqual(validate(g, env0), [], `${job} ${speed} ${many}`);
    assert.equal(g.secs, minutes * 60);
    assert.ok(g.things.reduce((a, t) => a + (t.appears ? t.appears.max : 0), 0) <= 60, 'never more than the engine holds');
  }
  /* seven stops, the middle one the usual; speed 0.3x to 3x, how many 1 to 25 */
  assert.equal(defaultPicks().speed, 3); assert.equal(defaultPicks().many, 3); assert.equal(SPEED_X[3], 1); assert.equal(SPEED_X[0], 0.3); assert.equal(SPEED_X[6], 3);
  assert.equal(ON_SCREEN[0], 1); assert.equal(ON_SCREEN[6], 25);
  const sp = (n) => build({ ...picksOf(['apple', 'collect']), speed: n }).things[0].speed;
  assert.ok(Math.abs(sp(3) - 0.11) < 1e-9, 'the middle is as it was'); assert.ok(Math.abs(sp(0) / sp(3) - 0.3) < 0.02); assert.ok(Math.abs(sp(6) / sp(3) - 3) < 0.02);
  for (let i = 1; i < 7; i++) assert.ok(sp(i) > sp(i - 1), 'each stop is faster');
  const many = (n) => build({ ...picksOf(['apple', 'collect']), many: n }).things[0].appears;
  assert.equal(many(0).max, 1); assert.equal(many(6).max, 25);
  for (let i = 1; i < 7; i++) assert.ok(many(i).max >= many(i - 1).max && many(i).every < many(i - 1).every, 'each stop is more');
  /* the things share the screen: five things never put more than about 25 up between them */
  const five = build({ ...picksOf(['apple', 'collect'], ['bee', 'collect'], ['star', 'collect'], ['pear', 'collect'], ['fish', 'collect']), many: 6, golden: false });
  assert.ok(five.things.reduce((a, t) => a + t.appears.max, 0) <= 25); assert.ok(five.things.every(t => t.appears.max === 5));
  assert.ok(build({ ...picksOf(['beachball', 'keepup']), many: 6 }).things[0].appears.max > 1, 'more balls');
  assert.equal(build({ ...picksOf(['beachball', 'keepup']), many: 0 }).things[0].appears.max, 1);
  assert.ok(build({ ...picksOf(['beachball', 'keepup']), size: 4 }).things[0].size > build({ ...picksOf(['beachball', 'keepup']), size: 0 }).things[0].size);
  assert.ok(build({ ...picksOf(['beachball', 'keepup']), speed: 6 }).things[0].size < build({ ...picksOf(['beachball', 'keepup']), speed: 0 }).things[0].size, 'a faster game, a smaller ball');
});

test('one job for the whole game (what the builder asks for): every thing has it, in every job', () => {
  for (const job of JOBS){
    const p = setAllJobs(picksOf(['apple', 'collect'], ['bee', 'dodge'], ['star', 'stack']), job);
    assert.ok(p.things.every(t => t.job === job), job); assert.equal(gameJob(p), job);
    const g = build({ ...p, golden: true, bomb: true });
    assert.deepEqual(validate(g, env0), [], job);
    assert.equal(g.things.filter(t => t.name.startsWith(job + '-')).length, 3, 'a thing each, all ' + job);
    assert.equal(g.hint.split(/\s+/).length <= 4, true);
  }
  /* things added later take the game's job */
  let p = setAllJobs(defaultPicks(), 'dodge'); p = addThing(p, 'bee'); p = addThing(p, 'star');
  assert.deepEqual(p.things.map(t => t.job), ['dodge', 'dodge', 'dodge']);
  assert.equal(addThing(p, 'pear', 'stack').things[3].job, 'stack', 'a job can still be said');
  assert.equal(setAllJobs(p, 'fly').things[0].job, 'dodge');
  /* the engine plays each, with several things */
  for (const job of JOBS){
    const { round, pose } = headless(build(setAllJobs(picksOf(['apple', 'collect'], ['bee', 'collect'], ['star', 'collect']), job)));
    /* (a ball each: one a player never bats pops on the floor and floats back a second later, so "things on the screen" is looked at all through the round, not at one moment) */
    let there = 0;
    for (let k = 0; k < 8 * 30; k++){ Object.assign(pose.players[0].hands.right, { x: 0.5 + 0.4 * Math.sin(k / 20), y: 0.5 + 0.3 * Math.sin(k / 7), speed: 0.6, vx: 0.5, vy: -0.5 }); round.step(DT, W, H); if (round.things.length > 0) there++; }
    assert.ok(there > 8 * 30 * 0.5 && round.score.every(v => v >= 0), job);
  }
});

test('how you play is the job\'s: the move card and the sentence come from it', () => {
  assert.equal(moveOf(picksOf(['apple', 'collect'])), 'reach'); assert.equal(moveOf(picksOf(['bee', 'dodge'])), 'lean');
  assert.equal(moveOf(picksOf(['beachball', 'keepup'])), 'reach'); assert.equal(moveOf(picksOf(['banana', 'stack'])), 'reach');
  for (const job of JOBS) assert.equal(build(picksOf(['apple', job])).card, moveOf(picksOf(['apple', job])));
  assert.equal(build({ ...picksOf(['apple', 'collect']), move: 'jump' }).card, 'reach', 'an old pick of a move is ignored');
  assert.equal('move' in clean({ move: 'jump' }), false);
});

test('each job maps onto the vocabulary', () => {
  const g = build({ ...picksOf(['apple', 'collect'], ['bee', 'dodge'], ['beachball', 'keepup'], ['banana', 'stack']), golden: true, bomb: true });
  const by = Object.fromEntries(g.things.map(t => [t.name, t]));
  assert.deepEqual(Object.keys(by), ['collect-apple', 'dodge-bee', 'keepup-beachball', 'stack-banana', 'golden', 'bomb']);
  /* Collect: it falls or floats in; a touch is +1 with a sparkle */
  assert.equal(by['collect-apple'].moves, 'fall'); assert.equal(by['collect-apple'].appears.from, 'top');
  assert.equal(build(picksOf(['balloon', 'collect'])).things[0].moves, 'rise'); assert.equal(build(picksOf(['balloon', 'collect'])).things[0].appears.from, 'bottom');
  assert.deepEqual(by['collect-apple'].rules[0].then, ['sparkle', 'score', { sound: 'twinkle' }, 'vanish']);
  /* Dodge (decision 0063), with other jobs in the game: it steers toward the players and a touch costs a point, with a wobble and an ouch; a thing let go by is
     nothing (standing still must not win) */
  assert.equal(by['dodge-bee'].moves, 'seek');
  assert.ok(by['dodge-bee'].rules[0].then.some(x => x.score === -1) && by['dodge-bee'].rules[0].then.includes('wobble') && by['dodge-bee'].rules[0].then.some(x => x.sound === 'ouch'));
  assert.ok(!by['dodge-bee'].rules.some(r => r.when === 'leftScreen'), 'no point for a thing that goes past'); assert.equal(g.health, undefined, 'with other jobs there are points, not a health bar');
  /* a game of Dodge things only has no score: a health bar each, and a touch takes a chunk off it (a bomb a bigger one) */
  const dg = build({ ...picksOf(['bee', 'dodge'], ['rock', 'dodge']), bomb: true }), dby = Object.fromEntries(dg.things.map(t => [t.name, t]));
  assert.equal(dg.health, true); assert.deepEqual(validate(dg, env0), []);
  assert.deepEqual(dby['dodge-bee'].rules, [{ when: 'touched', then: ['pop', { hurt: 1 }, 'vanish'] }]); assert.equal(dby['dodge-bee'].moves, 'seek');
  assert.deepEqual(dby.bomb.rules[0].then, ['pop', { hurt: 2 }, 'vanish']);
  assert.ok(!JSON.stringify(dg).includes('"score"') && !JSON.stringify(dg).includes('leftScreen'), 'nothing scores in a Dodge game');
  /* Keep up: a bouncing ball, a bat scores, a drop pops it and one floats back in a second later */
  assert.equal(by['keepup-beachball'].moves, 'bounce'); assert.ok(by['keepup-beachball'].rules[0].then.includes('kickUp'));
  assert.deepEqual(by['keepup-beachball'].rules[1], { when: 'lands', then: ['pop', { sound: 'plop' }, 'vanish'] });
  assert.equal(by['keepup-beachball'].appears.wait, 1);
  /* Stack: it falls; a touch sends it to the tower, six to a full tower */
  assert.equal(by['stack-banana'].moves, 'fall'); assert.deepEqual(by['stack-banana'].rules[0].then[0], { stack: 6 });
  /* specials: a golden one is a Collect thing worth 5, a bomb costs points */
  assert.equal(by.golden.piece, 'apple'); assert.equal(by.golden.color, 'gold'); assert.ok(JSON.stringify(by.golden.rules).includes('{"score":5}')); assert.ok(by.golden.appears.every > by['collect-apple'].appears.every, 'rarer');
  assert.equal(by.bomb.piece, 'bomb'); assert.ok(JSON.stringify(by.bomb.rules).includes('"score":-3'));
  /* together is the shared score, versus has a score for each player */
  assert.equal(build({ mode: 'together' }).team, true); assert.equal(build({ mode: 'versus' }).team, undefined);
  assert.equal(build({ where: 'night' }).scene, 'night');
  assert.equal(build(picksOf(['apple', 'collect'])).hint, 'Catch the apples!'); assert.equal(build(picksOf(['bee', 'dodge'])).hint, 'Dodge the bees!');
  assert.equal(build(picksOf(['star', 'stack'])).hint, 'Stack the stars!'); assert.equal(build(picksOf(['beachball', 'keepup'])).hint, 'Keep it up!');
  assert.equal(build(picksOf(['bee', 'dodge'], ['apple', 'collect'])).hintIcon, 'bee', 'the first thing is the main one');
  assert.equal(build({ name: 'Mia Rocks' }).title, 'Mia Rocks');
});

test('the rules that stop making sense with some jobs are dropped (golden needs a Collect, a bomb needs something that moves about)', () => {
  const ball = picksOf(['beachball', 'keepup']), dodge = picksOf(['bee', 'dodge']), both = picksOf(['bee', 'dodge'], ['star', 'collect']);
  assert.equal(goldenOn(ball), false); assert.equal(bombOn(ball), false);
  assert.equal(goldenOn(dodge), false); assert.equal(bombOn(dodge), true);
  assert.equal(goldenOn(both), true); assert.equal(bombOn(both), true);
  assert.equal(goldenOn(picksOf(['banana', 'stack'])), false); assert.equal(bombOn(picksOf(['banana', 'stack'])), true);
  assert.equal(build({ ...ball, golden: true, bomb: true }).things.length, 1, 'a ball has no specials');
  assert.deepEqual(build({ ...dodge, golden: true, bomb: true }).things.map(t => t.name), ['dodge-bee', 'bomb']);
  assert.deepEqual(build({ ...both, golden: true, bomb: false }).things.map(t => t.name), ['dodge-bee', 'collect-star', 'golden']);
  assert.equal(build({ ...both, golden: false, bomb: false }).things.length, 2);
});

test('the engine plays mixes for a while, with hands in the way, without throwing', () => {
  const r = rng(5);
  for (let i = 0; i < 24; i++){
    const p = { ...randomPicks(r), speed: 6, many: 6 };
    const { round, pose } = headless(build(p));
    for (let k = 0; k < 6 * 30; k++){
      Object.assign(pose.players[0].hands.right, { x: 0.5 + 0.4 * Math.sin(k / 20), y: 0.5 + 0.3 * Math.sin(k / 7), speed: 0.6, vx: 0.5, vy: -0.5 });
      Object.assign(pose.players[1].hands.right, { x: 0.5 + 0.4 * Math.cos(k / 17), y: 0.4, speed: 0.2, vx: 0, vy: 0 });
      round.step(DT, W, H); assert.doesNotThrow(() => { round.hud(); round.value(); round.card(); });
    }
    assert.ok(round.score.every(v => v >= 0), 'no score below 0');
  }
});

test('golden is worth 5; a bomb costs points; versus scores are the player\'s own; a score never goes below 0', () => {
  const p = { ...picksOf(['apple', 'collect']), golden: true, bomb: true, mode: 'versus', many: 4 };
  const { round, pose, sounds } = headless(build(p));
  run(round, 20);
  const main = round.things.find(t => t.d.name === 'collect-apple'); Object.assign(pose.players[1].hands.right, { x: main.x, y: main.y, speed: 0.1 }); round.step(DT, W, H);
  assert.equal(round.score[1], 1); assert.equal(round.score[0], 0); assert.ok(round.fx.some(f => f.kind === 'sparkle')); assert.ok(sounds.includes('twinkle'));
  round.things = []; const g = round._make(round.defs.find(d => d.name === 'golden'), { x: 0.3, y: 0.3 }); Object.assign(pose.players[0].hands.right, { x: 0.3, y: 0.3, speed: 0.1 }); round.step(DT, W, H);
  assert.equal(round.score[0], 5); assert.ok(sounds.includes('gold')); assert.ok(g.dead);
  const before = round.score[0]; const bomb = round._make(round.defs.find(d => d.name === 'bomb'), { x: 0.7, y: 0.3 }); Object.assign(pose.players[0].hands.right, { x: 0.7, y: 0.3, speed: 0.1 });
  round.step(DT, W, H); assert.ok(round.score[0] < before, 'the bomb cost points'); assert.ok(bomb.dead);
  const lone = headless(build({ ...picksOf(['bee', 'dodge']), golden: false, bomb: true, mode: 'versus' })); lone.round.things = [];
  lone.round._make(lone.round.defs.find(d => d.name === 'bomb'), { x: 0.7, y: 0.3 }); Object.assign(lone.pose.players[1].hands.right, { x: 0.7, y: 0.31, speed: 0.1 }); lone.round.step(DT, W, H);
  assert.equal(lone.round.score[1], 0, 'a score never goes below 0'); assert.equal(lone.round.total, 0);
});

/* ---------- the things ---------- */
test('things: add up to five, each once; take one off (one always stays); give each a job', () => {
  let p = defaultPicks();
  assert.deepEqual(p.things, [{ id: 'apple', job: 'collect' }], 'the first game: an apple to collect');
  p = addThing(p, 'bee'); assert.deepEqual(p.things.map(t => t.id), ['apple', 'bee']); assert.equal(p.things[1].job, 'collect', 'the usual job is Collect');
  assert.equal(addThing(p, 'bee').things.length, 2, 'a thing can be picked once');
  for (const id of ['star', 'fish', 'banana', 'pear', 'cookie']) p = addThing(p, id);
  assert.equal(p.things.length, 5, 'five is the most'); assert.deepEqual(p.things.map(t => t.id), ['apple', 'bee', 'star', 'fish', 'banana']);
  p = setJob(p, 'fish', 'stack'); assert.equal(p.things.find(t => t.id === 'fish').job, 'stack'); assert.equal(p.things.find(t => t.id === 'star').job, 'collect', 'only that one');
  assert.equal(setJob(p, 'fish', 'fly').things.find(t => t.id === 'fish').job, 'stack', 'a job that does not exist changes nothing');
  assert.equal(setJob(p, 'zzz', 'dodge').things.length, 5);
  p = removeThing(p, 'star'); assert.deepEqual(p.things.map(t => t.id), ['apple', 'bee', 'fish', 'banana']);
  assert.ok(hasThing(p, 'bee') && !hasThing(p, 'star'));
  assert.deepEqual(toggleThing(p, 'bee').things.map(t => t.id), ['apple', 'fish', 'banana'], 'picking it again takes it off');
  assert.equal(toggleThing(p, 'star').things.length, 5, 'picking a new one adds it');
  let one = defaultPicks(); one = removeThing(one, 'apple'); assert.deepEqual(one.things.map(t => t.id), ['apple'], 'the last one stays');
  assert.deepEqual(addThing(defaultPicks(), 'not-a-piece').things.map(t => t.id), ['apple']);
  /* the order is the order picked: the first is the main thing */
  assert.equal(build(setJob(addThing(defaultPicks(), 'bee'), 'bee', 'dodge')).title.length > 0, true);
});

test('clean: anything becomes whole, valid picks', () => {
  assert.deepEqual(clean({}), defaultPicks()); assert.deepEqual(clean(null), defaultPicks()); assert.deepEqual(clean('x'), defaultPicks());
  const c = clean({ things: [{ id: '<b>', job: 'x' }], where: 'mars', speed: 99, many: -4, size: 'x', minutes: 9, mode: 'x', name: '  A very long name that goes on and on and on and on and on  ' });
  assert.deepEqual(c.things, [{ id: 'apple', job: 'collect' }], 'nothing valid: the first game'); assert.equal(c.speed, 6); assert.equal(c.many, 0); assert.equal(c.size, 2); assert.equal(c.minutes, 1); assert.equal(c.name.length, NAME_MAX);
  assert.deepEqual(validate(build({ things: [{ id: 'mars' }], where: 'mars' }), env0), []);
  const six = clean({ things: ['apple', 'bee', 'star', 'fish', 'pear', 'banana', 'cookie'].map(id => ({ id, job: 'dodge' })) });
  assert.equal(six.things.length, 5); assert.ok(six.things.every(t => t.job === 'dodge'));
  assert.deepEqual(clean({ things: [{ id: 'bee', job: 'x' }, { id: 'bee', job: 'stack' }, { id: 'fish' }] }).things, [{ id: 'bee', job: 'collect' }, { id: 'fish', job: 'collect' }], 'once each; a missing job is Collect');
  assert.deepEqual(clean({ things: ['bee', 'fish'] }).things.map(t => t.id), ['bee', 'fish']);
});

test('picks from before 0059 (one thing, a "how") still load: each old recipe is that thing with the matching job', () => {
  for (const [how, job] of [['catch', 'collect'], ['pop', 'collect'], ['collect', 'collect'], ['dodge', 'dodge'], ['keepup', 'keepup']]){
    const p = clean({ how, what: 'bee', where: 'night', move: 'wave', speed: 3, many: 1, size: 4, minutes: 2, mode: 'versus', golden: false, bomb: true, name: 'Old Game' });
    assert.deepEqual(p.things, [{ id: 'bee', job }], how);
    assert.equal(p.where, 'night'); assert.equal('move' in p, false, 'the move is the job\'s now'); assert.equal(p.speed, 5, 'old 3 of 5 stops is 5 of 7'); assert.equal(p.many, 2); assert.equal(p.size, 4); assert.equal(p.minutes, 2); assert.equal(p.mode, 'versus'); assert.equal(p.golden, false); assert.equal(p.bomb, true); assert.equal(p.name, 'Old Game');
    assert.ok(!('how' in p) && !('what' in p), 'in the new shape');
    assert.deepEqual(validate(build({ how, what: 'bee' }), env0), [], how + ' still builds');
  }
  assert.deepEqual(clean({ how: 'catch' }).things, [{ id: 'apple', job: 'collect' }], 'no piece: the first');
  assert.deepEqual(clean({ how: 'nonsense', what: 'fish' }).things, [{ id: 'fish', job: 'collect' }]);
  /* what an old game was, as it stands */
  assert.deepEqual([0, 1, 2, 3, 4].map(v => clean({ how: 'catch', speed: v, many: v }).speed), [0, 2, 3, 5, 6], 'the old stops land on the new ones, the middle on the middle');
  assert.equal(clean({ how: 'catch', speed: 2 }).speed, defaultPicks().speed);
  assert.equal(build({ how: 'dodge', what: 'bee', move: 'squat' }).card, 'lean', 'an old dodge game is played by leaning');
  assert.equal(build({ how: 'dodge', what: 'bee' }).things[0].moves, 'seek');
  assert.equal(build({ how: 'keepup', what: 'beachball' }).things[0].moves, 'bounce');
});

/* ---------- names ---------- */
const words = (s) => s.trim().split(/\s+/).length;
const MEAN = ['stupid', 'dumb', 'ugly', 'idiot', 'loser', 'hate', 'kill', 'die', 'dead', 'fat', 'crazy', 'mad', 'evil', 'bad', 'hurt', 'smash', 'destroy', 'war', 'fight', 'attack the'];
test('names: three, each 3 to 5 words, short enough to show, from the things, their jobs and the place', () => {
  for (const id of ALL) for (const job of JOBS) for (const where of ['meadow', 'night']){
    const n = suggestNames({ ...picksOf([id, job]), where });
    assert.equal(n.length, 3, id + job); assert.equal(new Set(n).size, 3, 'three different ones: ' + n);
    for (const x of n){ assert.ok(words(x) >= 3 && words(x) <= 5, `3 to 5 words: "${x}"`); assert.ok(x.length <= NAME_MAX, `short enough: "${x}"`); assert.match(x, /^[A-Za-z' -]+$/, x); }
  }
  /* the examples in the decision */
  const all = new Set(); const r = rng(3);
  for (let i = 0; i < 400; i++) for (const x of suggestNames(randomPicks(r))) all.add(x);
  for (const x of all){ assert.ok(words(x) >= 3 && words(x) <= 5 && x.length <= NAME_MAX, x); }
  assert.deepEqual(suggestNames(picksOf(['banana', 'collect'])).filter(x => /Banana/.test(x)).length, 3, 'the thing is in the names');
  assert.ok(suggestNames(picksOf(['bee', 'dodge'])).every(x => /Bee/i.test(x) || /Bees/i.test(x)));
  assert.ok(suggestNames(picksOf(['cupcake', 'stack'])).some(x => /Stack|Tower/.test(x)), 'the job is in them');
  assert.ok(suggestNames(picksOf(['duck', 'keepup'])).some(x => /Keep-Up|Bounce|Juggle|Up/.test(x)));
  assert.ok(suggestNames(picksOf(['bee', 'dodge'], ['banana', 'stack'])).some(x => /Bee/.test(x) && /Banana/.test(x)), 'a mix names both things');
  assert.ok(suggestNames({ ...picksOf(['duck', 'collect']), where: 'night' }).some(x => /Starry/.test(x)), 'the place is in one');
  assert.deepEqual(suggestNames(defaultPicks()), suggestNames(defaultPicks()), 'the same picks give the same names (the screen can redraw)');
  assert.equal(build(defaultPicks()).title, suggestNames(defaultPicks())[0]);
});

test('names: plenty of variety across things, jobs and places', () => {
  const seen = new Set(), firsts = new Set();
  for (const id of ALL) for (const job of JOBS) for (const where of WHERES){ const n = suggestNames({ ...picksOf([id, job]), where }); n.forEach(x => seen.add(x)); firsts.add(n[0]); }
  assert.ok(seen.size > 1500, `${seen.size} different names`); assert.ok(firsts.size > 400, `${firsts.size} different first names`);
  /* different goofy words and different shapes, not one pattern */
  const shapes = new Set([...seen].map(x => x.split(' ')[0])); assert.ok(shapes.size >= 15, [...shapes].join());
  const adjs = new Set(); for (const x of seen) for (const w of ['Wobbly', 'Sneaky', 'Dizzy', 'Giggly', 'Zippy', 'Bouncy', 'Squishy', 'Wacky']) if (x.includes(w)) adjs.add(w);
  assert.ok(adjs.size >= 6, 'goofy words: ' + [...adjs].join());
  /* the same thing with another job or place changes the names */
  assert.notDeepEqual(suggestNames(picksOf(['bee', 'collect'])), suggestNames(picksOf(['bee', 'dodge'])));
  assert.notDeepEqual(suggestNames({ ...picksOf(['bee', 'collect']), where: 'night' }), suggestNames({ ...picksOf(['bee', 'collect']), where: 'beach' }));
});

test('names: the bad-words filter is kept, and nothing that could read as mean', () => {
  /* the filter itself */
  assert.equal(isGoodName('Super Sneaky Bee Dodge'), true); assert.equal(isGoodName('The Great Wobbly Banana Bonanza'), true);
  assert.equal(isGoodName('Kill The Bees Now'), false, 'a word that is not for children');
  assert.equal(isGoodName('Super k1ll Bee Dodge'), false, 'however it is written');
  assert.equal(isGoodName('Hell Of A Game'), false);
  assert.equal(isGoodName('Two Words'), false, 'too short'); assert.equal(isGoodName('One Two Three Four Five Six'), false, 'too long');
  assert.equal(isGoodName('Super Duper Extraordinarily Magnificent Bumblebee Dodge'), false, 'too many letters');
  assert.equal(isGoodName('Dodge The {A} Bees'), false, 'a gap left in it');
  /* every name that can be made */
  const r = rng(11), seen = new Set();
  for (const id of ALL) for (const job of JOBS) for (const where of WHERES) suggestNames({ ...picksOf([id, job]), where }).forEach(x => seen.add(x));
  for (let i = 0; i < 1500; i++) suggestNames(randomPicks(r)).forEach(x => seen.add(x));
  assert.ok(seen.size > 2000);
  for (const x of seen){
    assert.deepEqual(badWords(x), [], x);
    for (const m of MEAN) assert.ok(!new RegExp(`\\b${m}\\b`, 'i').test(x), `"${x}" has "${m}"`);
  }
  /* the pieces' own names are fine too */
  for (const id of ALL) assert.deepEqual(badWords(choices.what.flatMap(c => c.pieces).find(p => p.id === id).label), []);
});

test('the sentence sums the game up', () => {
  assert.equal(sentence(defaultPicks()), 'Catch the apples in the sunny meadow by reaching up, with a golden one worth 5. Play together.');
  assert.equal(sentence({ ...picksOf(['balloon', 'collect']), where: 'night', mode: 'versus', golden: true, bomb: true }), 'Catch the balloons in the starry night by reaching up, with a golden one worth 5, and a bomb to avoid. Who gets the most?');
  assert.equal(sentence({ ...picksOf(['bee', 'dodge']), where: 'beach', golden: false, bomb: true }), 'Dodge the bees in the sunny beach by leaning away, with a bomb to avoid. Play together.');
  assert.equal(sentence({ ...picksOf(['beachball', 'keepup']), where: 'snow', golden: true }), 'Keep the beach ball up in the snowy hills by batting it up. Play together.');
  assert.equal(sentence({ ...picksOf(['banana', 'stack']), golden: false }), 'Stack the bananas in the sunny meadow by reaching up, with a bomb to avoid. Play together.'.replace(', with a bomb to avoid', ''));
  assert.equal(sentence({ ...picksOf(['apple', 'collect'], ['bee', 'dodge'], ['beachball', 'keepup'], ['banana', 'stack']), golden: false, bomb: false }),
    'Catch the apples, dodge the bees, keep the beach ball up and stack the bananas in the sunny meadow by reaching up. Play together.');
  assert.match(sentence(picksOf(['apple', 'collect'], ['pear', 'collect'], ['star', 'dodge'])), /^Catch the apples and pears and dodge the stars in/);
  for (const job of JOBS) for (const id of ALL) assert.match(sentence(picksOf([id, job])), /\.$/);
});

/* [phrase, key that changes, expected value or label] */
const CASES = [
  ['faster', 'speed', 4], ['make it go faster please', 'speed', 4], ['a bit quicker', 'speed', 4], ['speed up', 'speed', 4], ['Faster!', 'speed', 4], ['zoom', 'speed', 4],
  ['slower', 'speed', 2], ['slow down please', 'speed', 2], ['can you make it slower', 'speed', 2],
  ['more', 'many', 4], ['more apples', 'many', 4], ['lots more please', 'many', 4], ['fewer', 'many', 2], ['less', 'many', 2], ['fewer please', 'many', 2],
  ['bigger', 'size', 3], ['make them bigger', 'size', 3], ['smaller', 'size', 1], ['tiny', 'size', 1],
  ['longer', 'minutes', 2], ['make it longer', 'minutes', 2], ['more time', 'minutes', 2],
  ['make it night', 'where', 'night'], ['night please', 'where', 'night'], ['make it snowy', 'where', 'snow'], ['make it a beach', 'where', 'beach'], ['beach', 'where', 'beach'], ['make it evening', 'where', 'sunset'], ['sunset', 'where', 'sunset'], ['make it autumn', 'where', 'autumn'],
  ['add a bomb', 'bomb', true], ['bomb please', 'bomb', true], ['race', 'mode', 'versus'], ['who wins', 'mode', 'versus'], ['lets race', 'mode', 'versus']
];
test('voice: a fixed phrase map changes one setting by one step', () => {
  assert.ok(CASES.length >= 30);
  for (const [phrase, key, want] of CASES){
    const start = { ...defaultPicks(), ...(key === 'mode' ? { mode: 'together' } : {}) };
    const r = voice(start, phrase);
    assert.ok(!r.unknown, phrase); assert.equal(r.changed.length, 1, phrase); assert.equal(r.picks[key], want, phrase);
    for (const k of Object.keys(start)) if (k !== key) assert.deepEqual(r.picks[k], start[k], phrase + ' left ' + k);
  }
});

test('voice: the jobs and the things', () => {
  const two = addThing(setAllJobs(defaultPicks(), 'stack'), 'bee');
  for (const [phrase, job] of [['dodge', 'dodge'], ['keep it up', 'keepup'], ['catch', 'collect'], ['pop', 'collect'], ['collect them', 'collect']]){
    const r = voice(two, phrase);
    assert.ok(!r.unknown, phrase); assert.deepEqual(r.picks.things.map(t => t.job), [job, job], phrase + ': one job for the game');
  }
  assert.ok(voice(two, 'stack').atLimit, 'already so');
  /* a thing's name adds it, with the usual job, until there are five */
  let p = defaultPicks();
  for (const [phrase, id] of [['bees', 'bee'], ['stars', 'star'], ['glow stars', 'glowstar'], ['I want fish', 'fish']]){ const r = voice(p, phrase); assert.deepEqual(r.changed.length, 1, phrase); assert.ok(r.picks.things.some(t => t.id === id), phrase); p = r.picks; }
  assert.equal(p.things.length, 5); assert.ok(p.things.slice(1).every(t => t.job === 'collect'));
  const full = voice(p, 'balloons'); assert.deepEqual(full.picks.things, p.things); assert.deepEqual(full.changed, []); assert.ok(full.atLimit && !full.unknown, 'five is the most');
  const again = voice(p, 'bees'); assert.ok(again.atLimit && !again.unknown, 'already there');
  assert.deepEqual(voice(defaultPicks(), 'ice cream').picks.things.map(t => t.id), ['apple', 'icecream']);
});

test('voice: the golden one, the bomb, together', () => {
  const mix = addThing(defaultPicks(), 'bee');
  const on = { ...mix, golden: true, bomb: true, mode: 'versus' }, off = { ...mix, golden: false, bomb: false };
  assert.equal(voice(on, 'no golden one').picks.golden, false); assert.deepEqual(voice(on, 'no golden one').changed, ['No golden one']);
  assert.equal(voice(on, 'take away the golden one').picks.golden, false);
  assert.equal(voice(on, 'no bomb').picks.bomb, false); assert.equal(voice(on, 'no more bombs').picks.bomb, false); assert.equal(voice(on, 'get rid of the bomb').picks.bomb, false);
  assert.equal(voice(off, 'add a golden one').picks.golden, true); assert.deepEqual(voice(off, 'add a golden one').changed, ['Golden one']);
  assert.equal(voice(off, 'golden please').picks.golden, true);
  assert.equal(voice(on, 'together').picks.mode, 'together'); assert.equal(voice(on, "let's play together").picks.mode, 'together');
  assert.equal(voice(off, 'add a bomb').picks.bomb, true);
  const r = voice(on, 'add a bomb'); assert.deepEqual(r.changed, []); assert.ok(!r.unknown); assert.ok(r.atLimit);
  /* a ball has no specials; a golden one needs something to Collect */
  const ball = { ...off, things: [{ id: 'beachball', job: 'keepup' }] };
  assert.ok(voice(ball, 'add a bomb').unknown); assert.ok(voice(ball, 'add a golden one').unknown);
  assert.ok(voice({ ...off, things: [{ id: 'bee', job: 'dodge' }] }, 'add a golden one').unknown);
  assert.equal(voice({ ...off, things: [{ id: 'bee', job: 'dodge' }] }, 'add a bomb').picks.bomb, true);
});

test('voice: unknown phrases, fillers, empty and odd input', () => {
  for (const x of ['', '   ', 'hello there', 'make it purple', 'draw me a dragon', 'xyzzy', '???', 'open the door', 'tell me a joke', null, undefined, 42]){
    const r = voice(defaultPicks(), x);
    assert.equal(r.unknown, true, String(x)); assert.deepEqual(r.changed, []); assert.deepEqual(r.picks, defaultPicks());
  }
  assert.ok(voice(defaultPicks(), '<script>alert(1)</script>').unknown);
  assert.ok(Array.isArray(VOICE_PHRASES) && VOICE_PHRASES.every(g => g.group && g.say.length));
  for (const g of VOICE_PHRASES) for (const s of g.say.filter(x => !x.startsWith('...'))) assert.ok(!voice({ ...defaultPicks(), things: [{ id: 'pear', job: 'dodge' }] }, s).unknown || ['add a golden one', 'no golden one'].includes(s), s);
});

test('voice: limits are never passed, however many times it is said', () => {
  const said = (phrase, n, start = defaultPicks()) => { let p = start; for (let i = 0; i < n; i++) p = voice(p, phrase).picks; return p; };
  assert.equal(said('faster', 20).speed, 6); assert.equal(said('slower', 20).speed, 0);
  assert.equal(said('more', 20).many, 6); assert.equal(said('fewer', 20).many, 0);
  assert.equal(said('bigger', 20).size, 4); assert.equal(said('smaller', 20).size, 0);
  assert.equal(said('longer', 20).minutes, 3); assert.equal(said('shorter', 20).minutes, 1);
  const top = voice(said('faster', 20), 'faster'); assert.deepEqual(top.changed, []); assert.ok(!top.unknown); assert.equal(top.atLimit, 'Faster');
  for (const phrase of ['faster', 'more', 'bigger', 'longer', 'slower', 'fewer', 'smaller', 'shorter']) for (const job of JOBS)
    assert.deepEqual(validate(build(said(phrase, 12, { ...picksOf(['apple', job], ['bee', 'dodge']), golden: true, bomb: true })), env0), [], phrase + job);
});
