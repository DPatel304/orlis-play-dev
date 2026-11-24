/* The Create screens (decisions 0057, 0059): the family's three slots, the banner, the five-step builder (Where, What with up to five things and their
   jobs, Your move with the real cards, Rules, Name) and what each pick does to the live game, "Rules" skipped to the usual, saving into a slot and
   playing, kids with the Create tab, the "Made by us" row on Play, and the old request flow gone. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resetDom } from './harness/browser.mjs';
resetDom();
const El = document.createElement('div').constructor;
El.prototype.getContext = () => null;
globalThis.requestAnimationFrame = () => 0;

const { MAX_SLOTS, FULL_LINE, slotsOf, usedOf, isFull, canMake, makeCard, slotsLine } = await import('../src/create/slots.js');
const B = await import('../src/create/builder-model.js');
const { defaultPicks, build, sentence, choices, clean, addThing, setJob } = await import('../src/create/recipe.js');
const { validate } = await import('../src/games/play/validate.js');
const { playEnv } = await import('../src/games/play/env.js');
const { creations } = await import('../src/create/creations.js');
const { madeGame, isMade, resultsOf, summaryOf } = await import('../src/create/made-game.js');
const { headless } = await import('../src/create/preview.js');
const { createHome } = await import('../src/ui/create-home.js');
const { createStudio } = await import('../src/ui/create-studio.js');
const { createMakePage } = await import('../src/ui/create-page.js');
const { tabsFor, homeRows, TITLES } = await import('../src/ui/home-model.js');
const { account } = await import('../src/ui/account.js');
const { menu, hooks } = await import('../src/ui/home.js');
const read = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
const env = playEnv();
const txt = (el) => [el._text, ...el.children.map(txt)].join('');
const q = (root, sel) => root.querySelector(sel), qa = (root, sel) => root.querySelectorAll(sel);
const pickEl = (el) => el.dispatchEvent(new CustomEvent('pick'));
const byLabel = (root, label) => qa(root, '.btn').find(b => b.getAttribute('aria-label') === label);
const one = (id, job = 'collect') => ({ things: [{ id, job }] });
const game = (id, name = id, makerId = 'p1', over = {}) => { const picks = { ...defaultPicks(), ...over, name }; return { id, name, makerId, picks, desc: build(picks), createdAt: '2026-11-24T10:00:00Z', updatedAt: '2026-11-24T10:00:00Z' }; };

/* a family signed in (or not), and what the server answers */
const forget = () => { try { localStorage.removeItem('orlis.creations:h1'); localStorage.removeItem('orlis.creations:here'); } catch {} };
const signedIn = (profiles = [{ id: 'p1', accountId: 'a', name: 'Mia' }, { id: 'p2', accountId: 'a', name: 'Leo' }], current = 'p2') => { account.state = { token: 't', account: { id: 'a', role: 'player' }, household: { id: 'h1', name: 'The Lees' }, profiles, current }; forget(); creations.reset(); };
const signedOut = () => { account.state = null; forget(); creations.reset(); };

test('slots: three per family, the full message, and removing frees one', () => {
  assert.equal(MAX_SLOTS, 3);
  assert.deepEqual(slotsOf([]).map(s => s.kind), ['empty', 'empty', 'empty']);
  const two = [game('a'), game('b')];
  assert.deepEqual(slotsOf(two).map(s => s.kind), ['full', 'full', 'empty']);
  assert.equal(usedOf(two), 2); assert.equal(slotsLine(two), '2 of 3 slots used');
  assert.ok(canMake(two) && !isFull(two));
  assert.equal(makeCard(two).starts, true);
  const three = [...two, game('c')];
  assert.ok(isFull(three) && !canMake(three));
  assert.equal(FULL_LINE, 'Your slots are full - remove one to make another');
  assert.equal(makeCard(three).line, FULL_LINE); assert.equal(makeCard(three).starts, false);
  assert.deepEqual(slotsOf(three).map(s => s.kind), ['full', 'full', 'full']);
  assert.ok(canMake(three.slice(1)), 'remove one: a slot is free again');
  assert.equal(slotsOf([...three, game('d')]).length, 3, 'never more than three shown');
});

test('kids get the Play and Create tabs; Create Pro stays out of it', () => {
  assert.deepEqual(tabsFor({ kid: true }), ['play', 'create'], 'a child sees both tabs');
  assert.deepEqual(tabsFor({}), ['play', 'create']);
  assert.deepEqual(tabsFor({ waiting: true }), [], 'still waiting to be let in: none');
  assert.deepEqual(tabsFor({ creatorApp: true }), [], 'the Creator app has its own pages');
  /* the page itself, for a child: tabs on top, Create lit, and no Pro anywhere */
  signedIn([{ id: 'p1', accountId: 'a', name: 'Mum' }, { id: 'p2', accountId: 'a', name: 'Leo' }], 'p2');
  assert.equal(account.isKid, true);
  const ui = resetDom(); El.prototype.getContext = () => null;
  createMakePage({ nav: { home(){}, create(){} }, onPlay(){} });
  const tabs = qa(ui, '.ptab');
  assert.deepEqual(tabs.map(t => t.getAttribute('aria-label')), ['Play', 'Create']);
  assert.ok(tabs[1].classList.contains('cur'), 'Create is the one lit');
  assert.equal(qa(ui, '.chero').length, 1, 'the big Make a game card is there for a child');
  assert.ok(!/Create Pro|Claude Code|grown-ups/i.test(txt(ui)), 'no Pro, no "for grown-ups"');
  signedOut();
});

test('the builder walks four steps (Where, What, Rules, Name) and every pick changes the game that is previewed', () => {
  assert.deepEqual(B.STEPS.map(s => s.id), ['where', 'what', 'rules', 'name']);
  assert.deepEqual(B.STEPS.map(s => s.label), ['Where', 'What', 'Rules', 'Name & play']);
  assert.ok(!B.STEPS.some(s => s.id === 'move'), 'no Your move step');
  let st = B.newBuilder();
  assert.equal(st.step, 0); assert.deepEqual(st.picks, defaultPicks());
  assert.deepEqual(B.stripOf(st).map(s => s.status), ['cur', 'todo', 'todo', 'todo']);
  assert.equal(B.stepInfo(st).id, 'where', 'Where is first');
  st = B.pick(st, 'where', 'night'); assert.equal(B.specOf(st).scene, 'night');
  st = B.next(st); assert.equal(B.stepInfo(st).id, 'what');
  st = B.addPiece(st, 'bee'); assert.deepEqual(B.specOf(st).things.filter(t => t.name !== 'golden').map(t => t.piece), ['apple', 'bee']);
  st = B.jobAll(st, 'dodge'); assert.equal(B.specOf(st).things.find(t => t.piece === 'bee').moves, 'drift'); assert.equal(B.specOf(st).card, 'lean', 'the job says how you play');
  assert.deepEqual(st.picks.things.map(t => t.job), ['dodge', 'dodge'], 'one job for every thing');
  st = B.next(st);
  assert.deepEqual(B.stripOf(st).map(s => s.status), ['done', 'done', 'cur', 'todo']);
  const slow = B.specOf(B.pick(st, 'speed', 0)).things[0], fast = B.specOf(B.pick(st, 'speed', 4)).things[0];
  assert.ok(fast.speed > slow.speed, 'speed');
  assert.ok(B.specOf(B.pick(st, 'many', 4)).things[0].appears.max > B.specOf(B.pick(st, 'many', 0)).things[0].appears.max, 'how many');
  assert.equal(B.specOf(B.pick(st, 'minutes', 3)).secs, 180);
  assert.equal(B.specOf(B.pick(st, 'mode', 'versus')).team, undefined); assert.equal(B.specOf(B.pick(st, 'mode', 'together')).team, true);
  assert.ok(B.specOf(B.flip(B.pick(st, 'bomb', false), 'bomb')).things.some(t => t.name === 'bomb'), 'a bomb to avoid');
  assert.ok(!B.specOf(B.pick(st, 'golden', false)).things.some(t => t.name === 'golden'), 'no golden one');
  st = B.next(st); assert.equal(B.isLast(st), true); assert.equal(B.next(st).step, B.LAST, 'never past the last');
  assert.equal(B.back(B.newBuilder()).step, 0, 'never before the first');
  /* what it says and what it asks, step by step */
  assert.equal(B.stepInfo(B.newBuilder()).title, 'Where is it?'); assert.equal(B.stepInfo(B.go(B.newBuilder(), 1)).title, 'What is in it?');
  assert.equal(B.stepInfo(st).nextLabel, 'Play it!'); assert.equal(B.stepInfo(B.newBuilder()).nextLabel, 'Next');
  assert.equal(B.sumUp(st), sentence(st.picks));
  assert.deepEqual(validate(B.specOf(st), env), []);
});

test('the things: up to five, each once, one always stays, each with its job', () => {
  let st = B.go(B.newBuilder(), 1);
  assert.deepEqual(st.picks.things, [{ id: 'apple', job: 'collect' }]);
  assert.equal(B.canAdd(st), true); assert.equal(B.canRemove(st), false, 'the last one stays');
  assert.equal(B.removePiece(st, 'apple').picks.things.length, 1); assert.equal(B.togglePiece(st, 'apple').picks.things.length, 1, 'picking the last again changes nothing');
  for (const id of ['bee', 'star', 'fish', 'pear']) st = B.addPiece(st, id);
  assert.equal(st.picks.things.length, 5); assert.equal(B.canAdd(st), false, 'five is the most');
  assert.equal(B.addPiece(st, 'banana').picks.things.length, 5); assert.equal(B.addPiece(B.removePiece(st, 'star'), 'bee').picks.things.length, 4, 'once each');
  assert.equal(B.isPicked(st, 'bee'), true); assert.equal(B.isPicked(st, 'banana'), false);
  st = B.togglePiece(st, 'bee'); assert.equal(B.isPicked(st, 'bee'), false, 'picking again takes it off');
  st = B.jobAll(st, 'stack'); assert.ok(st.picks.things.every(t => t.job === 'stack')); assert.equal(B.jobNow(st), 'stack'); assert.equal(B.addPiece(st, 'cookie').picks.things.at(-1).job, 'stack', 'new things take the game\'s job');
  st = B.jobOf(st, 'fish', 'dodge'); assert.equal(st.picks.things.find(t => t.id === 'fish').job, 'dodge', 'a thing can still hold its own');
  assert.deepEqual(validate(B.specOf(st), env), []);
  /* the name stays out of the picks the builder builds with */
  assert.equal('name' in B.addPiece(B.setName(st, 'x'), 'bee').picks, false);
});

test('Rules can be skipped: the usual rules are used, and it goes on to the name', () => {
  let st = B.go(B.newBuilder(), 2);
  assert.equal(B.SKIP_LABEL, 'Skip, use the usual rules');
  st = B.pick(B.pick(B.pick(B.pick(st, 'speed', 4), 'many', 0), 'minutes', 3), 'mode', 'versus');
  st = B.flip(B.pick(st, 'golden', false), 'bomb');
  const skipped = B.skipRules(st), d = defaultPicks();
  for (const k of B.RULE_KEYS) assert.equal(skipped.picks[k], d[k], k + ' is the usual');
  assert.equal(skipped.step, B.LAST, 'on to the name');
  assert.deepEqual(skipped.picks.things, st.picks.things, 'the other steps stay as picked');
  assert.deepEqual(validate(B.specOf(skipped), env), []);
  assert.equal(B.hasSpecials(clean(one('beachball', 'keepup'))), false, 'a ball to keep up has no golden ones or bombs');
  assert.deepEqual([B.hasGolden(clean(one('bee', 'dodge'))), B.hasBomb(clean(one('bee', 'dodge')))], [false, true], 'a Dodge thing can have a bomb but no golden one');
  assert.deepEqual([B.hasGolden(defaultPicks()), B.hasBomb(defaultPicks())], [true, true]);
});

test('names: three to pick from, one picked, and a changed game keeps its own name', () => {
  let st = B.go(B.newBuilder(), 3);
  const names = B.nameChoices(st);
  assert.equal(names.length, 3); assert.equal(new Set(names).size, 3);
  assert.equal(B.nameOf(st), names[0], 'the first is picked to begin with');
  st = B.setName(st, names[2]); assert.equal(B.nameOf(st), names[2]); assert.equal(B.finalPicks(st).name, names[2]);
  assert.equal(B.specOf(st).title, names[2]);
  st = B.addPiece(B.removePiece(B.addPiece(st, 'fish'), 'apple'), 'bee');
  assert.ok(B.nameChoices(st).includes(B.nameOf(st)), 'a name that no longer fits is dropped for one that does');
  for (const n of B.nameChoices(st)) assert.ok(n.split(' ').length >= 3 && n.split(' ').length <= 5, n);
  const mine = game('c1', 'The Great Wobbly Banana Bonanza'), again = B.newBuilder(mine);
  assert.equal(again.editing, 'c1'); assert.equal(again.step, 0);
  assert.equal(B.nameOf(again), 'The Great Wobbly Banana Bonanza', 'opened on its own name (up to five words)');
  assert.deepEqual(again.picks.things, [{ id: 'apple', job: 'collect' }]); assert.equal('name' in again.picks, false);
  /* a game made before 0059 (one thing, a "how") opens as one thing with its job */
  const old = { id: 'o1', name: 'Bee Dash', makerId: 'p1', picks: { how: 'dodge', what: 'bee', where: 'sunset', move: 'wave', speed: 3, many: 2, size: 2, minutes: 1, mode: 'together', golden: true, bomb: false, name: 'Bee Dash' } };
  const opened = B.newBuilder(old);
  assert.deepEqual(opened.picks.things, [{ id: 'bee', job: 'dodge' }]); assert.equal(opened.picks.where, 'sunset'); assert.equal(opened.picks.speed, 5); assert.equal(B.nameOf(opened), 'Bee Dash');
  assert.deepEqual(validate(B.specOf(opened), env), []);
});

test('the made game plays on the real engine, and tells the shell what it needs', () => {
  const g = madeGame(game('c9', 'Bee Dodge', 'p1', one('bee', 'dodge')));
  assert.equal(g.id, 'made:c9'); assert.equal(g.name, 'Bee Dodge'); assert.ok(isMade(g)); assert.ok(!isMade({ id: 'pop-party' }));
  assert.equal(g.secs, 60); assert.ok(g.accent && g.store.blurb.startsWith('Dodge the bees'));
  const round = g.create(2);
  for (const k of ['step', 'draw', 'hud', 'value', 'card', 'tally', 'winner', 'summary']) assert.equal(typeof round[k], 'function', k);
  for (let t = 0; t < 3; t += 1 / 30) round.step(1 / 30, 1920, 1080);
  assert.ok(Array.isArray(round.tally()));
  assert.equal(round.card(), 'lean', 'Dodge is played by leaning away');
  /* each job, run by the scripted hand: things do get caught, dodged, batted and stacked */
  for (const job of ['collect', 'dodge', 'keepup', 'stack']){
    const r = headless({ ...defaultPicks(), ...one('apple', job) }, 25);
    assert.ok(r.score > 0 && r.sounds.length > 0, job + ' scores by itself');
  }
  /* a mix of all four jobs */
  let mix = { ...defaultPicks(), bomb: true };
  for (const [id, j] of [['bee', 'dodge'], ['banana', 'stack'], ['beachball', 'keepup']]) mix = setJob(addThing(mix, id), id, j);
  const r = headless(mix, 40);
  assert.ok(r.score > 0, 'a mix scores'); assert.ok(Object.keys(r.round.counts).length >= 3, 'several things scored: ' + Object.keys(r.round.counts));
});

test('results of a mix: the main thing, points, and a short line of what was done', () => {
  assert.deepEqual(resultsOf(one('apple')), { unit: 'apples', prop: ['apple'], done: ['apples', 'caught'] });
  assert.deepEqual(resultsOf(one('bee', 'dodge')).done, ['bees', 'dodged']); assert.deepEqual(resultsOf(one('beachball', 'keepup')).done, ['bounces', '']);
  assert.deepEqual(resultsOf(one('banana', 'stack')).done, ['bananas', 'stacked']);
  assert.deepEqual(resultsOf({ things: [{ id: 'apple', job: 'collect' }, { id: 'pear', job: 'collect' }] }).done, ['things', 'caught'], 'a few things, one job');
  const mix = { things: [{ id: 'bee', job: 'dodge' }, { id: 'apple', job: 'collect' }, { id: 'banana', job: 'stack' }] };
  assert.deepEqual(resultsOf(mix), { unit: 'points', prop: ['bee'], done: ['points', ''], mix: true }, 'the first thing is the icon');
  assert.equal(summaryOf(mix, { 'collect-apple': 12, 'stack-banana': 3, 'dodge-bee': 0 }), '12 caught, 3 stacked');
  assert.equal(summaryOf(mix, { 'collect-apple': 4, golden: 2, 'dodge-bee': 7, 'stack-banana': 1 }), '6 caught, 7 dodged, 1 stacked');
  assert.equal(summaryOf({ things: [...mix.things, { id: 'beachball', job: 'keepup' }] }, { 'collect-apple': 5, 'dodge-bee': 4, 'keepup-beachball': 9, 'stack-banana': 1 }), '5 caught, 4 dodged, 9 bounces', 'the three biggest');
  assert.equal(summaryOf(mix, {}), null); assert.equal(summaryOf(one('apple'), { 'collect-apple': 5 }), null, 'one job: the count says it');
  const g = madeGame({ id: 'm', name: 'Mix', picks: mix }), round = g.create(1);
  assert.equal(round.summary(), null, 'nothing yet'); round.counts['collect-apple'] = 12; round.counts['stack-banana'] = 3; assert.equal(round.summary(), '12 caught, 3 stacked');
});

test('a game made before 0059 still loads and plays as it was saved', () => {
  const picks = { how: 'keepup', what: 'beachball', where: 'sunset', move: 'reach', speed: 2, many: 2, size: 2, minutes: 1, mode: 'together', golden: true, bomb: false, name: 'Ball Bounce' };
  const oldDesc = { title: 'Ball Bounce', secs: 60, scene: 'sunset', hint: 'Keep it up!', hintIcon: 'beachball', hintFor: 6, card: 'reach', cardFor: 8, team: true,
    things: [{ name: 'ball', piece: 'beachball', size: 0.095, at: { x: 0.5, y: 0.35 }, moves: 'bounce', spins: true, rules: [{ when: 'touched', then: ['kickUp', 'score', { sound: 'pop' }] }, { when: 'lands', then: [{ score: -1 }, { sound: 'plop' }] }] }] };
  assert.deepEqual(validate(oldDesc, env), [], 'the old description is still in the vocabulary');
  const g = madeGame({ id: 'old', name: 'Ball Bounce', makerId: 'p1', picks, desc: oldDesc });
  assert.equal(g.done[0], 'bounces'); assert.deepEqual(g.prop, ['beachball']); assert.match(g.store.blurb, /^Keep the beach ball up/);
  const round = g.create(1); for (let t = 0; t < 3; t += 1 / 30) round.step(1 / 30, 1920, 1080);
  assert.equal(round.things.length, 1, 'its own ball, as saved'); assert.equal(round.summary(), null);
  /* and from picks alone (no description kept) */
  assert.equal(madeGame({ id: 'o2', name: 'X', picks }).create(1).spec.things[0].moves, 'bounce');
});

/* ---------- the store: the family's server, and a copy here ---------- */
function fakeServer(){
  const rows = [], calls = []; let up = true;
  const call = async (method, path, body) => {
    calls.push(method + ' ' + path);
    if (!up) throw Object.assign(new Error('Couldn’t reach the Orlis server.'), { status: 0 });
    if (method === 'GET') return { creations: rows.map(r => ({ ...r })), max: 3 };
    if (method === 'DELETE'){ const i = rows.findIndex(r => path.endsWith('/' + r.id)); if (i < 0) throw Object.assign(new Error('gone'), { status: 404 }); rows.splice(i, 1); return { ok: true }; }
    if (body.id){ const r = rows.find(x => x.id === body.id); if (!r) throw Object.assign(new Error('no'), { status: 404 }); Object.assign(r, body); return { ...r }; }
    if (rows.length >= 3) throw Object.assign(new Error('Your slots are full'), { status: 409 });
    const r = { ...body, id: 'srv' + (rows.length + 1) + Math.random().toString(36).slice(2, 5), createdAt: 'x', updatedAt: 'x' }; rows.push(r); return { ...r };
  };
  return { rows, calls, call, down(){ up = false; }, up(){ up = true; } };
}

test('creations: saved to the family\'s server, kept here too, and a full family is told so', async () => {
  signedIn(); const srv = fakeServer(); creations.call = srv.call;
  const mk = (name, over = {}) => ({ name, picks: { ...defaultPicks(), ...over }, makerId: 'p1' });
  const a = await creations.save(mk('Apple Catch'));
  assert.ok(a.id.startsWith('srv'), 'the server\'s own id'); assert.equal(srv.rows.length, 1); assert.equal(a.desc.scene, 'meadow', 'the description goes with it');
  assert.equal(JSON.parse(localStorage.getItem('orlis.creations:h1')).length, 1, 'a copy is kept on this TV');
  await creations.save(mk('Bee Pop', one('bee'))); await creations.save(mk('Fish Dash', one('fish', 'dodge')));
  assert.equal(creations.items.length, 3); assert.ok(creations.full);
  await assert.rejects(() => creations.save(mk('A fourth')), (e) => e.message === FULL_LINE && e.status === 409, 'no fourth, and no call to the server');
  assert.equal(srv.rows.length, 3);
  /* changed into its own slot */
  const c = await creations.save({ ...mk('Apple Rocket', { speed: 4 }), id: a.id });
  assert.equal(c.id, a.id); assert.equal(creations.items.length, 3); assert.equal(creations.byId(a.id).name, 'Apple Rocket'); assert.equal(srv.rows[0].picks.speed, 4);
  /* removed: its slot is free */
  assert.equal(await creations.remove(a.id), true); assert.equal(creations.items.length, 2); assert.equal(srv.rows.length, 2); assert.ok(!creations.full);
  /* another TV in the house: asks the server, and has the same */
  creations.replace([]);
  assert.equal(await creations.refresh(), true); assert.deepEqual(creations.items.map(x => x.name), ['Bee Pop', 'Fish Dash']);
  assert.equal(await creations.refresh(), false, 'nothing changed');
  signedOut();
});

test('creations: with the server out of reach they still play, and go up when it is back', async () => {
  signedIn(); const srv = fakeServer(); creations.call = srv.call;
  await creations.save({ name: 'Apple Catch', picks: defaultPicks(), makerId: 'p1' });
  srv.down();
  const b = await creations.save({ name: 'Offline Bees', picks: { ...defaultPicks(), ...one('bee') }, makerId: 'p1' });
  assert.ok(b.pending && b.id.startsWith('local-'), 'kept here, waiting'); assert.equal(creations.items.length, 2);
  assert.equal(madeGame(b).create(1).card(), 'reach', 'and it plays');
  assert.equal(await creations.refresh(), false, 'out of reach: nothing changes');
  assert.equal(creations.items.length, 2);
  srv.up(); assert.equal(await creations.refresh(), true);
  assert.equal(srv.rows.length, 2, 'sent when it could be'); assert.ok(creations.items.every(x => !x.pending && x.id.startsWith('srv')));
  /* no account at all (the browser): all of it stays here */
  signedOut(); creations.call = () => { throw new Error('no server'); };
  const c = await creations.save({ name: 'Here Only', picks: defaultPicks(), makerId: null });
  assert.ok(c.pending); assert.equal(creations.items.length, 1);
  await creations.remove(c.id); assert.equal(creations.items.length, 0);
});

/* ---------- the home ---------- */
test('the Create home: three slots, Make a game starts the builder, and a full family cannot', () => {
  signedIn();
  const calls = [], said = [];
  const home = createHome({ items: [game('a', 'Apple Catch'), game('b', 'Bee Pop', 'p2')], onMake: () => calls.push('make'), onPlay: (c) => calls.push('play:' + c.id), onChange: (c) => calls.push('change:' + c.id), onRemove: async (c) => { calls.push('remove:' + c.id); }, say: (t) => said.push(t) });
  assert.equal(qa(home, '.cslot').length, 3);
  assert.equal(qa(home, '.cslot.full').length, 2); assert.equal(qa(home, '.cslot.empty').length, 1);
  assert.equal(qa(home, '.cslot.full').map(s => s.getAttribute('aria-label')).join('|'), 'Apple Catch: play, change or remove|Bee Pop: play, change or remove');
  assert.equal(qa(qa(home, '.cslot.full')[1], '.cby').length, 1, 'the maker\'s face on the tile');
  assert.match(txt(q(home, '.crowlab')), /2 of 3 slots used/);
  assert.match(txt(q(home, '.chero')), /Make a game/);
  assert.equal(qa(home, '.cministep').length, 0, 'no Pick, Play, Change a step tiles'); assert.equal(qa(home, '.chow').length, 0, 'no How it works card');
  pickEl(q(home, '.chero')); assert.deepEqual(calls, ['make']);
  pickEl(q(home, '.cslot.empty')); assert.deepEqual(calls, ['make', 'make'], 'an empty slot makes one too');
  /* a game opens: Play, Change, Remove (which asks first) */
  pickEl(qa(home, '.cslot.full')[0]);
  assert.equal(home.open, true);
  const pop = q(document.body, '.cgamepop'), btns = qa(pop, '.btn');
  assert.equal(btns.length, 3, 'Play, Change, Remove');
  assert.match(txt(q(pop, 'h2')), /Apple Catch/);
  const remove = btns[2]; pickEl(remove);
  assert.ok(remove.classList.contains('sure'), 'Remove asks "Sure?" first'); assert.ok(!calls.includes('remove:a'));
  /* full */
  const full = createHome({ items: [game('a'), game('b'), game('c')], onMake: () => calls.push('MAKE'), say: (t) => said.push(t) });
  assert.equal(qa(full, '.cslot.empty').length, 0); assert.equal(qa(full, '.cslot.full').length, 3);
  assert.match(txt(q(full, '.chero')), /Your slots are full - remove one to make another/);
  assert.ok(q(full, '.chero').classList.contains('full'));
  pickEl(q(full, '.chero'));
  assert.ok(!calls.includes('MAKE'), 'the builder does not start'); assert.deepEqual(said, [FULL_LINE]);
  /* removing one frees a slot: the card offers to make again */
  full.update([game('a'), game('b')]);
  assert.equal(qa(full, '.cslot.empty').length, 1); assert.ok(!q(full, '.chero').classList.contains('full'));
  pickEl(q(full, '.chero')); assert.ok(calls.includes('MAKE'));
  signedOut();
});

test('a slot opens to Play, Change and Remove, and Remove only on the second press', async () => {
  signedIn();
  const calls = [];
  resetDom(); El.prototype.getContext = () => null;
  const home = createHome({ items: [game('a', 'Apple Catch')], onPlay: (c) => calls.push('play:' + c.id), onChange: (c) => calls.push('change:' + c.id), onRemove: async (c) => { calls.push('remove:' + c.id); } });
  pickEl(q(home, '.cslot.full'));
  let [play, change, remove] = qa(q(document.body, '.cgamepop'), '.btn');
  pickEl(remove); assert.deepEqual(calls, [], 'the first press only asks');
  pickEl(remove); await new Promise(r => setTimeout(r, 5)); assert.deepEqual(calls, ['remove:a']); assert.equal(home.open, false, 'and it closes');
  pickEl(q(home, '.cslot.full')); [play, change, remove] = qa(q(document.body, '.cgamepop'), '.btn');
  pickEl(change); assert.deepEqual(calls, ['remove:a', 'change:a']);
  pickEl(q(home, '.cslot.full')); [play] = qa(q(document.body, '.cgamepop'), '.btn');
  pickEl(play); assert.deepEqual(calls, ['remove:a', 'change:a', 'play:a']);
  signedOut();
});

/* ---------- the studio ---------- */
test('the studio: the strip, the cards, the things with their jobs, the live game and Back and Next', () => {
  signedIn(); resetDom(); El.prototype.getContext = () => null;
  const calls = [], said = [];
  const studio = createStudio({ onBack: () => calls.push('back'), onPlay: (g) => calls.push('play:' + g.name), say: (t) => said.push(t) });
  const strip = () => qa(studio, '.cstep').map(s => s.className.replace('cstep ', ''));
  assert.deepEqual(strip(), ['cur', 'todo', 'todo', 'todo']);
  assert.deepEqual(qa(studio, '.cstl').map(txt), ['Where', 'What', 'Rules', 'Name & play']);
  assert.ok(q(studio, '.cprev') && q(studio, '.clive'), 'the live game, on the left');
  assert.match(txt(q(studio, '.csay')), /^Catch the apples in the sunny meadow/);
  /* 1: where - the world cards */
  assert.equal(qa(studio, '.cworld').length, 6);
  pickEl(byLabel(studio, 'Starry night')); assert.equal(studio.preview.round.spec.scene, 'night');
  /* 2: what - tabs, a grid of pictures, the things picked with their jobs */
  pickEl(byLabel(studio, 'Next')); assert.deepEqual(strip(), ['done', 'cur', 'todo', 'todo']);
  assert.equal(qa(studio, '.ccat').length, 5);
  assert.equal(qa(studio, '.ctrow').length, 1, 'the apple is picked to begin with');
  assert.deepEqual(qa(studio, '.cjob').map(b => b.getAttribute('data-job')), ['collect', 'dodge', 'keepup', 'stack'], 'a row of four job chips: the game\'s one job');
  assert.ok(qa(studio, '.cjob')[0].classList.contains('on'), 'Collect is the usual');
  pickEl(byLabel(studio, 'Animals')); assert.ok(byLabel(studio, 'Bee'), 'the animals'); assert.ok(!byLabel(studio, 'Apple'), 'not the food any more');
  pickEl(byLabel(studio, 'Bee')); assert.equal(qa(studio, '.ctrow').length, 2); assert.ok(byLabel(studio, 'Bee').classList.contains('on'));
  assert.deepEqual(studio.state.picks.things.map(t => t.id), ['apple', 'bee']);
  pickEl(byLabel(studio, 'Job: Dodge')); assert.deepEqual(studio.state.picks.things.map(t => t.job), ['dodge', 'dodge'], 'every thing gets the job');
  assert.ok(byLabel(studio, 'Job: Dodge').classList.contains('on') && !byLabel(studio, 'Job: Collect').classList.contains('on'));
  assert.equal(studio.preview.round.spec.things.find(t => t.piece === 'bee').moves, 'drift', 'the live game shows the mix');
  assert.match(txt(q(studio, '.csay')), /odge the apples and bees/);
  /* picking again takes it off; so does the cross; up to five; the last one stays */
  pickEl(byLabel(studio, 'Bee')); assert.equal(qa(studio, '.ctrow').length, 1);
  for (const l of ['Bee', 'Bumblebee', 'Butterfly', 'Bird']) pickEl(byLabel(studio, l));
  assert.equal(qa(studio, '.ctrow').length, 5); assert.match(txt(q(studio, '.ctrayhead')), /5 of 5/);
  pickEl(byLabel(studio, 'Ladybug')); assert.equal(qa(studio, '.ctrow').length, 5, 'five is the most'); assert.ok(said.some(t => /5 things is the most/.test(t)));
  pickEl(byLabel(studio, 'Take off the bird')); assert.equal(qa(studio, '.ctrow').length, 4); assert.ok(!studio.state.picks.things.some(t => t.id === 'bird'));
  for (const l of ['bee', 'bumblebee', 'butterfly']) pickEl(byLabel(studio, `Take off the ${l}`));
  assert.equal(qa(studio, '.ctrow').length, 1); pickEl(byLabel(studio, 'Take off the apple')); assert.equal(qa(studio, '.ctrow').length, 1); assert.ok(said.some(t => /at least one thing/.test(t)));
  pickEl(byLabel(studio, 'Fish')); pickEl(byLabel(studio, 'Job: Stack')); assert.equal(studio.preview.round.spec.things.find(t => t.piece === 'fish').rules[0].then[0].stack, 6); assert.equal(studio.preview.round.spec.card, 'reach');
  /* 3: rules - sliders with five stops, the round, together or who wins, the specials that fit */
  pickEl(byLabel(studio, 'Next'));
  assert.equal(qa(studio, '.cstop').length, 14, 'seven stops each');
  assert.ok(!qa(studio, '.cworld').length && !byLabel(studio, 'Squat'), 'no move to pick');
  pickEl(byLabel(studio, 'How fast: Rocket')); assert.equal(studio.state.picks.speed, 6);
  pickEl(byLabel(studio, 'How many: One')); assert.equal(studio.state.picks.many, 0);
  pickEl(byLabel(studio, '3 minutes')); assert.equal(studio.preview.round.spec.secs, 180);
  pickEl(byLabel(studio, 'Who wins?')); assert.equal(studio.state.picks.mode, 'versus');
  assert.ok(byLabel(studio, 'A bomb: to avoid'), 'a Stack thing can have a bomb'); assert.ok(!byLabel(studio, 'Golden one: worth 5'), 'a golden one needs a thing to Collect');
  pickEl(byLabel(studio, 'A bomb: to avoid')); assert.equal(studio.state.picks.bomb, true); assert.ok(studio.preview.round.spec.things.some(t => t.name === 'bomb'));
  assert.ok(byLabel(studio, B.SKIP_LABEL), 'a way to skip the rules');
  pickEl(byLabel(studio, B.SKIP_LABEL));
  assert.equal(studio.state.step, 3); assert.equal(studio.state.picks.speed, 3); assert.equal(studio.state.picks.minutes, 1); assert.equal(studio.state.picks.mode, 'together'); assert.equal(studio.state.picks.bomb, false);
  assert.deepEqual(studio.state.picks.things, [{ id: 'apple', job: 'stack' }, { id: 'fish', job: 'stack' }], 'the earlier steps stay');
  /* 4: name - three to pick, who made it, one Play it! */
  assert.equal(qa(studio, '.cname').length, 3);
  assert.match(txt(q(studio, '.cmbtxt')), /Made by Leo/);
  assert.ok(!byLabel(studio, 'Next') && byLabel(studio, 'Play it!'), 'the last step has Play it!');
  assert.equal(qa(studio, '.cname.on').length, 1);
  const second = qa(studio, '.cname')[1]; pickEl(second); assert.ok(second.classList.contains('on')); assert.equal(qa(studio, '.cname.on').length, 1);
  /* Back goes a step, and from the first step out of the builder */
  pickEl(byLabel(studio, 'Back')); assert.equal(studio.state.step, 2);
  studio.goto(0); pickEl(byLabel(studio, 'Back')); assert.deepEqual(calls, ['back']);
  signedOut();
});

test('Play it! keeps the game in a slot and plays it; Change it comes back to the same slot', async () => {
  signedIn(); resetDom(); El.prototype.getContext = () => null;
  const srv = fakeServer(); creations.call = srv.call;
  const played = [];
  const studio = createStudio({ onPlay: (g) => played.push(g) });
  studio.goto(3);
  const name = qa(studio, '.cname')[1].getAttribute('aria-label'); pickEl(qa(studio, '.cname')[1]);
  pickEl(byLabel(studio, 'Play it!')); await new Promise(r => setTimeout(r, 20));
  assert.equal(played.length, 1); assert.equal(played[0].name, name); assert.equal(played[0].makerId, 'p2', 'made by whoever is playing');
  assert.equal(creations.items.length, 1); assert.equal(srv.rows.length, 1);
  assert.equal(validate(played[0].desc, env).length, 0);
  /* Change it: the builder on that game's picks, saved back into its slot */
  const again = createStudio({ creation: played[0], onPlay: (g) => played.push(g) });
  assert.equal(again.state.editing, played[0].id); assert.equal(again.state.step, 0);
  again.goto(1); pickEl(byLabel(again, 'Job: Dodge')); again.goto(3);
  pickEl(byLabel(again, 'Play it!')); await new Promise(r => setTimeout(r, 20));
  assert.equal(creations.items.length, 1, 'the same slot'); assert.equal(played[1].id, played[0].id); assert.equal(creations.items[0].picks.things[0].job, 'dodge');
  /* a full family cannot make another from here */
  await creations.save({ name: 'B', picks: defaultPicks(), makerId: 'p1' }); await creations.save({ name: 'C', picks: defaultPicks(), makerId: 'p1' });
  const said = [];
  const third = createStudio({ onPlay: (g) => played.push(g), say: (t, bad) => said.push([t, bad]) });
  third.goto(3); pickEl(byLabel(third, 'Play it!')); await new Promise(r => setTimeout(r, 20));
  assert.equal(played.length, 2); assert.deepEqual(said, [[FULL_LINE, true]]);
  signedOut();
});

test('the results of a made game have Change it, Play again and Home', async () => {
  const { results } = await import('../src/ui/screens.js');
  const ui = resetDom(); El.prototype.getContext = () => null;
  const calls = [];
  const g = madeGame(game('c1', 'Apple Catch'));
  results(g, () => calls.push('again'), () => calls.push('home'), 'Home', null, { total: 3, kids: [], change: () => calls.push('change') });
  const labels = qa(ui, '.cbtn').map(b => txt(b).replace(/<[^>]*>/g, ''));
  assert.equal(qa(ui, '.cbtn').length, 3);
  assert.match(qa(ui, '.cbtn')[0].innerHTML + txt(qa(ui, '.cbtn')[0]), /Play again/);
  assert.match(qa(ui, '.cbtn')[1].innerHTML + txt(qa(ui, '.cbtn')[1]), /Change it/);
  assert.match(qa(ui, '.cbtn')[2].innerHTML + txt(qa(ui, '.cbtn')[2]), /Home/);
  pickEl(qa(ui, '.cbtn')[1]); assert.deepEqual(calls, ['change']);
  void labels;
  /* any other game: no Change it */
  const ui2 = resetDom(); El.prototype.getContext = () => null;
  results({ id: 'pop-party', name: 'Pop Party', accent: '#fff' }, () => {}, () => {}, 'Home', null, { total: 3, kids: [] });
  assert.equal(qa(ui2, '.cbtn').length, 2);
});

/* ---------- Play: the third row ---------- */
test('Play has "Made by us" as its third row, with the maker\'s face, only when the family has made something', () => {
  assert.equal(TITLES.made, 'Made by us');
  const g = madeGame(game('c1', 'Apple Catch'));
  const rows = homeRows({ pool: [{ id: 'x', name: 'X' }], featured: [{ id: 'f', name: 'F' }], discover: true, made: [g] });
  assert.deepEqual(rows.map(r => r.id), ['featured', 'games', 'made'], 'after Featured and My library');
  assert.equal(rows[2].title, 'Made by us'); assert.equal(rows[2].items[0].g, g);
  assert.deepEqual(homeRows({ pool: [{ id: 'x', name: 'X' }], featured: [], discover: true }).map(r => r.id), ['featured', 'games'], 'no row until there is one');
  /* the page: the row, its tile with the face, and it plays */
  hooks.world = (x) => 'world:' + x.id;
  const page = (list) => {
    signedIn(); creations.replace(list); creations.refresh = async () => false;
    const ui = resetDom(); El.prototype.getContext = () => null;
    const calls = [];
    const p = menu({ onPlay: (x) => calls.push('play:' + x.id), onRecalibrate(){}, onWho(){}, nav: { home(){}, store(){}, create(){} } });
    return { ui, p, calls, s: q(ui, '.home') };
  };
  let { s, p, calls } = page([game('c1', 'Apple Catch', 'p1'), game('c2', 'Bee Pop', 'p2', one('bee'))]);
  const labels = qa(s, '.hlab').map(l => txt(l));
  assert.deepEqual(labels.slice(-1), ['Made by us']); assert.ok(labels.indexOf('My library') < labels.indexOf('Made by us'));
  const tiles = qa(s, '.htile').filter(t => qa(t, '.mkby').length);
  assert.equal(tiles.length, 2, 'each tile carries its maker\'s face');
  assert.equal(tiles.map(t => t.getAttribute('aria-label')).join('|'), 'Play Apple Catch|Play Bee Pop');
  const at = p.items.findIndex(t => t.item.g && t.item.g.id === 'made:c2'); assert.ok(at >= 0);
  p.focusAt({ row: p.items[at].row, col: p.items[at].col });
  assert.equal(p.items.filter(t => t.item.made).length, 2);
  p.leave();
  signedOut();
  ({ s, p } = page([]));
  assert.ok(!qa(s, '.hlab').some(l => txt(l) === 'Made by us'), 'hidden when there are none');
  p.leave();
  signedOut(); hooks.world = null;
  void calls;
});

/* ---------- the old request flow is gone from the app ---------- */
test('the old request flow is out of the app: no builder, no "Your requests", no "Ask for a change", no "Under construction"', () => {
  assert.ok(!existsSync(new URL('../src/ui/request.js', import.meta.url)) && !existsSync(new URL('../src/ui/building.js', import.meta.url)), 'request.js and building.js are gone');
  const src = readdirSync(new URL('../src/ui/', import.meta.url)).filter(f => f.endsWith('.js')).map(f => [f, read('ui/' + f)]);
  for (const [f, code] of src){
    assert.ok(!/Your requests|Ask for a change|Ask for a game|Under construction|gameBuilder|changePop|buildingRow|\/api\/requests/.test(code.replace(/\/\*[\s\S]*?\*\//g, '')), f + ' has no request UI');
    assert.ok(!/from '\.\/(request|building)\.js'/.test(code), f);
  }
  /* and the dead styles it left */
  const css = ['style.css', 'clean.css', 'clean-home.css', 'clean-screens.css', 'clean-create.css', 'clean-account.css', 'clean-settings.css'].map(read).join('\n');
  for (const dead of ['.reqwrap', '.reqgrid', '.reqchips', '.reqfoot', '.reqpop', '.cask', '.csent', '.ygrid', '.createpage.flow', '.cbuild', '.buildingtile', '.cnotice.requests']) assert.ok(!css.includes(dead), dead + ' is gone');
  /* Create Pro is still there for grown-up creators */
  assert.match(read('ui/create.js'), /Create Pro/);
});
