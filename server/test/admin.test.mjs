import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../src/app.js';
import { makeServer, stats } from '../src/http.js';
import { writeOrlis } from '../src/orlis-file.js';
import { diskLevel, backupLevel, errorLevel, CODES, HEADS_UP, ACTIVITY_TYPES } from '../src/admin.js';

const DAY = 864e5;
const ago = (days) => new Date(Date.now() - days * DAY).toISOString();
const grownUp = (email, extra = {}) => ({ email, password: 'correct horse', name: 'Sam', adult: true, device: 'Laptop', ...extra });

/* a server with its own data folder, the internet door open, a stand-in for email, and the owner signed up */
async function fresh(opts = {}){
  const s = await start({ dataDir: mkdtempSync(join(tmpdir(), 'orlis-admin-')), port: 0, discoveryPort: false, internetPort: 0, tailscaleJoin: () => false, approveJoins: true,
    mail: { ready: true, settings: () => ({ user: 'owner@example.com', host: 'smtp.example.com' }), send: async () => {} }, notify: () => {}, ...opts });
  const call = async (method, path, body, { token, manage = true, base = `http://127.0.0.1:${s.port}` } = {}) => {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(manage ? { 'X-Orlis-Manage': s.manageKey } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const type = r.headers.get('content-type') || '';
    const out = type.includes('json') ? await r.json() : null;
    return { ...(out || {}), status: r.status, json: out, headers: r.headers, ...(out ? {} : { text: await r.text() }) };
  };
  const owner = await call('POST', '/api/signup', grownUp('owner@example.com', { name: 'Owner', family: 'The Patels' }), { manage: false });
  assert.equal(owner.status, 201);
  return { s, call, owner };
}

/* a family put straight into the database: its grown-up, kids, and plays (ISO times) */
let n = 0;
function addFamily(db, { name = 'The Smiths', email = null, kids = ['Sam'], joined = ago(100), pending = 0, plays = [], role = 'creator', slots = 3, game = 'pop-party', look = null } = {}){
  n++;
  const hid = `h-test${n}`, aid = `a-test${n}`;
  db.prepare('INSERT INTO households (id, name, created_at) VALUES (?, ?, ?)').run(hid, name, joined);
  db.prepare('INSERT INTO accounts (id, email, password_hash, role, created_at, household_id, pending, slots) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(aid, email || `fam${n}@example.com`, 'x', role, joined, hid, pending, slots);
  kids.forEach((k, i) => db.prepare('INSERT INTO profiles (id, account_id, name, avatar, look, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(`p-test${n}-${i}`, aid, k, 'cube', look, joined));
  for (const at of plays) db.prepare('INSERT INTO plays (household_id, account_id, game_id, value, secs, players, at) VALUES (?, ?, ?, 10, 60, 1, ?)').run(hid, aid, game, at);
  return { hid, aid };
}

const ADMIN = ['/api/admin/overview', '/api/admin/queue', '/api/admin/families', '/api/admin/families.csv', '/api/admin/families/x', '/api/admin/games', '/api/admin/games/x', '/api/admin/activity', '/api/admin/settings'];

test('the owner\'s lists: only the owner, and only from this laptop', async () => {
  const { s, call, owner } = await fresh();
  try {
    const kid = await call('POST', '/api/signup', grownUp('kid@example.com'), { manage: false });   /* (asks to join: waiting) */
    for (const path of ADMIN){
      assert.equal((await call('GET', path, null, { manage: false })).status, 401, `${path}: nobody signed in`);
      assert.equal((await call('GET', path, null, { manage: false, token: kid.token })).status, 403, `${path}: a grown-up waiting to join`);
      const wrongKey = await fetch(`http://127.0.0.1:${s.port}${path}`, { headers: { 'X-Orlis-Manage': 'nope' } });
      assert.equal(wrongKey.status, 403, `${path}: a wrong manage key`);
      /* through the internet door, the key is no use - it isn't this laptop */
      assert.equal((await call('GET', path, null, { base: `http://127.0.0.1:${s.internetPort}` })).status, 403, `${path}: through the internet door`);
      /* ...nor when something on this machine says it's passing a request on */
      const passed = await fetch(`http://127.0.0.1:${s.port}${path}`, { headers: { 'X-Orlis-Manage': s.manageKey, 'X-Forwarded-For': '203.0.113.9' } });
      assert.equal(passed.status, 403, `${path}: passed on by a tunnel`);
      if (path !== '/api/admin/families/x' && path !== '/api/admin/games/x'){
        assert.equal((await call('GET', path)).status, 200, `${path}: with the manage key on this laptop`);
        assert.equal((await call('GET', path, null, { manage: false, token: owner.token })).status, 200, `${path}: the signed-in owner`);
      }
    }
    /* a family player (not waiting) is no owner either */
    const home = addFamily(s.db, { email: 'player@example.com' });
    await call('POST', `/api/accounts/${home.aid}/password`, { password: 'another horse' });
    const player = await call('POST', '/api/signin', { email: 'player@example.com', password: 'another horse', device: 'x' }, { manage: false });
    assert.equal(player.status, 200);
    assert.equal((await call('GET', '/api/admin/families', null, { manage: false, token: player.token })).status, 403);
  } finally { await s.close(); }
});

test('families: pages, counts and the status rules', async () => {
  const { s, call } = await fresh();
  try {
    addFamily(s.db, { name: 'The Active', joined: ago(60), plays: [ago(2), ago(3)] });
    addFamily(s.db, { name: 'The New', joined: ago(2) });
    addFamily(s.db, { name: 'The NewAndPlaying', joined: ago(3), plays: [ago(1)] });
    addFamily(s.db, { name: 'The Quiet', joined: ago(60), plays: [ago(45)] });
    addFamily(s.db, { name: 'The Never', joined: ago(20) });
    addFamily(s.db, { name: 'The Waiting', joined: ago(1), pending: 1 });
    addFamily(s.db, { name: 'The WaitingOld', joined: ago(90), pending: 1, plays: [ago(1)] });
    const all = await call('GET', '/api/admin/families?per=100');
    const by = Object.fromEntries(all.rows.map(r => [r.name, r.status]));
    assert.deepEqual(by, { 'The Patels': 'new', 'The Active': 'active', 'The New': 'new', 'The NewAndPlaying': 'new', 'The Quiet': 'inactive', 'The Never': 'inactive', 'The Waiting': 'waiting', 'The WaitingOld': 'waiting' });
    assert.deepEqual(all.counts, { all: 8, active: 1, new: 3, waiting: 2, inactive: 2 });
    assert.equal(all.total, 8);
    /* a status filter: the rows and the total follow it; the counts stay the whole picture */
    const waiting = await call('GET', '/api/admin/families?status=waiting');
    assert.deepEqual(waiting.rows.map(r => r.name).sort(), ['The Waiting', 'The WaitingOld']);
    assert.equal(waiting.total, 2); assert.equal(waiting.counts.all, 8);
    assert.equal((await call('GET', '/api/admin/families?status=inactive')).total, 2);
    assert.equal((await call('GET', '/api/admin/families?status=nonsense')).total, 8, 'an unknown status is all');
    /* paging */
    const p1 = await call('GET', '/api/admin/families?per=3&page=1&sort=name&dir=asc'), p3 = await call('GET', '/api/admin/families?per=3&page=3&sort=name&dir=asc');
    assert.deepEqual([p1.page, p1.pages, p1.rows.length, p3.rows.length], [1, 3, 3, 2]);
    assert.deepEqual(p1.rows.map(r => r.name), ['The Active', 'The Never', 'The New']);
    assert.equal((await call('GET', '/api/admin/families?per=3&page=99&sort=name&dir=asc')).page, 3, 'past the end: the last page');
    assert.equal((await call('GET', '/api/admin/families?per=100000')).per, 100, 'a page is 100 at most');
    /* a row */
    const row = all.rows.find(r => r.name === 'The Active');
    assert.deepEqual(Object.keys(row).sort(), ['accounts', 'emails', 'id', 'joined', 'last', 'made', 'name', 'plays', 'profiles', 'slots', 'status']);
    assert.equal(row.slots, 3, 'Create\'s slots: 3 a family');
    assert.equal(row.plays, 2); assert.ok(Date.parse(row.last) > Date.now() - 3.5 * DAY && Date.parse(row.last) < Date.now() - 1.5 * DAY, 'its latest play');
    assert.equal(row.made, 0);
    assert.deepEqual(row.profiles.map(p => p.name), ['Sam']); assert.match(row.profiles[0].colour, /^#[0-9a-f]{6}$/);
    assert.equal(all.rows.find(r => r.name === 'The Patels').slots, 3, 'the owner\'s family too');
    /* games made in Create (the creations table), out of 3; sortable */
    const mk = (hid, name) => s.db.prepare("INSERT INTO creations (id, household_id, maker_id, name, picks, description, created_at, updated_at) VALUES (?, ?, 'm', ?, '{}', '{}', ?, ?)").run(`c-${hid}-${name}`, hid, name, ago(1), ago(1));
    const act = all.rows.find(r => r.name === 'The Active').id, qui = all.rows.find(r => r.name === 'The Quiet').id;
    mk(act, 'a'); mk(qui, 'a'); mk(qui, 'b');
    const byMade = await call('GET', '/api/admin/families?per=100&sort=made&dir=desc');
    assert.deepEqual(byMade.rows.slice(0, 2).map(r => [r.name, r.made]), [['The Quiet', 2], ['The Active', 1]]);
    assert.deepEqual(byMade.rows.at(-1).made, 0);
    assert.equal((await call('GET', `/api/admin/families/${qui}`)).made, 2);
  } finally { await s.close(); }
});

test('families: search by name, email, id and kids\' names; the sort whitelist', async () => {
  const { s, call } = await fresh();
  try {
    const a = addFamily(s.db, { name: 'The Okafors', email: 'ngozi@example.org', kids: ['Zuri', 'Chidi'], plays: [ago(1), ago(1), ago(2)] });
    addFamily(s.db, { name: 'The Rossis', email: 'luca@example.com', kids: ['Giulia'], plays: [ago(5)] });
    addFamily(s.db, { name: '100% Fun_Club', email: 'fun@example.com', kids: ['Pat'] });
    const names = async (q) => (await call('GET', '/api/admin/families?per=100&sort=name&dir=asc&q=' + encodeURIComponent(q))).rows.map(r => r.name);
    assert.deepEqual(await names('okafor'), ['The Okafors'], 'name, any case');
    assert.deepEqual(await names('NGOZI@'), ['The Okafors'], 'a grown-up\'s email');
    assert.deepEqual(await names('chidi'), ['The Okafors'], 'a profile\'s name');
    assert.deepEqual(await names(a.hid), ['The Okafors'], 'the household id');
    assert.deepEqual(await names('example.com'), ['100% Fun_Club', 'The Patels', 'The Rossis'], 'matches inside an email');
    assert.deepEqual(await names('100%'), ['100% Fun_Club'], 'a % is just a %');
    assert.deepEqual(await names('%'), ['100% Fun_Club'], 'and so is a lone one');
    assert.deepEqual(await names('Fun_C'), ['100% Fun_Club'], 'and an underscore');
    assert.deepEqual(await names("x' OR '1'='1"), [], 'nothing is run as SQL');
    const q = await call('GET', '/api/admin/families?q=okafor');
    assert.equal(q.counts.all, 1, 'the counts follow the search');
    /* sorting: plays, and a column that isn't on the list falls back to the default instead of reaching the database */
    const plays = (await call('GET', '/api/admin/families?per=100&sort=plays&dir=desc')).rows.map(r => r.plays);
    assert.deepEqual(plays, [...plays].sort((x, y) => y - x));
    const asc = (await call('GET', '/api/admin/families?per=100&sort=plays&dir=asc')).rows.map(r => r.plays);
    assert.deepEqual(asc, [...asc].sort((x, y) => x - y));
    const last = await call('GET', '/api/admin/families?per=100&sort=last&dir=desc');
    assert.ok(last.rows.at(-1).last === null || last.rows.at(-2).last !== null, 'nothing played goes last');
    for (const bad of ['password_hash', 'id; DROP TABLE households', '1', 'name COLLATE NOCASE', '__proto__', 'constructor']){
      const r = await call('GET', '/api/admin/families?per=100&sort=' + encodeURIComponent(bad));
      assert.equal(r.status, 200, bad);
      assert.deepEqual(r.rows.map(x => x.id), last.rows.map(x => x.id), `${bad}: the default order`);
    }
    assert.equal((await call('GET', '/api/admin/families')).total, 4, 'and the table is still there');
  } finally { await s.close(); }
});

test('one family, for the side panel: its accounts, kids and most played games', async () => {
  const { s, call } = await fresh();
  try {
    const f = addFamily(s.db, { name: 'The Chens', plays: [ago(1), ago(1), ago(2)], look: JSON.stringify({ colour: 'teal' }) });
    s.db.prepare("INSERT INTO plays (household_id, account_id, game_id, value, secs, players, at) VALUES (?, ?, 'sky-painter', 1, 10, 1, ?)").run(f.hid, f.aid, ago(1));
    const r = await call('GET', `/api/admin/families/${f.hid}`);
    assert.equal(r.http, undefined);
    assert.equal(r.name, 'The Chens'); assert.equal(r.json.status, 'active');
    assert.equal(r.accounts.length, 1); assert.deepEqual(Object.keys(r.accounts[0]).sort(), ['createdAt', 'email', 'id', 'role', 'waiting']);
    assert.equal(r.accounts[0].role, 'creator'); assert.deepEqual([r.made, r.slots], [0, 3]);
    assert.deepEqual(r.profiles, [{ name: 'Sam', avatar: 'cube', colour: '#14b8a6' }], 'the look\'s favourite colour, as a colour');
    assert.deepEqual(r.top.map(g => [g.id, g.plays]), [['pop-party', 3], ['sky-painter', 1]]);
    assert.equal(r.top[1].title, 'Sky Painter', 'an app game\'s name, when the Store hasn\'t it');
    assert.equal(r.tried, 2);
    assert.equal((await call('GET', '/api/admin/families/nope')).status, 404);
  } finally { await s.close(); }
});

test('families.csv: the current filter, quoted, and safe to open in a spreadsheet', async () => {
  const { s, call } = await fresh();
  try {
    addFamily(s.db, { name: 'The "Quoted", Family', email: 'q@example.com', kids: ['Ann', 'Bo'], plays: [ago(1)] });
    addFamily(s.db, { name: '=HYPERLINK("http://evil")', email: '+sum@example.com', joined: ago(1) });
    const all = await call('GET', '/api/admin/families.csv');
    assert.equal(all.status, 200);
    assert.match(all.headers.get('content-type'), /^text\/csv/);
    assert.match(all.headers.get('content-disposition'), /^attachment; filename="orlis-families-\d{4}-\d{2}-\d{2}\.csv"$/);
    const lines = all.text.split('\r\n').filter(Boolean);
    assert.equal(lines[0], 'household id,family,grown-up emails,profiles,status,last played,plays,games made,game slots,joined');
    assert.equal(lines.length, 4, 'a header and three families');
    assert.ok(all.text.includes('"The ""Quoted"", Family"'), 'quotes doubled');
    assert.ok(all.text.includes('Ann; Bo'));
    assert.ok(all.text.includes(`"'=HYPERLINK(""http://evil"")"`), 'a formula is made plain text');
    assert.ok(all.text.includes(`'+sum@example.com`));
    /* the filter, and no paging */
    const active = await call('GET', '/api/admin/families.csv?status=active');
    assert.equal(active.text.split('\r\n').filter(Boolean).length, 2);
    const searched = await call('GET', '/api/admin/families.csv?q=quoted');
    assert.equal(searched.text.split('\r\n').filter(Boolean).length, 2);
    for (let i = 0; i < 30; i++) addFamily(s.db, { name: `Family ${i}` });
    assert.equal((await call('GET', '/api/admin/families.csv')).text.split('\r\n').filter(Boolean).length, 34, 'all of them, not a page');
  } finally { await s.close(); }
});

/* a game in the Store (a .orlis file) */
const orlis = (id, name, { version = '1.0', by = '', tags = [], starter = false } = {}) =>
  writeOrlis({ 'manifest.json': JSON.stringify({ format: 1, id, name, version, kit: 2, blurb: `${name}.`, by, tags, starter, icon: { cols: ['#3da9ff', '#8b5cf6'], glyph: '<circle cx="50" cy="50" r="20"/>' } }), 'game.js': 'export default {};' });

test('games: status, featured slot, plays and families in the last week, categories, chips and sort', async () => {
  const { s, call, owner } = await fresh();
  try {
    await s.store.add('pop-party', orlis('pop-party', 'Pop Party', { tags: ['party'] }));
    await s.store.add('leaf-pile', orlis('leaf-pile', 'Leaf Pile', { tags: ['calm'] }));
    await s.store.add('frog-hop', orlis('frog-hop', 'Frog Hop', { by: 'The Smiths', tags: ['party'] }));
    await s.store.add('rocket-garden', orlis('rocket-garden', 'Rocket Garden', { version: '1.2', by: 'The Lees' }));
    const f1 = addFamily(s.db, { plays: [ago(1), ago(2), ago(3), ago(20)], game: 'pop-party' });
    const f2 = addFamily(s.db, { plays: [ago(1), ago(6)], game: 'pop-party' });
    addFamily(s.db, { plays: [ago(2)], game: 'leaf-pile' });
    addFamily(s.db, { plays: [ago(30)], game: 'leaf-pile' });
    /* frog-hop is kept to a family (hidden); a game is waiting for the owner's OK; two are featured */
    s.db.prepare('INSERT INTO reach (game_id, household_id) VALUES (?, ?)').run('frog-hop', f1.hid);
    s.db.prepare("INSERT INTO submissions (id, game_id, name, version, account_id, bytes, sha256, status, created_at) VALUES ('s1', 'new-game', 'New Game', '1.0', ?, 100, 'ab', 'waiting', ?)").run(f2.aid, ago(1));
    s.db.prepare("INSERT INTO submissions (id, game_id, name, version, account_id, bytes, sha256, status, created_at, decided_at) VALUES ('s2', 'old-game', 'Old Game', '1.0', ?, 100, 'cd', 'declined', ?, ?)").run(f2.aid, ago(5), ago(4));
    assert.equal((await call('POST', '/api/store/pop-party/feature', { on: true })).status, 200);
    await call('POST', '/api/store/leaf-pile/feature', { on: true });
    const all = await call('GET', '/api/admin/games?per=100&sort=title&dir=asc');
    assert.equal(all.status, 200);
    assert.deepEqual(all.rows.filter(g => g.version !== 'built in').map(g => g.title), ['Frog Hop', 'Leaf Pile', 'New Game', 'Pop Party', 'Rocket Garden']);
    assert.deepEqual(all.rows.filter(g => g.version === 'built in').map(g => g.title).sort(), ['Animal Gym', 'Cubion’s Long Way Home', 'Keep It Up!', 'Peekaboo Garden', 'Pterry Flight', 'Save the Harvest', 'Sky Painter', 'Sleepy Bear', 'Stack It High'], 'the games built into Orlis Play are listed too (a Store game of the same id stands for it)');
    const g = Object.fromEntries(all.rows.map(x => [x.title, x]));
    assert.deepEqual([g['Pop Party'].plays, g['Pop Party'].fams], [5, 2], 'plays and families in the last 7 days only');
    assert.deepEqual([g['Leaf Pile'].plays, g['Leaf Pile'].fams], [1, 1]);
    assert.equal(g['Pop Party'].slot, 1); assert.equal(g['Leaf Pile'].slot, 2); assert.equal(g['Rocket Garden'].slot, null);
    assert.deepEqual([g['Pop Party'].status, g['Frog Hop'].status, g['New Game'].status], ['live', 'hidden', 'review']);
    assert.equal(g['Pop Party'].key, 'pop-party@1.0'); assert.equal(g['Rocket Garden'].key, 'rocket-garden@1.2');
    assert.equal(g['Pop Party'].maker, 'Orlis'); assert.equal(g['Frog Hop'].maker, 'The Smiths'); assert.equal(g['New Game'].maker, 'The Smiths', 'a waiting game: its maker\'s family');
    assert.deepEqual(all.counts, { all: 14, live: 12, featured: 2, review: 1, hidden: 1 });
    assert.deepEqual(all.cats, ['Built in', 'Calm', 'In review', 'Other', 'Party']);
    assert.equal(all.featuredTotal, 2);
    /* chips, category, search, sort */
    assert.deepEqual((await call('GET', '/api/admin/games?status=featured&sort=feat&dir=desc')).rows.map(x => x.title), ['Pop Party', 'Leaf Pile']);
    assert.deepEqual((await call('GET', '/api/admin/games?status=review')).rows.map(x => x.title), ['New Game']);
    assert.deepEqual((await call('GET', '/api/admin/games?status=hidden')).rows.map(x => x.title), ['Frog Hop']);
    assert.deepEqual((await call('GET', '/api/admin/games?cat=Party&sort=title')).rows.map(x => x.title), ['Frog Hop', 'Pop Party']);
    assert.deepEqual((await call('GET', '/api/admin/games?q=rocket')).rows.map(x => x.title), ['Rocket Garden']);
    assert.deepEqual((await call('GET', '/api/admin/games?q=lees')).rows.map(x => x.title), ['Rocket Garden'], 'by its maker');
    assert.deepEqual((await call('GET', '/api/admin/games?sort=plays&dir=desc')).rows.map(x => x.title).slice(0, 2), ['Pop Party', 'Leaf Pile']);
    assert.equal((await call('GET', '/api/admin/games?sort=sha256%3B--')).status, 200, 'a bad sort is the default');
    assert.equal((await call('GET', '/api/admin/games?per=2&page=2&sort=title&dir=asc')).rows.length, 2);
    /* one game, for the panel */
    const one = await call('GET', '/api/admin/games/pop-party');
    assert.deepEqual([one.title, one.plays.all, one.plays.families], ['Pop Party', 6, 2]);
    assert.equal((await call('GET', '/api/admin/games/nope')).status, 404);
    void owner;
  } finally { await s.close(); }
});

test('activity: newest first, a short code for each kind, heads-ups marked, keyset paging', async () => {
  const { s, call } = await fresh();
  try {
    const add = s.db.prepare('INSERT INTO history (at, who, what, game_id, name, version, note) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const base = Date.now() - 3600e3;
    for (let i = 0; i < 70; i++){
      const what = ['joined', 'asked-to-join', 'featured', 'sent', 'first-play'][i % 5];
      add.run(new Date(base + i * 1000).toISOString(), what === 'featured' ? 'owner@example.com' : `u${i}@example.com`, what, what === 'first-play' || what === 'featured' || what === 'sent' ? 'pop-party' : null, what === 'first-play' || what === 'featured' || what === 'sent' ? 'Pop Party' : null, what === 'sent' ? '1.0' : null, what === 'asked-to-join' ? `u${i}@example.com · The Fam${i}s` : what === 'first-play' ? `The Fam${i}s · 2 players` : `note ${i}`);
    }
    const first = await call('GET', '/api/admin/activity?limit=30');
    assert.equal(first.status, 200);
    assert.equal(first.rows.length, 30);
    assert.equal(first.total, 70);
    assert.ok(first.next);
    assert.deepEqual(first.rows.map(r => r.id), first.rows.map(r => r.id).sort((a, b) => b - a), 'newest first');
    assert.deepEqual(Object.keys(first.rows[0]).sort(), ['at', 'code', 'head', 'id', 'subject', 'text']);
    /* keyset paging: every row once, none missed, even as a new one comes in */
    const seen = first.rows.map(r => r.id);
    let page = first;
    add.run(new Date().toISOString(), 'late@example.com', 'joined', null, null, null, 'late@example.com');
    while (page.next){ page = await call('GET', `/api/admin/activity?limit=30&before=${page.next}`); seen.push(...page.rows.map(r => r.id)); }
    assert.equal(seen.length, 70, 'the new one is newer than where we were: not in the later pages');
    assert.equal(new Set(seen).size, 70);
    assert.equal(page.next, null);
    assert.equal((await call('GET', '/api/admin/activity?limit=30')).total, 71);
    /* by time instead of by number */
    const byTime = await call('GET', `/api/admin/activity?limit=5&before=${encodeURIComponent(new Date(base + 10 * 1000).toISOString())}`);
    assert.equal(byTime.rows.length, 5); assert.ok(byTime.rows.every(r => Date.parse(r.at) < base + 10 * 1000));
    /* what the kinds are called, and which are heads-ups */
    const text = await call('GET', '/api/admin/activity?limit=100');
    const by = (code) => text.rows.filter(r => r.code === code);
    assert.ok(by('account.new').every(r => r.head === true));
    assert.ok(by('join.ask').every(r => r.head === true));
    assert.ok(by('play.first').every(r => r.head === true));
    assert.ok(by('owner.feature').every(r => r.head === false));
    assert.ok(by('game.sent').every(r => r.head === false));
    assert.match(by('join.ask')[0].text, /^asked to join · The Fam\d+s$/);
    assert.match(by('play.first')[0].subject, /^The Fam\d+s$/);
    assert.match(by('play.first')[0].text, /^first play: Pop Party · 2 players$/);
    assert.equal(by('owner.feature')[0].subject, 'You', 'the owner\'s own actions are "You"');
    assert.match(by('game.sent')[0].text, /^sent for your OK Pop Party@1\.0/);
    /* type chips and search */
    const types = { joins: ['account.new', 'join.ask'], plays: ['play.first'], games: ['game.sent', 'owner.feature'], owner: ['owner.feature'] };
    for (const [type, codes] of Object.entries(types)){
      const r = await call('GET', `/api/admin/activity?limit=100&type=${type}`);
      assert.ok(r.rows.length > 0, type);
      assert.ok(r.rows.every(x => codes.includes(x.code)), `${type}: ${[...new Set(r.rows.map(x => x.code))]}`);
    }
    assert.equal((await call('GET', '/api/admin/activity?type=plays')).total, 14);
    assert.equal((await call('GET', '/api/admin/activity?type=nonsense')).total, 71, 'an unknown type is all');
    assert.equal((await call('GET', '/api/admin/activity?q=u6%40example')).total, 1);
    assert.equal((await call('GET', '/api/admin/activity?q=pop-party&type=plays')).total, 14, 'search by game id');
    assert.equal((await call('GET', '/api/admin/activity?q=%25')).total, 0, 'a % is just a %');
    /* every kind history writes has a code; the chips only name codes that exist */
    const { WHAT } = await import('../src/history.js');
    for (const w of WHAT) assert.ok(CODES[w], `${w} has a code`);
    for (const list of Object.values(ACTIVITY_TYPES)) for (const k of list) assert.ok(CODES[k]);
    assert.deepEqual([...HEADS_UP].sort(), ['account.new', 'join.ask', 'play.first']);
  } finally { await s.close(); }
});

test('a family\'s first game is in the history (and a backup, and the owner\'s own doings)', async () => {
  const { s, call, owner } = await fresh({ tailscaleJoin: () => true });
  try {
    await s.store.add('pop-party', orlis('pop-party', 'Pop Party'));
    const sam = await call('POST', '/api/signup', grownUp('sam@example.com', { family: 'The Bs' }), { manage: false });
    await call('POST', '/api/plays', { gameId: 'pop-party', value: 5, secs: 60, players: 2 }, { token: sam.token, manage: false });
    await call('POST', '/api/plays', { gameId: 'pop-party', value: 9, secs: 60, players: 2 }, { token: sam.token, manage: false });
    await call('POST', '/api/plays', { gameId: 'pop-party', value: 5, secs: 60 }, { token: owner.token, manage: false });
    /* (it's written a moment after the answer: wait for it, then a little more in case another was on its way) */
    for (let i = 0; i < 100 && !(await call('GET', '/api/admin/activity?type=plays')).rows.length; i++) await new Promise(r => setTimeout(r, 30));
    await new Promise(r => setTimeout(r, 100));
    const firsts = (await call('GET', '/api/admin/activity?type=plays')).rows;
    assert.equal(firsts.length, 1, 'once, and not for the owner\'s family');
    assert.equal(firsts[0].code, 'play.first'); assert.equal(firsts[0].head, true);
    assert.equal(firsts[0].subject, 'The Bs'); assert.equal(firsts[0].text, 'first play: Pop Party · 2 players');
    /* a backup made on request */
    assert.equal((await call('POST', '/api/backups')).status, 201);
    const b = (await call('GET', '/api/admin/activity?type=backup')).rows;
    assert.equal(b.length, 1); assert.equal(b[0].code, 'backup'); assert.match(b[0].text, /^ok · manual · \d+ KB$/);
  } finally { await s.close(); }
});

test('queue: joins, beta asks and games waiting, oldest first, and the allowlist', async () => {
  const { s, call } = await fresh();
  try {
    const f = addFamily(s.db, { name: 'The Games', email: 'maker@example.com' });
    s.db.prepare("INSERT INTO submissions (id, game_id, name, version, account_id, bytes, sha256, status, created_at, tried_at) VALUES ('s1', 'g1', 'G One', '1.0', ?, 2048, 'ab', 'waiting', ?, ?)").run(f.aid, ago(0.5), ago(0.1));
    await call('POST', '/api/signup', grownUp('late@example.com', { name: 'Late' }), { manage: false });
    s.db.prepare("INSERT INTO beta (email, status, created_at) VALUES ('beta@example.com', 'requested', ?)").run(ago(2));
    s.db.prepare("INSERT INTO beta (email, status, created_at, decided_at) VALUES ('in@example.com', 'joined', ?, ?)").run(ago(9), ago(9));
    addFamily(s.db, { name: 'The Early', email: 'early@example.com', pending: 1, joined: ago(1) });
    const r = await call('GET', '/api/admin/queue');
    assert.deepEqual(r.items.map(x => x.kind), ['beta', 'join', 'game', 'join'], 'oldest first');
    assert.deepEqual(r.counts, { all: 4, joins: 3, games: 1 });
    assert.equal(r.items[2].tried, true); assert.equal(r.items[2].gameId, 'g1'); assert.equal(r.items[2].family, 'The Games');
    assert.deepEqual(r.allowlist.map(a => a.email), ['in@example.com']);
    assert.equal(r.mail, true);
    /* what Approve does is the routes that were there: the join goes through them, and the numbers follow */
    const join = r.items.find(x => x.kind === 'join' && x.email === 'early@example.com');
    assert.equal((await call('POST', `/api/joins/${join.id}/approve`)).status, 200);
    assert.equal((await call('GET', '/api/admin/queue')).counts.joins, 2);
    assert.equal((await call('POST', '/api/beta/approve', { email: 'beta@example.com' })).status, 200);
    assert.equal((await call('GET', '/api/admin/queue')).counts.joins, 1);
  } finally { await s.close(); }
});

test('overview: health, stats, 14-day series, the queue\'s first four, activity and top games', async () => {
  const { s, call } = await fresh();
  try {
    await s.store.add('pop-party', orlis('pop-party', 'Pop Party'));
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const at = (d) => new Date(Math.min(Date.now() - 1000, today.getTime() - d * DAY)).toISOString();
    addFamily(s.db, { joined: ago(1), plays: [at(0), at(0), at(1), at(10)] });
    addFamily(s.db, { joined: ago(40), plays: [at(0)] });
    for (let i = 0; i < 6; i++) addFamily(s.db, { pending: 1, joined: ago(1 + i / 10) });
    await call('POST', '/api/backups');
    stats.reset();
    const o = await call('GET', '/api/admin/overview');
    assert.equal(o.status, 200);
    assert.deepEqual(Object.keys(o.json).sort(), ['activity', 'health', 'now', 'queue', 'series', 'stats', 'top']);
    assert.deepEqual(Object.keys(o.health).sort(), ['backup', 'disk', 'errors', 'funnel', 'server', 'smtp']);
    /* the internet door is open (the test opened it); there's no public address */
    assert.deepEqual([o.health.funnel.door, o.health.funnel.publicUrl, o.health.funnel.level], [true, null, 'ok']);
    assert.deepEqual([o.health.smtp.ready, o.health.smtp.user, o.health.smtp.level], [true, 'owner@example.com', 'ok']);
    assert.equal(o.health.backup.count, 1); assert.equal(o.health.backup.last.reason, 'manual'); assert.equal(o.health.backup.level, 'ok'); assert.ok(o.health.backup.bytes > 0);
    assert.ok(o.health.disk.freeBytes > 0 && o.health.disk.usedPct >= 0 && o.health.disk.usedPct <= 100);
    assert.equal(o.health.disk.level, diskLevel(o.health.disk.usedPct));
    assert.equal(o.health.server.version, '0.1.0'); assert.ok(o.health.server.uptimeSecs >= 0);
    assert.deepEqual([o.health.errors.count24h, o.health.errors.level], [0, 'ok']);
    /* stats: owner + 2 + 6 waiting (all counted: they're families) */
    assert.equal(o.stats.families.total, 9);
    assert.equal(o.stats.families.newThisWeek, 8, 'all but the one from 40 days ago... and the owner\'s, who joined just now');
    assert.equal(o.stats.active7.households, 2);
    assert.equal(o.stats.active7.pct, Math.round(2 / 9 * 100));
    assert.equal(o.stats.plays.today, 3, 'today\'s plays');
    assert.deepEqual(o.stats.queue, { all: 6, joins: 6, games: 0 });
    assert.equal(o.stats.games, 1);
    /* the series: 14 days, oldest first, ending today */
    assert.equal(o.series.days.length, 14); assert.equal(o.series.newFamilies.length, 14); assert.equal(o.series.plays.length, 14);
    assert.equal(o.series.newFamilies.reduce((x, y) => x + y, 0), 8 + 0, 'the families that joined in the last 14 days');
    assert.equal(o.series.plays.reduce((x, y) => x + y, 0), 5, 'the plays in the last 14 days');
    assert.deepEqual(o.series.days, [...o.series.days].sort());
    assert.equal(o.series.plays.at(-1), o.stats.plays.today);
    /* the queue's first four, the latest 8 activity rows, the top games */
    assert.equal(o.queue.items.length, 4); assert.deepEqual(o.queue.counts, o.stats.queue);
    assert.ok(o.activity.length <= 8);
    assert.deepEqual(o.top.map(g => [g.id, g.title, g.plays, g.fams, g.featured]), [['pop-party', 'Pop Party', 4, 2, false]]);
  } finally { await s.close(); }
});

test('the health strip\'s colours', () => {
  assert.deepEqual([0, 79, 80, 94, 95, 100].map(diskLevel), ['ok', 'ok', 'warn', 'warn', 'bad', 'bad']);
  const now = Date.parse('2026-11-24T12:00:00Z');
  assert.equal(backupLevel(null, now), 'warn');
  assert.equal(backupLevel('2026-11-24T03:00:00Z', now), 'ok');
  assert.equal(backupLevel('2026-11-22T13:00:00Z', now), 'warn');
  assert.equal(backupLevel('2026-11-21T12:00:00Z', now), 'bad');
  assert.deepEqual([0, 1, 9, 10].map(errorLevel), ['ok', 'warn', 'warn', 'bad']);
});

test('the health strip reads the disk (statfs on the data folder), and goes amber and red', async () => {
  for (const [bavail, pct, level] of [[500, 50, 'ok'], [200, 80, 'warn'], [50, 95, 'bad']]){
    const { s, call } = await fresh({ statfs: (dir) => { assert.match(dir, /orlis-admin-/); return { blocks: 1000, bsize: 4096, bavail }; } });
    try {
      const d = (await call('GET', '/api/admin/overview')).health.disk;
      assert.deepEqual([d.usedPct, d.level, d.freeBytes, d.totalBytes], [pct, level, bavail * 4096, 1000 * 4096]);
    } finally { await s.close(); }
  }
});

test('settings: what the page shows that nothing else tells it', async () => {
  const { s, call } = await fresh({ publicUrl: 'https://orlis.example.ts.net' });
  try {
    stats.reset();
    const r = await call('GET', '/api/admin/settings');
    assert.equal(r.status, 200);
    assert.equal(r.name, 'Orlis'); assert.equal(r.version, '0.1.0');
    assert.deepEqual(r.internet, { door: s.internetPort, publicUrl: 'https://orlis.example.ts.net', lastSeen: null });
    assert.deepEqual(r.heads, ['join request', 'joined', 'first play']);
    assert.equal(r.defaultSlots, 3);
    assert.equal(r.joining.mode, 'allowlist + ask');
    assert.equal(r.mail.ready, true); assert.equal(r.mail.user, 'owner@example.com');
    assert.deepEqual(Object.keys(r.backups.keep).sort(), ['before-restore', 'daily', 'manual', 'update']);
    assert.match(r.dataDir, /orlis-admin-/);
    assert.ok(Array.isArray(r.lan));
    /* the door: a request that came through it is noticed */
    await fetch(`http://127.0.0.1:${s.internetPort}/api/hello`);
    await new Promise(r2 => setTimeout(r2, 30));
    assert.ok((await call('GET', '/api/admin/settings')).internet.lastSeen, 'last seen through the internet door');
  } finally { await s.close(); }
});

test('errors and p95: the HTTP layer keeps the last day\'s 5xx and the last ~2,000 response times', async () => {
  stats.reset();
  const web = makeServer([['GET', '/ok', () => ({ ok: true })], ['GET', '/slow', async () => { await new Promise(r => setTimeout(r, 40)); return {}; }], ['GET', '/boom', () => { throw new Error('a bug'); }]]);
  await new Promise(r => web.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${web.address().port}`;
  const log = console.error; console.error = () => {};      /* (the server logs the bug it was handed) */
  try {
    for (let i = 0; i < 19; i++) await fetch(base + '/ok').then(r => r.text());
    await fetch(base + '/slow').then(r => r.text());
    assert.equal((await fetch(base + '/boom')).status, 500);
    assert.equal((await fetch(base + '/nothing')).status, 404, 'a 404 is no error');
    await new Promise(r => setTimeout(r, 20));
    const a = stats.snapshot();
    assert.equal(a.errors24h, 1, 'only the 5xx');
    assert.equal(a.samples, 22);
    assert.ok(a.p95 >= 0 && a.p95 < 40, `p95 is the 95th of 22 times: ${a.p95}`);
    /* the p95 sits on the slow tail: 20 of 100 slow ones */
    stats.reset();
    for (let i = 0; i < 100; i++) stats.record(200, i < 80 ? 5 : 100);
    assert.equal(stats.snapshot().p95, 100);
    stats.reset();
    for (let i = 0; i < 100; i++) stats.record(200, i < 96 ? 5 : 100);
    assert.equal(stats.snapshot().p95, 5);
    /* a ring: only the last 2,000 are kept */
    stats.reset();
    for (let i = 0; i < 2500; i++) stats.record(200, i < 500 ? 900 : 1);
    const full = stats.snapshot();
    assert.equal(full.samples, 2000); assert.equal(full.p95, 1, 'the 500 oldest, slow ones are gone');
    /* errors older than a day aren't counted */
    stats.reset();
    stats.record(500, 1); stats.record(503, 1); stats.record(404, 1);
    assert.equal(stats.snapshot().errors24h, 2);
    assert.equal(stats.snapshot(Date.now() + 25 * 3600e3).errors24h, 0);
    assert.deepEqual(Object.keys(stats.snapshot()).sort(), ['errors24h', 'lastInternet', 'p95', 'samples']);
    assert.equal(stats.snapshot().lastInternet, null);
    stats.record(200, 1, true);
    assert.ok(stats.snapshot().lastInternet > 0);
  } finally { console.error = log; await new Promise(r => web.close(r)); web.closeAllConnections?.(); stats.reset(); }
});

test('the overview counts the errors and the response times the server has seen', async () => {
  const { s, call } = await fresh();
  try {
    stats.reset();
    stats.record(500, 3); stats.record(502, 3);
    for (let i = 0; i < 10; i++) stats.record(200, 20);
    const o = await call('GET', '/api/admin/overview');
    assert.equal(o.health.errors.count24h, 2); assert.equal(o.health.errors.level, 'warn');
    assert.ok(o.health.errors.p95ms >= 20 - 1 && o.health.errors.p95ms < 100, `p95 ${o.health.errors.p95ms}`);
  } finally { stats.reset(); await s.close(); }
});

test('the page: one file, nothing from the internet, its key kept out of sight', async () => {
  const { s, call } = await fresh();
  try {
    const r = await fetch(`http://127.0.0.1:${s.port}/manage`);
    assert.equal(r.status, 200);
    const csp = r.headers.get('content-security-policy');
    assert.match(csp, /default-src 'none'/); assert.match(csp, /connect-src 'self'/); assert.match(csp, /font-src data:/);
    assert.doesNotMatch(csp, /https?:/);
    const html = await r.text();
    assert.doesNotMatch(html, /https?:\/\/(?!www\.w3\.org)/, 'no address to fetch anything from (but SVG\'s own namespace)');
    assert.doesNotMatch(html, /<link |<script src|@import/);
    assert.match(html, /replaceState/, 'the key is taken out of the address');
    assert.match(html, /@font-face\{ font-family:"Outfit"/);
    /* only this laptop */
    assert.equal((await fetch(`http://127.0.0.1:${s.internetPort}/manage`)).status, 404);
    void call;
  } finally { await s.close(); }
});

test('the lists\' indexes: an older database gets them, and the queries use them', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { openDb, STEPS } = await import('../src/db.js');
  const file = join(mkdtempSync(join(tmpdir(), 'orlis-idx-')), 'orlis.db');
  const old = new DatabaseSync(file);
  old.exec('CREATE TABLE schema_version (version INTEGER NOT NULL)');
  for (const step of STEPS.slice(0, 13)) old.exec(step);       /* (what a server from before the management page's lists has) */
  old.exec('INSERT INTO schema_version VALUES (13)');
  old.close();
  const db = openDb(file);
  assert.equal(db.prepare('SELECT version FROM schema_version').get().version, STEPS.length);
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map(r => r.name);
  for (const want of ['plays_week', 'plays_game_at', 'plays_at', 'accounts_household', 'accounts_pending', 'households_created', 'history_what', 'submissions_status']) assert.ok(names.includes(want), want);
  const plan = (sql, ...args) => db.prepare('EXPLAIN QUERY PLAN ' + sql).all(...args).map(r => r.detail).join(' | ');
  /* a family's plays: by the (family, time) index, never the whole table */
  assert.match(plan('SELECT COUNT(*), MAX(at) FROM plays WHERE household_id = ?', 'h'), /USING COVERING INDEX plays_week/);
  /* a week of plays (the games and the Overview): the time index, covering */
  assert.match(plan('SELECT game_id, COUNT(*), COUNT(DISTINCT household_id), AVG(secs) FROM plays INDEXED BY plays_at WHERE at >= ? GROUP BY game_id', 'x'), /SEARCH plays USING COVERING INDEX plays_at/);
  assert.match(plan('SELECT COUNT(*) FROM plays WHERE at >= ? AND at < ?', 'a', 'b'), /plays_at/);
  assert.match(plan('SELECT * FROM history WHERE what IN (?) ORDER BY id DESC LIMIT 30', 'x'), /history_what|SCAN history/);
  assert.match(plan('SELECT * FROM history WHERE id < ? ORDER BY id DESC LIMIT 31', 5), /SEARCH history USING INTEGER PRIMARY KEY/);
  assert.match(plan('SELECT COUNT(*) FROM accounts WHERE household_id = ? AND pending = 1', 'h'), /accounts_household/);
  assert.match(plan('SELECT COUNT(*) FROM creations WHERE household_id = ?', 'h'), /creations_household/, 'games made, per family');
  db.close();
});
