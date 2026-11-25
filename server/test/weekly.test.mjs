import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../src/app.js';
import { weekStart, featuredIds, challenges, progress } from '../src/weekly.js';

test('a week starts on Monday; featured takes turns each week, the owner\'s pins first', () => {
  const wed = new Date(2026, 10, 18, 15), mon = weekStart(wed);
  assert.equal(mon.getDay(), 1); assert.equal(mon.getDate(), 16);
  assert.equal(weekStart(new Date(2026, 10, 22, 23)).getTime(), mon.getTime(), 'Sunday night is the same week');
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const w1 = featuredIds(ids, [], wed, 3), w2 = featuredIds(ids, [], new Date(2026, 10, 25), 3);
  assert.equal(w1.length, 3);
  assert.notDeepEqual(w1, w2, 'a new few next week');
  assert.deepEqual(featuredIds(ids, [], new Date(2026, 10, 20), 3), w1, 'the same all week');
  assert.equal(featuredIds(ids, ['g', 'gone'], wed, 3)[0], 'g', 'a pin comes first (and a pin for a game that\'s gone is skipped)');
});

test('challenges: three a week, counted from the family\'s rounds', () => {
  const list = challenges(new Date(2026, 10, 18));
  assert.equal(list.length, 3);
  const rounds = list.find(c => c.kind === 'rounds');
  const plays = [...Array(6)].map(() => ({ game_id: rounds.game, secs: 120 })).concat([{ game_id: 'x', secs: 60 }, { game_id: 'y', secs: 60 }]);
  const got = progress(list, plays);
  assert.ok(got.find(c => c.id === rounds.id).done, '6 rounds of 5: done (and shown as 5 of 5)');
  assert.equal(got.find(c => c.id === rounds.id).have, rounds.need);
  assert.equal(got.find(c => c.kind === 'different').have, 3, 'three different games');
});

test('rounds reported from Orlis Play count for the family this week; a done challenge is a star; the owner features a game', async () => {
  const s = await start({ dataDir: mkdtempSync(join(tmpdir(), 'orlis-week-')), port: 0, discoveryPort: false, tailscaleJoin: () => true });
  const base = `http://127.0.0.1:${s.port}`;
  const call = async (method, path, body, token, manage) => {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(manage ? { 'X-Orlis-Manage': s.manageKey } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, ...(await r.json()) };
  };
  try {
    const me = await call('POST', '/api/signup', { email: 'deep@example.com', password: 'correct horse', name: 'Deep', adult: true });
    const before = await call('GET', '/api/challenges', null, me.token);
    assert.equal(before.challenges.length, 3);
    assert.ok(before.challenges.every(c => c.have === 0 && !c.done));
    const target = before.challenges.find(c => c.kind === 'rounds');
    for (let i = 0; i < target.need; i++) assert.equal((await call('POST', '/api/plays', { gameId: target.game, value: 40, secs: 90, players: 2 }, me.token)).ok, true);
    assert.equal((await call('POST', '/api/plays', { gameId: '../nope', secs: 5 }, me.token)).status, 400, 'a made-up game id is refused');
    assert.equal((await call('POST', '/api/plays', { gameId: 'pop-party' })).status, 401, 'signed in only');
    const after = await call('GET', '/api/challenges', null, me.token);
    assert.ok(after.challenges.find(c => c.id === target.id).done, 'done');
    assert.equal(after.stars, 1, 'a star'); assert.equal(after.trophies, 1, '(and the old name, for older apps)');
    assert.equal((await call('GET', '/api/challenges', null, me.token)).stars, 1, 'only once');
    /* featuring: owner only, and it shows in Discover's list */
    assert.equal((await call('POST', '/api/store/pop-party/feature', { on: true }, me.token, false)).featured, true, 'the owner (signed in) features a game');
    const st = await call('GET', '/api/store', null, me.token);
    assert.ok(Array.isArray(st.featured));
    assert.ok((await call('GET', '/api/history', null, null, true)).history.some(x => x.what === 'featured'));
  } finally { await s.close(); }
});

test('a round with no score (a Dodge game: a health bar, no points) counts as played, by game and minutes, not by value', () => {
  const list = challenges(new Date(2026, 10, 18)), rounds = list.find(c => c.kind === 'rounds');
  const plays = [...Array(rounds.need)].map(() => ({ game_id: rounds.game, value: 0, secs: 120 })).concat([{ game_id: 'dodge-one', value: 0, secs: 120 }]);
  const got = progress(list, plays);
  assert.ok(got.find(c => c.id === rounds.id).done, 'rounds with value 0 still count');
  assert.equal(got.find(c => c.kind === 'different').have, 2, 'and a different game');
});

test('no "minutes moving together" challenge, any week (decision 0065)', async () => {
  const { challenges } = await import('../src/weekly.js');
  for (let w = 0; w < 12; w++){
    const list = challenges(new Date(Date.UTC(2027, 0, 4 + w * 7)));
    assert.equal(list.length, 3);
    assert.ok(list.every(c => c.kind !== 'minutes'), `week ${w}`);
  }
});
