/* Play's rows (decision 0055): Featured (this week's games to get, then the Discover tile) and Your games; who sees the tabs; where focus
   starts and how it moves; what the hero says; the Discover page's rows. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { homeRows, discoverRows, tabsFor, startFocus, step, heroOf, bigHero, PLAY_BIG } from '../src/ui/home-model.js';

const g = (id, name, more = {}) => ({ id, name, ...more });
const POOL = [g('pop-party', 'Pop Party', { secs: 120 }), g('sky-painter', 'Sky Painter', { secs: 120 }), g('leaf-pile', 'Leaf Pile', { secs: 120 }), g('sleepy-bear', 'Sleepy Bear', { secs: 180 })];
const GET = [g('comet', 'Comet Catch', { discover: { id: 'comet' } }), g('bubble', 'Bubble Dash', { discover: { id: 'bubble' } })];

test('two rows: Featured (games to get, then the Discover tile) and Your games', () => {
  const rows = homeRows({ pool: POOL, featured: GET, discover: true });
  assert.deepEqual(rows.map(r => r.title), ['Featured', 'Your games']);
  assert.deepEqual(rows[0].items.map(i => i.kind), ['get', 'get', 'discover'], 'featured games to get, then the way to Discover');
  assert.deepEqual(rows[1].items.map(i => i.g.id), POOL.map(x => x.id), 'the games on this PC, in order');
  assert.ok(!rows.some(r => ['new', 'make'].includes(r.id)), 'no "New to try" or "Make a game" any more');
});

test('a row with nothing in it is not shown; none featured: the row is just the Discover tile; Testing only while a creator has a game on this TV', () => {
  assert.deepEqual(homeRows({ pool: POOL }).map(r => r.id), ['games']);
  assert.deepEqual(homeRows({ pool: POOL, discover: true }).map(r => r.id), ['featured', 'games']);
  assert.deepEqual(homeRows({ pool: POOL, discover: true })[0].items.map(i => i.kind), ['discover']);
  assert.deepEqual(homeRows({ pool: POOL, testing: [{ id: 'x', name: 'X' }] }).map(r => r.id), ['games', 'testing']);
  assert.deepEqual(homeRows({}).map(r => r.id), []);
});

test('at most three featured games; fewer if fewer are featured', () => {
  const many = Array.from({ length: 9 }, (_, i) => g('d' + i, 'D' + i));
  assert.equal(homeRows({ pool: POOL, featured: many, discover: true }).find(r => r.id === 'featured').items.length, 4, 'three and the Discover tile');
  assert.equal(homeRows({ pool: POOL, featured: GET.slice(0, 1), discover: true })[0].items.length, 2);
});

test('the tabs (0055, 0057): Play and Create for everyone in the Player app, children too; none for a profile waiting to be let in, or the Creator app', () => {
  assert.deepEqual(tabsFor({}), ['play', 'create']);
  assert.deepEqual(tabsFor({ kid: true }), ['play', 'create'], 'children make games too (0057)');
  assert.deepEqual(tabsFor({ waiting: true }), []);
  assert.deepEqual(tabsFor({ creatorApp: true, modeTabs: ['create', 'pro'] }), []);
  assert.deepEqual(tabsFor({ modeTabs: ['create', 'pro'] }), []);
});

test('focus starts on the pick made this session, else the one played last, else the first of Your games, else the first featured', () => {
  const rows = homeRows({ pool: POOL, featured: GET, discover: true });
  assert.deepEqual(startFocus(rows, { session: 'leaf-pile', last: 'pop-party' }), { row: 1, col: 2 });
  assert.deepEqual(startFocus(rows, { last: 'sleepy-bear' }), { row: 1, col: 3 });
  assert.deepEqual(startFocus(rows, { session: 'gone', last: 'also-gone' }), { row: 1, col: 0 }, 'families replay their games');
  assert.deepEqual(startFocus(rows), { row: 1, col: 0 });
  assert.deepEqual(startFocus(rows, { last: 'comet' }), { row: 1, col: 0 }, 'a game to get is not a pick to return to');
  assert.deepEqual(startFocus(homeRows({ featured: GET, discover: true })), { row: 0, col: 0 }, 'no games of your own: the first featured');
});

test('focus: left and right stay in the row; up and down change row and keep the column last used there', () => {
  const rows = homeRows({ pool: POOL, featured: GET, discover: true, testing: [{ id: 'x', name: 'X' }] });
  const mem = {};
  assert.equal(step(rows, { row: 0, col: 0 }, 'left', mem), null);
  assert.deepEqual(step(rows, { row: 1, col: 2 }, 'right', mem), { row: 1, col: 3 });
  assert.equal(step(rows, { row: 1, col: 3 }, 'right', mem), null, 'the end of a row');
  mem[1] = 3;
  /* up from the fourth game: Featured has only three tiles, so the column is clamped */
  assert.deepEqual(step(rows, { row: 1, col: 3 }, 'up', mem), { row: 0, col: 2 });
  mem[0] = 1;
  assert.deepEqual(step(rows, { row: 1, col: 0 }, 'up', mem), { row: 0, col: 1 }, 'back to where it was in that row');
  assert.deepEqual(step(rows, { row: 0, col: 1 }, 'down', mem), { row: 1, col: 3 });
  assert.equal(step(rows, { row: 2, col: 0 }, 'down', mem), null, 'nothing below the last row');
});

test('up from the first row goes nowhere in the rows (home.js takes it to the tabs, when there are tabs)', () => {
  const rows = homeRows({ pool: POOL });
  assert.equal(step(rows, { row: 0, col: 1 }, 'up', {}), null);
});

test('the hero (0046): no title, one line, players as lo and hi (no time), a label for the tile; a game to get says Get (an update, Update); Discover says what it opens', () => {
  const pop = heroOf({ kind: 'game', g: { ...POOL[0], minPlayers: 1, maxPlayers: 4 } }, { blurb: 'Reach up and pop the balloons', cap: 4 });
  assert.deepEqual(pop, { name: 'Pop Party', line: 'Reach up and pop the balloons', players: { lo: 1, hi: 4 }, cta: { label: 'Play', icon: 'play' } });
  assert.ok(!('title' in pop) && !('chips' in pop), 'no title, no chips');
  assert.deepEqual(heroOf({ kind: 'game', g: { ...POOL[0], minPlayers: 1, maxPlayers: 4 } }, { cap: 2 }).players, { lo: 1, hi: 2 }, 'as many as this PC can seat');
  assert.deepEqual(heroOf({ kind: 'game', g: { name: 'Solo', minPlayers: 1, maxPlayers: 1, secs: 45 } }).players, { lo: 1, hi: 1 });
  assert.equal(heroOf({ kind: 'get', g: GET[0] }).cta.label, 'Get');
  assert.equal(heroOf({ kind: 'get', g: GET[0], update: true }).cta.label, 'Update');
  const story = heroOf({ kind: 'game', g: { name: 'Story', passive: true } });
  assert.equal(story.players, null); assert.match(story.line, /story/i);
  assert.equal(heroOf({ kind: 'discover' }).name, 'Discover');
  assert.match(heroOf({ kind: 'discover' }).line, /game/);
});

test('the hero is big on Play\'s two rows, a banner below them; on Discover only the first row keeps it big', () => {
  const rows = homeRows({ pool: POOL, featured: GET, discover: true, testing: [{ id: 'x', name: 'X' }] });
  assert.equal(PLAY_BIG, 2);
  assert.equal(bigHero({ row: 0, col: 2 }, rows, PLAY_BIG), true);
  assert.equal(bigHero({ row: 1, col: 0 }, rows, PLAY_BIG), true);
  assert.equal(bigHero({ row: 2, col: 0 }, rows, PLAY_BIG), false);
  assert.equal(bigHero({ row: 1, col: 0 }, rows), false, 'the default is the first row only (Discover)');
});

test('the Discover page\'s rows: updates first, then a row per category, each tile a get', () => {
  const rows = discoverRows({ updates: [GET[0]], rows: [{ name: 'New', list: GET }, { name: 'Calm', list: [] }, { name: 'Solo', list: [GET[1]] }] });
  assert.deepEqual(rows.map(r => r.title), ['Updates', 'New', 'Solo'], 'an empty category is left out');
  assert.ok(rows.every(r => r.items.every(i => i.kind === 'get')));
  assert.equal(rows[0].items[0].update, true);
  assert.deepEqual(discoverRows({}), []);
});

import { howYouPlay, needsTablet } from '../src/ui/home-model.js';
test('how you play (0052, trimmed): players, then PlayPad / PlayPad optional; nothing else; a story shows no row', () => {
  const ids = (x, o) => howYouPlay(x, o).map(i => i.id);
  assert.deepEqual(ids({ id: 'a', minPlayers: 1, maxPlayers: 2 }), ['players'], 'a camera game: players only (no Move)');
  assert.equal(howYouPlay({ id: 'a', minPlayers: 1, maxPlayers: 2 })[0].text, '1–2', 'the en dash');
  assert.equal(howYouPlay({ id: 'a', minPlayers: 2, maxPlayers: 2 })[0].text, '2');
  assert.equal(howYouPlay({ id: 'a' })[0].text, '1–4', 'no counts declared: 1 to 4');
  assert.equal(howYouPlay({ id: 'a', maxPlayers: 6 }, { cap: 4 })[0].text, '1–4', 'capped to what the PC seats');
  assert.deepEqual(howYouPlay({ id: 's', passive: true }), [], 'a story: no row at all');
  const peek = { id: 'p', seats: { tracked: [1, 2], pads: [1, 1] }, requiredPads: 1 };
  assert.deepEqual(ids(peek), ['players', 'tablet']);
  assert.equal(howYouPlay(peek)[1].text, 'PlayPad');
  assert.ok(needsTablet(peek));
  const opt = { id: 'o', seats: { tracked: [1, 2], pads: [0, 1] } };
  assert.equal(howYouPlay(opt)[1].text, 'PlayPad optional'); assert.ok(!needsTablet(opt), 'optional: no mark on the tile');
  assert.deepEqual(ids({ id: 'f', seats: { tracked: [0, 0], pads: [1, 4] } }), ['players'], 'phones are not shown');
  assert.ok(!needsTablet({ id: 'n' }) && !needsTablet(null) && !needsTablet({ passive: true, seats: { pads: [1, 1] } }));
  assert.deepEqual(howYouPlay(null), []);
});
