/* The pad hub (plan package P1): spec tests 1, 4 and 5 from docs/specs/pad-protocol.md, plus the hub's own relay rules.
   Run by pad-hub.test.mjs in a plain Node process (the shared test harness replaces Event, which Node's WebSocket client needs).
   A pretend host (tools/pad-fake-host.mjs) plays the game's side; real WebSocket pads talk to the real hub over localhost. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { startHub, CLOSE, LIMITS } from '../../tools/pad-hub.mjs';
import { FakeHost } from '../../tools/pad-fake-host.mjs';

const KEY = 'test-secret';
const hubUp = (o = {}) => startHub({ port: 0, host: '127.0.0.1', key: KEY, padDir: null, ...o });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* a phone: queues what it hears; waitFor(pred) finds a message (already heard or yet to come); closed resolves with the close code */
function pad(hub, { ua } = {}) {
  const ws = new WebSocket(`${hub.wsUrl}/ws?role=pad`);
  const heard = [], waiters = [];
  let closeInfo = null, onClosed;
  const closed = new Promise(r => { onClosed = r; });
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); heard.push(m); for (const w of [...waiters]) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(m); } });
  ws.addEventListener('close', (e) => { closeInfo = { code: e.code, reason: e.reason }; onClosed(closeInfo); for (const w of waiters) w.reject(new Error(`closed (${e.code}) before the message came`)); waiters.length = 0; });
  const opened = new Promise((res, rej) => { ws.addEventListener('open', () => res()); ws.addEventListener('error', () => rej(new Error('could not connect'))); });
  return {
    ws, heard, closed, opened,
    send: (o) => ws.send(typeof o === 'string' ? o : JSON.stringify(o)),
    waitFor: (pred, ms = 2000) => new Promise((resolve, reject) => {
      const hit = heard.find(pred); if (hit) return resolve(hit);
      if (closeInfo) return reject(new Error(`closed (${closeInfo.code})`));
      const w = { pred, resolve, reject }; waiters.push(w);
      setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); reject(new Error('timed out waiting for a message')); } }, ms);
    }),
    get closeInfo() { return closeInfo; }
  };
}
const hello = (extra = {}) => ({ t: 'hello', v: 1, device: null, join: null, screen: { w: 390, h: 844, dpr: 3 }, gl: true, ...extra });

/* a bare host that just records what the hub sends it */
async function rawHost(hub, key = KEY) {
  const ws = new WebSocket(`${hub.wsUrl}/ws?role=host&key=${key}`), got = [];
  ws.addEventListener('message', (e) => got.push(JSON.parse(e.data)));
  const closed = new Promise(r => ws.addEventListener('close', (e) => r({ code: e.code })));
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', () => rej(new Error('refused'))); });
  return { ws, got, closed, send: (o) => ws.send(JSON.stringify(o)) };
}
const until = async (fn, ms = 2000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(10); } return false; };

/* ---------- spec test 1: join with the picture code, pick who, get a seat; wrong pictures; five wrong tries wait ---------- */
test('1. a phone joins with the picture code, picks who it is and gets a seat; wrong pictures are turned away; five wrong tries wait', async () => {
  const hub = await hubUp();
  let clock = 1_000_000;
  const host = await new FakeHost({ url: hub.wsUrl, key: KEY, now: () => clock }).start();
  try {
    const a = pad(hub); await a.opened;
    /* no secret yet: the phone is shown the nine pictures */
    a.send(hello());
    const pics = await a.waitFor(m => m.t === 'pics?');
    assert.equal(pics.grid.length, 9);
    assert.deepEqual(['balloon', 'cat', 'star'].filter(w => pics.grid.includes(w)), ['balloon', 'cat', 'star'], 'the three right pictures are in the nine');
    /* wrong pictures */
    a.send(hello({ join: ['fish', 'tree', 'moon'] }));
    assert.equal((await a.waitFor(m => m.t === 'reject')).why, 'join');
    /* right pictures, in order: asked who it is */
    a.send(hello({ join: ['balloon', 'cat', 'star'] }));
    const who = await a.waitFor(m => m.t === 'who?');
    assert.deepEqual(who.people.map(p => p.id), ['mia', 'sam', 'ola', 'guest']);
    a.send({ t: 'pick', who: 'sam' });
    const w = await a.waitFor(m => m.t === 'welcome');
    assert.equal(w.seat, 0); assert.equal(w.who, 'sam'); assert.ok(w.device && w.device.length >= 16, 'a token to keep'); assert.equal(w.game, 'pop-party'); assert.equal(w.need, 'controller');
    /* a second phone gets the next seat */
    const b = pad(hub); await b.opened;
    b.send(hello({ join: ['balloon', 'cat', 'star'] })); await b.waitFor(m => m.t === 'who?');
    b.send({ t: 'pick', who: 'mia' });
    assert.equal((await b.waitFor(m => m.t === 'welcome')).seat, 1);
    /* five wrong tries: wait a minute, even for the right pictures */
    const c = pad(hub); await c.opened;
    for (let i = 0; i < 4; i++) { c.send(hello({ join: ['fish', 'tree', 'moon'] })); }
    await until(() => c.heard.filter(m => m.t === 'reject' && m.why === 'join').length === 4);
    c.send(hello({ join: ['sun', 'kite', 'shoe'] }));
    await until(() => c.heard.some(m => m.t === 'reject' && m.why === 'wait'));
    assert.ok(c.heard.some(m => m.t === 'reject' && m.why === 'wait'), 'the fifth wrong try is told to wait');
    c.send(hello({ join: ['balloon', 'cat', 'star'] }));
    await until(() => c.heard.filter(m => m.t === 'reject' && m.why === 'wait').length === 2);
    assert.equal(c.heard.filter(m => m.t === 'reject' && m.why === 'wait').length, 2, 'the right pictures wait too');
    assert.ok(!c.heard.some(m => m.t === 'who?'));
    clock += 61_000;                                   /* a minute later */
    c.send(hello({ join: ['balloon', 'cat', 'star'] }));
    assert.ok(await c.waitFor(m => m.t === 'who?'), 'then the right pictures work');
    /* the hub told the host who came and went */
    assert.deepEqual(host.seen.filter(m => m.t === 'open').map(m => m.from), ['c1', 'c2', 'c3']);
  } finally { host.stop(); await hub.close(); }
});

/* ---------- spec test 4: the host restarts ---------- */
test('4. when the host restarts, pads are told "no game running" (4001) and rejoin their seat when it is back', async () => {
  const hub = await hubUp(), tokens = new Map();
  let host = await new FakeHost({ url: hub.wsUrl, key: KEY, tokens }).start();
  try {
    const a = pad(hub); await a.opened;
    a.send(hello({ join: ['balloon', 'cat', 'star'] })); await a.waitFor(m => m.t === 'who?');
    a.send({ t: 'pick', who: 'ola' });
    const first = await a.waitFor(m => m.t === 'welcome');
    host.stop();                                                          /* the host goes away */
    const gone = await a.closed;
    assert.equal(gone.code, CLOSE.noGame); assert.match(gone.reason, /no game/);
    /* while it is away, a new connection is refused the same way (the pad page shows "Start Orlis on the TV") */
    const b = pad(hub); await b.opened;
    assert.equal((await b.closed).code, CLOSE.noGame);
    assert.equal(hub.padCount, 0);
    /* the host comes back (the Box remembers trusted phones); the pad reconnects with its token and gets the same seat */
    host = await new FakeHost({ url: hub.wsUrl, key: KEY, tokens }).start();
    const c = pad(hub); await c.opened;
    c.send(hello({ device: first.device }));
    const again = await c.waitFor(m => m.t === 'welcome');
    assert.equal(again.seat, first.seat); assert.equal(again.who, 'ola'); assert.equal(again.device, first.device);
    assert.ok(!c.heard.some(m => m.t === 'pics?' || m.t === 'who?'), 'no pictures needed the second time');
  } finally { host.stop(); await hub.close(); }
});

/* ---------- spec test 5: limits ---------- */
test('5. oversized and too-fast messages are dropped, a pad that sends junk is closed, and the hub carries on', async () => {
  const hub = await hubUp(), host = await rawHost(hub);
  try {
    const a = pad(hub); await a.opened;
    await until(() => host.got.some(m => m.t === 'open'));
    /* oversized: dropped, the pad stays and the next message still arrives */
    a.send(JSON.stringify({ t: 'in', seq: 1, pad: 'x'.repeat(LIMITS.message + 100) }));
    a.send({ t: 'in', seq: 2 });
    assert.ok(await until(() => host.got.some(m => m.t === 'msg' && m.m.seq === 2)), 'the small one after it is relayed');
    assert.ok(!host.got.some(m => m.t === 'msg' && m.m.seq === 1), 'the big one is not');
    assert.equal(hub.stats.droppedBig, 1);
    assert.equal(a.closeInfo, null, 'the pad is still connected');
    /* too fast: 60 a second, the rest dropped */
    const before = host.got.filter(m => m.t === 'msg').length;
    for (let i = 0; i < 300; i++) a.send({ t: 'in', seq: 1000 + i });
    await until(() => hub.stats.relayed + hub.stats.droppedFast >= before + 300 - 1, 3000);
    await sleep(100);
    const relayed = host.got.filter(m => m.t === 'msg' && m.m.seq >= 1000).length;
    assert.ok(relayed >= 50 && relayed <= 90, `about a second's worth got through (${relayed})`);
    assert.ok(hub.stats.droppedFast >= 200, `the rest were dropped (${hub.stats.droppedFast})`);
    /* junk: not JSON, and JSON that is not an object, closes that pad only */
    const bad = pad(hub); await bad.opened;
    bad.send('this is not json');
    assert.equal((await bad.closed).code, CLOSE.badData);
    const arr = pad(hub); await arr.opened; arr.send('[1,2,3]');
    assert.equal((await arr.closed).code, CLOSE.badData);
    assert.equal(hub.stats.closedBadJson, 2);
    /* still serving */
    const ok = pad(hub); await ok.opened; ok.send({ t: 'ping', n: 1 });
    assert.ok(await until(() => host.got.some(m => m.t === 'msg' && m.m.t === 'ping')));
    assert.equal(a.closeInfo, null, 'the first pad was never affected');
  } finally { host.ws.close(); await hub.close(); }
});

/* ---------- the hub's own rules ---------- */
test('the hub relays in both directions with the spec shapes: open, msg, close, and to one pad, to all, or close one', async () => {
  const hub = await hubUp(), host = await rawHost(hub);
  try {
    const a = pad(hub, {}); await a.opened;
    const b = pad(hub); await b.opened;
    await until(() => host.got.filter(m => m.t === 'open').length === 2);
    const opens = host.got.filter(m => m.t === 'open');
    assert.deepEqual(opens.map(o => o.from), ['c1', 'c2']);
    assert.equal(typeof opens[0].ua, 'string');
    a.send({ t: 'in', seq: 7, x: 0.4 });
    await until(() => host.got.some(m => m.t === 'msg'));
    assert.deepEqual(host.got.find(m => m.t === 'msg'), { t: 'msg', from: 'c1', m: { t: 'in', seq: 7, x: 0.4 } });
    host.send({ to: 'c2', m: { t: 'state', tick: 1 } });
    assert.equal((await b.waitFor(m => m.t === 'state')).tick, 1);
    assert.ok(!a.heard.some(m => m.t === 'state'), 'only c2 heard it');
    host.send({ to: '*', m: { t: 'pause', why: 'seat' } });
    await a.waitFor(m => m.t === 'pause'); await b.waitFor(m => m.t === 'pause');
    host.send({ to: 'c1', close: true });
    assert.equal((await a.closed).code, CLOSE.normal);
    await until(() => host.got.some(m => m.t === 'close' && m.from === 'c1'));
    assert.ok(host.got.some(m => m.t === 'close' && m.from === 'c1'), 'the host is told it left');
    assert.equal(b.closeInfo, null);
  } finally { host.ws.close(); await hub.close(); }
});

test('the host needs the secret, and a second host replaces the first (the pads stay and the new host learns who is here)', async () => {
  const hub = await hubUp();
  try {
    await assert.rejects(rawHost(hub, 'wrong'), /refused/);
    const one = await rawHost(hub);
    const a = pad(hub); await a.opened; await until(() => one.got.some(m => m.t === 'open'));
    const two = await rawHost(hub);
    assert.equal((await one.closed).code, CLOSE.replaced);
    await until(() => two.got.some(m => m.t === 'open'));
    assert.deepEqual(two.got.find(m => m.t === 'open').from, 'c1');
    assert.equal(a.closeInfo, null, 'the pad was not dropped');
    a.send({ t: 'in', seq: 1 });
    assert.ok(await until(() => two.got.some(m => m.t === 'msg')), 'its messages go to the new host');
    two.ws.close();
  } finally { await hub.close(); }
});

test('there is room for 16 pads; the 17th is told the garden is full (4003)', async () => {
  const hub = await hubUp(), host = await rawHost(hub);
  try {
    const pads = []; for (let i = 0; i < LIMITS.pads; i++) { const p = pad(hub); await p.opened; pads.push(p); }
    await until(() => hub.padCount === LIMITS.pads);
    const extra = pad(hub); await extra.opened;
    assert.equal((await extra.closed).code, CLOSE.full);
    assert.equal(hub.padCount, LIMITS.pads);
  } finally { host.ws.close(); await hub.close(); }
});

test('it serves the pad page and a game\'s pad program as files', async () => {
  const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
  const root = mkdtempSync(join(tmpdir(), 'orlis-pad-')), pagesDir = join(root, 'pad'), gamesDir = join(root, 'games');
  mkdirSync(join(pagesDir), { recursive: true }); mkdirSync(join(gamesDir, 'pop-party'), { recursive: true });
  writeFileSync(join(pagesDir, 'index.html'), '<p>pad page</p>'); writeFileSync(join(gamesDir, 'pop-party', 'pad.js'), 'export default 1;');
  const hub = await hubUp({ padDir: pagesDir, gamesDir });
  try {
    const page = await fetch(hub.url + '/'); assert.equal(page.status, 200); assert.match(page.headers.get('content-type'), /html/); assert.match(await page.text(), /pad page/);
    const js = await fetch(hub.url + '/pads/pop-party/pad.js'); assert.equal(js.status, 200); assert.match(js.headers.get('content-type'), /javascript/);
    assert.equal((await fetch(hub.url + '/%2e%2e/%2e%2e/etc/passwd')).status, 404, 'no way out of the folder');
    assert.equal((await fetch(hub.url + '/nope.html')).status, 404);
  } finally { await hub.close(); }
});

test('if the first port is busy the hub tries the next ones', async () => {
  const a = await startHub({ port: 0, host: '127.0.0.1', key: KEY, padDir: null });
  const b = await startHub({ port: a.port, host: '127.0.0.1', key: KEY, padDir: null, fallback: true });
  try { assert.ok(b.port > a.port && b.port <= a.port + 9, `${b.port}`); } finally { await a.close(); await b.close(); }
});
