import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { newGame } from '../src/ui/creator-kit.js';
import { start } from '../../server/src/app.js';

const CLI = fileURLToPath(new URL('../kit/cli/orlis.mjs', import.meta.url));
/* (the harness's own loader isn't wanted in the child: it's plain node, as on a creator's laptop) */
const run = (args, cwd, home) => new Promise((ok) => {
  const p = spawn(process.execPath, [CLI, ...args], { cwd, env: { ...process.env, ORLIS_HOME: home, NODE_OPTIONS: '' } });
  let out = '', err = '';
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
  p.on('close', code => ok({ code, out, err }));
});

test('the orlis command: connect once, then check, test, publish, status and take-off in a game folder', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'orlis-cli-srv-'));
  const s = await start({ dataDir, port: 0, discoveryPort: false, name: 'Test', tailscaleJoin: () => true, notify: () => {} });
  const base = `http://127.0.0.1:${s.port}`;
  const call = async (method, path, body, token) => { const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
  try {
    const me = await call('POST', '/api/signup', { email: 'bro@example.com', password: 'correct horse', name: 'Bro', adult: true, family: 'The Bros' });
    const home = mkdtempSync(join(tmpdir(), 'orlis-cli-home-'));
    const dir = mkdtempSync(join(tmpdir(), 'orlis-cli-game-'));
    const g = newGame({ name: 'Firefly Jar', idea: 'Catch fireflies in a jar' });
    writeFileSync(join(dir, 'game.js'), g.files['game.js']); writeFileSync(join(dir, 'orlis.json'), g.files['orlis.json']);

    /* not connected: it says what to do, and goes nowhere */
    let r = await run(['test'], dir, home);
    assert.equal(r.code, 1); assert.match(r.err, /Not connected/);
    /* connecting: a wrong code, then the right one */
    r = await run(['connect', base, 'NOPE-NOPE'], dir, home);
    assert.equal(r.code, 1);
    const code = (await call('POST', '/api/pair', null, me.token)).code;
    r = await run(['connect', base, code], dir, home);
    assert.equal(r.code, 0, r.err); assert.match(r.out, /Connected as bro@example.com/);
    assert.ok(existsSync(join(home, 'creator.json')), 'its sign-in is kept in its own settings, not in the game folder');
    assert.ok(!existsSync(join(dir, 'creator.json')));

    r = await run(['check'], dir, home); assert.equal(r.code, 0, r.err);
    /* a game that fails its checks is stopped here, in plain words */
    const good = readFileSync(join(dir, 'game.js'), 'utf8');
    writeFileSync(join(dir, 'game.js'), good + '\nfetch("http://x");\n');
    r = await run(['test'], dir, home);
    assert.equal(r.code, 1); assert.match(r.err, /needs fixing first[\s\S]*internet/);
    assert.equal((await call('GET', '/api/drafts', null, me.token)).drafts.length, 0, 'nothing went to the TV');
    writeFileSync(join(dir, 'game.js'), good);

    /* publishing before testing says to test first */
    r = await run(['publish'], dir, home); assert.equal(r.code, 1); assert.match(r.err, /Test the game first/);
    /* test: on the TV's Testing row */
    r = await run(['test'], dir, home);
    assert.equal(r.code, 0, r.err); assert.match(r.out, /on the TV/);
    assert.deepEqual((await call('GET', '/api/drafts', null, me.token)).drafts.map(d => d.name), ['Firefly Jar']);
    r = await run(['status'], dir, home); assert.match(r.out, /Testing on the TV:\n- Firefly Jar/); assert.match(r.out, /Nothing is published yet/);
    /* take it off, test again, publish */
    r = await run(['take-off'], dir, home); assert.equal(r.code, 0, r.err);
    assert.equal((await call('GET', '/api/drafts', null, me.token)).drafts.length, 0);
    await run(['test'], dir, home);
    r = await run(['publish'], dir, home); assert.equal(r.code, 0, r.err); assert.match(r.out, /is published/);
    r = await run(['status'], dir, home); assert.match(r.out, /Published for the family:\n- Firefly Jar/);
    /* the same version again: it gets a newer number by itself */
    r = await run(['test'], dir, home);
    assert.equal(r.code, 0, r.err); assert.match(r.out, /Version is now 0\.2/);
    assert.equal(JSON.parse(readFileSync(join(dir, 'orlis.json'), 'utf8')).version, '0.2');
    r = await run(['publish'], dir, home); assert.equal(r.code, 0, r.err);
    /* it can't be sent anywhere else: no option names a server */
    r = await run(['test', '--server', 'http://elsewhere'], dir, home);
    assert.equal(r.code, 0, 'extra words are ignored by the tool (the guard refuses them for Claude)');
    r = await run(['wipe'], dir, home); assert.equal(r.code, 1); assert.match(r.err, /Use one of/);
  } finally { await s.close(); }
});
