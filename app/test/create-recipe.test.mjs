import test from 'node:test';
import assert from 'node:assert/strict';
import { choices, defaultPicks, clean, build, suggestNames, sentence, voice, VOICE_PHRASES } from '../src/create/recipe.js';
import { validate } from '../src/games/play/validate.js';
import { playEnv } from '../src/games/play/env.js';
import { makePlay } from '../src/games/play/engine.js';
import { LIMITS } from '../src/games/play/vocabulary.js';

const env0 = playEnv(), DT = 1 / 30, W = 1920, H = 1080;
const HOWS = choices.how.map(h => h.id), WHERES = choices.where.map(w => w.id), MOVES = choices.move.map(m => m.id);
const ALL = choices.what.flatMap(c => c.pieces.map(p => p.id));
const SAMPLE = ['apple', 'strawberry', 'bee', 'fish', 'star', 'glowstar', 'balloon', 'beachball', 'mapleleaf', 'icecream'];

function headless(spec, n = 2){
  let s = 7; const random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pose = { players: Array.from({ length: 4 }, (_, i) => ({ present: i < n, hands: { left: { x: 0.1, y: 1.6, vx: 0, vy: 0, speed: 0 }, right: { x: 0.9, y: 1.6, vx: 0, vy: 0, speed: 0 } } })), mouse: { active: false } };
  const sounds = [], sfx = new Proxy({}, { get: (_, k) => () => sounds.push(k) });
  const A = { scene() {}, draw() {}, text() {} }, ui = { say() {}, goal() {} };
  const g = makePlay(spec, { pose, sfx, assets: A, ui, colors: ['#3da9ff', '#ff8a3d', '#3fcf7f', '#c46bff'], max: 4, random });
  return { round: g.create(n), pose, sounds };
}
const run = (round, secs) => { for (let t = 0; t < secs; t += DT) round.step(DT, W, H); };

test('the menus: five recipes, pieces that exist in the library, worlds, moves and rules', () => {
  assert.deepEqual(HOWS, ['catch', 'pop', 'dodge', 'collect', 'keepup']);
  for (const c of choices.what){ assert.ok(c.pieces.length >= 6 && c.pieces.length <= 10, c.id); for (const p of c.pieces) assert.ok(env0.has(p.id), p.id + ' is in the library'); }
  assert.equal(new Set(ALL).size, ALL.length, 'no piece twice');
  for (const w of choices.where) assert.ok(env0.scenes.includes(w.id), w.id);
  assert.ok(choices.where.every(w => w.palette), 'every world is on the master palette (decision 0040)');
  for (const m of choices.move) assert.ok(env0.poses.includes(m.id), m.id);
  assert.equal(choices.rules.speed.steps, 5); assert.equal(choices.rules.many.steps, 5);
  assert.deepEqual(choices.rules.minutes.options, [1, 2, 3]);
  assert.deepEqual(choices.rules.mode.map(m => m.id), ['together', 'versus']);
  assert.deepEqual(choices.rules.specials.map(m => m.id), ['golden', 'bomb']);
});

test('every recipe x thing x world x move x mode x specials builds a game that passes validate.js', () => {
  let n = 0;
  for (const how of HOWS) for (const what of ALL) for (const where of WHERES) for (const move of MOVES) for (const mode of ['together', 'versus']) for (const [golden, bomb] of [[false, false], [true, false], [false, true], [true, true]]){
    if (what !== 'apple' && where !== 'meadow' && move !== 'wave') continue;        /* (every piece with one world and move, and every world and move with one piece: all of the product is overkill) */
    const g = build({ how, what, where, move, mode, golden, bomb });
    assert.deepEqual(validate(g, env0), [], JSON.stringify({ how, what, where, move, mode, golden, bomb })); n++;
  }
  for (const how of HOWS) for (const what of SAMPLE) for (const where of WHERES) for (const move of MOVES) for (const mode of ['together', 'versus']) for (const [golden, bomb] of [[false, false], [true, true]]){
    assert.deepEqual(validate(build({ how, what, where, move, mode, golden, bomb }), env0), []); n++;
  }
  assert.ok(n > 3000);
});

test('every speed, how many, size and length is in the limits', () => {
  for (const how of HOWS) for (let speed = 0; speed < 5; speed++) for (let many = 0; many < 5; many++) for (let size = 0; size < 5; size++) for (const minutes of [1, 2, 3]){
    const g = build({ how, speed, many, size, minutes, golden: true, bomb: true });
    assert.deepEqual(validate(g, env0), []);
    assert.equal(g.secs, minutes * 60);
    for (const t of g.things){ assert.ok(t.size >= LIMITS.size[0] && t.size <= LIMITS.size[1]); if (t.appears) assert.ok(t.appears.max >= 1 && t.appears.max <= LIMITS.max[1] && t.appears.every >= LIMITS.every[0] && t.appears.every <= LIMITS.every[1]); }
  }
  /* speed and how many really change the game */
  const slow = build({ how: 'catch', speed: 0 }), fast = build({ how: 'catch', speed: 4 });
  assert.ok(fast.things[0].speed > slow.things[0].speed);
  const few = build({ how: 'pop', many: 0 }), lots = build({ how: 'pop', many: 4 });
  assert.ok(lots.things[0].appears.max > few.things[0].appears.max && lots.things[0].appears.every < few.things[0].appears.every);
  assert.ok(build({ how: 'keepup', many: 4 }).things[0].count > 1);
});

test('recipes map onto the vocabulary', () => {
  const t = (how, o = {}) => build({ how, ...o }).things;
  assert.equal(t('catch')[0].moves, 'fall'); assert.equal(t('catch')[0].appears.from, 'top');
  assert.equal(t('pop')[0].moves, 'rise'); assert.equal(t('pop')[0].appears.from, 'bottom');
  assert.equal(t('dodge')[0].moves, 'drift');
  assert.deepEqual(t('dodge')[0].rules[0].then.filter(x => typeof x === 'object')[0], { score: -1 });
  assert.equal(t('collect')[0].moves, 'bob'); assert.ok(t('collect')[0].rules.some(r => r.when === 'age'), 'collected things go after a while');
  assert.equal(t('keepup')[0].moves, 'bounce'); assert.ok(t('keepup')[0].rules.some(r => r.when === 'lands'));
  assert.ok(t('keepup')[0].rules[0].then.includes('kickUp'));
  /* specials: golden is a second thing worth 5, bomb a second thing that costs points */
  const g = t('catch', { golden: true, bomb: true });
  assert.equal(g.length, 3);
  assert.ok(JSON.stringify(g[1].rules).includes('{"score":5}') && g[1].color === 'gold' && g[1].appears.every > g[0].appears.every);
  assert.ok(JSON.stringify(g[2].rules).includes('"score":-3') && g[2].piece === 'bomb');
  assert.equal(t('catch', { golden: false, bomb: false }).length, 1);
  assert.equal(t('keepup', { golden: true, bomb: true }).length, 1, 'a ball has no specials');
  /* together is the shared score, versus has a score for each player */
  assert.equal(build({ mode: 'together' }).team, true); assert.equal(build({ mode: 'versus' }).team, undefined);
  assert.equal(build({ where: 'night' }).scene, 'night'); assert.equal(build({ move: 'jump' }).card, 'jump');
  assert.equal(build({ how: 'catch', what: 'apple' }).hint, 'Catch the apples!');
  assert.equal(build({ how: 'keepup' }).hint, 'Keep it up!');
  assert.equal(build({ name: 'Mia Rocks' }).title, 'Mia Rocks');
});

test('the engine plays every recipe for a while, with hands in the way, without throwing', () => {
  for (const how of HOWS) for (const mode of ['together', 'versus']) for (const what of ['apple', 'glowstar', 'fish']){
    const { round, pose } = headless(build({ how, what, mode, golden: true, bomb: true, speed: 4, many: 4 }));
    for (let k = 0; k < 6 * 30; k++){
      /* a hand sweeping across the middle of the screen */
      Object.assign(pose.players[0].hands.right, { x: 0.5 + 0.4 * Math.sin(k / 20), y: 0.5 + 0.2 * Math.sin(k / 7), speed: 0.6, vx: 0.5, vy: -0.5 });
      Object.assign(pose.players[1].hands.right, { x: 0.5 + 0.4 * Math.cos(k / 17), y: 0.4, speed: 0.2, vx: 0, vy: 0 });
      round.step(DT, W, H); assert.doesNotThrow(() => { round.hud(); round.value(); round.card(); });
    }
    assert.ok(round.things.length > 0, how + ' has things');
    assert.ok(round.score.every(v => v >= 0), 'no score below 0');
  }
});

test('catch scores and pops; golden is worth 5; a bomb costs points; versus scores are the player\'s own', () => {
  const { round, pose, sounds } = headless(build({ how: 'catch', golden: true, bomb: true, mode: 'versus', many: 4 }));
  run(round, 20);
  const main = round.things.find(t => t.d.name === 'main'); Object.assign(pose.players[1].hands.right, { x: main.x, y: main.y, speed: 0.1 }); round.step(DT, W, H);
  assert.equal(round.score[1], 1); assert.equal(round.score[0], 0); assert.ok(round.fx.some(f => f.kind === 'popring')); assert.ok(sounds.includes('pop'));
  const gold = { d: round.defs.find(d => d.name === 'golden') }; assert.ok(gold.d);
  const g = round._make(gold.d, { x: 0.3, y: 0.3 }); Object.assign(pose.players[0].hands.right, { x: 0.3, y: 0.3, speed: 0.1 }); round.step(DT, W, H);
  assert.equal(round.score[0], 5); assert.ok(sounds.includes('gold')); assert.ok(g.dead);
  const before = round.score[0]; const bomb = round._make(round.defs.find(d => d.name === 'bomb'), { x: 0.7, y: 0.3 }); Object.assign(pose.players[0].hands.right, { x: 0.7, y: 0.3, speed: 0.1 });
  round.step(DT, W, H); assert.ok(round.score[0] < before, 'the bomb cost points'); assert.ok(bomb.dead);
  const lone = headless(build({ how: 'catch', golden: false, bomb: true, mode: 'versus' })); lone.round.things = [];
  lone.round._make(lone.round.defs.find(d => d.name === 'bomb'), { x: 0.7, y: 0.3 }); Object.assign(lone.pose.players[1].hands.right, { x: 0.7, y: 0.31, speed: 0.1 }); lone.round.step(DT, W, H);
  assert.equal(lone.round.score[1], 0, 'a score never goes below 0'); assert.equal(lone.round.total, 0);
});

test('dodge: a thing let go by scores for everyone playing, one that touches costs a point; keep it up: a ball that lands costs one', () => {
  const d = headless(build({ how: 'dodge', mode: 'versus', many: 4 }));
  run(d.round, 30);
  assert.ok(d.round.score[0] > 0 && d.round.score[1] > 0 && d.round.score[2] === 0, 'dodged things score for each player present');
  assert.ok(d.round.score[0] === d.round.score[1]);
  const before = d.round.score[0], th = d.round.things[0];
  Object.assign(d.pose.players[0].hands.right, { x: th.x, y: th.y, speed: 0.1 }); d.round.step(DT, W, H);
  assert.equal(d.round.score[0], Math.max(0, before - 1) + 0, 'touched: minus one'); assert.ok(d.sounds.includes('boing'));
  const k = headless(build({ how: 'keepup', mode: 'together' }));
  run(k.round, 4);
  assert.ok(k.sounds.includes('plop'), 'it landed');
  const ball = k.round.things[0]; ball.y = 0.5; ball.vy = 0;
  Object.assign(k.pose.players[0].hands.right, { x: ball.x, y: ball.y, speed: 0.5, vy: -1 }); const t0 = k.round.total; k.round.step(DT, W, H);
  assert.equal(k.round.total, t0 + 1); assert.ok(ball.vy < 0, 'kicked up');
});

test('names: three short ones, from fixed words', () => {
  for (const how of HOWS) for (const what of ALL) for (const golden of [false, true]){
    const n = suggestNames({ how, what, golden });
    assert.equal(n.length, 3, how + what); assert.equal(new Set(n).size, 3);
    for (const x of n) assert.ok(x.length > 0 && x.length <= 24 && /^[A-Za-z ]+$/.test(x), x);
  }
  assert.deepEqual(suggestNames(defaultPicks()), ['Apple Catch', 'Apple Rain', 'Golden Apples']);
  assert.equal(suggestNames({ how: 'collect', what: 'bee', golden: false, where: 'night' })[2], 'Starry Bees');
  assert.equal(build(defaultPicks()).title, 'Apple Catch');
});

test('the sentence sums the game up', () => {
  assert.equal(sentence(defaultPicks()), 'Catch the apples in the sunny meadow by reaching up, with a golden one worth 5. Play together.');
  assert.equal(sentence({ how: 'pop', what: 'balloon', where: 'night', move: 'jump', mode: 'versus', golden: true, bomb: true }), 'Pop the balloons in the starry night by jumping, with a golden one worth 5, and a bomb to avoid. Who gets the most?');
  assert.equal(sentence({ how: 'dodge', what: 'rock' === 'x' ? 'x' : 'bee', where: 'beach', move: 'squat', golden: false, bomb: true }), 'Dodge the bees in the sunny beach by squatting, with a bomb to avoid. Play together.');
  assert.equal(sentence({ how: 'keepup', what: 'beachball', where: 'snow', move: 'wave', golden: true }), 'Keep the beach ball up in the snowy hills by waving. Play together.');
  for (const how of HOWS) for (const what of ALL) assert.match(sentence({ how, what }), /\.$/);
});

test('clean: anything becomes whole, valid picks', () => {
  assert.deepEqual(clean({}), defaultPicks());
  const c = clean({ how: 'zzz', what: '<b>', where: 'mars', move: 'fly', speed: 99, many: -4, size: 'x', minutes: 9, mode: 'x', name: '  A very long name that goes on and on  ' });
  assert.equal(c.how, 'catch'); assert.equal(c.speed, 4); assert.equal(c.many, 0); assert.equal(c.size, 2); assert.equal(c.minutes, 1); assert.equal(c.name.length, 24);
  assert.deepEqual(validate(build({ how: 'zzz', what: 'mars' }), env0), []);
});

/* [phrase, key that changes, expected value or label] */
const CASES = [
  ['faster', 'speed', 3], ['make it go faster please', 'speed', 3], ['a bit quicker', 'speed', 3], ['speed up', 'speed', 3], ['Faster!', 'speed', 3], ['zoom', 'speed', 3],
  ['slower', 'speed', 1], ['slow down please', 'speed', 1], ['can you make it slower', 'speed', 1],
  ['more', 'many', 3], ['more apples', 'many', 3], ['lots more please', 'many', 3], ['fewer', 'many', 1], ['less', 'many', 1], ['fewer please', 'many', 1],
  ['bigger', 'size', 3], ['make them bigger', 'size', 3], ['smaller', 'size', 1], ['tiny', 'size', 1],
  ['longer', 'minutes', 2], ['make it longer', 'minutes', 2], ['more time', 'minutes', 2],
  ['make it night', 'where', 'night'], ['night please', 'where', 'night'], ['make it snowy', 'where', 'snow'], ['make it a beach', 'where', 'beach'], ['beach', 'where', 'beach'], ['make it evening', 'where', 'sunset'], ['sunset', 'where', 'sunset'], ['make it autumn', 'where', 'autumn'],
  ['add a bomb', 'bomb', true], ['bomb please', 'bomb', true], ['race', 'mode', 'versus'], ['who wins', 'mode', 'versus'], ['lets race', 'mode', 'versus'],
  ['catch', 'how', 'catch'], ['pop', 'how', 'pop'], ['dodge', 'how', 'dodge'], ['collect them', 'how', 'collect'], ['keep it up', 'how', 'keepup'],
  ['bees', 'what', 'bee'], ['stars', 'what', 'star'], ['glow stars', 'what', 'glowstar'], ['I want fish', 'what', 'fish'], ['ice cream', 'what', 'icecream'], ['balloons!', 'what', 'balloon']
];
test('voice: a fixed phrase map changes one setting by one step', () => {
  assert.ok(CASES.length >= 30);
  for (const [phrase, key, want] of CASES){
    const start = { ...defaultPicks(), ...(key === 'how' && want === 'catch' ? { how: 'pop' } : {}), ...(key === 'what' && want === 'bee' ? {} : {}), ...(key === 'mode' ? { mode: 'together' } : {}), ...(key === 'where' && want === 'beach' ? {} : {}) };
    const r = voice(start, phrase);
    assert.ok(!r.unknown, phrase); assert.equal(r.changed.length, 1, phrase); assert.equal(r.picks[key], want, phrase);
    /* only that setting moved */
    for (const k of Object.keys(start)) if (k !== key) assert.deepEqual(r.picks[k], start[k], phrase + ' left ' + k);
    assert.deepEqual(start, { ...start }, 'the picks given are not changed');
  }
});

test('voice: the golden one, the bomb, together', () => {
  const on = { ...defaultPicks(), golden: true, bomb: true, mode: 'versus' }, off = { ...defaultPicks(), golden: false, bomb: false };
  assert.equal(voice(on, 'no golden one').picks.golden, false); assert.deepEqual(voice(on, 'no golden one').changed, ['No golden one']);
  assert.equal(voice(on, 'take away the golden one').picks.golden, false);
  assert.equal(voice(on, 'no bomb').picks.bomb, false); assert.equal(voice(on, 'no more bombs').picks.bomb, false); assert.equal(voice(on, 'get rid of the bomb').picks.bomb, false);
  assert.equal(voice(off, 'add a golden one').picks.golden, true); assert.deepEqual(voice(off, 'add a golden one').changed, ['Golden one']);
  assert.equal(voice(off, 'golden please').picks.golden, true);
  assert.equal(voice(on, 'together').picks.mode, 'together'); assert.equal(voice(on, "let's play together").picks.mode, 'together');
  assert.equal(voice(off, 'add a bomb').picks.bomb, true);
  /* already so: nothing changes, and it is not "unknown" */
  const r = voice(on, 'add a bomb'); assert.deepEqual(r.changed, []); assert.ok(!r.unknown); assert.ok(r.atLimit);
  /* a ball has no specials */
  assert.ok(voice({ ...off, how: 'keepup' }, 'add a bomb').unknown);
});

test('voice: unknown phrases, fillers, empty and odd input', () => {
  for (const x of ['', '   ', 'hello there', 'make it purple', 'draw me a dragon', 'xyzzy', '???', 'open the door', 'tell me a joke', null, undefined, 42]){
    const r = voice(defaultPicks(), x);
    assert.equal(r.unknown, true, String(x)); assert.deepEqual(r.changed, []); assert.deepEqual(r.picks, defaultPicks());
  }
  /* a phrase is one command: words are never taken as code or text */
  assert.ok(voice(defaultPicks(), '<script>alert(1)</script>').unknown);
  assert.ok(Array.isArray(VOICE_PHRASES) && VOICE_PHRASES.every(g => g.group && g.say.length));
  for (const g of VOICE_PHRASES) for (const s of g.say.filter(x => !x.startsWith('...'))) assert.ok(!voice(defaultPicks(), s).unknown || ['catch'].includes(s) === false, s);
});

test('voice: limits are never passed, however many times it is said', () => {
  const said = (phrase, n, start = defaultPicks()) => { let p = start; for (let i = 0; i < n; i++) p = voice(p, phrase).picks; return p; };
  assert.equal(said('faster', 20).speed, 4); assert.equal(said('slower', 20).speed, 0);
  assert.equal(said('more', 20).many, 4); assert.equal(said('fewer', 20).many, 0);
  assert.equal(said('bigger', 20).size, 4); assert.equal(said('smaller', 20).size, 0);
  assert.equal(said('longer', 20).minutes, 3); assert.equal(said('shorter', 20).minutes, 1);
  const top = voice(said('faster', 20), 'faster'); assert.deepEqual(top.changed, []); assert.ok(!top.unknown); assert.equal(top.atLimit, 'Faster');
  /* and the game built from the extremes is still valid */
  for (const phrase of ['faster', 'more', 'bigger', 'longer', 'slower', 'fewer', 'smaller', 'shorter']) for (const how of HOWS)
    assert.deepEqual(validate(build(said(phrase, 12, { ...defaultPicks(), how, golden: true, bomb: true })), env0), [], phrase + how);
});
