import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../src/app.js';
import { writeOrlis, readOrlis, manifestOf } from '../src/orlis-file.js';

const ICON = { cols: ['#6366f1', '#c084fc'], glyph: '<circle cx="50" cy="50" r="30" fill="#fff"/>' };
const game = (id, { version = '1.0', code = 'postMessage({ t: "ready" });', kit = 2, blurb = 'Flap to fly', icon = ICON, name = 'Bird Hoops', cover } = {}) =>
  writeOrlis({ 'manifest.json': JSON.stringify({ format: 1, kit, id, name, version, blurb, players: [1, 4], icon, cover, by: 'Me, honest' }), 'game.js': code });

async function server(){
  const dataDir = mkdtempSync(join(tmpdir(), 'orlis-sub-'));
  const s = await start({ everyoneCreates: false, dataDir, port: 0, discoveryPort: false, starters: [{ name: 'pop-party.orlis', data: writeOrlis({ 'manifest.json': JSON.stringify({ format: 1, kit: 2, id: 'pop-party', name: 'Pop Party', version: '1.1', by: 'Orlis Play', blurb: 'x' }), 'game.js': 'x' }) }] });
  const base = `http://127.0.0.1:${s.port}`;
  const call = async (method, path, body, token, extra = {}) => {
    const file = Buffer.isBuffer(body);
    const r = await fetch(base + path, { method, headers: { 'Content-Type': file ? 'application/octet-stream' : 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, body: file ? body : body ? JSON.stringify(body) : undefined });
    const type = r.headers.get('content-type') || '';
    return type.includes('json') ? { status: r.status, ...(await r.json()) } : { status: r.status, bytes: Buffer.from(await r.arrayBuffer()) };
  };
  const owner = await call('POST', '/api/signup', { email: 'deep@example.com', password: 'correct horse', name: 'Deep', adult: true, family: 'The Patels' });
  const inv = await call('POST', '/api/invites', { household: 'new', role: 'creator' }, owner.token);
  const friend = await call('POST', '/api/signup', { email: 'max@example.com', password: 'correct horse', name: 'Max', adult: true, invite: inv.code });
  const inv2 = await call('POST', '/api/invites', { household: 'new' }, owner.token);
  const player = await call('POST', '/api/signup', { email: 'pat@example.com', password: 'correct horse', name: 'Pat', adult: true, invite: inv2.code });
  return { s, dataDir, call, owner: owner.token, friend: friend.token, player: player.token };
}


test('Test then Publish: a creator\'s game plays on their family\'s TV, then lives in their family\'s Play page, with no owner in between', async () => {
  const { s, call, owner, friend, player } = await server();
  try {
    assert.equal((await call('POST', '/api/drafts', game('bird-hoops'), player)).status, 403, 'only creators');
    assert.equal((await call('POST', '/api/drafts', game('bird-hoops', { code: 'fetch("x")' }), friend)).status, 400, 'the same checks');
    const t = await call('POST', '/api/drafts', game('bird-hoops'), friend);
    assert.equal(t.status, 201);
    /* the family's TV sees it (any member of the family), nobody else does */
    const sees = async (tok) => (await call('GET', '/api/drafts', null, tok)).drafts.map(d => d.id);
    assert.deepEqual(await sees(friend), ['bird-hoops']);
    assert.deepEqual(await sees(owner), [], 'another family has no drafts of this one');
    assert.equal((await call('GET', '/api/drafts/bird-hoops/file', null, friend)).status, 200);
    assert.equal((await call('GET', '/api/drafts/bird-hoops/file', null, owner)).status, 404);
    assert.equal((await call('GET', '/api/store', null, friend)).games.some(g => g.id === 'bird-hoops'), false, 'testing is not in the Store');
    assert.equal((await call('POST', '/api/submissions', game('bird-hoops'), owner)).status, 201, 'the owner may use that id until it is published');
    /* publish: in the Store for the family only, draft gone */
    assert.equal((await call('POST', '/api/drafts/nope/publish', null, friend)).status, 404);
    const p = await call('POST', '/api/drafts/bird-hoops/publish', null, friend);
    assert.equal(p.status, 200); assert.equal(p.game.reach, 'family');
    assert.deepEqual(await sees(friend), []);
    assert.equal((await call('GET', '/api/store', null, friend)).games.find(g => g.id === 'bird-hoops').by, "Max's family");
    assert.equal((await call('GET', '/api/store', null, player)).games.some(g => g.id === 'bird-hoops'), false, 'other families do not see it');
    /* the same id again needs a newer version */
    await call('POST', '/api/drafts', game('bird-hoops'), friend);
    assert.equal((await call('POST', '/api/drafts/bird-hoops/publish', null, friend)).status, 409);
    await call('POST', '/api/drafts', game('bird-hoops', { version: '1.1' }), friend);
    assert.equal((await call('POST', '/api/drafts/bird-hoops/publish', null, friend)).status, 200);
    /* not another family's or Orlis Play's game */
    assert.equal((await call('POST', '/api/drafts', game('pop-party', { version: '2.0' }), friend)).status, 409);
    await call('POST', '/api/drafts', game('other'), friend);
    assert.equal((await call('DELETE', '/api/drafts/other', null, friend)).ok, true);
    assert.deepEqual(await sees(friend), []);
  } finally { await s.close(); }
});

test('the TV waits, and is answered only when a creator tests, publishes or goes away', async () => {
  const { s, call, friend, player } = await server();
    const tv = friend;      /* (the family's TV is signed in as one of the family) */
  try {
    const wait = (n, tok, ms = 3000) => call('GET', `/api/drafts/wait?since=${n}&ms=${ms}`, null, tok);
    const first = await wait(0, tv, 50);
    assert.equal(first.here, false); assert.deepEqual(first.drafts, []);
    /* quiet: nothing to say, so an empty answer, same number */
    const quiet = await wait(first.n, tv, 100);
    assert.equal(quiet.n, first.n);
    /* a Test (made while it waits) answers it at once - and the creator is here, so the draft shows */
    const pending = wait(first.n, tv, 5000);
    await new Promise(r => setTimeout(r, 150));
    await call('POST', '/api/drafts', game('bird-hoops'), friend);
    const got = await pending;
    assert.ok(got.n > first.n); assert.equal(got.here, true); assert.deepEqual(got.drafts.map(d => d.id), ['bird-hoops']);
    /* another family's TV hears nothing of it */
    const other = await wait(0, player, 50);
    assert.deepEqual(other.drafts, []);
    /* taking it off tells the TV */
    const p2 = wait(got.n, tv, 5000);
    await new Promise(r => setTimeout(r, 100));
    await call('DELETE', '/api/drafts/bird-hoops', null, friend);
    assert.deepEqual((await p2).drafts, []);
    /* "still here" from the creator's app counts as arriving */
    const p3 = wait((await p2).n, tv, 5000);
    await new Promise(r => setTimeout(r, 100));
    assert.equal((await call('POST', '/api/drafts/here', null, friend)).ok, true);
    assert.equal((await p3).here, true);
    assert.equal((await call('POST', '/api/drafts/here', null, player)).status, 403, 'only creators');
  } finally { await s.close(); }
});

test('pairing: a creator asks for a code, the laptop tool trades it once for its own sign-in', async () => {
  const { s, call, friend, player } = await server();
  try {
    assert.equal((await call('POST', '/api/pair', null, player)).status, 403, 'only creators');
    const c = await call('POST', '/api/pair', null, friend);
    assert.match(c.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.equal((await call('POST', '/api/pair/redeem', { code: 'NOPE-NOPE' })).status, 400);
    const got = await call('POST', '/api/pair/redeem', { code: c.code.toLowerCase().replace('-', ' ') });
    assert.equal(got.status, 200); assert.ok(got.token && got.email === 'max@example.com');
    assert.equal((await call('POST', '/api/pair/redeem', { code: c.code })).status, 400, 'good once');
    /* the tool's sign-in works as that creator (and Test then works with it) */
    assert.equal((await call('POST', '/api/drafts', game('bird-hoops'), got.token)).status, 201);
    /* too many wrong tries: it waits */
    let last;
    for (let i = 0; i < 9; i++) last = await call('POST', '/api/pair/redeem', { code: 'WRONGCODE' });
    assert.equal(last.status, 429);
  } finally { await s.close(); }
});
