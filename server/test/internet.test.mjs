import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../src/app.js';
import { whoFrom, INTERNET } from '../src/http.js';
import { settings } from '../src/settings.js';

test('who a request is from: the internet door is always the internet; a passed-on request is never this laptop', () => {
  const req = (ip, headers = {}) => ({ socket: { remoteAddress: ip }, headers });
  assert.equal(whoFrom(req('127.0.0.1')), '127.0.0.1');
  assert.equal(whoFrom(req('127.0.0.1'), true), INTERNET);
  assert.equal(whoFrom(req('127.0.0.1', { 'x-forwarded-for': '203.0.113.9' })), INTERNET);
  assert.equal(whoFrom(req('::1', { 'tailscale-funnel-request': '?1' })), INTERNET);
  assert.equal(whoFrom(req('192.168.1.20', { 'x-forwarded-for': '127.0.0.1' })), '192.168.1.20', 'a header never makes someone local');
});

test('the internet door: 47872 by default, off with 0 or false', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orlis-set-'));
  assert.equal(settings({ env: {}, defaultDataDir: dir }).internetPort, 47872);
  assert.equal(settings({ env: { ORLIS_INTERNET_PORT: '0' }, defaultDataDir: dir }).internetPort, false);
  assert.equal(settings({ env: { ORLIS_INTERNET_PORT: 'off' }, defaultDataDir: dir }).internetPort, false);
  assert.equal(settings({ env: { ORLIS_INTERNET_PORT: '48000' }, defaultDataDir: dir }).internetPort, 48000);
});

test('through the internet door (Tailscale Funnel): never the owner, and joining needs an invite', async () => {
  const s = await start({ dataDir: mkdtempSync(join(tmpdir(), 'orlis-door-')), port: 0, discoveryPort: false, internetPort: 0, tailscaleJoin: true });
  const main = `http://127.0.0.1:${s.port}`, door = `http://127.0.0.1:${s.internetPort}`;
  const get = (base, path, headers = {}) => fetch(base + path, { headers });
  const post = (base, path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    const owner = await post(main, '/api/signup', { email: 'deep@example.com', password: 'correct horse', name: 'Deep', adult: true });
    assert.equal(owner.status, 201);
    /* on the laptop itself: the management page and the owner's key work */
    assert.equal((await get(main, '/manage')).status, 200);
    assert.equal((await get(main, '/api/requests', { 'X-Orlis-Manage': s.manageKey })).status, 200);
    /* through the door: nothing of the owner's, even with the key */
    assert.equal((await get(door, '/manage')).status, 404);
    assert.equal((await get(door, '/api/requests', { 'X-Orlis-Manage': s.manageKey })).status, 403);
    /* a tunnel on the main port, saying it's passing a request on: the same */
    assert.equal((await get(main, '/manage', { 'X-Forwarded-For': '203.0.113.9' })).status, 404);
    /* joining from the internet needs an invite (Tailscale's free joining is only for Tailscale) */
    assert.equal((await (await get(door, '/api/hello')).json()).invite, true);
    const noInvite = await post(door, '/api/signup', { email: 'stranger@example.com', password: 'correct horse', name: 'S', adult: true });
    assert.notEqual(noInvite.status, 201);
    /* but the family's app works through it as usual */
    const signin = await post(door, '/api/signin', { email: 'deep@example.com', password: 'correct horse', device: 'Phone' });
    assert.equal(signin.status, 200);
  } finally { await s.close(); }
});
