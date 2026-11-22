/* Pads in the game shell (plan package S1): the game API wiring (session/pads.js), the pause pill's logic, the hub config, and the Trusted phones
   list's text (plan package P5). The shell itself, with a real phone, is in pads-shell.node.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPads, usesPads, padHub, padPageUrl, peopleFrom, colourFor, waitingText, pauseWatch, STATE_GAP_MS, WIFI_HINT_AFTER, currentPads } from '../src/session/pads.js';
import { createTrust } from '../src/session/trust.js';
import { whenText, phoneRows } from '../src/ui/trusted-phones.js';
import { personOf } from '../src/ui/pad-faces.js';
import { GAMES, LABS } from '../src/games/index.js';
import padLab from '../src/games/labs/pad-lab.js';

const PROFILES = [
  { id: 'mia', name: 'Mia', look: { colour: 'pink', face: { eyes: 'happy', mouth: 'grin' }, top: 'bob', outfit: 'plain', outfitColour: 'shade.card', extra: 'none' } },
  { id: 'sam', name: 'Sam', look: { colour: 'sky' } },
  { id: 'ola', name: 'Ola' }
];
const LAB = { id: 'lab', seats: { tracked: [0, 2], pads: [1, 2] }, pads: { program: '/pads/lab/', need: 'controller' }, requiredPads: 1 };
const POPPY = { id: 'poppy', seats: { tracked: [1, 4], pads: [0, 2] }, pads: { program: '/pads/poppy/', need: 'controller' } };
const NOPADS = { id: 'quiet', seats: { tracked: [1, 1], pads: [0, 0] } };

function memStorage() { const m = new Map(); return { getItem: (k) => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)) }; }

/* a pads runtime with a fake link, fake clock and fake timers */
function rig(game = LAB, opts = {}) {
  const clock = { t: 1_000_000 }, sent = [], closed = [], timers = [];
  const link = { session: null, started: 0, stopped: 0, attach(s) { this.session = s; }, start() { this.started++; return true; }, stop() { this.stopped++; } };
  link.send = (to, m) => sent.push({ to, m }); link.send.close = (to) => closed.push(to);
  const setTimer = (fn, ms) => { const t = { fn, at: clock.t + ms, dead: false }; timers.push(t); return t; };
  const clearTimer = (t) => { if (t) t.dead = true; };
  const advance = (ms) => { clock.t += ms; for (const t of timers.filter(x => !x.dead && x.at <= clock.t)) { t.dead = true; t.fn(); } };
  let n = 0;
  const trust = createTrust(memStorage(), () => clock.t);
  const rt = createPads({ game, people: () => peopleFrom(PROFILES), trust, config: { port: 1, key: 'k' }, createLink: () => link, now: () => clock.t, setTimer, clearTimer,
    newToken: () => 'tok' + String(++n).padStart(21, '0'), ...opts });
  const s = rt.session;
  const to = (id) => sent.filter(x => x.to === id).map(x => x.m);
  const hello = (id, extra = {}) => s.message(id, { t: 'hello', v: 1, device: null, join: null, screen: { w: 1, h: 1, dpr: 1 }, gl: true, ...extra });
  const joinPhone = (id, who = 'sam') => { s.open(id, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'); hello(id); hello(id, { join: s.join.pictures }); s.message(id, { t: 'pick', who }); return to(id).at(-1).device; };
  return { rt, s, link, sent, closed, clock, advance, to, hello, joinPhone, trust, timers };
}

/* ---------- the manifest ---------- */
test('usesPads: only a game whose manifest has pad seats; games without behave as before', () => {
  assert.equal(usesPads(LAB), true); assert.equal(usesPads(POPPY), true);
  assert.equal(usesPads(NOPADS), false); assert.equal(usesPads({ id: 'old' }), false); assert.equal(usesPads(null), false);
  assert.equal(usesPads({ seats: { tracked: [1, 1], pads: [0, 0] } }), false);
  assert.ok(GAMES.every(g => !usesPads(g)), 'no catalogue game uses phones yet');
});
test('the pad lab is an owner-only lab with a manifest the session understands', () => {
  assert.ok(LABS.includes(padLab) && !GAMES.includes(padLab));
  assert.deepEqual(padLab.seats, { tracked: [0, 2], pads: [1, 2] });
  assert.deepEqual(padLab.pads, { program: '/pads/pad-lab/', need: 'controller' });
  assert.equal(padLab.requiredPads, 1);
});

/* ---------- where the hub is ---------- */
test('hub config: the app sets window.__ORLIS_PAD_HUB__; the dev ?padhub= is only honoured when allowed', () => {
  assert.equal(padHub({ g: {} }), null);
  assert.deepEqual(padHub({ g: { __ORLIS_PAD_HUB__: { port: 47880, key: 'k', lan: '192.168.1.20' } } }), { port: 47880, key: 'k', lan: '192.168.1.20' });
  assert.deepEqual(padHub({ g: { __ORLIS_PAD_HUB__: { port: 47880, key: 'k' } }, search: '?padhub=1:2' }), { port: 47880, key: 'k' }, 'the app wins');
  assert.equal(padHub({ g: {}, search: '?padhub=47880:secret' }), null, 'not allowed by default');
  assert.deepEqual(padHub({ g: {}, search: '?game=x&padhub=47881:sec:ret&padhost=192.168.1.9', allowDev: true }), { port: 47881, key: 'sec:ret', lan: '192.168.1.9' });
  for (const bad of ['?padhub=', '?padhub=abc:key', '?padhub=47880', '?padhub=0:k', '?padhub=99999:k', '?padhub=47880:']) assert.equal(padHub({ g: {}, search: bad, allowDev: true }), null, bad);
});
test('the QR opens the pad page at the hub LAN address, never with a secret', () => {
  assert.equal(padPageUrl(null), null);
  assert.equal(padPageUrl({ port: 47880, key: 'k', lan: '192.168.1.20' }, { hostname: 'localhost' }), 'http://192.168.1.20:47880/');
  assert.equal(padPageUrl({ port: 47881, key: 'k' }, { hostname: '192.168.1.5' }), 'http://192.168.1.5:47881/', 'the address this page was opened from');
  assert.equal(padPageUrl({ port: 47880, key: 'k' }, { hostname: 'localhost' }), 'http://127.0.0.1:47880/');
  assert.equal(padPageUrl({ port: 47880, key: 'k', url: 'http://10.0.0.2:47880/' }, null), 'http://10.0.0.2:47880/');
  assert.equal(padPageUrl({ port: 1, key: 'k', lan: 'fe80::1' }), 'http://[fe80::1]:1/');
  assert.ok(!/key|secret/.test(padPageUrl({ port: 47880, key: 'topsecret', lan: '10.0.0.2' })));
});

/* ---------- people and colours ---------- */
test('people: the household with looks, then Guest (drawn as Cubo); old looks are carried over', () => {
  const p = peopleFrom([...PROFILES, { id: 'guest', name: 'x' }, null]);
  assert.deepEqual(p.map(x => x.id), ['mia', 'sam', 'ola', 'guest']);
  assert.equal(p[0].favourite, 'pink'); assert.equal(p[0].avatar.top, 'bob');
  assert.equal(p[1].favourite, 'sky'); assert.equal(p[1].avatar.face.eyes, 'dot', 'a partial look is completed');
  assert.equal(p[2].avatar, null); assert.equal(p[2].favourite, undefined);
  assert.deepEqual(p[3], { id: 'guest', name: 'Guest', avatar: null });
  assert.equal(peopleFrom(null).length, 1);
  assert.equal(peopleFrom([{ id: 'k', name: 'Old', look: { color: '#ea5353', eyes: 'happy', hair: 'short' } }])[0].favourite, 'red', 'a look from before the one character');
});
test('colours for phones: the favourite if free, else the nearest free one, a guest the next free', () => {
  assert.equal(colourFor({ favourite: 'pink' }, []), 'pink');
  const c = colourFor({ favourite: 'pink' }, ['pink']); assert.notEqual(c, 'pink');
  assert.equal(colourFor({ favourite: 'sky' }, ['orange', 'sky']) === 'sky', false);
  const g = colourFor({}, ['sky']); assert.notEqual(g, 'sky');
  assert.equal(colourFor({ id: 'guest' }, ['sky', 'orange', 'green', 'purple']), 'pink');
  assert.ok(colourFor({ favourite: 'red' }, ['sky', 'orange', 'green', 'purple', 'pink', 'yellow', 'teal', 'red']), 'even with nothing free');
});

/* ---------- the game API ---------- */
test('join and leave: seats going live (and coming back) and going away are told to the game', () => {
  const r = rig(); const got = [];
  const api = r.rt.forRound();
  api.on('join', (e) => got.push(['join', e.seat, e.who, e.name, !!e.colour])); api.on('leave', (e) => got.push(['leave', e.seat, e.who]));
  r.joinPhone('c1', 'sam');
  assert.deepEqual(got, [['join', 0, 'sam', 'Sam', true]], 'pad seats are numbered after the tracked ones (none here)');
  r.s.close('c1'); assert.deepEqual(got.at(-1), ['leave', 0, 'sam']);
  const tok = r.trust.list()[0].token;
  r.s.open('c2', 'ua'); r.hello('c2', { device: tok });
  assert.deepEqual(got.at(-1), ['join', 0, 'sam', 'Sam', true], 'its rejoin is a join');
  /* changing who on the same seat is a leave then a join */
  r.s.message('c2', { t: 'who?' }); r.s.message('c2', { t: 'pick', who: 'mia' });
  assert.deepEqual(got.slice(-2), [['leave', 0, 'sam'], ['join', 0, 'mia', 'Mia', true]]);
});
test('join also fires at once for the phones already in (a game is made after the join card)', () => {
  const r = rig(); r.joinPhone('c1', 'sam'); r.joinPhone('c2', 'mia');
  const got = []; const api = r.rt.forRound();
  api.on('join', (e) => got.push(e.who));
  assert.deepEqual(got.sort(), ['mia', 'sam']);
  api.on('leave', () => { throw new Error('no replay for leave'); });
});
test('input: a phone\'s `in` message arrives with its seat number and person', () => {
  const r = rig(LAB); r.s.setTracked([{ who: 'cam0', name: 'Player 1', favourite: 'sky' }]);
  const got = []; r.rt.forRound().on('input', (e) => got.push(e));
  r.joinPhone('c1', 'sam');
  r.s.message('c1', { t: 'in', seq: 1, x: 0.5, y: -1 });
  assert.equal(got.length, 1); assert.equal(got[0].seat, 1, 'after the one tracked seat'); assert.equal(got[0].who, 'sam');
  assert.deepEqual({ x: got[0].m.x, y: got[0].m.y, seq: got[0].m.seq }, { x: 0.5, y: -1, seq: 1 });
  r.s.message('c9', { t: 'in', seq: 1 }); assert.equal(got.length, 1, 'a connection with no seat is not heard');
});
test('send: to one seat (by its phone), to everyone, an unknown seat does nothing; it arrives on the pad as an ev', () => {
  const r = rig(LAB); const api = r.rt.forRound();
  r.joinPhone('c1', 'sam'); r.joinPhone('c2', 'mia');
  r.sent.length = 0;
  api.send(1, { e: 'found', n: 3 }); assert.deepEqual(r.sent, [{ to: 'c2', m: { t: 'ev', e: 'found', n: 3 } }]);
  r.sent.length = 0; api.send('*', { text: 'hi' }); assert.deepEqual(r.sent, [{ to: '*', m: { t: 'ev', e: 'msg', text: 'hi' } }]);
  r.sent.length = 0; api.send(7, { e: 'x' }); api.send(0, null); api.send(0, 'str'); assert.deepEqual(r.sent, []);
  /* a phone that left is not sent to */
  r.s.close('c1'); r.sent.length = 0; api.send(0, { e: 'x' }); assert.deepEqual(r.sent, []);
});
test('seats: tracked first, then phones, as the session lists them', () => {
  const r = rig(LAB); r.s.setTracked([{ who: 'cam0', name: 'Player 1', favourite: 'orange' }]);
  r.joinPhone('c1', 'sam');
  const seats = r.rt.forRound().seats;
  assert.deepEqual(seats.map(s => [s.n, s.kind, s.who, s.state]), [[0, 'tracked', 'cam0', 'live'], [1, 'pad', 'sam', 'live']]);
});
test('state: throttled to about 18 a second, the latest wins, nothing is lost at the end', () => {
  const r = rig(); const api = r.rt.forRound();
  const states = () => r.sent.filter(x => x.m.t === 'state');
  assert.ok(STATE_GAP_MS >= 50 && STATE_GAP_MS <= 67, 'between 15 and 20 a second');
  api.state({ n: 1 }); assert.equal(states().length, 1, 'the first goes at once');
  api.state({ n: 2 }); api.state({ n: 3 }); api.state({ n: 4 }); assert.equal(states().length, 1, 'a burst waits');
  r.advance(STATE_GAP_MS - 1); assert.equal(states().length, 1);
  r.advance(1); assert.equal(states().length, 2); assert.equal(states()[1].m.n, 4, 'the latest');
  /* 60 frames in a second: no more than 20 go out */
  r.sent.length = 0;
  for (let i = 0; i < 60; i++) { api.state({ n: 100 + i }); r.advance(1000 / 60); }
  r.advance(STATE_GAP_MS);
  assert.ok(states().length >= 15 && states().length <= 20, `sent ${states().length} in a second`);
  assert.equal(states().at(-1).m.n, 159, 'the last state is not dropped');
  api.state(null); api.state('x');                                    /* (not objects: ignored) */
  assert.deepEqual(states().map(x => x.m.tick), states().map((_, i) => states()[0].m.tick + i), 'ticks count up');
});
test('a game never starts the session: pads has no start, end or stop; rounds hand out their own handle and take handlers away', () => {
  const r = rig(); const api = r.rt.forRound();
  for (const k of ['start', 'end', 'stop', 'go', 'forget', 'session']) assert.equal(api[k], undefined, k);
  const got = []; api.on('input', () => got.push(1));
  r.joinPhone('c1', 'sam'); r.s.message('c1', { t: 'in', seq: 1 }); assert.equal(got.length, 1);
  api.dispose(); r.s.message('c1', { t: 'in', seq: 2 }); assert.equal(got.length, 1, 'a finished round hears nothing more');
  const api2 = r.rt.forRound(); api2.on('input', () => got.push(2)); r.s.message('c1', { t: 'in', seq: 3 }); assert.deepEqual(got, [1, 2]);
  const off = api2.on('input', () => got.push(3)); off(); r.s.message('c1', { t: 'in', seq: 4 }); assert.deepEqual(got.slice(2), [2]);
});
test('a handler that throws does not break the others or the session', () => {
  const r = rig(); const api = r.rt.forRound(); const got = [];
  const warn = console.warn; console.warn = () => {};
  try { api.on('input', () => { throw new Error('bad game'); }); api.on('input', () => got.push('ok')); r.joinPhone('c1', 'sam'); r.s.message('c1', { t: 'in', seq: 1 }); } finally { console.warn = warn; }
  assert.deepEqual(got, ['ok']);
});

/* ---------- the TV's Start ---------- */
test('Start: only when the needed phone is in; phones never start; the lobby, the round, and play again', () => {
  const r = rig(LAB);
  assert.equal(r.s.canStart, false); assert.equal(r.rt.go(), false); assert.equal(r.s.phase, 'lobby');
  r.joinPhone('c1', 'sam');
  r.s.message('c1', { t: 'start' }); assert.equal(r.s.phase, 'lobby', 'a phone cannot start it');
  assert.equal(r.s.canStart, true); assert.equal(r.rt.go(), true); assert.equal(r.s.phase, 'playing'); assert.equal(r.s.canStart, false);
  r.rt.end(); assert.equal(r.s.phase, 'over'); assert.equal(r.s.canStart, true, 'play again from the scores');
  const q = rig(POPPY); assert.equal(q.s.canStart, true, 'a game that does not need a phone starts with none');
});
test('no hub (the browser build): nothing connects and nothing throws', () => {
  const rt = createPads({ game: LAB, people: () => peopleFrom([]), config: null });
  assert.equal(rt.link.enabled, false); assert.equal(rt.connect(), false); assert.equal(rt.padUrl, null);
  rt.forRound().state({ a: 1 }); rt.forRound().send('*', { e: 'x' }); rt.stop();
});
test('the running pads are findable (Settings uses it) until stopped', () => {
  const r = rig(); assert.equal(currentPads(), r.rt); r.rt.stop(); assert.equal(currentPads(), null); assert.equal(r.link.stopped, 1);
  const r2 = rig(); r2.rt.connect(); assert.equal(r2.link.started, 1); r2.rt.stop();
});

/* ---------- the pause pill ---------- */
test('the pill words: "Waiting for Sam\'s phone", or "a phone" when no name is known', () => {
  assert.equal(waitingText('Sam'), "Waiting for Sam's phone"); assert.equal(waitingText(null), 'Waiting for a phone'); assert.equal(waitingText(''), 'Waiting for a phone');
});
test('pause pill logic: a needed phone dropping while playing shows who we wait for; its return clears it; 120 s offers to end, once', () => {
  const r = rig(LAB); const w = r.rt.pause; const seen = [];
  w.on((st) => seen.push([st.waiting && st.waiting.name, st.offered]));
  const tok = r.joinPhone('c1', 'sam'); r.rt.go();
  assert.equal(w.waiting, null);
  r.s.close('c1');
  assert.deepEqual(w.waiting, { who: 'sam', name: 'Sam' }); assert.equal(w.text, "Waiting for Sam's phone"); assert.equal(w.offered, false);
  r.advance(119_000); assert.equal(w.offered, false, 'not yet');
  r.advance(1_000); assert.equal(w.offered, true, '120 s: offer to end'); assert.equal(w.waiting.name, 'Sam');
  const offers = seen.filter(x => x[1]).length; r.s.tick(); assert.equal(seen.filter(x => x[1]).length, offers, 'offered once');
  r.s.open('c2', 'ua'); r.hello('c2', { device: tok });
  assert.equal(w.waiting, null); assert.equal(w.offered, false); assert.equal(w.text, '');
  assert.equal(r.s.phase, 'playing');
});
test('pause pill logic: a phone the game can do without, or one that drops in the lobby, shows nothing; ending clears the pill', () => {
  const q = rig(POPPY); q.joinPhone('c1', 'sam'); q.rt.go(); q.s.close('c1');
  assert.equal(q.rt.pause.waiting, null); assert.equal(q.s.phase, 'playing', 'extra phones just go quiet');
  const r = rig(LAB); r.joinPhone('c1', 'sam'); r.s.close('c1'); assert.equal(r.rt.pause.waiting, null, 'not playing yet');
  const e = rig(LAB); e.joinPhone('c1', 'ola'); e.rt.go(); e.s.close('c1'); assert.equal(e.rt.pause.waiting.name, 'Ola');
  e.rt.end(); assert.equal(e.rt.pause.waiting, null, 'the round ended while waiting');
});
test('pause pill logic: removing the needed phone in Settings while playing also waits; the pill names who', () => {
  const r = rig(LAB); const tok = r.joinPhone('c1', 'mia'); r.rt.go();
  r.s.forget(tok);
  assert.equal(r.s.phase, 'paused'); assert.equal(r.rt.pause.text, 'Waiting for a phone', 'the seat is empty, nobody to name');
});
test('the wifi line comes after 90 s (a constant the card uses)', () => { assert.equal(WIFI_HINT_AFTER, 90); });

/* ---------- Trusted phones ---------- */
test('when a phone was last used, said the way a person would', () => {
  const noon = new Date(2026, 10, 21, 12, 0, 0).getTime(), D = 86400000;
  assert.equal(whenText(noon - 3600000, noon), 'Today');
  assert.equal(whenText(new Date(2026, 10, 21, 0, 5).getTime(), new Date(2026, 10, 21, 23, 55).getTime()), 'Today', 'the same calendar day');
  assert.equal(whenText(noon - D, noon), 'Yesterday');
  assert.equal(whenText(new Date(2026, 10, 20, 23, 59).getTime(), new Date(2026, 10, 21, 0, 1).getTime()), 'Yesterday', 'calendar days, not 24 hours');
  assert.equal(whenText(noon - 4 * D, noon), '4 days ago');
  assert.equal(whenText(noon - 21 * D, noon), '3 weeks ago');
  assert.equal(whenText(noon - 90 * D, noon), '3 months ago');
  assert.equal(whenText(0, noon), 'A while ago'); assert.equal(whenText(noon + D, noon), 'Today', 'a clock a little ahead is today');
});
test('the Trusted phones rows: device name, the person (Guest and unknown ones too), when', () => {
  const noon = new Date(2026, 10, 21, 12).getTime();
  const trust = createTrust(memStorage(), () => noon - 86400000);
  trust.set('a', { who: 'sam', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' });
  trust.set('b', { who: 'guest', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel) Mobile Safari', lastSeen: noon - 1000 });
  trust.set('c', { who: 'gone', ua: 'Mozilla/5.0 (Linux; Android 14; Tab)', lastSeen: noon - 21 * 86400000 });
  const rows = phoneRows(trust.list(), PROFILES, noon);
  assert.deepEqual(rows.map(r => [r.token, r.device, r.name, r.when]), [['b', 'Android phone', 'Guest', 'Today'], ['a', 'iPhone', 'Sam', 'Yesterday'], ['c', 'Android tablet', 'Someone', '3 weeks ago']]);
  assert.equal(rows[0].avatar, null); assert.equal(rows[1].avatar.colour, 'sky');
  assert.deepEqual(personOf('guest', PROFILES), { name: 'Guest', avatar: null }); assert.equal(personOf(null, []).name, 'Guest');
});
