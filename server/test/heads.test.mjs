import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../src/app.js';

const grownUp = (email, extra = {}) => ({ email, password: 'correct horse', name: 'Sam', adult: true, device: 'Laptop', ...extra });
const wait = () => new Promise(r => setTimeout(r, 30));
/* until: wait for something that happens in the background (a note, an email), up to a few seconds - a busy machine can be slow */
const until = async (ok, ms = 5000) => { const end = Date.now() + ms; while (!ok() && Date.now() < end) await wait(); };

/* a server with the notes by the clock kept, and a stand-in for email */
async function fresh({ ready = true, fail = false, ...opts } = {}){
  const said = [], sent = [];
  const mail = { ready, send: async (m) => { sent.push(m); if (fail) throw new Error('mail is down'); } };
  const s = await start({ dataDir: mkdtempSync(join(tmpdir(), 'orlis-heads-')), port: 0, discoveryPort: false, tailscaleJoin: () => false, betaPage: true, mail, notify: (t, x) => said.push([t, x]), ...opts });
  const call = async (method, path, body, token, manage) => {
    const r = await fetch(`http://127.0.0.1:${s.port}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(manage ? { 'X-Orlis-Manage': s.manageKey } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, ...(await r.json().catch(() => ({}))) };
  };
  return { s, said, sent, call };
}
const joined = (said) => said.filter(([t]) => / joined Orlis$/.test(t));

test('joined note: from the beta and by invite - but not for the owner', async () => {
  const { s, said, sent, call } = await fresh();
  try {
    const owner = await call('POST', '/api/signup', grownUp('owner@example.com', { name: 'Owner' }));
    assert.equal(owner.status, 201);
    assert.deepEqual(joined(said), [], 'none for the owner');
    /* from the beta */
    await call('POST', '/api/beta/approve', { email: 'mia@example.com' }, null, true);
    assert.equal((await call('POST', '/api/signup', grownUp('mia@example.com', { name: 'Mia' }))).status, 201);
    assert.deepEqual(joined(said).at(-1), ['Mia joined Orlis', "mia@example.com made their account - they're in."]);
    /* with an invite */
    const inv = await call('POST', '/api/invites', { household: 'new' }, owner.token);
    assert.equal((await call('POST', '/api/signup', grownUp('ben@example.com', { name: 'Ben', invite: inv.code }))).status, 201);
    assert.deepEqual(joined(said).at(-1), ['Ben joined Orlis', "ben@example.com made their account - they're in."]);
    assert.equal(joined(said).length, 2);
    await until(() => sent.filter(m => / joined Orlis$/.test(m.subject)).length >= 2);
    /* and each was emailed to the owner, with the sign-off */
    const mails = sent.filter(m => / joined Orlis$/.test(m.subject));
    assert.equal(mails.length, 2);
    assert.equal(mails[0].to, 'owner@example.com');
    assert.equal(mails[0].subject, 'Mia joined Orlis');
    assert.equal(mails[0].text, "mia@example.com made their account - they're in.\n\n- Orlis Server");
  } finally { await s.close(); }
});

test('joined note: someone joining free (on Tailscale) is straight in', async () => {
  const { s, said, call } = await fresh({ tailscaleJoin: () => true });
  try {
    await call('POST', '/api/signup', grownUp('owner@example.com', { name: 'Owner' }));
    assert.deepEqual(joined(said), []);
    await call('POST', '/api/signup', grownUp('zed@example.com', { name: 'Zed' }));
    assert.deepEqual(joined(said), [['Zed joined Orlis', "zed@example.com made their account - they're in."]]);
  } finally { await s.close(); }
});

test('asks to join: keeps its own note, no "joined" one', async () => {
  const { s, said, call } = await fresh({ approveJoins: true });
  try {
    await call('POST', '/api/signup', grownUp('owner@example.com', { name: 'Owner' }));
    await call('POST', '/api/signup', grownUp('sam@example.com', { name: 'Sam' }));
    assert.deepEqual(said, [['Sam wants to join', 'sam@example.com - open Manage Orlis Server to let them in']]);
  } finally { await s.close(); }
});

test('first game: once per family, never the owner\'s, with the game and players', async () => {
  const { s, said, call } = await fresh({ tailscaleJoin: () => true });
  const firsts = () => said.filter(([t]) => /played their first game$/.test(t));
  try {
    const owner = await call('POST', '/api/signup', grownUp('owner@example.com', { name: 'Owner' }));
    const sam = await call('POST', '/api/signup', grownUp('sam@example.com', { name: 'Sam', family: 'The Bs' }));
    await call('POST', '/api/plays', { gameId: 'pop-party', value: 5, secs: 60, players: 1 }, owner.token);
    await wait();
    assert.deepEqual(firsts(), [], 'not the owner\'s family');
    await call('POST', '/api/plays', { gameId: 'pop-party', value: 5, secs: 60, players: 3 }, sam.token);
    await call('POST', '/api/plays', { gameId: 'pop-party', value: 9, secs: 60, players: 3 }, sam.token);
    await call('POST', '/api/plays', { gameId: 'other-game', value: 9, secs: 60 }, sam.token);
    await until(() => firsts().length >= 1); await wait();
    assert.equal(firsts().length, 1, 'exactly once');
    assert.deepEqual(firsts()[0], ['The Bs played their first game', 'pop-party with 3 players'], 'the id, when the Store has no such game');
  } finally { await s.close(); }
});

test('first game: one player says no count', async () => {
  const { s, said, call } = await fresh({ tailscaleJoin: () => true });
  try {
    await call('POST', '/api/signup', grownUp('owner@example.com', { name: 'Owner' }));
    const sam = await call('POST', '/api/signup', grownUp('sam@example.com', { name: 'Sam' }));
    await call('POST', '/api/plays', { gameId: 'pop-party', value: 1, secs: 10 }, sam.token);
    await until(() => said.some(([t]) => / played their first game$/.test(t)));
    assert.deepEqual(said.at(-1), ['Sam\'s family played their first game', 'pop-party']);
  } finally { await s.close(); }
});

test('email: sent when mail is ready, not when it is not, and a failure never breaks the request', async () => {
  const on = await fresh({ tailscaleJoin: () => true });
  try {
    await on.call('POST', '/api/signup', grownUp('owner@example.com', { name: 'Owner' }));
    const sam = await on.call('POST', '/api/signup', grownUp('sam@example.com', { name: 'Sam' }));
    await on.call('POST', '/api/plays', { gameId: 'pop-party', secs: 10, players: 2 }, sam.token);
    await until(() => on.sent.length >= 2);
    assert.deepEqual(on.sent.map(m => m.subject), ['Sam joined Orlis', 'Sam\'s family played their first game']);
    assert.equal(on.sent[1].text, 'pop-party with 2 players\n\n- Orlis Server');
  } finally { await on.s.close(); }
  const off = await fresh({ ready: false, tailscaleJoin: () => true });
  try {
    await off.call('POST', '/api/signup', grownUp('owner@example.com', { name: 'Owner' }));
    await off.call('POST', '/api/signup', grownUp('sam@example.com', { name: 'Sam' }));
    await until(() => off.said.length >= 1); await wait();
    assert.equal(off.said.length, 1, 'the note by the clock still shows');
    assert.deepEqual(off.sent, [], 'no email: it is not set up');
  } finally { await off.s.close(); }
  const bad = await fresh({ fail: true, tailscaleJoin: () => true });
  try {
    await bad.call('POST', '/api/signup', grownUp('owner@example.com', { name: 'Owner' }));
    const r = await bad.call('POST', '/api/signup', grownUp('sam@example.com', { name: 'Sam' }));
    assert.equal(r.status, 201, 'mail failing does not stop joining');
    await until(() => bad.sent.length >= 1);
    assert.equal(bad.sent.length, 1);
  } finally { await bad.s.close(); }
});

test('email: "wants to join" goes by email too', async () => {
  const { s, sent, call } = await fresh({ approveJoins: true });
  try {
    await call('POST', '/api/signup', grownUp('owner@example.com', { name: 'Owner' }));
    await call('POST', '/api/signup', grownUp('sam@example.com', { name: 'Sam' }));
    await until(() => sent.length >= 1);
    assert.deepEqual(sent.map(m => [m.to, m.subject]), [['owner@example.com', 'Sam wants to join']]);
  } finally { await s.close(); }
});
