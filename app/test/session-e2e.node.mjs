/* The real host session (P4) end to end: headless Chromium opens the built pad page from the Node hub; the game host is the REAL session
   (app/src/session) driven through host-link.js over the hub's host socket. Spec tests 1 to 3 (P6 extends this to all five). */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { startHub } from '../../tools/pad-hub.mjs';
import { createSession } from '../src/session/session.js';
import { createTrust } from '../src/session/trust.js';
import { createHostLink } from '../src/session/host-link.js';

const { chromium } = createRequire(import.meta.url)('playwright');
const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'test-secret';
const PEOPLE = [{ id: 'mia', name: 'Mia', avatar: null, favourite: 'pink' }, { id: 'sam', name: 'Sam', avatar: null, favourite: 'sky' },
  { id: 'ola', name: 'Ola', avatar: null, favourite: 'green' }, { id: 'guest', name: 'Guest', avatar: null }];
const GAME = { id: 'test', seats: { tracked: [1, 2], pads: [1, 2] }, pads: { program: '/pads/test/', need: 'controller' }, requiredPads: 1 };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };

let tmp, browser;
before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'orlis-session-'));
  await build({ configFile: path.join(APP, 'vite.pad.config.js'), logLevel: 'silent', build: { outDir: path.join(tmp, 'dist-pad'), emptyOutDir: true } });
  fs.mkdirSync(path.join(tmp, 'games', 'test'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'games', 'test', 'pad.js'),
    `export default function start(api){ api.root.textContent = 'PAD PROGRAM seat ' + api.seat; api.send({ x: 1 }); }`);
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

/* the Box side: a hub, a trust store (kept across sessions in `storage`), and a session wired up with the host link */
async function rig(storage = new Map(), port = 0) {
  const hub = await startHub({ port, host: '127.0.0.1', key: KEY, padDir: path.join(tmp, 'dist-pad'), gamesDir: path.join(tmp, 'games') });
  const trust = createTrust({ getItem: (k) => storage.has(k) ? storage.get(k) : null, setItem: (k, v) => storage.set(k, v) });
  const link = createHostLink({ port: hub.port, key: KEY });
  const r = { hub, trust, link, conn: null, events: [] };
  const send = (to, m) => { if (m.t === 'welcome') r.conn = to; link.send(to, m); };       /* (remember which hub id the phone has) */
  send.close = link.send.close;
  r.session = createSession({ game: GAME, people: () => PEOPLE, trust, send });
  link.attach(r.session);
  for (const e of ['pause', 'resume', 'ready']) r.session.on(e, (a) => r.events.push([e, a]));
  link.start();
  await until(() => link.connected);
  r.down = async () => { link.stop(); await hub.close(); };
  return r;
}
async function phone(opts = PHONE, ctxOpts = {}) {
  const ctx = await browser.newContext({ ...opts, ...ctxOpts });
  await ctx.addInitScript(() => {
    window.__sawPill = false;
    new MutationObserver(() => { if (document.querySelector('.pill')) window.__sawPill = true; }).observe(document, { childList: true, subtree: true });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  return { ctx, page };
}
const text = (page, t, timeout = 6000) => page.getByText(t, { exact: false }).first().waitFor({ state: 'visible', timeout });
async function tapPictures(page, ids) { for (const id of ids) await page.locator(`.cell[data-id="${id}"]`).tap(); }
async function until(fn, ms = 4000) { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out waiting for ' + fn); await new Promise(r => setTimeout(r, 25)); } }
const padSeat = (r) => r.session.seats.find(s => s.kind === 'pad');

/* ---------- spec test 1 ---------- */
test('1. a new phone joins with the pictures, picks who it is and is ready; wrong pictures are refused', async () => {
  const r = await rig();
  const { ctx, page } = await phone();
  try {
    await page.goto(r.hub.url + '/');
    await text(page, 'Tap the three');
    assert.deepEqual(await page.locator('.cell').evaluateAll(els => els.map(e => e.dataset.id)), r.session.join.grid, 'the phone shows the session grid');
    const wrong = r.session.join.grid.filter(id => !r.session.join.pictures.includes(id)).slice(0, 3);
    await tapPictures(page, wrong);
    await text(page, 'Not quite');
    await page.waitForFunction(() => document.querySelectorAll('.slot.full').length === 0, null, { timeout: 3000 });
    await tapPictures(page, r.session.join.pictures);
    await text(page, 'Who are you?');
    assert.equal(await page.locator('.person').count(), 4);
    await page.locator('.person[data-who="sam"]').tap();
    await text(page, 'Hi Sam!');
    const token = await page.evaluate(() => localStorage.getItem('orlis.pad.device'));
    assert.match(token, /^[0-9a-f]{24}$/);
    assert.equal(r.trust.get(token).who, 'sam');
    assert.equal(padSeat(r).who, 'sam'); assert.equal(padSeat(r).state, 'live'); assert.equal(padSeat(r).colour, 'sky');
    await page.getByRole('button', { name: "I'm ready" }).tap();
    await until(() => r.events.some(e => e[0] === 'ready'));
    assert.equal(padSeat(r).ready, true);
    await page.waitForFunction(() => document.body.dataset.program === 'on', null, { timeout: 4000 });
    assert.match(await page.locator('.padroot').innerText(), /PAD PROGRAM seat 0/);
  } finally { await ctx.close(); await r.down(); }
});

/* ---------- spec test 2 ---------- */
test('2. the phone\'s socket is dropped: the required seat pauses the game; it rejoins by itself on the same seat and the game resumes', async () => {
  const r = await rig();
  const { ctx, page } = await phone();
  try {
    await page.goto(r.hub.url + '/');
    await text(page, 'Tap the three'); await tapPictures(page, r.session.join.pictures);
    await page.locator('.person[data-who="ola"]').tap(); await text(page, 'Hi Ola!');
    const token = await page.evaluate(() => localStorage.getItem('orlis.pad.device'));
    await page.getByRole('button', { name: "I'm ready" }).tap();
    await page.waitForFunction(() => document.body.dataset.program === 'on');
    assert.equal(r.session.start(), true); assert.equal(r.session.phase, 'playing');
    const seatN = padSeat(r).n;
    for (let round = 1; round <= 2; round++) {
      await page.evaluate(() => { window.__sawPill = false; });
      r.link.send.close(r.conn);                                           /* the host drops this phone */
      await until(() => r.session.phase === 'paused');
      assert.equal(padSeat(r).state, 'away');
      await page.waitForFunction(() => window.__sawPill === true, null, { timeout: 3000 });
      await until(() => r.session.phase === 'playing', 8000);
      assert.equal(await page.evaluate(() => localStorage.getItem('orlis.pad.device')), token, 'the same token');
      assert.equal(padSeat(r).state, 'live'); assert.equal(padSeat(r).who, 'ola'); assert.equal(padSeat(r).n, seatN, 'the same seat');
      assert.equal(r.trust.list().length, 1, 'no new token');
      assert.equal(r.events.filter(e => e[0] === 'pause').length, round); assert.equal(r.events.filter(e => e[0] === 'resume').length, round);
      assert.equal(await page.evaluate(() => document.body.dataset.screen), 'play', 'still in the game, not asked again');
    }
  } finally { await ctx.close(); await r.down(); }
});

/* ---------- spec test 3 ---------- */
test('3. a returning phone with an old token comes straight back in a new session; "Not Sam? Change" keeps the seat', async () => {
  const storage = new Map();
  const a = await rig(storage);
  const p1 = await phone();
  let state;
  try {
    await p1.page.goto(a.hub.url + '/');
    await text(p1.page, 'Tap the three'); await tapPictures(p1.page, a.session.join.pictures);
    await p1.page.locator('.person[data-who="sam"]').tap(); await text(p1.page, 'Hi Sam!');
    state = await p1.ctx.storageState();
  } finally { await p1.ctx.close(); await a.down(); }

  const b = await rig(storage, a.hub.port);                                              /* the TV app restarted: a new session, the Box remembers */
  const p2 = await phone(PHONE, { storageState: state });
  try {
    await p2.page.goto(b.hub.url + '/');
    await text(p2.page, 'Welcome back,'); await text(p2.page, 'Sam!');
    assert.equal(await p2.page.locator('.cell').count(), 0, 'no pictures');
    assert.equal(padSeat(b).who, 'sam');
    const before = b.trust.list().length;
    await p2.page.getByRole('button', { name: /Not Sam/ }).tap();
    await text(p2.page, 'Who are you?');
    await p2.page.locator('.person[data-who="guest"]').tap();
    await text(p2.page, 'Hi Guest!');
    assert.equal(b.trust.list().length, before, 'same token');
    assert.equal(b.trust.list()[0].who, 'guest');
    assert.equal(b.session.seats.filter(s => s.kind === 'pad' && s.state !== 'empty').length, 1, 'same seat');
  } finally { await p2.ctx.close(); await b.down(); }
});
