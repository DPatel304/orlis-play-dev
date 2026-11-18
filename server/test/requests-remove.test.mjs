import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../src/app.js';

const grownUp = (email, extra = {}) => ({ email, password: 'correct horse', name: 'Sam', adult: true, device: 'Laptop', ...extra });
const recipe = (thing) => ({ start: 'new', view: 'hands', action: 'catch', thing, place: 'a meadow', twists: [], ages: '4-6', energy: 'calm', minutes: 5, players: 2, words: '' });

test('a game asked for can be taken back: in line, turned down - but not while it is being made', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'orlis-rm-'));
  const s = await start({ dataDir, port: 0, discoveryPort: false, name: 'Test', tailscaleJoin: () => true, notify: () => {} });
  const call = async (method, path, body, token, manage) => {
    const r = await fetch(`http://127.0.0.1:${s.port}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(manage ? { 'X-Orlis-Manage': s.manageKey } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, ...(await r.json().catch(() => ({}))) };
  };
  try {
    await call('POST', '/api/signup', grownUp('owner@example.com'));
    const bro = await call('POST', '/api/signup', grownUp('bro@example.com', { family: 'The Bros' }));
    const list = async () => (await call('GET', '/api/requests', null, bro.token)).requests.map(x => x.state);
    /* in line */
    const a = await call('POST', '/api/requests', recipe('fireflies'), bro.token);
    assert.deepEqual(await list(), ['waiting']);
    assert.equal((await call('DELETE', `/api/requests/${a.id}`, null, bro.token)).status, 200);
    assert.deepEqual(await list(), [], 'gone');
    assert.equal((await call('DELETE', `/api/requests/${a.id}`, null, bro.token)).status, 404, 'already gone');
    /* turned down */
    const b = await call('POST', '/api/requests', recipe('frogs'), bro.token);
    await call('POST', `/api/requests/${b.id}/decline`, { note: 'not this one' }, null, true);
    assert.deepEqual(await list(), ['declined']);
    assert.equal((await call('DELETE', `/api/requests/${b.id}`, null, bro.token)).status, 200);
    /* being made: not now */
    const c = await call('POST', '/api/requests', recipe('owls'), bro.token);
    await call('POST', `/api/requests/${c.id}/make`, null, null, true);
    assert.equal((await call('DELETE', `/api/requests/${c.id}`, null, bro.token)).status, 409);
    /* someone else's is theirs */
    const other = await call('POST', '/api/signup', grownUp('other@example.com', { family: 'Others' }));
    assert.equal((await call('DELETE', `/api/requests/${c.id}`, null, other.token)).status, 404);
  } finally { await s.close(); }
});
