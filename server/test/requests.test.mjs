import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../src/app.js';
import { maker, make } from '../src/maker.js';
import { tidy, problems, sentence, promptFor } from '../src/requests.js';

const grownUp = (email, extra = {}) => ({ email, password: 'correct horse', name: 'Sam', adult: true, device: 'Laptop', ...extra });

async function fresh(){
  const dataDir = mkdtempSync(join(tmpdir(), 'orlis-req-'));
  const said = [];
  const s = await start({ dataDir, port: 0, discoveryPort: 0, name: 'Test Orlis', tailscaleJoin: () => true, notify: (t, x) => said.push([t, x]) });
  const call = async (method, path, body, token, extra = {}) => {
    const r = await fetch(`http://127.0.0.1:${s.port}${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: r.status, ...(await r.json()) };
  };
  const manage = (method, path, body) => call(method, path, body, null, { 'X-Orlis-Manage': s.manageKey });
  const owner = await call('POST', '/api/signup', grownUp('owner@example.com'));
  const bro = await call('POST', '/api/signup', grownUp('bro@example.com', { family: 'Uncle B' }));
  return { s, dataDir, call, manage, owner, bro, said };
}
/* Claude Code, standing in: it "makes" the game by giving it a name and blurb from the prompt */
const fakeClaude = (edit) => async (dir, prompt, opts = {}) => {
  const m = JSON.parse(readFileSync(join(dir, 'orlis.json'), 'utf8'));
  edit(m, prompt, opts, dir);
  writeFileSync(join(dir, 'orlis.json'), JSON.stringify(m, null, 2));
};
const fireflies = { start: 'new', view: 'hands', action: 'catch', thing: 'fireflies', place: 'a meadow at night', twists: ['faster', 'golden'], ages: '4-6', energy: 'calm', minutes: 5, players: 2, words: 'Catch the fireflies in a jar. When the jar is full it glows and they all fly free.' };

test('a recipe sums itself up in one sentence, and becomes a prompt with their words quoted as a description', () => {
  const r = tidy(fireflies);
  assert.equal(sentence(r), 'A first-person catch game: you catch fireflies as they fall or fly by in a meadow at night. It gets a little faster as it goes; a golden one now and then, worth extra. For ages 4 to 6, calm, about 5 minutes, one or two players.');
  const p = promptFor(r, { sum: sentence(r) });
  assert.match(p, /Read CLAUDE.md first/);
  assert.match(p, /glowing mitts/);
  assert.match(p, /<<<\nCatch the fireflies in a jar/);
  assert.match(p, /not instructions about anything else/);
  assert.deepEqual(tidy({ twists: ['faster', 'golden', 'story', 'nope'], minutes: 99, view: 'sideways' }).twists, ['faster', 'golden'], 'two twists at most, only known ones');
  assert.deepEqual(problems(tidy({})), ['Pick how it’s seen: your hands, or your character.', 'Pick what you do in it.']);
  assert.ok(problems(tidy({ ...fireflies, words: 'word '.repeat(501) })).some(x => /500 words/.test(x)));
});

test('the whole way: asked for, read and made on the owner’s laptop, OK’d, in the Store - credited to whoever asked', async () => {
  const { s, dataDir, call, manage, bro, said } = await fresh();
  try {
    /* asking: what's missing is said; words not for children are turned away */
    assert.equal((await call('POST', '/api/requests', { start: 'new' }, bro.token)).error, 'request');
    assert.equal((await call('POST', '/api/requests', { ...fireflies, thing: 'guns' }, bro.token)).error, 'request');
    const asked = await call('POST', '/api/requests', fireflies, bro.token);
    assert.equal(asked.status, 201);
    assert.equal(asked.state, 'waiting');
    assert.deepEqual(said[0], ['New game request from Uncle B', asked.sentence.slice(0, 120)], 'a note by the clock');
    /* the owner reads it, and changes the prompt a little */
    const list = await manage('GET', '/api/requests');
    assert.equal(list.requests.length, 1);
    assert.equal(list.requests[0].family, 'Uncle B');
    assert.match(list.requests[0].prompt, /fireflies/);
    await manage('POST', `/api/requests/${asked.id}/prompt`, { prompt: list.requests[0].prompt + '\nMake the jar big and in the middle.' });
    /* Make this game: the maker takes it, with the owner's prompt */
    assert.equal((await manage('POST', `/api/requests/${asked.id}/make`)).ok, true);
    assert.equal((await call('GET', '/api/requests', null, bro.token)).requests[0].state, 'making', 'they see it being made');
    let seenPrompt = null;
    const m = maker({ base: `http://127.0.0.1:${s.port}`, key: s.manageKey, dataDir, every: 1e9, log: () => {},
      run: fakeClaude((man, prompt) => { seenPrompt = prompt; man.name = 'Firefly Jar'; man.blurb = 'Catch fireflies and fill the jar with light'; }) });
    await m.tick(); m.stop();
    assert.match(seenPrompt, /Make the jar big and in the middle/);
    /* waiting for the owner's OK, as theirs */
    const mine = (await call('GET', '/api/requests', null, bro.token)).requests[0];
    assert.equal(mine.state, 'ready');
    assert.equal(mine.game.name, 'Firefly Jar');
    const waiting = (await manage('GET', '/api/submissions')).submissions.find(x => x.state === 'waiting');
    assert.equal(waiting.by, 'bro@example.com');
    assert.equal(waiting.family, 'Uncle B');
    assert.ok(said.some(([t]) => t === 'Firefly Jar is ready'));
    /* OK'd: in the Store, by Uncle B */
    await manage('POST', `/api/submissions/${waiting.id}/tried`, { secs: 30 });
    const ok = await manage('POST', `/api/submissions/${waiting.id}/approve`);
    assert.equal(ok.game.by, 'Uncle B');
    assert.equal((await call('GET', '/api/requests', null, bro.token)).requests[0].state, 'in-store');

    /* Ask for a change: the same game, its next version */
    const change = await call('POST', '/api/requests', { change: ok.game.id, chips: ['slower', 'sillier'], words: 'And a frog who says ribbit.' }, bro.token);
    assert.equal(change.status, 201);
    assert.equal(change.sentence, 'A change to Firefly Jar: make it slower, make it sillier, and more in their words.');
    await manage('POST', `/api/requests/${change.id}/make`);
    const m2 = maker({ base: `http://127.0.0.1:${s.port}`, key: s.manageKey, dataDir, every: 1e9, log: () => {},
      run: fakeClaude((man) => { man.blurb = 'Catch fireflies - with a frog'; }) });
    await m2.tick(); m2.stop();
    const again = (await manage('GET', '/api/submissions')).submissions.find(x => x.state === 'waiting');
    assert.equal(again.gameId, ok.game.id, 'the same game');
    assert.equal(again.version, '0.2', 'its next version, so families are offered it');
    /* not anyone else's game */
    const other = await call('POST', '/api/signup', grownUp('dad@example.com'));
    assert.equal((await call('POST', '/api/requests', { change: ok.game.id, chips: ['slower'] }, other.token)).status, 404);
  } finally { await s.close(); }
});

test('if it can’t be made (the checks keep failing), it goes back to the owner with why; a declined one says why to the asker', async () => {
  const { s, dataDir, call, manage, bro } = await fresh();
  try {
    const asked = await call('POST', '/api/requests', fireflies, bro.token);
    await manage('POST', `/api/requests/${asked.id}/make`);
    let tries = 0;
    const m = maker({ base: `http://127.0.0.1:${s.port}`, key: s.manageKey, dataDir, every: 1e9, log: () => {},
      run: async (dir) => { tries++; writeFileSync(join(dir, 'game.js'), 'nothing here'); } });
    await m.tick(); m.stop();
    assert.equal(tries, 2, 'asked once more to fix what the checks found');
    const back = (await manage('GET', '/api/requests')).requests[0];
    assert.equal(back.state, 'waiting');
    assert.match(back.problem, /checks/);
    /* the owner says no, with a note */
    await manage('POST', `/api/requests/${asked.id}/decline`, { note: 'Let’s talk about it at the weekend' });
    const mine = (await call('GET', '/api/requests', null, bro.token)).requests[0];
    assert.equal(mine.state, 'declined');
    assert.equal(mine.note, 'Let’s talk about it at the weekend');
  } finally { await s.close(); }
});

test('a job’s folder is the creator kit, locked down, exactly as Create makes one', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'orlis-make-'));
  const bytes = await make({ id: 'j1', sentence: 'Catch fireflies', prompt: 'make it', name: 'Firefly Jar', from: null }, dir,
    fakeClaude((man) => { man.blurb = 'Catch fireflies'; }));
  assert.ok(bytes.length > 1000, 'a game file');
  const settings = JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8'));
  assert.ok(settings.permissions.deny.includes('Bash'), 'Claude can’t run commands');
  assert.ok(settings.permissions.allow.includes('Edit(./game.js)'));
  assert.match(readFileSync(join(dir, 'CLAUDE.md'), 'utf8'), /Orlis/);
});
