/* Cubo's Create as a state machine (decision 0060): start, where, game, what, rules, name, play; back; the remote's paths; slots full. */
import test from 'node:test';
import assert from 'node:assert/strict';
const F = await import('../src/create/cubo-flow.js');
const { isGoodName, build, gameJob } = await import('../src/create/recipe.js');
const { FULL_LINE } = await import('../src/create/slots.js');

const go = (s, ...evs) => { const fx = []; for (const e of evs){ const r = F.reduce(s, typeof e === 'string' ? { t: e } : e); s = r.state; fx.push(...r.fx); } return { s, fx }; };
const says = (fx) => fx.filter(f => f.say).map(f => f.say);

test('the steps run start, where, game, what, rules, name, play, and each one says its line once on arriving', () => {
  assert.deepEqual(F.STEPS, ['start', 'where', 'game', 'what', 'rules', 'name', 'play']);
  let s = F.newFlow();
  assert.equal(s.step, 'start'); assert.equal(s.say, "Let's make a game! Raise both arms to start.");
  let r = go(s, 'arms'); assert.equal(r.s.step, 'where'); assert.deepEqual(says(r.fx), [F.LINES.where]);
  r = go(r.s, { t: 'world', ix: 2 }, 'arms'); assert.equal(r.s.step, 'game'); assert.equal(r.s.picks.where, F.WORLDS[2]); assert.deepEqual(says(r.fx), [F.LINES.game]);
  r = go(r.s, { t: 'job', id: 'dodge' }); assert.equal(r.s.step, 'what'); assert.equal(r.s.job, 'dodge');
  assert.deepEqual(says(r.fx), ['What shall we dodge? Pick a group, then grab!']);
  assert.ok(r.fx.some(f => f.cheer === 'dodge'), 'Cubo reacts to the pick');
  r = go(r.s, { t: 'group', id: 'animals' }, { t: 'grab', id: 'bee' }, { t: 'grab', id: 'frog' }, 'arms');
  assert.equal(r.s.step, 'rules'); assert.deepEqual(r.s.picks.things, [{ id: 'bee', job: 'dodge' }, { id: 'frog', job: 'dodge' }], 'every thing has the game’s one job');
  r = go(r.s, { t: 'speed', i: 6 }, { t: 'many', i: 0 }, 'arms');
  assert.equal(r.s.step, 'name'); assert.equal(r.s.picks.speed, 6); assert.equal(r.s.picks.many, 0);
  assert.deepEqual(says(r.fx), [F.LINES.name]);
  assert.ok(r.s.names.length >= 6 && r.s.names.every(isGoodName), 'a wheel of good names');
  const want = r.s.names[0];
  r = go(r.s, 'arms'); assert.equal(r.s.step, 'play');
  const play = r.fx.find(f => f.play).play;
  assert.equal(play.name, want); assert.equal(play.picks.name, want); assert.equal(play.id, null);
  assert.ok(build(play.picks), 'the picks build a game');
});

test('a jump spins the name wheel on; arms up keeps the one it stopped at', () => {
  let { s } = go(F.newFlow(), 'arms', 'arms', { t: 'job', id: 'collect' }, { t: 'group', id: 'food' }, { t: 'grab', id: 'apple' }, 'arms', 'arms');
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

test('What: five at most, a sixth is turned down with a line; touching the tray takes one back; none cannot go on', () => {
  let { s } = go(F.newFlow(), 'arms', 'arms', { t: 'job', id: 'collect' }, { t: 'group', id: 'food' });
  let r = go(s, 'arms'); assert.equal(r.s.step, 'what', 'nothing grabbed yet: stays'); assert.deepEqual(says(r.fx), [F.LINES.none]);
  const ids = ['apple', 'pear', 'banana', 'orange', 'cherry'];
  r = go(s, ...ids.map(id => ({ t: 'grab', id }))); assert.equal(r.s.tray.length, 5); assert.ok(r.fx.filter(f => f.pop).length === 5);
  r = go(r.s, { t: 'grab', id: 'cupcake' }); assert.equal(r.s.tray.length, 5); assert.ok(r.fx.some(f => f.msg));
  r = go(r.s, { t: 'grab', id: 'apple' }); assert.equal(r.s.tray.length, 5, 'the same one twice is not a second pick');
  r = go(r.s, { t: 'take', id: 'pear' }); assert.deepEqual(r.s.tray, ['apple', 'banana', 'orange', 'cherry']);
  r = go(r.s, 'arms'); assert.equal(r.s.step, 'rules'); assert.deepEqual(r.s.picks.things.map(t => t.id), ['apple', 'banana', 'orange', 'cherry']);
  assert.equal(gameJob(r.s.picks), 'collect');
});

test('Rules: nothing touched for 8 s and Cubo picks, with the usual rules, and goes on to the name; touching restarts the wait', () => {
  let { s } = go(F.newFlow(), 'arms', 'arms', { t: 'job', id: 'keepup' }, { t: 'group', id: 'toys' }, { t: 'grab', id: 'beachball' }, 'arms');
  assert.equal(s.step, 'rules');
  let r = go(s, { t: 'tick', dt: 7 }); assert.equal(r.s.step, 'rules');
  r = go(r.s, { t: 'speed', i: 5 }, { t: 'tick', dt: 7 }); assert.equal(r.s.step, 'rules', 'a touch restarts the wait'); assert.equal(r.s.picks.speed, 5);
  r = go(r.s, { t: 'tick', dt: 1.5 });
  assert.equal(r.s.step, 'name'); assert.deepEqual(says(r.fx), ["I'll pick!", F.LINES.name]);
  assert.equal(r.s.picks.speed, 3, 'the usual speed'); assert.equal(r.s.picks.many, 3);
  assert.equal(go(F.newFlow(), { t: 'tick', dt: 30 }).s.step, 'start', 'the clock only runs in Rules');
});

test('Back goes a step back at a time, out of a group first, and leaves from the start', () => {
  let { s } = go(F.newFlow(), 'arms', 'arms', { t: 'job', id: 'stack' }, { t: 'group', id: 'toys' }, { t: 'grab', id: 'balloon' });
  assert.equal(s.group, 'toys');
  let r = go(s, 'back'); assert.equal(r.s.step, 'what'); assert.equal(r.s.group, null, 'out of the group first'); assert.deepEqual(r.s.tray, ['balloon'], 'the pick is kept');
  r = go(r.s, 'back'); assert.equal(r.s.step, 'game');
  r = go(r.s, 'back'); assert.equal(r.s.step, 'where');
  r = go(r.s, 'back'); assert.equal(r.s.step, 'start');
  r = go(r.s, 'back'); assert.ok(r.fx.some(f => f.exit));
  const named = go(s, { t: 'back' }, 'arms').s; assert.equal(named.step, 'rules');
  assert.equal(go(named, 'back').s.step, 'what'); assert.equal(go(go(named, 'arms').s, 'back').s.step, 'rules');
  assert.equal(go(go(go(named, 'arms').s, 'arms').s, { t: 'saved-failed' }).s.step, 'name', 'a play that did not save goes back to the name');
});

test('Change it: opens at Where on the game’s own picks, keeps its things, job and name, and saves back into the same slot', () => {
  const creation = { id: 'c9', name: 'Super Bee Dodge Party', picks: { things: [{ id: 'bee', job: 'dodge' }, { id: 'frog', job: 'dodge' }], where: 'beach', speed: 5, many: 4, name: 'Super Bee Dodge Party' } };
  let s = F.newFlow({ creation });
  assert.equal(s.step, 'where'); assert.equal(F.WORLDS[s.worldIx], 'beach'); assert.deepEqual(s.tray, ['bee', 'frog']); assert.equal(s.job, 'dodge');
  let r = go(s, { t: 'world', ix: 1 }, 'arms'); assert.equal(r.s.picks.where, F.WORLDS[1]);
  r = go(r.s, { t: 'job', id: 'dodge' }, 'arms'); assert.equal(r.s.step, 'rules', 'the picks were kept: straight on from What');
  assert.equal(r.s.picks.speed, 5);
  r = go(r.s, 'arms'); assert.equal(r.s.names[0], 'Super Bee Dodge Party', 'its own name is first on the wheel');
  r = go(r.s, 'arms'); assert.equal(r.fx.find(f => f.play).play.id, 'c9');
  assert.ok(go(s, 'back').fx.some(f => f.exit), 'Back from Where, in a game being changed, leaves');
});

test('the remote: arrows and OK on every step', () => {
  let r = go(F.newFlow(), 'ok'); assert.equal(r.s.step, 'where');
  const n = F.WORLDS.length;
  r = go(r.s, { t: 'key', key: 'right' }, { t: 'key', key: 'right' }); assert.equal(r.s.worldIx, 2); assert.equal(r.s.picks.where, F.WORLDS[2]);
  r = go(r.s, { t: 'key', key: 'left' }, { t: 'key', key: 'left' }, { t: 'key', key: 'left' }); assert.equal(r.s.worldIx, n - 1, 'it wraps');
  r = go(r.s, 'ok'); assert.equal(r.s.step, 'game');
  r = go(r.s, { t: 'key', key: 'right' }, { t: 'key', key: 'down' }); assert.equal(r.s.gameIx, 3, 'right then down: the fourth card');
  r = go(r.s, 'ok'); assert.equal(r.s.step, 'what'); assert.equal(r.s.job, 'stack');
  /* groups */
  r = go(r.s, { t: 'key', key: 'right' }, { t: 'key', key: 'right' }, 'ok'); assert.equal(r.s.group, F.GROUPS[2]);
  /* the wheel: arrows turn it, OK grabs what is at the top */
  r = go(r.s, { t: 'key', key: 'right' }); assert.deepEqual(r.fx.filter(f => f.wheel), [{ wheel: 1 }]);
  r = go(r.s, 'ok'); assert.ok(r.fx.some(f => f.grabTop));
  r = go(r.s, { t: 'grab', id: 'star' }, { t: 'grab', id: 'moon' });
  r = go(r.s, { t: 'key', key: 'down' }); assert.equal(r.s.zone, 'tray');
  r = go(r.s, { t: 'key', key: 'right' }, 'ok'); assert.deepEqual(r.s.tray, ['star'], 'OK on a tray item takes it back');
  r = go(r.s, { t: 'key', key: 'down' }, { t: 'key', key: 'down' }); assert.equal(r.s.zone, 'done');
  r = go(r.s, 'ok'); assert.equal(r.s.step, 'rules');
  /* rules: left and right move the lit slider, up and down change which */
  r = go(r.s, { t: 'key', key: 'right' }, { t: 'key', key: 'right' }); assert.equal(r.s.picks.speed, 5);
  r = go(r.s, { t: 'key', key: 'down' }, { t: 'key', key: 'left' }); assert.equal(r.s.picks.many, 2);
  r = go(r.s, { t: 'key', key: 'down' }, 'ok'); assert.equal(r.s.step, 'name');
  r = go(r.s, { t: 'key', key: 'right' }, { t: 'key', key: 'right' }); assert.equal(r.s.nameIx, 2);
  r = go(r.s, 'ok'); assert.equal(r.s.step, 'play'); assert.equal(r.fx.find(f => f.play).play.name, r.s.names[2]);
});

test('the wheel of names is the same for the same game, and every name passes isGoodName', () => {
  const picks = { things: [{ id: 'apple', job: 'collect' }, { id: 'bee', job: 'collect' }], where: 'night' };
  const a = F.nameWheel(picks), b = F.nameWheel(picks);
  assert.deepEqual(a, b); assert.ok(a.length >= 8); assert.equal(new Set(a).size, a.length); assert.ok(a.every(isGoodName));
});
