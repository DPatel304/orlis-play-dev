import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../src/app.js';
import { build, defaultPicks } from '../../app/src/create/recipe.js';

const grownUp = (email, extra = {}) => ({ email, password: 'correct horse', name: 'Sam', adult: true, device: 'Laptop', ...extra });
const game = (over = {}) => { const picks = { ...defaultPicks(), ...over }; return { name: 'Apple Catch', picks, desc: build(picks) }; };

async function rig(){
  const dataDir = mkdtempSync(join(tmpdir(), 'orlis-made-'));
  const s = await start({ dataDir, port: 0, discoveryPort: false, name: 'Test', tailscaleJoin: () => true, notify: () => {} });
  const call = async (method, path, body, token) => {
    const r = await fetch(`http://127.0.0.1:${s.port}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, ...(await r.json().catch(() => ({}))) };
  };
  return { s, call };
}

test('a family keeps three games: save, list, change in the same slot, remove', async () => {
  const { s, call } = await rig();
  try {
    await call('POST', '/api/signup', grownUp('owner@example.com'));
    const fam = await call('POST', '/api/signup', grownUp('mum@example.com', { family: 'The Lees' }));
    const me = fam.profiles[0].id;
    assert.deepEqual((await call('GET', '/api/creations', null, fam.token)).creations, [], 'none to begin with');
    assert.equal((await call('GET', '/api/creations', null, fam.token)).max, 3);

    const a = await call('POST', '/api/creations', { ...game(), makerId: me }, fam.token);
    assert.equal(a.status, 201);
    assert.equal(a.name, 'Apple Catch'); assert.equal(a.makerId, me); assert.deepEqual(a.picks.things, [{ id: 'apple', job: 'collect' }]); assert.equal(a.desc.scene, 'meadow');
    assert.ok(a.id && a.createdAt && a.updatedAt);
    const b = await call('POST', '/api/creations', { ...game({ things: [{ id: 'bee', job: 'collect' }] }), name: 'Bee Pop', makerId: me }, fam.token);
    const c = await call('POST', '/api/creations', { ...game({ things: [{ id: 'fish', job: 'dodge' }] }), name: 'Fish Dash', makerId: me }, fam.token);
    assert.equal(b.status, 201); assert.equal(c.status, 201);
    assert.deepEqual((await call('GET', '/api/creations', null, fam.token)).creations.map(x => x.name), ['Apple Catch', 'Bee Pop', 'Fish Dash']);

    /* all three used: no fourth */
    const d = await call('POST', '/api/creations', { ...game(), name: 'Too Many', makerId: me }, fam.token);
    assert.equal(d.status, 409); assert.equal(d.error, 'full');
    assert.match(d.message, /slots are full/i);

    /* changing one keeps its slot (and works when the slots are full) */
    const ch = await call('POST', '/api/creations', { ...game({ speed: 4 }), id: a.id, name: 'Apple Rocket', makerId: me }, fam.token);
    assert.equal(ch.status, 200); assert.equal(ch.id, a.id); assert.equal(ch.name, 'Apple Rocket'); assert.equal(ch.picks.speed, 4);
    assert.equal((await call('GET', '/api/creations', null, fam.token)).creations.length, 3);

    /* removing frees a slot */
    assert.equal((await call('DELETE', `/api/creations/${b.id}`, null, fam.token)).status, 200);
    assert.equal((await call('DELETE', `/api/creations/${b.id}`, null, fam.token)).status, 404, 'already gone');
    assert.equal((await call('POST', '/api/creations', { ...game(), name: 'Again', makerId: me }, fam.token)).status, 201);
  } finally { await s.close(); }
});

test('another household can not see, change or remove a family\'s games - not even the owner', async () => {
  const { s, call } = await rig();
  try {
    const owner = await call('POST', '/api/signup', grownUp('owner@example.com'));
    const lee = await call('POST', '/api/signup', grownUp('mum@example.com', { family: 'The Lees' }));
    const kim = await call('POST', '/api/signup', grownUp('dad@example.com', { family: 'The Kims' }));
    const made = await call('POST', '/api/creations', { ...game(), makerId: lee.profiles[0].id }, lee.token);
    assert.equal(made.status, 201);
    for (const other of [kim, owner]){
      assert.deepEqual((await call('GET', '/api/creations', null, other.token)).creations, [], 'their list is their own');
      assert.equal((await call('POST', '/api/creations', { ...game(), id: made.id, makerId: other.profiles[0].id }, other.token)).status, 404, 'not changed');
      assert.equal((await call('DELETE', `/api/creations/${made.id}`, null, other.token)).status, 404, 'not removed');
    }
    /* a maker has to be in the family */
    assert.equal((await call('POST', '/api/creations', { ...game(), makerId: kim.profiles[0].id }, lee.token)).error, 'bad_maker');
    /* signed out: no */
    assert.equal((await call('GET', '/api/creations')).status, 401);
    assert.equal((await call('GET', '/api/creations', null, lee.token)).creations.length, 1, 'still there');
  } finally { await s.close(); }
});

test('a game that is not in the vocabulary, or has words for grown-ups, is turned away', async () => {
  const { s, call } = await rig();
  try {
    await call('POST', '/api/signup', grownUp('owner@example.com'));
    const fam = await call('POST', '/api/signup', grownUp('mum@example.com', { family: 'The Lees' }));
    const me = fam.profiles[0].id, ok = game();
    const bad = async (patch) => call('POST', '/api/creations', { ...ok, makerId: me, ...patch }, fam.token);
    let r = await bad({ desc: { ...ok.desc, scene: 'a-secret-lair' } });
    assert.equal(r.status, 400); assert.equal(r.error, 'bad_game'); assert.match(r.message, /scene/);
    r = await bad({ desc: { ...ok.desc, things: [{ ...ok.desc.things[0], piece: 'not-a-piece' }] } });
    assert.equal(r.error, 'bad_game');
    r = await bad({ desc: { ...ok.desc, things: [{ ...ok.desc.things[0], script: 'alert(1)' }] } });
    assert.equal(r.error, 'bad_game', 'no code, no settings the vocabulary does not know');
    r = await bad({ desc: { ...ok.desc, secs: 99999 } });
    assert.equal(r.error, 'bad_game', 'a round longer than the limits');
    r = await bad({ desc: null }); assert.equal(r.error, 'bad_game');
    r = await bad({ desc: 'Orlis.play({})' }); assert.equal(r.error, 'bad_game');
    r = await bad({ name: 'Kill Them All' }); assert.equal(r.error, 'bad_words');
    r = await bad({ desc: { ...ok.desc, hint: 'Kill the apples!' } }); assert.equal(r.status, 400, 'words in the game too');
    r = await bad({ name: '' }); assert.equal(r.error, 'bad_name');
    r = await bad({ name: 'x'.repeat(41) }); assert.equal(r.error, 'bad_name');
    r = await bad({ picks: 'many' }); assert.equal(r.error, 'bad_picks');
    r = await bad({ picks: { junk: 'x'.repeat(3000) } }); assert.equal(r.error, 'bad_picks');
    assert.deepEqual((await call('GET', '/api/creations', null, fam.token)).creations, [], 'nothing was kept');
    /* every recipe the builder can make is accepted */
    /* every job, and a mix of five things with all four, and a name of five words */
    const mix = { things: [{ id: 'bee', job: 'dodge' }, { id: 'apple', job: 'collect' }, { id: 'banana', job: 'stack' }, { id: 'beachball', job: 'keepup' }, { id: 'star', job: 'collect' }], bomb: true };
    for (const over of [{ things: [{ id: 'apple', job: 'collect' }] }, { things: [{ id: 'bee', job: 'dodge' }], bomb: true }, { things: [{ id: 'beachball', job: 'keepup' }] }, { things: [{ id: 'banana', job: 'stack' }] }, mix]){
      const made = await call('POST', '/api/creations', { ...game(over), name: 'The Great Wobbly Banana Bonanza', makerId: me }, fam.token);
      assert.equal(made.status, 201, JSON.stringify(over) + ' ' + (made.message || '')); assert.equal(made.name, 'The Great Wobbly Banana Bonanza');
      await call('DELETE', `/api/creations/${made.id}`, null, fam.token);
    }
    /* a game made before 0059 (one thing, a "how") is still kept, changed and listed */
    const old = { name: 'Bee Dash', makerId: me, picks: { how: 'dodge', what: 'bee', where: 'meadow', move: 'reach', speed: 2, many: 2, size: 2, minutes: 1, mode: 'together', golden: true, bomb: false }, desc: { title: 'Bee Dash', secs: 60, scene: 'meadow', hint: 'Dodge the bees!', hintIcon: 'bee', card: 'reach', team: true,
      things: [{ name: 'main', piece: 'bee', size: 0.095, moves: 'drift', speed: 0.12, appears: { every: 1.2, everyEnd: 0.84, max: 6 }, rules: [{ when: 'touched', then: ['pop', { score: -1 }, { sound: 'boing' }, 'vanish'] }, { when: 'leftScreen', then: ['score'] }] }] } };
    const kept = await call('POST', '/api/creations', old, fam.token); assert.equal(kept.status, 201, kept.message); assert.equal(kept.picks.how, 'dodge');
    assert.equal((await call('POST', '/api/creations', { ...old, id: kept.id, name: 'Bee Dash 2' }, fam.token)).status, 200);
    await call('DELETE', `/api/creations/${kept.id}`, null, fam.token);
    /* more than five things, or none, is turned away; a stack of other than 3 to 10 is not in the vocabulary */
    const six = ['apple', 'bee', 'star', 'fish', 'pear', 'banana'].map(id => ({ id, job: 'collect' }));
    assert.equal((await bad({ picks: { ...ok.picks, things: six } })).error, 'bad_picks');
    assert.equal((await bad({ picks: { ...ok.picks, things: [] } })).error, 'bad_picks');
    r = await bad({ desc: { ...ok.desc, things: [{ piece: 'apple', moves: 'fall', appears: { every: 1 }, rules: [{ when: 'touched', then: [{ stack: 50 }] }] }] } });
    assert.equal(r.error, 'bad_game'); assert.match(r.message, /3 to 10/);
  } finally { await s.close(); }
});
