/* The host session (plan package P4; docs/specs/session.md): one or more tests for each numbered rule, with a fake clock, a seeded rng
   and a fake `send` that records messages. Plus the trusted-phones store and the host link. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, PICTURE_POOL, defaultColourFor } from '../src/session/session.js';
import { createTrust, deviceName, TRUST_KEY } from '../src/session/trust.js';
import { createHostLink, hubConfig } from '../src/session/host-link.js';

const PEOPLE = [
  { id: 'mia', name: 'Mia', avatar: null, favourite: 'pink' }, { id: 'sam', name: 'Sam', avatar: null, favourite: 'sky' },
  { id: 'ola', name: 'Ola', avatar: null, favourite: 'sky' }, { id: 'guest', name: 'Guest', avatar: null }
];
const POP = { id: 'pop-party', seats: { tracked: [1, 4], pads: [0, 2] }, pads: { program: '/pads/pop-party/', need: 'controller' } };
const PEEK = { id: 'peekaboo', seats: { tracked: [1, 2], pads: [1, 1] }, pads: { program: '/pads/peekaboo/', need: 'view3d' }, requiredPads: 1 };
const NOPADS = { id: 'quiet', seats: { tracked: [1, 1], pads: [0, 0] } };

function memStorage() { const m = new Map(); return { getItem: (k) => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), m }; }
function seededRng(seed = 7) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

function rig(game = POP, opts = {}) {
  const clock = { t: 1_000_000 }, sent = [], closed = [];
  const send = (to, m) => sent.push({ to, m }); send.close = (to) => closed.push(to);
  const storage = opts.storage || memStorage();
  const trust = createTrust(storage, () => clock.t);
  let n = 0;
  const s = createSession({ game, people: () => PEOPLE, trust, send, now: () => clock.t, rng: seededRng(), newToken: () => 'tok' + String(++n).padStart(21, '0'), setTimer: () => 1, clearTimer: () => {}, ...opts.session });
  const to = (id) => sent.filter(x => x.to === id).map(x => x.m);
  const last = (id) => to(id).at(-1);
  const hello = (id, extra = {}) => s.message(id, { t: 'hello', v: 1, device: null, join: null, screen: { w: 1, h: 1, dpr: 1 }, gl: true, ...extra });
  /* a phone that joins with the pictures and picks `who`; returns its token */
  const joinPhone = (id, who = 'mia', ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)') => {
    s.open(id, ua); hello(id); hello(id, { join: s.join.pictures }); s.message(id, { t: 'pick', who });
    return last(id).device;
  };
  const events = {}; for (const e of ['change', 'pause', 'resume', 'offerEnd', 'ready']) { events[e] = []; s.on(e, (a) => events[e].push(a)); }
  return { s, clock, sent, closed, trust, storage, to, last, hello, joinPhone, events };
}

/* ---------- 1. picture join ---------- */
test('1. the join is three distinct pictures from the pool and a shuffled grid of nine that holds them', () => {
  const { s } = rig();
  const j = s.join;
  assert.equal(j.pictures.length, 3); assert.equal(new Set(j.pictures).size, 3);
  assert.equal(j.grid.length, 9); assert.equal(new Set(j.grid).size, 9);
  for (const p of j.pictures) assert.ok(j.grid.includes(p));
  for (const g of j.grid) assert.ok(PICTURE_POOL.includes(g));
  assert.notDeepEqual(j.grid.slice(0, 3), j.pictures, 'the grid is shuffled (seeded rng)');
  assert.notDeepEqual(rig(POP, { session: { rng: seededRng(99) } }).s.join, j, 'new for every session');
});

test('1. hello with no join gets the grid; the right pictures in order get "who?"; wrong ones are rejected', () => {
  const { s, last, hello } = rig();
  s.open('c1', 'ua'); hello('c1');
  assert.deepEqual(last('c1'), { t: 'pics?', grid: s.join.grid });
  hello('c1', { join: [...s.join.pictures].reverse() });
  assert.deepEqual(last('c1'), { t: 'reject', why: 'join' });
  hello('c1', { join: s.join.pictures });
  assert.equal(last('c1').t, 'who?');
  assert.deepEqual(last('c1').people.map(p => p.id), ['mia', 'sam', 'ola', 'guest']);
});

test('1. five wrong tries make every new phone wait 60 s, then the count resets; trusted phones are not affected', () => {
  const r = rig(); const { s, clock, last, hello } = r;
  const token = r.joinPhone('c1', 'sam');
  for (let i = 0; i < 4; i++) { s.open('x' + i, 'ua'); hello('x' + i, { join: ['a', 'b', 'c'] }); assert.equal(last('x' + i).why, 'join'); }
  s.open('c5', 'ua'); hello('c5', { join: ['a', 'b', 'c'] });
  assert.deepEqual(last('c5'), { t: 'reject', why: 'wait' });
  s.open('c6', 'ua'); hello('c6'); assert.equal(last('c6').why, 'wait', 'even asking for the pictures waits');
  hello('c6', { join: s.join.pictures }); assert.equal(last('c6').why, 'wait', 'even the right pictures wait');
  s.open('c7', 'ua'); hello('c7', { device: token }); assert.equal(last('c7').t, 'welcome', 'trusted phones are not affected');
  clock.t += 59_000; hello('c6'); assert.equal(last('c6').why, 'wait');
  clock.t += 1_000; hello('c6'); assert.equal(last('c6').t, 'pics?');
  hello('c6', { join: ['a', 'b', 'c'] }); assert.equal(last('c6').why, 'join', 'the count started again from zero');
});

test('1. a right answer resets the wrong count', () => {
  const { s, last, hello } = rig();
  for (let i = 0; i < 4; i++) { s.open('x' + i, ''); hello('x' + i, { join: ['a', 'b', 'c'] }); }
  s.open('ok', ''); hello('ok', { join: s.join.pictures }); assert.equal(last('ok').t, 'who?');
  s.open('y', ''); hello('y', { join: ['a', 'b', 'c'] }); assert.equal(last('y').why, 'join');
});

/* ---------- 2. trust, pick, who? ---------- */
test('2. pick after a verified join makes a 24-hex token, stores it and welcomes', () => {
  const r = rig(); const { s, trust, last } = r;
  s.open('c1', 'Mozilla/5.0 (iPhone)'); r.hello('c1', { join: s.join.pictures }); s.message('c1', { t: 'pick', who: 'sam' });
  const w = last('c1');
  assert.equal(w.t, 'welcome'); assert.equal(w.device, 'tok000000000000000000001'); assert.equal(w.device.length, 24);
  assert.deepEqual(trust.get(w.device), { who: 'sam', ua: 'Mozilla/5.0 (iPhone)', lastSeen: r.clock.t });
});

test('2. the real token generator gives 24 random hex characters', () => {
  const { s, trust, last, hello } = rig(POP, { session: { newToken: undefined } });
  const tokens = new Set();
  for (let i = 0; i < 2; i++) { s.open('c' + i, ''); hello('c' + i, { join: s.join.pictures }); s.message('c' + i, { t: 'pick', who: 'mia' }); tokens.add(last('c' + i).device); }
  assert.equal(tokens.size, 2); for (const t of tokens) assert.match(t, /^[0-9a-f]{24}$/);
  assert.equal(trust.list().length, 2);
});

test('2. pick without a verified join is ignored', () => {
  const { s, sent } = rig(); s.open('c1', ''); s.message('c1', { t: 'pick', who: 'sam' });
  assert.equal(sent.length, 0); assert.equal(s.seats.length, 0);
});

test('2. a known device token goes straight to welcome with its remembered who, even in a new session', () => {
  const a = rig(); const token = a.joinPhone('c1', 'sam');
  const b = rig(POP, { storage: a.storage });                      /* the Box remembers across sessions */
  b.s.open('p1', 'ua'); b.hello('p1', { device: token });
  const w = b.last('p1');
  assert.equal(w.t, 'welcome'); assert.equal(w.who, 'sam'); assert.equal(w.name, 'Sam'); assert.equal(w.device, token);
  assert.equal(b.to('p1').length, 1, 'no pictures, no picking');
});

test('2. an unknown token is treated as a new phone (pictures)', () => {
  const { s, last, hello } = rig(); s.open('c1', ''); hello('c1', { device: 'f'.repeat(24) });
  assert.equal(last('c1').t, 'pics?');
});

test('2. who? from a phone in a seat resends the people; its next pick changes who and keeps token and seat', () => {
  const r = rig(); const { s, trust, last } = r;
  const token = r.joinPhone('c1', 'sam'); const seat = last('c1').seat;
  s.message('c1', { t: 'who?' });
  assert.equal(last('c1').t, 'who?'); assert.equal(last('c1').people.length, 4);
  s.message('c1', { t: 'pick', who: 'guest' });
  const w = last('c1');
  assert.equal(w.t, 'welcome'); assert.equal(w.device, token); assert.equal(w.seat, seat); assert.equal(w.who, 'guest');
  assert.equal(trust.get(token).who, 'guest'); assert.equal(trust.list().length, 1);
  assert.equal(s.seats.filter(x => x.kind === 'pad' && x.state !== 'empty').length, 1);
});

test('2. who? from a phone that has not joined is ignored', () => {
  const { s, sent } = rig(); s.open('c1', ''); s.message('c1', { t: 'who?' }); assert.equal(sent.length, 0);
});

/* ---------- 3. seats ---------- */
test('3. pad seats come after the tracked seats; each phone gets the lowest empty one; the third is full', () => {
  const r = rig(); const { s, last } = r;
  s.setTracked([{ who: 'mia', name: 'Mia', avatar: null, favourite: 'pink' }, { who: 'ola', name: 'Ola', avatar: null, favourite: 'green' }]);
  r.joinPhone('c1', 'sam'); r.joinPhone('c2', 'guest');
  assert.equal(r.to('c1').find(m => m.t === 'welcome').seat, 2); assert.equal(r.to('c2').find(m => m.t === 'welcome').seat, 3);
  s.open('c3', ''); r.hello('c3', { join: s.join.pictures }); s.message('c3', { t: 'pick', who: 'mia' });
  assert.deepEqual(last('c3'), { t: 'reject', why: 'full' });
  assert.deepEqual(s.seats.map(x => [x.n, x.kind, x.state]), [[0, 'tracked', 'live'], [1, 'tracked', 'live'], [2, 'pad', 'live'], [3, 'pad', 'live']]);
});

test('3. a phone that drops keeps its seat (away) and gets it back on rejoin, even when others joined meanwhile', () => {
  const r = rig(); const { s } = r;
  const t1 = r.joinPhone('c1', 'sam');
  s.close('c1');
  assert.equal(s.seats[0].state, 'away');
  r.joinPhone('c2', 'mia');                                         /* takes the other seat, not the away one */
  assert.equal(s.seats[1].who, 'mia'); assert.equal(s.seats[0].state, 'away');
  s.open('c3', 'ua'); r.hello('c3', { device: t1 });
  assert.equal(r.last('c3').seat, 0); assert.equal(s.seats[0].state, 'live');
});

test('3. a rejoin from a new connection replaces the old one; the late close of the old one does not make the seat away', () => {
  const r = rig(); const { s } = r;
  const t1 = r.joinPhone('c1', 'sam');
  s.open('c2', ''); r.hello('c2', { device: t1 });
  assert.deepEqual(r.closed, ['c1']);
  s.close('c1');
  assert.equal(s.seats[0].state, 'live');
});

test('3. the seat list shows empty pad seats up to the minimum', () => {
  const r = rig(PEEK);
  assert.deepEqual(r.s.seats.map(x => [x.kind, x.state]), [['pad', 'empty']]);
});

/* ---------- 4. welcome ---------- */
test('4. welcome carries device, seat, who, name, avatar, colour, game, pad and need', () => {
  const r = rig(); r.joinPhone('c1', 'mia');
  const w = r.last('c1');
  assert.deepEqual(Object.keys(w).sort(), ['avatar', 'colour', 'device', 'game', 'name', 'need', 'pad', 'seat', 't', 'who'].sort());
  assert.equal(w.game, 'pop-party'); assert.equal(w.pad, '/pads/pop-party/'); assert.equal(w.need, 'controller');
  assert.equal(w.avatar, null); assert.equal(w.name, 'Mia'); assert.equal(w.seat, 0);
  assert.match(w.colour, /^#[0-9a-f]{6}$/i, 'the pad draws with a css colour');
});

test('4. two people never share a colour: the second takes the first free one', () => {
  const r = rig(); const { s } = r;
  r.joinPhone('c1', 'sam'); r.joinPhone('c2', 'ola');             /* both favour sky */
  assert.equal(s.seats[0].colour, 'sky'); assert.notEqual(s.seats[1].colour, 'sky');
  s.setTracked([{ who: 'mia', name: 'Mia', avatar: null, favourite: 'sky' }]);
  const all = s.seats.map(x => x.colour); assert.equal(new Set(all).size, all.length);
});

test('4. colourFor is the injected function and sees the taken colours', () => {
  const calls = [];
  const r = rig(POP, { session: { colourFor: (who, taken) => { calls.push([who.id, [...taken]]); return 'teal'; } } });
  r.joinPhone('c1', 'sam');
  assert.deepEqual(calls, [['sam', []]]); assert.equal(r.s.seats[0].colour, 'teal');
});

test('4. the default colour is the favourite, else the first free favourite', () => {
  assert.equal(defaultColourFor({ favourite: 'pink' }, []), 'pink');
  assert.equal(defaultColourFor({ favourite: 'pink' }, ['pink']), 'sky');
  assert.equal(defaultColourFor({}, ['sky']), 'orange');
});

/* ---------- 5. ready ---------- */
test('5. ready marks the seat and emits ready; changing who clears it', () => {
  const r = rig(); r.joinPhone('c1', 'sam');
  assert.equal(r.s.seats[0].ready, false);
  r.s.message('c1', { t: 'ready' });
  assert.equal(r.s.seats[0].ready, true); assert.equal(r.events.ready.length, 1); assert.equal(r.events.ready[0].who, 'sam');
  r.s.message('c1', { t: 'who?' }); assert.equal(r.s.seats[0].ready, false);
});

test('5. ready from a phone without a seat does nothing', () => {
  const r = rig(); r.s.open('c1', ''); r.s.message('c1', { t: 'ready' }); assert.equal(r.events.ready.length, 0);
});

/* ---------- 6. start ---------- */
test('6. start only with the required seats filled; phones never start a game', () => {
  const r = rig(PEEK); const { s } = r;
  assert.equal(s.start(), false); assert.equal(s.phase, 'lobby');
  r.joinPhone('c1', 'mia');
  r.s.message('c1', { t: 'start' }); r.s.message('c1', { t: 'ready' });
  assert.equal(s.phase, 'lobby', 'a phone message cannot start it');
  assert.equal(s.start(), true); assert.equal(s.phase, 'playing');
  assert.equal(s.start(), false, 'already playing');
});

test('6. a game with no required pads starts at once; an away required seat blocks start', () => {
  const a = rig(POP); assert.equal(a.s.start(), true);
  const b = rig(PEEK); b.joinPhone('c1', 'mia'); b.s.close('c1'); assert.equal(b.s.start(), false);
});

test('6. end sets over, and a new round can start again', () => {
  const r = rig(POP); r.s.start(); r.s.end(); assert.equal(r.s.phase, 'over'); assert.equal(r.s.start(), true);
});

/* ---------- 7. pause ---------- */
test('7. a required seat going away pauses; its rejoin resumes; 120 s paused offers to end once', () => {
  const r = rig(PEEK); const { s, clock } = r;
  const token = r.joinPhone('c1', 'mia'); s.start();
  r.sent.length = 0;
  s.close('c1');
  assert.equal(s.phase, 'paused');
  assert.deepEqual(r.sent, [{ to: '*', m: { t: 'pause', why: 'seat', who: 'mia', name: 'Mia' } }]);
  assert.deepEqual(r.events.pause, [{ why: 'seat', who: 'mia', name: 'Mia' }]);
  clock.t += 119_000; s.tick(); assert.equal(r.events.offerEnd.length, 0);
  clock.t += 1_000; s.tick(); s.tick(); assert.equal(r.events.offerEnd.length, 1, 'once');
  r.sent.length = 0;
  s.open('c2', 'ua'); r.hello('c2', { device: token });
  assert.equal(s.phase, 'playing');
  assert.deepEqual(r.sent.filter(x => x.to === '*'), [{ to: '*', m: { t: 'resume', why: 'seat' } }]);
  assert.equal(r.events.resume.length, 1);
});

test('7. the offer-to-end timer is set when paused and cancelled on resume', () => {
  const timers = []; const cleared = [];
  const r = rig(PEEK, { session: { setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimer: (id) => cleared.push(id) } });
  const token = r.joinPhone('c1', 'mia'); r.s.start(); r.s.close('c1');
  assert.equal(timers.length, 1); assert.equal(timers[0].ms, 120000);
  r.clock.t += 120_000; timers[0].fn();
  assert.equal(r.events.offerEnd.length, 1, 'the timer fires the offer');
  r.s.open('c2', ''); r.hello('c2', { device: token });
  r.s.close('c2'); assert.equal(timers.length, 2, 'paused again: a fresh timer');
  r.s.open('c3', ''); r.hello('c3', { device: token });
  assert.deepEqual(cleared, [2], 'the resume cancels it');
});

test('7. a non-required seat going away just goes quiet; nothing pauses in the lobby', () => {
  const a = rig(POP); a.joinPhone('c1', 'sam'); a.s.start(); a.sent.length = 0; a.s.close('c1');
  assert.equal(a.s.phase, 'playing'); assert.equal(a.sent.length, 0); assert.equal(a.events.pause.length, 0);
  const b = rig(PEEK); b.joinPhone('c1', 'mia'); b.s.close('c1'); assert.equal(b.s.phase, 'lobby');
});

test('7. ending while paused clears the pause', () => {
  const r = rig(PEEK); r.joinPhone('c1', 'mia'); r.s.start(); r.s.close('c1'); r.s.end();
  assert.equal(r.s.phase, 'over'); r.clock.t += 500_000; r.s.tick(); assert.equal(r.events.offerEnd.length, 0);
});

/* ---------- 8. ping, state, events, input ---------- */
test('8. ping is answered with pong n and the state counter', () => {
  const r = rig(); r.s.open('c1', ''); r.s.message('c1', { t: 'ping', n: 4 });
  assert.deepEqual(r.last('c1'), { t: 'pong', n: 4, tick: 0 });
  r.s.state({ score: 1 }); r.s.state({ score: 2 });
  r.s.message('c1', { t: 'ping', n: 5 }); assert.deepEqual(r.last('c1'), { t: 'pong', n: 5, tick: 2 });
  assert.deepEqual(r.sent.filter(x => x.to === '*').at(-1).m, { t: 'state', tick: 2, score: 2 });
});

test('8. event goes to every pad; input from a seated phone is passed on as an input event', () => {
  const r = rig(); const got = []; r.s.on('input', (e) => got.push(e));
  r.s.event('popped', { n: 3 });
  assert.deepEqual(r.sent.at(-1), { to: '*', m: { t: 'ev', e: 'popped', n: 3 } });
  r.joinPhone('c1', 'sam'); r.s.message('c1', { t: 'in', seq: 1, x: 5 });
  assert.deepEqual(got, [{ seat: 0, who: 'sam', m: { t: 'in', seq: 1, x: 5 } }]);
  r.s.open('c2', ''); r.s.message('c2', { t: 'in', seq: 1 }); assert.equal(got.length, 1);
});

/* ---------- 9. version and game ---------- */
test('9. a hello with another version is rejected; a game without pads rejects every phone', () => {
  const r = rig(); r.s.open('c1', ''); r.hello('c1', { v: 2 }); assert.deepEqual(r.last('c1'), { t: 'reject', why: 'version' });
  const q = rig(NOPADS); q.s.open('c1', ''); q.hello('c1'); assert.deepEqual(q.last('c1'), { t: 'reject', why: 'game' });
});

/* ---------- 10. forget ---------- */
test('10. forget removes the token and closes that phone; the old token is a new phone again', () => {
  const r = rig(); const token = r.joinPhone('c1', 'sam'); r.joinPhone('c2', 'mia');
  assert.equal(r.s.forget(token), true);
  assert.equal(r.trust.get(token), null); assert.deepEqual(r.closed, ['c1']);
  assert.equal(r.s.seats[0].state, 'empty'); assert.equal(r.s.seats[1].who, 'mia');
  r.s.open('c3', ''); r.hello('c3', { device: token }); assert.equal(r.last('c3').t, 'pics?');
  assert.equal(r.s.forget(token), false, 'nothing left to forget');
});

test('10. forgetting a required seat while playing pauses', () => {
  const r = rig(PEEK); const token = r.joinPhone('c1', 'mia'); r.s.start(); r.s.forget(token); assert.equal(r.s.phase, 'paused');
});

test('10. forgetting a phone that is not connected still removes the token', () => {
  const r = rig(); const token = r.joinPhone('c1', 'sam'); r.s.close('c1'); r.s.forget(token);
  assert.equal(r.trust.list().length, 0); assert.deepEqual(r.closed, []);
});

/* ---------- change events ---------- */
test('change fires when seats change', () => {
  const r = rig(); const n0 = r.events.change.length; r.joinPhone('c1', 'sam'); assert.ok(r.events.change.length > n0);
  const n1 = r.events.change.length; r.s.close('c1'); assert.ok(r.events.change.length > n1);
});

/* ---------- the trust store ---------- */
test('trust: set, get, touch, remove, list newest first, stored under orlis.trustedPads', () => {
  const st = memStorage(); const clock = { t: 100 };
  const t = createTrust(st, () => clock.t);
  assert.equal(t.get('a'), null);
  t.set('a', { who: 'sam', ua: 'iPhone' }); clock.t = 200; t.set('b', { who: 'mia', ua: 'Android Mobile' });
  assert.deepEqual(t.get('a'), { who: 'sam', ua: 'iPhone', lastSeen: 100 });
  assert.deepEqual(t.list().map(x => x.token), ['b', 'a']);
  clock.t = 300; t.touch('a'); assert.deepEqual(t.list().map(x => x.token), ['a', 'b']); assert.equal(t.get('a').lastSeen, 300);
  assert.ok(JSON.parse(st.m.get(TRUST_KEY)).a);
  assert.equal(createTrust(st).get('a').who, 'sam', 'a new store reads the same storage');
  assert.equal(t.remove('a'), true); assert.equal(t.remove('a'), false); assert.equal(t.get('a'), null);
  t.touch('nope');
});

test('trust: broken or missing storage does not throw (it works in memory)', () => {
  const bad = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } };
  const t = createTrust(bad); t.set('a', { who: 'x', ua: '' }); assert.equal(t.get('a').who, 'x');
  const junk = memStorage(); junk.setItem(TRUST_KEY, 'not json'); assert.deepEqual(createTrust(junk).list(), []);
  const none = createTrust(null); none.set('z', { who: 'q' }); assert.equal(none.list().length, 1);
});

test('trust: friendly device names from user agents', () => {
  assert.equal(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148'), 'iPhone');
  assert.equal(deviceName('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Mobile/15E148'), 'iPad');
  assert.equal(deviceName('Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/120 Mobile Safari/537.36'), 'Android phone');
  assert.equal(deviceName('Mozilla/5.0 (Linux; Android 13; Tablet) Chrome/120 Safari/537.36'), 'Android tablet');
  assert.equal(deviceName('curl/8'), 'Phone'); assert.equal(deviceName(''), 'Phone'); assert.equal(deviceName(undefined), 'Phone');
  const t = createTrust(memStorage()); t.set('a', { who: 's', ua: 'iPhone' }); assert.equal(t.list()[0].name, 'iPhone');
});

/* ---------- the host link ---------- */
class FakeWS {
  static all = [];
  constructor(url) { this.url = url; this.sent = []; FakeWS.all.push(this); }
  send(s) { this.sent.push(JSON.parse(s)); }
  close() { this.onclose && this.onclose(); }
}

test('host link: with no hub configured it does nothing', () => {
  FakeWS.all = [];
  const link = createHostLink(null, { WebSocketImpl: FakeWS });
  assert.equal(link.enabled, false); assert.equal(link.start(), false);
  link.send('c1', { t: 'x' }); link.send.close('c1'); link.stop();
  assert.equal(FakeWS.all.length, 0);
  assert.equal(hubConfig({}), null); assert.equal(hubConfig({ __ORLIS_PAD_HUB__: { port: 1 } }), null);
  assert.deepEqual(hubConfig({ __ORLIS_PAD_HUB__: { port: 47880, key: 'k' } }), { port: 47880, key: 'k' });
});

test('host link: connects as host, feeds the session, sends {to,m} and {to,close}, closes pads when the hub drops, reconnects with backoff', () => {
  FakeWS.all = [];
  const timers = [];
  const link = createHostLink({ port: 47880, key: 'sec ret' }, { WebSocketImpl: FakeWS, setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimer: () => {} });
  const calls = [];
  link.attach({ open: (...a) => calls.push(['open', ...a]), close: (...a) => calls.push(['close', ...a]), message: (...a) => calls.push(['message', ...a]) });
  assert.equal(link.start(), true);
  let ws = FakeWS.all[0];
  assert.equal(ws.url, 'ws://127.0.0.1:47880/ws?role=host&key=sec%20ret');
  link.send('c1', { t: 'x' }); assert.equal(ws.sent.length, 0, 'not sent before the socket is open');
  ws.onopen();
  link.send('c1', { t: 'welcome' }); link.send.close('c2');
  assert.deepEqual(ws.sent, [{ to: 'c1', m: { t: 'welcome' } }, { to: 'c2', close: true }]);
  ws.onmessage({ data: JSON.stringify({ t: 'open', from: 'c1', ua: 'UA' }) });
  ws.onmessage({ data: JSON.stringify({ t: 'msg', from: 'c1', m: { t: 'ping', n: 1 } }) });
  ws.onmessage({ data: 'garbage' });
  ws.onmessage({ data: JSON.stringify({ t: 'open', from: 'c2', ua: 'U2' }) });
  ws.onmessage({ data: JSON.stringify({ t: 'close', from: 'c2' }) });
  assert.deepEqual(calls, [['open', 'c1', 'UA'], ['message', 'c1', { t: 'ping', n: 1 }], ['open', 'c2', 'U2'], ['close', 'c2']]);
  calls.length = 0;
  ws.onclose();                                            /* the hub went away: pads that were open are gone */
  assert.deepEqual(calls, [['close', 'c1']]);
  assert.equal(timers.at(-1).ms, 500);
  timers.at(-1).fn(); ws = FakeWS.all[1]; ws.onclose(); assert.equal(timers.at(-1).ms, 1000);
  timers.at(-1).fn(); FakeWS.all[2].onclose(); assert.equal(timers.at(-1).ms, 2000);
  timers.at(-1).fn(); FakeWS.all[3].onclose(); assert.equal(timers.at(-1).ms, 4000);
  timers.at(-1).fn(); FakeWS.all[4].onclose(); assert.equal(timers.at(-1).ms, 4000, 'max 4 s');
  timers.at(-1).fn(); FakeWS.all[5].onopen(); FakeWS.all[5].onclose(); assert.equal(timers.at(-1).ms, 500, 'a good connection resets the backoff');
  const n = FakeWS.all.length; link.stop(); timers.at(-1).fn(); assert.equal(FakeWS.all.length, n, 'stopped: no more connecting');
});
