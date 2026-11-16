import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../src/app.js';
import { maker } from '../src/maker.js';

const grownUp = (email, extra = {}) => ({ email, password: 'correct horse', name: 'Sam', adult: true, device: 'Laptop', ...extra });
const recipe = (thing, extra = {}) => ({ start: 'new', view: 'hands', action: 'catch', thing, place: 'a meadow', twists: [], ages: '4-6', energy: 'calm', minutes: 5, players: 2, words: '', ...extra });

async function fresh(){
  const dataDir = mkdtempSync(join(tmpdir(), 'orlis-reach-'));
  const s = await start({ dataDir, port: 0, discoveryPort: false, name: 'Test', tailscaleJoin: () => true, notify: () => {} });
  const call = async (method, path, body, token, manage) => {
    const r = await fetch(`http://127.0.0.1:${s.port}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(manage ? { 'X-Orlis-Manage': s.manageKey } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, ...(await r.json().catch(() => ({}))) };
  };
  const owner = await call('POST', '/api/signup', grownUp('owner@example.com'));
  const bro = await call('POST', '/api/signup', grownUp('bro@example.com', { family: 'Uncle B' }));
  const dad = await call('POST', '/api/signup', grownUp('dad@example.com', { family: 'Grandpa' }));
  /* a request, made (Claude Code standing in) and OK'd: in the Store */
  const makeOne = async (thing, name) => {
    const asked = await call('POST', '/api/requests', recipe(thing), bro.token);
    await call('POST', `/api/requests/${asked.id}/make`, null, null, true);
    const m = maker({ base: `http://127.0.0.1:${s.port}`, key: s.manageKey, dataDir, every: 1e9, log: () => {},
      run: async (dir) => { const f = join(dir, 'orlis.json'); const x = JSON.parse(readFileSync(f, 'utf8')); x.name = name; x.blurb = `Catch ${thing}`; writeFileSync(f, JSON.stringify(x, null, 2)); } });
    await m.tick(); m.stop();
    const sub = (await call('GET', '/api/submissions', null, null, true)).submissions.find(x => x.state === 'waiting');
    await call('POST', `/api/submissions/${sub.id}/tried`, { secs: 30 }, null, true);
    return (await call('POST', `/api/submissions/${sub.id}/approve`, null, null, true)).game;
  };
  return { s, call, owner, bro, dad, makeOne };
}

test('making is private: a family\'s game is in their own Store, until the owner shares it with everyone', async () => {
  const { s, call, owner, bro, dad, makeOne } = await fresh();
  try {
    const g = await makeOne('fireflies', 'Firefly Jar');
    assert.equal(g.reach, 'family');
    const sees = async (who) => (await call('GET', '/api/store', null, who.token)).games.map(x => x.id).includes(g.id);
    assert.equal(await sees(bro), true, 'their family sees it');
    assert.equal(await sees(dad), false, 'another family doesn\'t');
    assert.equal(await sees(owner), true, 'the owner sees everything');
    assert.equal((await fetch(`http://127.0.0.1:${s.port}/api/store/${g.id}/file`, { headers: { Authorization: `Bearer ${dad.token}` } })).status, 404, 'nor can they download it');
    /* the management page shows it as theirs, and the owner shares it */
    const listed = (await call('GET', '/api/store', null, null, true)).games.find(x => x.id === g.id);
    assert.equal(listed.reach, 'family');
    assert.equal((await call('POST', `/api/store/${g.id}/reach`, { everyone: true }, null, true)).reach, 'everyone');
    assert.equal(await sees(dad), true, 'shared: everyone sees it');
    /* and back to their family */
    await call('POST', `/api/store/${g.id}/reach`, { everyone: false }, null, true);
    assert.equal(await sees(dad), false);
    const said = (await call('GET', '/api/history', null, null, true)).history.map(x => x.what);
    assert.ok(said.includes('shared') && said.includes('family-only'));
    /* only the owner shares */
    assert.equal((await call('POST', `/api/store/${g.id}/reach`, { everyone: true }, bro.token)).status, 403);
  } finally { await s.close(); }
});

test('limits that keep making thoughtful: 3 slots (the owner can give more), 3 a day, and nothing asked for twice', async () => {
  const { s, call, owner, bro } = await fresh();
  try {
    assert.deepEqual((await call('GET', '/api/requests', null, bro.token)).slots, { used: 0, total: 3 });
    for (const t of ['fireflies', 'snowflakes']) assert.equal((await call('POST', '/api/requests', recipe(t), bro.token)).status, 201);
    /* the same again: caught */
    const twice = await call('POST', '/api/requests', recipe('fireflies'), bro.token);
    assert.equal(twice.error, 'asked_already');
    assert.equal((await call('POST', '/api/requests', recipe('raindrops'), bro.token)).status, 201);
    /* slots used up */
    assert.deepEqual((await call('GET', '/api/requests', null, bro.token)).slots, { used: 3, total: 3 });
    assert.equal((await call('POST', '/api/requests', recipe('apples'), bro.token)).error, 'no_slots');
    /* taking one back frees its slot - but 3 a day is the pace */
    const mine = (await call('GET', '/api/requests', null, bro.token)).requests;
    await call('DELETE', `/api/requests/${mine[0].id}`, null, bro.token);
    assert.equal((await call('POST', '/api/requests', recipe('apples'), bro.token)).error, 'slow_down');
    /* the owner gives more slots (it's in the history); the owner has no limits */
    const fams = (await call('GET', '/api/households', null, null, true)).households;
    const b = fams.flatMap(f => f.accounts).find(a => a.email === 'bro@example.com');
    assert.equal(b.slots, 3);
    assert.equal((await call('POST', `/api/accounts/${b.id}/slots`, { slots: 5 }, null, true)).slots, 5);
    assert.ok((await call('GET', '/api/history', null, null, true)).history.some(x => x.what === 'slots'));
    for (const t of ['a', 'b', 'c', 'd', 'e'].map(x => 'thing ' + x)) assert.equal((await call('POST', '/api/requests', recipe(t), owner.token)).status, 201, 'the owner: no limits');
    assert.equal((await call('GET', '/api/requests', null, owner.token)).slots, null);
  } finally { await s.close(); }
});
