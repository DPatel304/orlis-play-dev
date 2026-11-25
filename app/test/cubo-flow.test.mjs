/* Cubo's Create as a state machine (decisions 0060, 0061): start, where, game, what (tiles, then a parade), rules (two questions), name, play;
   back; the remote's paths; slots full; Cubo shows each gesture once. */
import test from 'node:test';
import assert from 'node:assert/strict';
const F = await import('../src/create/cubo-flow.js');
const { isGoodName, build, gameJob } = await import('../src/create/recipe.js');
const { FULL_LINE } = await import('../src/create/slots.js');

const go = (s, ...evs) => { const fx = []; for (const e of evs){ const r = F.reduce(s, typeof e === 'string' ? { t: e } : e); s = r.state; fx.push(...r.fx); } return { s, fx }; };
const says = (fx) => fx.filter(f => f.say).map(f => f.say);
const key = (k) => ({ t: 'key', key: k });
/* a game as far as Rules: start, where, game (a kind), what (a group and its things), on */
const toRules = (job = 'collect', group = 'food', ...things) => go(F.newFlow(), 'arms', 'arms', { t: 'job', id: job }, { t: 'group', id: group }, ...things.map(id => ({ t: 'grab', id })), 'arms');

test('the steps run start, where, game, what, rules, name, play, and each one says its line once on arriving', () => {
  assert.deepEqual(F.STEPS, ['start', 'where', 'game', 'what', 'rules', 'name', 'play']);
  assert.deepEqual(F.DOTS, ['where', 'game', 'what', 'rules', 'name'], 'the step dots across the top');
  let s = F.newFlow();
  assert.equal(s.step, 'start'); assert.equal(s.say, "Let's make a game! Raise both arms to start.");
  let r = go(s, 'arms'); assert.equal(r.s.step, 'where'); assert.deepEqual(says(r.fx), [F.LINES.where]);
  r = go(r.s, { t: 'world', ix: 2 }, 'arms'); assert.equal(r.s.step, 'game'); assert.equal(r.s.picks.where, F.WORLDS[2]); assert.deepEqual(says(r.fx), [F.LINES.game]);
  r = go(r.s, { t: 'job', id: 'dodge' }); assert.equal(r.s.step, 'what'); assert.equal(r.s.job, 'dodge');
  assert.deepEqual(says(r.fx), ['What shall we dodge? Hold one to open it!']);
  assert.ok(r.fx.some(f => f.cheer === 'dodge'), 'Cubo reacts to the pick');
  assert.equal(r.s.group, null, 'the group tiles first');
  r = go(r.s, { t: 'group', id: 'animals' }, { t: 'grab', id: 'bee' }, { t: 'grab', id: 'frog' }, 'arms');
  assert.equal(r.s.step, 'rules'); assert.deepEqual(r.s.picks.things, [{ id: 'bee', job: 'dodge' }, { id: 'frog', job: 'dodge' }], 'every thing has the game’s one job');
  assert.equal(r.s.q, 'speed'); assert.deepEqual(says(r.fx), [F.LINES.speed]);
  r = go(r.s, { t: 'meter', i: 6 }, 'set'); assert.equal(r.s.q, 'many', 'one question at a time'); assert.deepEqual(says(r.fx), [F.LINES.many]);
  r = go(r.s, { t: 'meter', i: 0 }, 'set', 'arms');
  assert.equal(r.s.step, 'name'); assert.equal(r.s.picks.speed, 6); assert.equal(r.s.picks.many, 0);
  assert.deepEqual(says(r.fx), [F.LINES.name]);
  assert.ok(r.s.names.length >= 6 && r.s.names.every(isGoodName), 'a wheel of good names');
  const want = r.s.names[0];
  r = go(r.s, 'arms'); assert.equal(r.s.step, 'play');
  const play = r.fx.find(f => f.play).play;
  assert.equal(play.name, want); assert.equal(play.picks.name, want); assert.equal(play.id, null);
  assert.ok(build(play.picks), 'the picks build a game');
});

test('Cubo shows each gesture the first time it is needed, once: arms up at Where, hold on the game cards', () => {
  assert.deepEqual(F.DEMO_LINES, { hold: 'Hold your hand on one!', arms: "Arms up when you're done!" });
  let r = go(F.newFlow(), 'arms');
  assert.deepEqual(r.fx.filter(f => f.demo), [{ demo: 'arms' }], 'arms up, at Where');
  r = go(r.s, 'arms'); assert.deepEqual(r.fx.filter(f => f.demo), [{ demo: 'hold' }], 'hold, at the game cards');
  r = go(r.s, 'back'); r = go(r.s, 'arms'); assert.deepEqual(r.fx.filter(f => f.demo), [], 'never twice');
  assert.deepEqual(r.s.demoed, { hold: true, arms: true });
  /* a second game in the same session starts knowing both */
  r = go(F.newFlow({ demoed: r.s.demoed }), 'arms', 'arms'); assert.deepEqual(r.fx.filter(f => f.demo), []);
  /* Change it opens at Where: Cubo shows arms up there */
  const edit = F.newFlow({ creation: { id: 'c', name: 'N', picks: { things: [{ id: 'apple', job: 'collect' }] } } });
  assert.equal(edit.demo, 'arms');
  assert.equal(F.newFlow({ demoed: { arms: true }, creation: { id: 'c', name: 'N', picks: { things: [{ id: 'apple', job: 'collect' }] } } }).demo, null);
});

test('a jump spins the name wheel on; arms up keeps the one it stopped at', () => {
  let { s } = go(toRules('collect', 'food', 'apple').s, 'arms', 'arms');
  assert.equal(s.step, 'name');
  const first = s.names[0];
  let r = go(s, { t: 'spin', by: 3 }); assert.equal(r.s.nameIx, 3);
  r = go(r.s, { t: 'spin', by: s.names.length }); assert.equal(r.s.nameIx, 3, 'it wraps right round');
  r = go(s, { t: 'spin', by: 2 }, 'arms');
  assert.equal(r.fx.find(f => f.play).play.name, s.names[2]); assert.notEqual(s.names[2], first);
});

test('slots full: Cubo says so and nothing starts, by arms or by the remote', () => {
  const s = F.newFlow({ full: true });
  for (const e of ['arms', 'ok']){
    const r = go(s, e);
    assert.equal(r.s.step, 'start'); assert.ok(r.fx.some(f => f.full)); assert.deepEqual(says(r.fx), [FULL_LINE]);
  }
  assert.equal(F.newFlow({ full: true, creation: { id: 'x', name: 'N', picks: { things: [{ id: 'apple', job: 'collect' }] } } }).full, false, 'changing a game you already have is allowed');
});

test('What: five at most, a sixth is turned down with a line; holding the tray takes one back; none cannot go on; Groups goes back to the tiles', () => {
  let { s } = go(F.newFlow(), 'arms', 'arms', { t: 'job', id: 'collect' }, { t: 'group', id: 'food' });
  let r = go(s, 'arms'); assert.equal(r.s.step, 'what', 'nothing grabbed yet: stays'); assert.deepEqual(says(r.fx), [F.LINES.none]);
  const ids = ['apple', 'pear', 'banana', 'orange', 'cherry'];
  r = go(s, ...ids.map(id => ({ t: 'grab', id }))); assert.equal(r.s.tray.length, 5); assert.ok(r.fx.filter(f => f.pop).length === 5);
  r = go(r.s, { t: 'grab', id: 'cupcake' }); assert.equal(r.s.tray.length, 5); assert.ok(r.fx.some(f => f.msg));
  r = go(r.s, { t: 'grab', id: 'apple' }); assert.equal(r.s.tray.length, 5, 'the same one twice is not a second pick');
  r = go(r.s, { t: 'take', id: 'pear' }); assert.deepEqual(r.s.tray, ['apple', 'banana', 'orange', 'cherry']);
  r = go(r.s, 'ungroup'); assert.equal(r.s.group, null, 'the tiles again'); assert.equal(r.s.tray.length, 4, 'the tray is kept');
  r = go(r.s, { t: 'group', id: 'toys' }, 'arms'); assert.equal(r.s.step, 'rules'); assert.deepEqual(r.s.picks.things.map(t => t.id), ['apple', 'banana', 'orange', 'cherry']);
  assert.equal(gameJob(r.s.picks), 'collect');
});

test('Rules asks "How fast?" then "How many?", the hand live, held still to set; Cubo picks only after a quiet spell with nothing touched', () => {
  let { s } = toRules('keepup', 'toys', 'beachball');
  assert.equal(s.step, 'rules'); assert.equal(s.q, 'speed');
  let r = go(s, { t: 'tick', dt: 7 }); assert.equal(r.s.step, 'rules');
  /* the hand moves along the meter: live, nothing set yet */
  const live = go(r.s, { t: 'meter', i: 5 }, { t: 'tick', dt: 30 });
  assert.equal(live.s.step, 'rules', 'a touch ends the wait: the choosing is theirs'); assert.equal(live.s.picks.speed, 5, 'live'); assert.equal(live.s.q, 'speed', 'not set yet');
  assert.equal(go(live.s, { t: 'meter', i: 99 }).s.picks.speed, 6, 'the top stop is the most');
  assert.equal(go(live.s, { t: 'meter', i: -4 }).s.picks.speed, 0);
  r = go(live.s, 'set'); assert.equal(r.s.q, 'many'); assert.equal(r.s.picks.speed, 5);
  r = go(r.s, { t: 'meter', i: 4 }); assert.equal(r.s.picks.many, 4); assert.equal(r.s.picks.speed, 5, 'the speed stays');
  assert.equal(r.s.manySet, false);
  r = go(r.s, 'set'); assert.equal(r.s.manySet, true); assert.equal(r.s.step, 'rules', 'arms up goes on, setting does not');
  r = go(r.s, 'arms'); assert.equal(r.s.step, 'name');
  /* a quiet spell: Cubo picks the usual rules and goes on */
  r = go(r.s, 'back'); assert.equal(r.s.step, 'rules');
  r = go(toRules('keepup', 'toys', 'beachball').s, { t: 'tick', dt: 7 }, { t: 'tick', dt: 1.5 });
  assert.equal(r.s.step, 'name'); assert.deepEqual(says(r.fx), ["I'll pick!", F.LINES.name]);
  assert.equal(r.s.picks.speed, 3, 'the usual speed'); assert.equal(r.s.picks.many, 3);
  /* a game being changed keeps its own rules when Cubo picks */
  const edit = F.newFlow({ creation: { id: 'c1', name: 'N', picks: { things: [{ id: 'apple', job: 'collect' }], speed: 5, many: 4 } } });
  let e = go(edit, 'arms', { t: 'job', id: 'collect' }, 'arms', { t: 'tick', dt: 9 });
  assert.equal(e.s.step, 'name'); assert.equal(e.s.picks.speed, 5, 'its own speed'); assert.equal(e.s.picks.many, 4);
  assert.equal(F.reduce(F.newFlow({ full: true }), { t: 'full', full: false }).state.full, false, 'a slot freed while waiting at the start');
  assert.equal(F.reduce(F.newFlow(), { t: 'full', full: true }).state.full, true);
  assert.equal(go(F.newFlow(), { t: 'tick', dt: 30 }).s.step, 'start', 'the clock only runs in Rules');
});

test('Back goes a step back at a time, out of a group first, from "How many?" to "How fast?", and leaves from the start', () => {
  let { s } = go(F.newFlow(), 'arms', 'arms', { t: 'job', id: 'stack' }, { t: 'group', id: 'toys' }, { t: 'grab', id: 'balloon' });
  assert.equal(s.group, 'toys');
  let r = go(s, 'back'); assert.equal(r.s.step, 'what'); assert.equal(r.s.group, null, 'out of the group first'); assert.deepEqual(r.s.tray, ['balloon'], 'the pick is kept');
  r = go(r.s, 'back'); assert.equal(r.s.step, 'game');
  r = go(r.s, 'back'); assert.equal(r.s.step, 'where');
  r = go(r.s, 'back'); assert.equal(r.s.step, 'start');
  r = go(r.s, 'back'); assert.ok(r.fx.some(f => f.exit));
  /* rules: how many back to how fast, then out to What */
  let q = go(s, 'arms', 'set').s; assert.equal(q.step, 'rules'); assert.equal(q.q, 'many');
  assert.deepEqual(says(go(q, 'back').fx), [F.LINES.speed]);
  q = go(q, 'back').s; assert.equal(q.step, 'rules'); assert.equal(q.q, 'speed');
  q = go(q, 'back').s; assert.equal(q.step, 'what'); assert.equal(q.group, null);
  const named = go(s, 'arms', 'arms', 'arms').s; assert.equal(named.step, 'name');
  assert.equal(go(named, 'back').s.step, 'rules'); assert.equal(go(go(named, 'arms').s, 'back').s.step, 'name');
  assert.equal(go(go(named, 'arms').s, { t: 'saved-failed' }).s.step, 'name', 'a play that did not save goes back to the name');
});

test('Change it: opens at Where on the game’s own picks, keeps its things, job and name, and saves back into the same slot', () => {
  const creation = { id: 'c9', name: 'Super Bee Dodge Party', picks: { things: [{ id: 'bee', job: 'dodge' }, { id: 'frog', job: 'dodge' }], where: 'beach', speed: 5, many: 4, name: 'Super Bee Dodge Party' } };
  let s = F.newFlow({ creation });
  assert.equal(s.step, 'where'); assert.equal(F.WORLDS[s.worldIx], 'beach'); assert.deepEqual(s.tray, ['bee', 'frog']); assert.equal(s.job, 'dodge');
  let r = go(s, { t: 'world', ix: 1 }, 'arms'); assert.equal(r.s.picks.where, F.WORLDS[1]);
  r = go(r.s, { t: 'job', id: 'dodge' }, 'arms'); assert.equal(r.s.step, 'rules', 'the picks were kept: straight on from What');
  assert.equal(r.s.picks.speed, 5);
  r = go(r.s, 'arms', 'arms'); assert.equal(r.s.names[0], 'Super Bee Dodge Party', 'its own name is first on the wheel');
  r = go(r.s, 'arms'); assert.equal(r.fx.find(f => f.play).play.id, 'c9');
  assert.ok(go(s, 'back').fx.some(f => f.exit), 'Back from Where, in a game being changed, leaves');
});

test('the remote: arrows and OK on every step, one lit thing each', () => {
  let r = go(F.newFlow(), 'ok'); assert.equal(r.s.step, 'where');
  const n = F.WORLDS.length;
  assert.deepEqual(F.focusOf(r.s), { zone: 'world', item: 0 });
  r = go(r.s, key('right'), key('right')); assert.equal(r.s.worldIx, 2); assert.equal(r.s.picks.where, F.WORLDS[2]);
  r = go(r.s, key('left'), key('left'), key('left')); assert.equal(r.s.worldIx, n - 1, 'it wraps');
  r = go(r.s, 'ok'); assert.equal(r.s.step, 'game');
  r = go(r.s, key('right'), key('right'), key('right')); assert.equal(r.s.gameIx, 3, 'one row of four: the fourth card');
  r = go(r.s, key('right')); assert.equal(r.s.gameIx, 0, 'it wraps');
  r = go(r.s, key('left'), 'ok'); assert.equal(r.s.step, 'what'); assert.equal(r.s.job, 'stack');
  /* the tiles */
  assert.deepEqual(F.focusOf(r.s), { zone: 'tiles', item: 0 });
  r = go(r.s, key('right'), key('right'), 'ok'); assert.equal(r.s.group, F.GROUPS[2]);
  /* the parade: left and right pick the thing, OK grabs it; down goes to the tray, up to Groups */
  assert.deepEqual(F.focusOf(r.s), { zone: 'parade', item: 0 });
  const ids = F.idsOf('sky');
  r = go(r.s, key('right'), 'ok'); assert.deepEqual(r.s.tray, [ids[1]], 'OK grabs the lit one');
  r = go(r.s, 'ok'); assert.deepEqual(r.s.tray, [ids[1]], 'the same one again: not a second pick'); assert.ok(r.fx.some(f => f.msg));
  r = go(r.s, key('right'), 'ok'); assert.deepEqual(r.s.tray, [ids[1], ids[2]]);
  r = go(r.s, key('left'), key('left'), key('left')); assert.equal(r.s.parIx, ids.length - 1, 'the parade wraps');
  r = go(r.s, key('down')); assert.deepEqual(F.focusOf(r.s), { zone: 'tray', item: 0 });
  r = go(r.s, key('right'), 'ok'); assert.deepEqual(r.s.tray, [ids[1]], 'OK on a tray item takes it back');
  r = go(r.s, key('up')); assert.equal(r.s.zone, 'parade');
  r = go(r.s, key('up')); assert.deepEqual(F.focusOf(r.s), { zone: 'groups', item: 0 });
  r = go(r.s, key('down')); assert.equal(r.s.zone, 'parade');
  r = go(r.s, key('up'), 'ok'); assert.equal(r.s.group, null, 'OK on Groups goes back to the tiles');
  r = go(r.s, 'ok'); r = go(r.s, key('down'), key('down')); assert.equal(r.s.zone, 'done');
  r = go(r.s, 'ok'); assert.equal(r.s.step, 'rules');
  /* rules: up is more, down is less, OK sets (and on) */
  assert.deepEqual(F.focusOf(r.s), { zone: 'meter', item: 0 });
  r = go(r.s, key('up'), key('up')); assert.equal(r.s.picks.speed, 5);
  r = go(r.s, key('down')); assert.equal(r.s.picks.speed, 4);
  r = go(r.s, 'ok'); assert.equal(r.s.q, 'many'); assert.deepEqual(F.focusOf(r.s), { zone: 'meter', item: 1 });
  r = go(r.s, key('down'), key('down')); assert.equal(r.s.picks.many, 1);
  r = go(r.s, key('up')); assert.equal(r.s.picks.many, 2);
  r = go(r.s, 'ok'); assert.equal(r.s.step, 'name');
  r = go(r.s, key('right'), key('right')); assert.equal(r.s.nameIx, 2);
  r = go(r.s, 'ok'); assert.equal(r.s.step, 'play'); assert.equal(r.fx.find(f => f.play).play.name, r.s.names[2]);
});

test('there is one lit thing on every step the remote can reach', () => {
  const must = (s) => { const f = F.focusOf(s); assert.ok(f && f.zone, `a focus on ${s.step}`); return f; };
  let s = F.newFlow(); assert.equal(F.focusOf(s), null, 'the start screen is the page’s (the banner)');
  for (const e of ['ok', 'ok']) s = go(s, e).s;
  must(s);
  s = go(s, { t: 'job', id: 'collect' }).s; must(s);
  s = go(s, { t: 'group', id: 'food' }, { t: 'grab', id: 'apple' }).s; must(s);
  s = go(s, 'ok').s;
  for (const k of ['down', 'down', 'up', 'up', 'left', 'right']) { s = go(s, key(k)).s; must(s); }
  s = go(s, 'arms').s; must(s);
  s = go(s, 'ok', 'ok').s; must(s);
});

test('the wheel of names is the same for the same game, and every name passes isGoodName', () => {
  const picks = { things: [{ id: 'apple', job: 'collect' }, { id: 'bee', job: 'collect' }], where: 'night' };
  const a = F.nameWheel(picks), b = F.nameWheel(picks);
  assert.deepEqual(a, b); assert.ok(a.length >= 8); assert.equal(new Set(a).size, a.length); assert.ok(a.every(isGoodName));
});
