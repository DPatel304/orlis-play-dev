import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../src/app.js';

test('the Dev Kit: off for everyone but the owner, until the owner gives it - and it says so in the history', async () => {
  const s = await start({ dataDir: mkdtempSync(join(tmpdir(), 'orlis-kit-')), port: 0, discoveryPort: false, tailscaleJoin: () => true });
  const base = `http://127.0.0.1:${s.port}`;
  const call = async (method, path, body, token, manage) => {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(manage ? { 'X-Orlis-Manage': s.manageKey } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, ...(await r.json()) };
  };
  try {
    const owner = await call('POST', '/api/signup', { email: 'deep@example.com', password: 'correct horse', name: 'Deep', adult: true });
    assert.equal(owner.account.devkit, true, 'the owner always has it');
    const bro = await call('POST', '/api/signup', { email: 'bro@example.com', password: 'correct horse', name: 'B', adult: true });
    assert.equal(bro.account.devkit, false, 'off to start with');
    /* only the owner gives it */
    assert.equal((await call('POST', `/api/accounts/${bro.account.id}/devkit`, { on: true }, bro.token)).status, 403);
    assert.equal((await call('POST', `/api/accounts/${bro.account.id}/devkit`, { on: true }, null, true)).devkit, true);
    assert.equal((await call('GET', '/api/me', null, bro.token)).account.devkit, true, 'their app sees it');
    const fams = (await call('GET', '/api/households', null, null, true)).households;
    assert.equal(fams.flatMap(f => f.accounts).find(a => a.email === 'bro@example.com').devkit, true, 'the management page sees it');
    await call('POST', `/api/accounts/${bro.account.id}/devkit`, { on: false }, null, true);
    assert.equal((await call('GET', '/api/me', null, bro.token)).account.devkit, false);
    const said = (await call('GET', '/api/history', null, null, true)).history.map(x => x.what);
    assert.ok(said.includes('devkit-on') && said.includes('devkit-off'), 'given and taken away, in the history');
    assert.equal((await call('POST', `/api/accounts/${owner.account.id}/devkit`, { on: false }, null, true)).status, 400, 'the owner keeps it');
  } finally { await s.close(); }
});

test('the server\'s name: "Orlis" unless the owner names it (not the laptop\'s name); the owner renames it, and it stays', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'orlis-name-'));
  let s = await start({ dataDir, port: 0, discoveryPort: false });
  const hello = async () => (await fetch(`http://127.0.0.1:${s.port}/api/hello`)).json();
  try {
    assert.equal((await hello()).name, 'Orlis');
    await fetch(`http://127.0.0.1:${s.port}/api/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'o@example.com', password: 'correct horse', name: 'O', adult: true }) });
    const r = await fetch(`http://127.0.0.1:${s.port}/api/server/name`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Orlis-Manage': s.manageKey }, body: JSON.stringify({ name: '  The Patels’ Orlis ' }) });
    assert.equal((await r.json()).name, 'The Patels’ Orlis');
    assert.equal((await hello()).name, 'The Patels’ Orlis');
    assert.equal(JSON.parse(readFileSync(join(dataDir, 'settings.json'), 'utf8')).name, 'The Patels’ Orlis', 'kept in settings.json, for after a restart');
  } finally { await s.close(); }
});
