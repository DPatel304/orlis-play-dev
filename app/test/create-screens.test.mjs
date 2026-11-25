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
const { defaultPicks, build, sentence, choices, clean, addThing, setJob } = await import('../src/create/recipe.js');
const { validate } = await import('../src/games/play/validate.js');
const { playEnv } = await import('../src/games/play/env.js');
const { creations } = await import('../src/create/creations.js');
const { madeGame, isMade, resultsOf, summaryOf } = await import('../src/create/made-game.js');
const { headless } = await import('../src/create/preview.js');
const { createHome } = await import('../src/ui/create-home.js');
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
  assert.match(txt(q(home, '.chero')), /Cubo(&#39;|')s Create/); assert.match(txt(q(home, '.chero')), /Raise both arms to start/);
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

/* ---------- Cubo's Create (the screen; the steps and gestures are cubo-flow.test.mjs and cubo-gestures.test.mjs) ---------- */
const { cuboCreate } = await import('../src/ui/cubo-create.js');
const { pose } = await import('../src/tracking/pose.js');
const tickFor = (cc, secs, dt = 1 / 30) => { for (let t = 0; t < secs - 1e-9; t += dt) cc.tick(dt); };
const keyDown = (key) => { const e = { key, preventDefault(){}, stopImmediatePropagation(){} }; for (const f of (globalThis.__keys || [])) f(e); };

test('Cubo’s Create walks the steps on the screen: big things to touch, Cubo’s line, the tray, and Play saves into a slot', async () => {
  signedIn(); resetDom(); El.prototype.getContext = () => null;
  const srv = fakeServer(); creations.call = srv.call;
  const steps = [], played = [], said = [];
  const cc = cuboCreate({ onStep: (s) => steps.push(s), onPlay: (g) => played.push(g), say: (t) => said.push(t) });
  cc.start();
  assert.equal(cc.step, 'start'); assert.ok(cc.classList.contains('hide'), 'the start screen is the page’s');
  /* where */
  cc.event({ t: 'ok' }); assert.equal(cc.step, 'where');
  assert.match(txt(q(cc, '.cctext')), /Where shall we play/, 'Cubo says the step’s line');
  assert.equal(qa(cc, '.ccsd').length, 5, 'step dots across the top: Where, Game, What, Rules, Name');
  assert.ok(qa(cc, '.ccsd')[0].classList.contains('on'));
  assert.equal(qa(cc, '.ccpeek').length, 2, 'the previous and next worlds peek in at the sides');
  cc.event({ t: 'key', key: 'right' }); assert.equal(cc.state.worldIx, 1);
  assert.match(txt(q(cc, '.ccworld')), new RegExp(choices.where[1].label));
  pickEl(q(cc, '.ccpeek.left')); assert.equal(cc.state.worldIx, 0, 'a hand held on a peek (here a pick) slides it in');
  cc.event({ t: 'key', key: 'right' });
  cc.event({ t: 'arms' }); assert.equal(cc.step, 'game');
  /* the game: four big cards, each a single touch */
  assert.equal(qa(cc, '.cccard').length, 4);
  assert.deepEqual(qa(cc, '.cccard').map(b => b.getAttribute('aria-label')), ['Collect', 'Dodge', 'Keep up', 'Stack']);
  pickEl(qa(cc, '.cccard')[1]); assert.equal(cc.step, 'what'); assert.equal(cc.state.job, 'dodge');
  assert.match(txt(q(cc, '.cctext')), /What shall we dodge/);
  /* what: five group tiles; a group opens its parade; the tray */
  assert.deepEqual(qa(cc, '.cctile').map(b => b.getAttribute('aria-label')), ['Food', 'Animals', 'Sky', 'Toys', 'Nature']);
  assert.equal(qa(cc, '.ccfloat').length, 0, 'no parade until a group is open');
  pickEl(qa(cc, '.cctile')[1]); assert.equal(cc.state.group, 'animals');
  assert.equal(qa(cc, '.ccfloat').length, choices.what[1].pieces.length, 'the group’s things float by');
  pickEl(qa(cc, '.ccfloat')[0]); assert.deepEqual(cc.state.tray, ['bee'], 'touching one in the parade grabs it'); cc.event({ t: 'take', id: 'bee' });
  pickEl(q(cc, '.ccgroups')); assert.equal(cc.state.group, null, 'the Groups target goes back to the tiles'); pickEl(qa(cc, '.cctile')[1]);
  cc.event({ t: 'grab', id: 'bee' }); cc.event({ t: 'grab', id: 'frog' });
  assert.equal(qa(cc, '.cctrayslot').filter(b => !b.classList.contains('empty')).length, 2, 'two in the tray');
  assert.match(txt(q(cc, '.cctray')), /2 of 5/);
  pickEl(byLabel(cc, 'Put back the frog')); assert.deepEqual(cc.state.tray, ['bee'], 'touch a tray item to take it back');
  cc.event({ t: 'grab', id: 'frog' });
  cc.event({ t: 'arms' }); assert.equal(cc.step, 'rules');
  /* rules: one question at a time on a tall meter of seven stops */
  assert.equal(qa(cc, '.ccmstop').length, 7);
  assert.match(txt(q(cc, '.ccq')), /How fast/);
  pickEl(byLabel(cc, 'How fast: Rocket')); assert.equal(cc.state.picks.speed, 6); assert.equal(cc.state.q, 'many', 'set: on to the next question');
  assert.match(txt(q(cc, '.ccq')), /How many/);
  pickEl(byLabel(cc, 'How many: A storm')); assert.equal(cc.state.picks.many, 6);
  assert.match(txt(q(cc, '.ccq')), /A storm/);
  cc.event({ t: 'arms' }); assert.equal(cc.step, 'name');
  assert.ok(cc.state.names.length >= 6);
  const keep = cc.state.names[0];
  cc.event({ t: 'arms' });
  await new Promise(r => setTimeout(r, 30));
  assert.equal(cc.step, 'play'); assert.equal(played.length, 0, 'a 3-2-1 with Cubo first');
  tickFor(cc, 1); assert.equal(played.length, 0); tickFor(cc, 1.6);
  assert.equal(played.length, 1); assert.equal(played[0].name, keep); assert.equal(played[0].makerId, 'p2');
  assert.equal(creations.items.length, 1); assert.deepEqual(played[0].picks.things.map(t => t.id), ['bee', 'frog']); assert.equal(played[0].picks.speed, 6);
  assert.deepEqual(played[0].picks.things.map(t => t.job), ['dodge', 'dodge']);
  assert.equal(validate(played[0].desc, env).length, 0, 'it plays on the real engine');
  assert.ok(steps.includes('start') && steps.includes('play'));
  cc.dispose(); signedOut();
});

test('Cubo’s Create: a body walking across the picture changes the world; the second player does nothing; slots full say so', () => {
  signedIn(); resetDom(); El.prototype.getContext = () => null;
  const cc = cuboCreate({ full: false }); cc.start(); cc.event({ t: 'ok' });
  const person = (x, up = false) => {
    const lm = Array.from({ length: 33 }, () => ({ x, y: 0.5, v: 0.95 }));
    lm[0] = { x, y: 0.2, v: 0.95 }; lm[15] = { x: x - 0.1, y: up ? 0.08 : 0.55, v: 0.95 }; lm[16] = { x: x + 0.1, y: up ? 0.08 : 0.55, v: 0.95 };
    lm[23] = { x: x - 0.03, y: 0.55, v: 0.95 }; lm[24] = { x: x + 0.03, y: 0.55, v: 0.95 };
    return { present: true, lm, centre: { x, y: 0.4 }, scale: 0.4, hands: { left: { x: x - 0.1, y: up ? 0.08 : 0.55 }, right: { x: x + 0.1, y: up ? 0.08 : 0.55 } } };
  };
  const saved = pose.players.slice(); const was = pose.mouse.active; pose.mouse.active = false;
  try {
    pose.players.splice(0, pose.players.length, person(0.25), person(0.7, true), { present: false });
    tickFor(cc, 1);   /* (the second player has both arms up the whole time) */
    assert.equal(cc.step, 'where', 'the second player’s arms do nothing');
    const seen = new Set();
    for (let x = 0.2; x <= 0.8; x += 0.01){ pose.players[0] = person(x); tickFor(cc, 0.1); seen.add(cc.state.worldIx); }
    assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4, 5], 'walking across the picture goes through every world');
    pose.players[0] = person(0.8, true); tickFor(cc, 1);
    assert.equal(cc.step, 'game', 'the first player’s arms up chose it');
  } finally { pose.players.splice(0, pose.players.length, ...saved); pose.mouse.active = was; }
  cc.dispose();
  /* the page can hold the start back (the camera check): arms up asks it, and only a forced OK goes on */
  const asked = [], held = cuboCreate({ onStart: () => asked.push('asked') }); held.start();
  held.event({ t: 'arms' }); held.event({ t: 'ok' }); assert.equal(held.step, 'start'); assert.deepEqual(asked, ['asked', 'asked']);
  held.event({ t: 'ok', force: true }); assert.equal(held.step, 'where'); held.dispose();
  /* slots full: Cubo says so, and it does not start */
  const calls = [], full = cuboCreate({ full: true, onFull: () => calls.push('full'), say: () => {} }); full.start();
  full.event({ t: 'arms' }); assert.equal(full.step, 'start'); assert.deepEqual(calls, ['full']);
  full.dispose(); signedOut();
});

test('Cubo’s Create: Change it opens at Where on the game’s own picks and saves back into its slot', async () => {
  signedIn(); resetDom(); El.prototype.getContext = () => null;
  const srv = fakeServer(); creations.call = srv.call;
  const mine = await creations.save({ name: 'Super Bee Dodge Party', picks: { things: [{ id: 'bee', job: 'dodge' }], where: 'beach', speed: 4, many: 2 }, makerId: 'p1' });
  const played = [];
  const cc = cuboCreate({ creation: mine, onPlay: (g) => played.push(g) }); cc.start();
  assert.equal(cc.step, 'where'); assert.equal(cc.state.picks.where, 'beach');
  cc.event({ t: 'arms' }); cc.event({ t: 'job', id: 'dodge' }); cc.event({ t: 'arms' }); cc.event({ t: 'arms' }); cc.event({ t: 'arms' });
  assert.equal(cc.step, 'name'); assert.equal(cc.state.names[0], 'Super Bee Dodge Party');
  cc.event({ t: 'arms' }); await new Promise(r => setTimeout(r, 30)); tickFor(cc, 3.2);
  assert.equal(played[0].id, mine.id); assert.equal(creations.items.length, 1, 'the same slot');
  /* a full family cannot make another from here */
  await creations.save({ name: 'B', picks: defaultPicks(), makerId: 'p1' }); await creations.save({ name: 'C', picks: defaultPicks(), makerId: 'p1' });
  const said = [], third = cuboCreate({ onPlay: (g) => played.push(g), say: (t, bad) => said.push([t, bad]) }); third.start();
  for (const e of ['ok', 'ok']) third.event({ t: e });
  third.event({ t: 'job', id: 'collect' }); third.event({ t: 'group', id: 'food' }); third.event({ t: 'grab', id: 'apple' }); third.event({ t: 'arms' }); third.event({ t: 'arms' }); third.event({ t: 'arms' }); third.event({ t: 'arms' });
  await new Promise(r => setTimeout(r, 30)); tickFor(third, 3.2);
  assert.equal(played.length, 1); assert.deepEqual(said, [[FULL_LINE, true]]); assert.equal(third.step, 'name', 'a play that did not save goes back to the name');
  cc.dispose(); third.dispose(); signedOut();
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
