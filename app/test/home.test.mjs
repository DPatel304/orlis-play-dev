/* Home is one page with rows (decision 0045): the rows, who sees which, where focus starts and how it moves, and what the hero says. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { homeRows, makeFor, startFocus, step, heroOf, bigHero, MAKE } from '../src/ui/home-model.js';

const g = (id, name, more = {}) => ({ id, name, ...more });
const POOL = [g('pop-party', 'Pop Party', { secs: 120 }), g('sky-painter', 'Sky Painter', { secs: 120 }), g('leaf-pile', 'Leaf Pile', { secs: 120 }), g('sleepy-bear', 'Sleepy Bear', { secs: 180 })];
const GET = [g('comet', 'Comet Catch', { discover: { id: 'comet' } }), g('bubble', 'Bubble Dash', { discover: { id: 'bubble' } })];

test('three rows: Your games, New to try (Discover, then More to try), Make a game', () => {
  const rows = homeRows({ pool: POOL, toGet: GET, make: ['ask', 'requests', 'pro'], more: true });
  assert.deepEqual(rows.map(r => r.title), ['Your games', 'New to try', 'Make a game']);
  assert.deepEqual(rows[0].items.map(i => i.g.id), POOL.map(x => x.id), 'the games on this PC, in order');
  assert.deepEqual(rows[1].items.map(i => i.kind), ['get', 'get', 'more'], 'games to get, then the way to the rest of Discover');
  assert.deepEqual(rows[2].items.map(i => i.name), ['Ask for a game', 'Your requests', 'Create Pro']);
  assert.equal(rows[2].items[2].tag, 'Grown-ups');
});

test('a row with nothing in it is not shown; Testing comes only while a creator has a game on this TV', () => {
  assert.deepEqual(homeRows({ pool: POOL }).map(r => r.id), ['games']);
  assert.deepEqual(homeRows({ pool: POOL, more: true }).map(r => r.id), ['games', 'new']);
  assert.deepEqual(homeRows({ pool: POOL, testing: [{ id: 'x', name: 'X' }] }).map(r => r.id), ['games', 'testing']);
  assert.deepEqual(homeRows({}).map(r => r.id), []);
});

test('at most six games to get; waiting to be let in leaves only the starter games (the page passes none to get)', () => {
  const many = Array.from({ length: 9 }, (_, i) => g('d' + i, 'D' + i));
  assert.equal(homeRows({ pool: POOL, toGet: many }).find(r => r.id === 'new').items.length, 6);
});

test('who sees Make a game: a child nothing; a grown-up Ask and Requests; a creator Create Pro too; the Creator app only Create Pro', () => {
  assert.deepEqual(makeFor({ kid: true, creator: true }), []);
  assert.deepEqual(makeFor({}), ['ask', 'requests']);
  assert.deepEqual(makeFor({ creator: true }), ['ask', 'requests', 'pro']);
  assert.deepEqual(makeFor({ creator: true, creatorApp: true }), ['pro']);
  assert.deepEqual(MAKE.map(m => m.id), ['ask', 'requests', 'pro']);
});

test('focus starts on the pick made this session, else the one played last, else the first tile', () => {
  const rows = homeRows({ pool: POOL, toGet: GET, more: true });
  assert.deepEqual(startFocus(rows, { session: 'leaf-pile', last: 'pop-party' }), { row: 0, col: 2 });
  assert.deepEqual(startFocus(rows, { last: 'sleepy-bear' }), { row: 0, col: 3 });
  assert.deepEqual(startFocus(rows, { session: 'gone', last: 'also-gone' }), { row: 0, col: 0 });
  assert.deepEqual(startFocus(rows), { row: 0, col: 0 });
});

test('focus: left and right stay in the row; up and down change row and keep the column last used there', () => {
  const rows = homeRows({ pool: POOL, toGet: GET, make: ['ask', 'requests', 'pro'], more: true });
  const mem = {};
  assert.equal(step(rows, { row: 0, col: 0 }, 'left', mem), null);
  assert.deepEqual(step(rows, { row: 0, col: 2 }, 'right', mem), { row: 0, col: 3 });
  assert.equal(step(rows, { row: 0, col: 3 }, 'right', mem), null, 'the end of a row');
  mem[0] = 3;
  /* down from the fourth game: New to try has only three tiles, so the column is clamped */
  assert.deepEqual(step(rows, { row: 0, col: 3 }, 'down', mem), { row: 1, col: 2 });
  mem[1] = 1;
  assert.deepEqual(step(rows, { row: 2, col: 0 }, 'up', mem), { row: 1, col: 1 }, 'back to where it was in that row');
  assert.deepEqual(step(rows, { row: 1, col: 1 }, 'up', mem), { row: 0, col: 3 });
  assert.equal(step(rows, { row: 2, col: 2 }, 'down', mem), null, 'nothing below the last row');
});

test('up from the first row goes nowhere (no Play button); focus never leaves the rows', () => {
  const rows = homeRows({ pool: POOL });
  assert.equal(step(rows, { row: 0, col: 1 }, 'up', {}), null);
  assert.deepEqual(startFocus(rows), { row: 0, col: 0 });
});

test('the hero (0046): no title, one line, players as lo and hi (no time), a label for the tile; a game to get says Get; the rest say what they open', () => {
  const pop = heroOf({ kind: 'game', g: { ...POOL[0], minPlayers: 1, maxPlayers: 4 } }, { blurb: 'Reach up and pop the balloons', cap: 4 });
  assert.deepEqual(pop, { name: 'Pop Party', line: 'Reach up and pop the balloons', players: { lo: 1, hi: 4 }, cta: { label: 'Play', icon: 'play' } });
  assert.ok(!('title' in pop) && !('chips' in pop), 'no title, no chips');
  assert.deepEqual(heroOf({ kind: 'game', g: { ...POOL[0], minPlayers: 1, maxPlayers: 4 } }, { cap: 2 }).players, { lo: 1, hi: 2 }, 'as many as this PC can seat');
  assert.deepEqual(heroOf({ kind: 'game', g: { name: 'Solo', minPlayers: 1, maxPlayers: 1, secs: 45 } }).players, { lo: 1, hi: 1 });
  assert.equal(heroOf({ kind: 'get', g: GET[0] }).cta.label, 'Get');
  const story = heroOf({ kind: 'game', g: { name: 'Story', passive: true } });
  assert.equal(story.players, null); assert.match(story.line, /story/i);
  assert.equal(heroOf({ kind: 'make', id: 'requests', name: 'Your requests', line: 'x' }).name, 'Your requests');
  assert.match(heroOf({ kind: 'make', id: 'pro', name: 'Create Pro', line: 'Build', tag: 'Grown-ups' }).line, /grown-ups/);
  assert.equal(heroOf({ kind: 'more' }).name, 'More to try');
  assert.match(heroOf({ kind: 'more' }).line, /game/);
});

test('the hero is big only on the first row (and the top); further down it is a banner', () => {
  const rows = homeRows({ pool: POOL, toGet: GET, more: true });
  assert.equal(bigHero({ row: 0, col: 2 }, rows), true);
  assert.equal(bigHero({ row: 1, col: 0 }, rows), false);
});
