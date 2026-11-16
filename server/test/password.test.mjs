import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../src/app.js';

test('a forgotten password: the owner sets a new one; the old one stops working and its devices are signed out', async () => {
  const s = await start({ dataDir: mkdtempSync(join(tmpdir(), 'orlis-pw-')), port: 0, discoveryPort: false, tailscaleJoin: () => true });
  const base = `http://127.0.0.1:${s.port}`;
  const call = async (method, path, body, token, manage) => {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(manage ? { 'X-Orlis-Manage': s.manageKey } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, ...(await r.json()) };
  };
  try {
    const owner = await call('POST', '/api/signup', { email: 'deep@example.com', password: 'correct horse', name: 'Deep', adult: true });
    const bro = await call('POST', '/api/signup', { email: 'bro@example.com', password: 'correct horse', name: 'B', adult: true });
    /* only from the management page */
    assert.equal((await call('POST', `/api/accounts/${bro.account.id}/password`, { password: 'new horse battery' }, bro.token)).status, 403);
    assert.equal((await call('POST', `/api/accounts/${bro.account.id}/password`, { password: 'short' }, null, true)).status, 400, 'still 8+ characters');
    assert.equal((await call('POST', `/api/accounts/${bro.account.id}/password`, { password: 'new horse battery' }, null, true)).ok, true);
    assert.equal((await call('GET', '/api/me', null, bro.token)).status, 401, 'signed out everywhere');
    assert.equal((await call('POST', '/api/signin', { email: 'bro@example.com', password: 'correct horse' })).status, 401, 'the old one is gone');
    assert.ok((await call('POST', '/api/signin', { email: 'bro@example.com', password: 'new horse battery' })).token, 'the new one works');
    /* the owner, who forgot their own */
    assert.equal((await call('POST', `/api/accounts/${owner.account.id}/password`, { password: 'owner horse battery' }, null, true)).ok, true);
    assert.ok((await call('POST', '/api/signin', { email: 'deep@example.com', password: 'owner horse battery' })).token);
    assert.ok((await call('GET', '/api/history', null, null, true)).history.some(x => x.what === 'password-set'), 'in the history');
  } finally { await s.close(); }
});
