import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../src/app.js';

const grownUp = (email, extra = {}) => ({ email, password: 'correct horse', name: 'Sam', adult: true, device: 'Laptop', ...extra });

test('joining with the owner\'s OK: no code - they ask, wait, and are let in (or not)', async () => {
  const said = [];
  const s = await start({ dataDir: mkdtempSync(join(tmpdir(), 'orlis-join-')), port: 0, discoveryPort: false, approveJoins: true, tailscaleJoin: () => false, notify: (t, x) => said.push([t, x]) });
  const call = async (method, path, body, token, manage) => {
    const r = await fetch(`http://127.0.0.1:${s.port}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(manage ? { 'X-Orlis-Manage': s.manageKey } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, ...(await r.json().catch(() => ({}))) };
  };
  try {
    await call('POST', '/api/signup', grownUp('owner@example.com'));
    const hi = await call('GET', '/api/hello');
    assert.equal(hi.invite, false, 'no invite code asked for');
    assert.equal(hi.approval, true, 'joining waits for the owner');

    /* getting in starts with an email: is there an account? */
    assert.equal((await call('POST', '/api/account-exists', { email: 'owner@example.com' })).exists, true);
    assert.equal((await call('POST', '/api/account-exists', { email: 'SAM@example.com' })).exists, false);
    assert.equal((await call('POST', '/api/account-exists', { email: 'nope' })).status, 400);
    /* they make an account - and wait */
    const sam = await call('POST', '/api/signup', grownUp('sam@example.com', { name: 'Sam', family: 'Uncle B' }));
    assert.equal(sam.status, 201);
    assert.equal(sam.account.waiting, true);
    assert.deepEqual(said[0], ['Sam wants to join', 'sam@example.com - open Manage Orlis Server to let them in'], 'a note by the clock');
    /* waiting: only "am I in yet?" - nothing else */
    assert.equal((await call('GET', '/api/me', null, sam.token)).account.waiting, true);
    assert.equal((await call('GET', '/api/store', null, sam.token)).status, 403);
    assert.equal((await call('POST', '/api/requests', { start: 'new', view: 'hands', action: 'catch' }, sam.token)).status, 403);
    /* but their own family, yes: they add their kids while they wait (and play the starter games) */
    assert.equal((await call('POST', '/api/profiles', { name: 'Kiddo', avatar: 'rocket' }, sam.token)).status, 201);
    assert.equal((await call('GET', '/api/me', null, sam.token)).profiles.length, 2);
    /* signing in again, still waiting */
    assert.equal((await call('POST', '/api/signin', { email: 'sam@example.com', password: 'correct horse' })).account.waiting, true);

    /* the owner sees them, and lets them in */
    const joins = (await call('GET', '/api/joins', null, null, true)).joins;
    assert.equal(joins.length, 1);
    assert.equal(joins[0].email, 'sam@example.com');
    assert.equal(joins[0].family, 'Uncle B');
    assert.equal(joins[0].name, 'Sam');
    assert.equal((await call('GET', '/api/joins', null, sam.token)).status, 403, 'only the owner');
    await call('POST', `/api/joins/${joins[0].id}/approve`, null, null, true);
    assert.equal((await call('GET', '/api/me', null, sam.token)).account.waiting, false, 'in');
    assert.equal((await call('GET', '/api/store', null, sam.token)).status, 200);

    /* someone else asks; the owner says no: their account goes */
    const x = await call('POST', '/api/signup', grownUp('stranger@example.com', { family: 'Strangers' }));
    const id = (await call('GET', '/api/joins', null, null, true)).joins[0].id;
    await call('POST', `/api/joins/${id}/decline`, null, null, true);
    assert.equal((await call('GET', '/api/me', null, x.token)).status, 401, 'their account is gone');
    assert.equal((await call('POST', '/api/signin', { email: 'stranger@example.com', password: 'correct horse' })).status, 401);
    assert.ok(!(await call('GET', '/api/households', null, null, true)).households.some(h => h.name === 'Strangers'), 'and their family');
    const hist = (await call('GET', '/api/history', null, null, true)).history.map(h => h.what);
    for (const w of ['asked-to-join', 'join-approved', 'join-declined']) assert.ok(hist.includes(w), w);

    /* an invite code still lets someone straight in */
    const owner = await call('POST', '/api/signin', { email: 'owner@example.com', password: 'correct horse' });
    const inv = await call('POST', '/api/invites', { household: 'new' }, owner.token);
    const dad = await call('POST', '/api/signup', grownUp('dad@example.com', { invite: inv.code }));
    assert.equal(dad.account.waiting, false);
  } finally { await s.close(); }
});
