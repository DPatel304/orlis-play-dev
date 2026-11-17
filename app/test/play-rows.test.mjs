import test from 'node:test';
import assert from 'node:assert/strict';
import { resetDom } from './harness/browser.mjs';
resetDom();
const { playRows } = await import('../src/ui/menu.js');

const g = (id, name, store) => ({ id, name, ...(store ? { store: {} } : {}) });
const POOL = [g('pop-party', 'Pop Party'), g('sky-painter', 'Sky Painter'), g('leaf-pile', 'Leaf Pile'), g('sleepy-bear', 'Sleepy Bear'), g('stack-it-high', 'Stack It High'), g('bubble', 'Bubble Dash', true)];

test('Play\'s rows: Jump back in (newest first), Featured (Discover games first), All A-Z', () => {
  const rows = playRows(POOL, ['leaf-pile', 'gone-game', 'pop-party']);
  assert.deepEqual(rows.map(r => r.title), ['Jump back in', 'Featured', 'My games']);
  assert.deepEqual(rows[0].games.map(x => x.id), ['leaf-pile', 'pop-party'], 'what was played lately, skipping games no longer here');
  assert.equal(rows[1].games[0].id, 'bubble', 'a game from Discover leads Featured');
  assert.ok(rows[1].games.length <= 3);
  assert.deepEqual(rows[2].games.map(x => x.name), [...POOL.map(x => x.name)].sort((a, b) => a.localeCompare(b)));
});

test('nothing played yet: no Jump back in; only a couple of games (waiting to be let in): just All', () => {
  assert.deepEqual(playRows(POOL, []).map(r => r.title), ['Featured', 'My games']);
  assert.deepEqual(playRows(POOL.slice(0, 2), []).map(r => r.title), ['My games']);
});

test('Featured this week: the server\'s pick from Discover when there is one (games to get, in its order)', () => {
  const pick = [g('comet', 'Comet Catch', true), g('bubble', 'Bubble Dash', true)];
  const rows = playRows(POOL, [], pick);
  assert.deepEqual(rows.map(r => r.title), ['Featured this week', 'My games']);
  assert.deepEqual(rows[0].games.map(x => x.id), ['comet', 'bubble']);
  assert.ok(!rows[1].games.some(x => x.id === 'comet'), 'All is what\'s on this PC');
});
