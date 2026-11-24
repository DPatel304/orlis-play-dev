/* Featured is three numbered slots the owner fills (decision 0058): set, clear, order, built-in games, what the app reads, older apps, history, migration. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../src/app.js';
import { openDb } from '../src/db.js';
import { writeOrlis } from '../src/orlis-file.js';
import { BUILT_IN_GAMES } from '../src/builtin.js';
import { weekly } from '../src/weekly.js';

const orlis = (id, name) =>
  writeOrlis({ 'manifest.json': JSON.stringify({ format: 1, id, name, version: '1.0', kit: 2, blurb: `${name}.`, by: '', tags: [], icon: { cols: ['#3da9ff', '#8b5cf6'], glyph: '<circle cx="50" cy="50" r="20"/>' } }), 'game.js': 'export default {};' });
const STORE = [['comet', 'Comet Catch'], ['bubble', 'Bubble Dash'], ['moon', 'Moon Hop'], ['star', 'Star Sweep'], ['tide', 'Tide Pool']];

async function fresh(){
  const s = await start({ dataDir: mkdtempSync(join(tmpdir(), 'orlis-feat-')), port: 0, discoveryPort: false, tailscaleJoin: () => true, notify: () => {} });
  const call = async (method, path, body, token, manage = true) => {
    const r = await fetch(`http://127.0.0.1:${s.port}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(manage ? { 'X-Orlis-Manage': s.manageKey } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, ...(await r.json()) };
  };
  const me = await call('POST', '/api/signup', { email: 'owner@example.com', password: 'correct horse', name: 'Owner', adult: true }, null, false);
  for (const [id, name] of STORE) await s.store.add(id, orlis(id, name));
  return { s, call, me };
}
const ids = (slots) => slots.map(x => x.id);

test('a fresh server has no slots: the three come from the rotation, marked as such', async () => {
  const { s, call, me } = await fresh();
  try {
    const st = await call('GET', '/api/store', null, me.token, false);
    assert.equal(st.featuredSlots.length, 3);
    assert.ok(st.featuredSlots.every((x, i) => x.rotating === true && x.slot === i + 1 && x.builtIn === false && x.name && x.version), 'each is a Store entry, marked rotating');
    assert.deepEqual(ids(st.featuredSlots), st.featured, 'the same three the older apps get');
    assert.deepEqual(s.db.prepare('SELECT * FROM featured_slots').all(), []);
  } finally { await s.close(); }
});

test('the owner sets and clears slots: any Store game or built-in game; unknown ids and bad slots refused; one game in one slot', async () => {
  const { s, call, me } = await fresh();
  try {
    assert.deepEqual(await call('POST', '/api/featured/2', { id: 'sleepy-bear' }, me.token, false).then(r => [r.status, r.id, r.name, r.builtIn, r.slot]), [200, 'sleepy-bear', 'Sleepy Bear', true, 2], 'a built-in game');
    assert.equal((await call('POST', '/api/featured/1', { id: 'tide' })).status, 200, 'a Store game (with the manage key)');
    assert.deepEqual(s.db.prepare('SELECT slot, game_id FROM featured_slots ORDER BY slot').all().map(r => [r.slot, r.game_id]), [[1, 'tide'], [2, 'sleepy-bear']]);
    assert.equal((await call('POST', '/api/featured/3', { id: 'no-such-game' })).status, 404, 'an unknown id');
    assert.equal((await call('POST', '/api/featured/3', { id: '../x' })).status, 404);
    assert.equal((await call('POST', '/api/featured/4', { id: 'tide' })).status, 400, 'there are three slots');
    assert.equal((await call('POST', '/api/featured/0', { id: 'tide' })).status, 400);
    assert.equal((await call('POST', '/api/featured/two', { id: 'tide' })).status, 400);
    /* a game in another slot moves; the slot it left is empty */
    await call('POST', '/api/featured/3', { id: 'tide' });
    assert.deepEqual(s.db.prepare('SELECT slot, game_id FROM featured_slots ORDER BY slot').all().map(r => [r.slot, r.game_id]), [[2, 'sleepy-bear'], [3, 'tide']]);
    /* putting a game over another one replaces it */
    await call('POST', '/api/featured/2', { id: 'comet' });
    assert.deepEqual(s.db.prepare('SELECT slot, game_id FROM featured_slots ORDER BY slot').all().map(r => [r.slot, r.game_id]), [[2, 'comet'], [3, 'tide']]);
    /* clearing: { id: null } or DELETE */
    assert.deepEqual(await call('POST', '/api/featured/2', { id: null }).then(r => [r.status, r.id]), [200, null]);
    assert.equal((await call('DELETE', '/api/featured/3')).status, 200);
    assert.equal((await call('DELETE', '/api/featured/3')).status, 200, 'clearing an empty slot is fine');
    assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM featured_slots').get().n, 0);
    /* not the owner: no */
    const other = await call('POST', '/api/signup', { email: 'kid@example.com', password: 'correct horse', name: 'Kid', adult: true }, null, false);
    assert.equal((await call('POST', '/api/featured/1', { id: 'tide' }, other.token, false)).status, 403);
    assert.equal((await call('POST', '/api/featured/1', { id: 'tide' }, null, false)).status, 401);
  } finally { await s.close(); }
});

test('what the app reads: [slot 1, 2, 3] in order, each { id, name, builtIn, ...store entry }, empty slots filled from the rotation', async () => {
  const { s, call, me } = await fresh();
  try {
    await call('POST', '/api/featured/1', { id: 'sleepy-bear' });
    await call('POST', '/api/featured/3', { id: 'star' });
    const st = await call('GET', '/api/store', null, me.token, false);
    const [a, b, c] = st.featuredSlots;
    assert.deepEqual([a.slot, a.id, a.name, a.builtIn, a.rotating], [1, 'sleepy-bear', 'Sleepy Bear', true, false]);
    assert.equal(a.version, undefined, 'a built-in game has no Store entry');
    assert.deepEqual([b.slot, b.rotating, b.builtIn], [2, true, false], 'slot 2 rotates');
    assert.ok(b.version && b.sha256 && b.icon, 'a rotating game is a whole Store entry');
    assert.notEqual(b.id, 'star', 'the rotation skips a game already in a slot');
    assert.deepEqual([c.slot, c.id, c.name, c.builtIn, c.rotating], [3, 'star', 'Star Sweep', false, false]);
    assert.ok(c.version && c.sha256 && c.icon, 'a Store game in a slot has its entry');
    /* two slots filled: the rotation fills only the one left */
    assert.equal(st.featuredSlots.filter(x => x.rotating).length, 1);
    /* a game kept to another family is not shown to this one: its slot rotates */
    const other = await call('POST', '/api/signup', { email: 'kid@example.com', password: 'correct horse', name: 'Kid', adult: true }, null, false);
    s.db.prepare('INSERT INTO reach (game_id, household_id) VALUES (?, ?)').run('star', s.db.prepare("SELECT household_id AS h FROM accounts WHERE email = 'owner@example.com'").get().h);
    const mine = await call('GET', '/api/store', null, other.token, false);
    assert.ok(!ids(mine.featuredSlots).includes('star'));
    assert.equal(mine.featuredSlots.length, 3);
    assert.equal(mine.featuredSlots[2].rotating, true);
    /* fewer games than slots: only what there is */
    for (const [id] of STORE) await call('DELETE', `/api/store/${id}`);
    const bare = await call('GET', '/api/store', null, me.token, false);
    assert.deepEqual(ids(bare.featuredSlots), ['sleepy-bear'], 'the built-in game; the Store is empty');
  } finally { await s.close(); }
});

test('older apps still work: "featured" stays a list of Store ids (slotted first, then the rotation) and the on/off route still works', async () => {
  const { s, call, me } = await fresh();
  try {
    assert.equal((await call('POST', '/api/store/moon/feature', { on: true }, me.token, false)).featured, true);
    assert.equal((await call('POST', '/api/store/tide/feature', { on: true })).slot, 2, 'the first empty slot');
    await call('POST', '/api/featured/3', { id: 'sleepy-bear' });
    const st = await call('GET', '/api/store', null, me.token, false);
    assert.ok(Array.isArray(st.featured) && st.featured.every(id => typeof id === 'string'));
    assert.deepEqual(st.featured.slice(0, 2), ['moon', 'tide'], 'slotted Store games first');
    assert.ok(!st.featured.includes('sleepy-bear'), 'a built-in game is not a Store id');
    assert.equal(st.featured.length, 3);
    assert.ok(st.games.find(g => g.id === 'moon').pinned && !st.games.find(g => g.id === 'comet').pinned, '"pinned" still says which are chosen');
    /* the three are full: a fourth is refused; off takes one out */
    assert.equal((await call('POST', '/api/store/comet/feature', { on: true })).status, 409);
    assert.equal((await call('POST', '/api/store/moon/feature', { on: false })).featured, false);
    assert.deepEqual(s.db.prepare('SELECT slot, game_id FROM featured_slots ORDER BY slot').all().map(r => [r.slot, r.game_id]), [[2, 'tide'], [3, 'sleepy-bear']]);
    assert.equal((await call('POST', '/api/store/comet/feature', { on: true })).slot, 1);
  } finally { await s.close(); }
});

test('slot changes go in the history (featured / unfeatured, with the slot), and show on the management page\'s lists', async () => {
  const { s, call } = await fresh();
  try {
    await call('POST', '/api/featured/2', { id: 'peekaboo' });
    await call('POST', '/api/featured/2', { id: null });
    const h = (await call('GET', '/api/history')).history.filter(x => x.what === 'featured' || x.what === 'unfeatured');
    assert.deepEqual(h.map(x => [x.what, x.gameId, x.name, x.note]), [['unfeatured', 'peekaboo', 'Peekaboo Garden', 'slot 2'], ['featured', 'peekaboo', 'Peekaboo Garden', 'slot 2']]);
    await call('POST', '/api/featured/1', { id: 'sleepy-bear' });
    await call('POST', '/api/featured/3', { id: 'comet' });
    const g = await call('GET', '/api/admin/games?per=100');
    assert.deepEqual(g.featuredNow.map(x => [x.slot, x.id, x.title, x.builtIn]), [[1, 'sleepy-bear', 'Sleepy Bear', true], [2, null, null, false], [3, 'comet', 'Comet Catch', false]]);
    const bear = g.rows.find(x => x.id === 'sleepy-bear');
    assert.deepEqual([bear.builtIn, bear.slot, bear.featured, bear.cat], [true, 1, true, 'Built in']);
    assert.equal((await call('GET', '/api/admin/games/sleepy-bear')).builtIn, true);
    assert.equal(g.featuredTotal, 2);
  } finally { await s.close(); }
});

test('migration: the old on/off pins become slots in pin order (three at most); a fresh database has none', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'orlis-mig-')), 'orlis.db');
  const db = openDb(file);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM featured_slots').get().n, 0, 'fresh: none');
  /* put the database back as it was at step 14, with four pins */
  db.exec('DROP TABLE featured_slots; CREATE TABLE featured (game_id TEXT PRIMARY KEY, pinned_at TEXT NOT NULL); UPDATE schema_version SET version = 14');
  const pin = db.prepare('INSERT INTO featured (game_id, pinned_at) VALUES (?, ?)');
  pin.run('third', '2026-11-03T00:00:00Z'); pin.run('first', '2026-11-01T00:00:00Z'); pin.run('second', '2026-11-02T00:00:00Z'); pin.run('fourth', '2026-11-04T00:00:00Z');
  db.close();
  const again = openDb(file);
  assert.deepEqual(again.prepare('SELECT slot, game_id FROM featured_slots ORDER BY slot').all().map(r => [r.slot, r.game_id]), [[1, 'first'], [2, 'second'], [3, 'third']]);
  assert.equal(again.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'featured'").get().n, 0, 'the old table is gone');
  assert.deepEqual(weekly(again).slots(), ['first', 'second', 'third']);
  again.close();
});

test('migration: a server in use with no pins starts with the owner\'s picks (Sky Painter, Keep It Up!, Stack It High); a brand-new one has none; pins win', () => {
  const back = (file, { account, pins }) => {
    const db = openDb(file);
    db.exec('DROP TABLE featured_slots; CREATE TABLE featured (game_id TEXT PRIMARY KEY, pinned_at TEXT NOT NULL); UPDATE schema_version SET version = 14');
    if (account){
      db.prepare("INSERT INTO households (id, name, created_at) VALUES ('h1', 'The Patels', '2026-01-01T00:00:00Z')").run();
      db.prepare("INSERT INTO accounts (id, email, password_hash, role, created_at, household_id, pending, slots) VALUES ('a1', 'o@example.com', 'x', 'owner', '2026-01-01T00:00:00Z', 'h1', 0, 3)").run();
    }
    for (const p of pins) db.prepare('INSERT INTO featured (game_id, pinned_at) VALUES (?, ?)').run(p, '2026-11-01T00:00:00Z');
    db.close();
    const again = openDb(file), out = weekly(again).slots();
    again.close();
    return out;
  };
  const dir = () => join(mkdtempSync(join(tmpdir(), 'orlis-mig-')), 'orlis.db');
  assert.deepEqual(back(dir(), { account: true, pins: [] }), ['sky-painter', 'keep-it-up', 'stack-it-high']);
  assert.deepEqual(back(dir(), { account: false, pins: [] }), [null, null, null]);
  assert.deepEqual(back(dir(), { account: true, pins: ['mine'] }), ['mine', null, null], 'old pins are carried over instead');
});

test('the built-in list: ids are unique and well formed (app/test/builtin-ids.test.mjs checks it against the app)', () => {
  assert.ok(BUILT_IN_GAMES.length >= 5);
  assert.equal(new Set(BUILT_IN_GAMES.map(g => g[0])).size, BUILT_IN_GAMES.length);
  for (const [id, name] of BUILT_IN_GAMES){ assert.match(id, /^[a-z0-9][a-z0-9-]*$/); assert.ok(name.length > 1); }
});
