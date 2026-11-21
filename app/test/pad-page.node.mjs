/* The pad page (plan package P3): spec tests 1 to 3 from docs/specs/pad-protocol.md with real pages.
   Run by pad-page.test.mjs in a plain Node process. Headless Chromium (Playwright) opens the built page (dist-pad, built here into a temp
   folder) from the Node hub; a pretend host (tools/pad-fake-host.mjs) plays the game. WebKit is not available here, so real iPhone Safari
   is not covered. Set PAD_SHOTS=<folder> to also save screenshots of the screens. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { startHub } from '../../tools/pad-hub.mjs';
import { FakeHost } from '../../tools/pad-fake-host.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'test-secret';
const SHOTS = process.env.PAD_SHOTS || null;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
const TABLET = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' };

let tmp, browser;
before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'orlis-pad-'));
  await build({ configFile: path.join(APP, 'vite.pad.config.js'), logLevel: 'silent', build: { outDir: path.join(tmp, 'dist-pad'), emptyOutDir: true } });
  /* a tiny pad program for the page to load */
  fs.mkdirSync(path.join(tmp, 'games', 'test'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'games', 'test', 'pad.js'),
    `export default function start(api){ const r = api.root; r.textContent = 'PAD PROGRAM seat ' + api.seat; r.dataset.seat = api.seat; r.dataset.colour = api.colour;
       api.send({ x: 1 }); api.onState(s => { r.dataset.tick = s.tick; }); api.onEvent(e => { r.dataset.ev = e.e; }); }`);
  fs.mkdirSync(path.join(tmp, 'games', 'broken'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'games', 'broken', 'pad.js'), `throw new Error('this pad program is broken');`);
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

async function rig(hostOpts = {}, { host = true } = {}) {
  const hub = await startHub({ port: 0, host: '127.0.0.1', key: KEY, padDir: path.join(tmp, 'dist-pad'), gamesDir: path.join(tmp, 'games') });
  const h = host ? await new FakeHost({ url: hub.wsUrl, key: KEY, padUrl: '/pads/test/', ...hostOpts }).start() : null;
  return { hub, host: h, async down() { h && h.stop(); await hub.close(); } };
}

/* a page that notes whether the "Joining again" pill ever showed */
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
const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.waitForTimeout(250); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } };
async function tapPictures(page, ids) { for (const id of ids) await page.locator(`.cell[data-id="${id}"]`).tap(); }

/* ---------- spec test 1: the pictures, who are you, a seat, ready; wrong pictures; five wrong tries wait ---------- */
test('1. a new phone joins with the pictures, picks who it is and gets the ready screen; wrong pictures show "Not quite"; five wrong tries wait', async () => {
  const r = await rig({ waitMs: 1200 });
  const { ctx, page } = await phone();
  try {
    await page.goto(r.hub.url + '/?waitms=1800');
    await text(page, 'Tap the three');
    await shot(page, '1-pictures');
    assert.equal(await page.locator('.cell').count(), 9, 'nine pictures');
    const hello = r.host.log.find(x => x.m.t === 'hello').m;
    assert.equal(hello.v, 1); assert.equal(hello.device, null); assert.equal(hello.join, null);
    assert.deepEqual(Object.keys(hello.screen).sort(), ['dpr', 'h', 'w']); assert.equal(typeof hello.gl, 'boolean');

    /* the slots fill, and tapping one takes the picture back */
    await tapPictures(page, ['fish', 'tree']);
    assert.equal(await page.locator('.slot.full').count(), 2);
    await page.locator('.slot[data-slot="0"]').tap();
    assert.equal(await page.locator('.slot.full').count(), 1);
    await tapPictures(page, ['moon']);
    await shot(page, '2-picking');
    /* three wrong ones */
    await tapPictures(page, ['kite']);
    await text(page, 'Not quite');
    await shot(page, '3-not-quite');
    await page.waitForFunction(() => document.querySelectorAll('.slot.full').length === 0, null, { timeout: 3000 });     /* the slots empty after a second */
    await text(page, 'Tap the three');

    /* the right three, in order */
    await tapPictures(page, r.host.join);
    await text(page, 'Who are you?');
    assert.deepEqual(r.host.log.filter(x => x.m.t === 'hello').pop().m.join, r.host.join);
    assert.equal(await page.locator('.person').count(), 4, 'three people and Guest');
    await shot(page, '4-who');
    await page.locator('.person[data-who="sam"]').tap();
    await text(page, 'Hi Sam!'); await text(page, "You're in");
    await shot(page, '5-ready');
    assert.equal(await page.evaluate(() => localStorage.getItem('orlis.pad.device')) != null, true, 'the device token is kept');
    assert.ok(r.host.log.some(x => x.m.t === 'pick' && x.m.who === 'sam'));

    /* the tap on "I'm ready" tells the host, starts the keep-awake video, and loads the game's pad program */
    const ready = new Promise(res => { r.host.onReady = res; });
    await page.getByRole('button', { name: "I'm ready" }).tap();
    await ready;
    await page.waitForFunction(() => document.body.dataset.program === 'on', null, { timeout: 4000 });
    assert.match(await page.locator('.padroot').innerText(), /PAD PROGRAM seat 0/);
    assert.equal(await page.locator('video[loop]').count(), 1, 'the keep-awake video');
    await sleep(150);
    assert.ok(r.host.log.some(x => x.m.t === 'in' && x.m.x === 1 && x.m.seq === 1), 'the pad program sends input');
    const id = [...r.host.pads.keys()][0];
    r.host.send(id, { t: 'state', tick: 7 }); r.host.send(id, { t: 'ev', e: 'popped' });
    await page.waitForFunction(() => { const d = document.querySelector('.padroot').dataset; return d.tick === '7' && d.ev === 'popped'; });
    await sleep(2300);
    assert.ok(r.host.log.some(x => x.m.t === 'ping'), 'it pings');

    /* five wrong tries (one is already counted by the host? no: it was reset by the right answer) */
    const b = await phone(); const p2 = b.page;
    await p2.goto(r.hub.url + '/?waitms=1800');
    for (let i = 0; i < 5; i++) {
      await text(p2, 'Tap the three');
      await p2.waitForFunction(() => !document.querySelector('.picked.shake'));
      await tapPictures(p2, ['fish', 'tree', 'moon']);
      if (i < 4) await text(p2, 'Not quite');
    }
    await text(p2, "Let's wait");
    await shot(p2, '6-wait');
    await text(p2, 'Tap the three', 5000);        /* the sun bar ran out, the pictures came back */
    await b.ctx.close();
  } finally { await ctx.close(); await r.down(); }
});

/* ---------- spec test 2: the socket dies; "Joining again"; the same token and the same seat ---------- */
test('2. when the socket is closed the page says "Joining again" and comes back by itself with the same token and seat', async () => {
  const r = await rig();
  const { ctx, page } = await phone();
  try {
    const joins = []; r.host.onJoin = (rec) => joins.push({ ...rec });
    await page.goto(r.hub.url + '/');
    await text(page, 'Tap the three');
    await tapPictures(page, r.host.join);
    await page.locator('.person[data-who="ola"]').tap();
    await text(page, 'Hi Ola!');
    const token = await page.evaluate(() => localStorage.getItem('orlis.pad.device'));
    await page.getByRole('button', { name: "I'm ready" }).tap();
    await page.waitForFunction(() => document.body.dataset.program === 'on');
    const seat = joins[0].seat;

    for (let round = 0; round < 2; round++) {
      await page.evaluate(() => { window.__sawPill = false; });
      const id = [...r.host.pads.keys()].pop();
      r.host.kick(id);                                          /* the host (hub) closes this phone */
      await page.waitForFunction(() => window.__sawPill === true, null, { timeout: 3000 });
      if (round === 0 && SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, '7-joining-again.png') }); }
      await page.waitForFunction(() => !document.querySelector('.pill') && document.body.dataset.link === 'ok', null, { timeout: 6000 });
      assert.equal(await page.evaluate(() => localStorage.getItem('orlis.pad.device')), token, 'the same token');
      assert.equal(joins.at(-1).seat, seat, 'the same seat');
      assert.equal(joins.at(-1).who, 'ola');
      assert.equal(r.host.tokens.size, 1, 'no new seat was made');
      assert.equal(await page.evaluate(() => document.body.dataset.screen), 'play', 'still in the game, not asked again');
    }
    const rejoin = r.host.log.filter(x => x.m.t === 'hello').at(-1).m;
    assert.equal(rejoin.device, token); assert.equal(rejoin.join, null);

    /* the screen shows the pill and greys the controls while it is away: stop the host, look, bring it back */
    r.host.stop();
    await page.waitForFunction(() => document.body.dataset.screen === 'start', null, { timeout: 3000 });      /* the host left: "Start Orlis on the TV" */
    await text(page, 'Start Orlis');
    await shot(page, '7-start-orlis');
    const h2 = await new FakeHost({ url: r.hub.wsUrl, key: KEY, padUrl: '/pads/test/', tokens: r.host.tokens }).start();
    try { await text(page, 'Welcome back', 8000); } finally { h2.stop(); }
  } finally { await ctx.close(); await r.down(); }
});

/* ---------- spec test 3: an old token comes straight back ---------- */
test('3. a second page with an old token comes straight back: "Welcome back", no pictures; "Not Sam? Change" picks again on the same seat', async () => {
  const r = await rig();
  const a = await phone();
  try {
    await a.page.goto(r.hub.url + '/');
    await text(a.page, 'Tap the three');
    await tapPictures(a.page, r.host.join);
    await a.page.locator('.person[data-who="sam"]').tap();
    await text(a.page, 'Hi Sam!');
    const state = await a.ctx.storageState();
    await a.ctx.close();

    const b = await phone(PHONE, { storageState: state });
    try {
      await b.page.goto(r.hub.url + '/');
      await text(b.page, 'Welcome back,');
      await text(b.page, 'Sam!');
      await shot(b.page, '8-welcome-back');
      assert.equal(await b.page.locator('.cell').count(), 0, 'no pictures');
      const hellos = r.host.log.filter(x => x.m.t === 'hello');
      const mine = hellos.at(-1).m;
      assert.ok(mine.device, 'it sent its token'); assert.equal(mine.join, null);
      assert.equal(r.host.log.filter(x => x.m.t === 'pick').length, 1, 'nobody picked again');

      /* "Not Sam? Change" */
      const before = r.host.tokens.size;
      await b.page.getByRole('button', { name: /Not Sam/ }).tap();
      await text(b.page, 'Who are you?');
      await b.page.locator('.person[data-who="guest"]').tap();
      await text(b.page, 'Hi Guest!');
      assert.equal(r.host.tokens.size, before, 'same token and seat');
      assert.equal([...r.host.tokens.values()][0].who, 'guest');
      await shot(b.page, '9-guest');
      /* with no pad program the game screen is calm */
      await b.page.getByRole('button', { name: "I'm ready" }).tap();
      await b.page.waitForFunction(() => document.body.dataset.program === 'on');           /* (the test pad program) */
    } finally { await b.ctx.close(); }
  } finally { await r.down(); }
});

/* ---------- no host, then a host; a broken or missing pad program; the reject reasons; a tablet ---------- */
test('4. with no host the page says "Start Orlis on the TV" and joins by itself once a host starts', async () => {
  const r = await rig({}, { host: false });
  const { ctx, page } = await phone();
  try {
    await page.goto(r.hub.url + '/');
    await text(page, 'Start Orlis');
    const host = await new FakeHost({ url: r.hub.wsUrl, key: KEY }).start();
    try { await text(page, 'Tap the three', 8000); } finally { host.stop(); }
  } finally { await ctx.close(); await r.down(); }
});

test('5. a pad program that is missing or broken leaves a calm "Look at the TV!"', async () => {
  for (const padUrl of ['/pads/broken/', '/pads/nothing/', null]) {
    const r = await rig({ padUrl });
    const { ctx, page } = await phone();
    try {
      page.removeAllListeners('pageerror');
      await page.goto(r.hub.url + '/');
      await text(page, 'Tap the three'); await tapPictures(page, r.host.join);
      await page.locator('.person[data-who="mia"]').tap();
      await text(page, 'Hi Mia!');
      await page.getByRole('button', { name: "I'm ready" }).tap();
      await text(page, 'Look at the TV!');
      if (padUrl === '/pads/broken/') { await page.waitForFunction(() => document.body.dataset.program === 'failed'); await shot(page, '10-look-at-the-tv'); }
    } finally { await ctx.close(); await r.down(); }
  }
});

test('6. rejects: full, a game without phones, a new version', async () => {
  const hub = await startHub({ port: 0, host: '127.0.0.1', key: KEY, padDir: path.join(tmp, 'dist-pad'), gamesDir: path.join(tmp, 'games') });
  const why = { value: 'full' };
  const ws = new WebSocket(`${hub.wsUrl}/ws?role=host&key=${KEY}`);
  ws.addEventListener('message', (e) => { const o = JSON.parse(e.data); if (o.t === 'msg' && o.m.t === 'hello') ws.send(JSON.stringify({ to: o.from, m: { t: 'reject', why: why.value } })); });
  await new Promise(res => ws.addEventListener('open', res));
  const { ctx, page } = await phone();
  try {
    await page.goto(hub.url + '/'); await text(page, 'This game');  await text(page, 'is full');
    await shot(page, '11-full');
    const p2 = await ctx.newPage(); why.value = 'game';
    await p2.goto(hub.url + '/'); await text(p2, "doesn't");
    const p3 = await ctx.newPage(); why.value = 'version';
    await p3.goto(hub.url + '/'); await text(p3, 'Orlis got');
    /* a hub that is full closes with 4003 */
    const full = await startHub({ port: 0, host: '127.0.0.1', key: KEY, padDir: path.join(tmp, 'dist-pad'), limits: { pads: 0 } });
    const fh = await new FakeHost({ url: full.wsUrl, key: KEY }).start();
    const p4 = await ctx.newPage(); await p4.goto(full.url + '/'); await text(p4, 'This game'); fh.stop(); await full.close();
  } finally { await ctx.close(); ws.close(); await hub.close(); }
});

test('7. an Android tablet size joins and shows the ready screen', async () => {
  const r = await rig();
  const { ctx, page } = await phone(TABLET);
  try {
    await page.goto(r.hub.url + '/');
    await text(page, 'Tap the three'); await shot(page, 'tablet-1-pictures');
    await tapPictures(page, r.host.join);
    await text(page, 'Who are you?');
    await page.locator('.person[data-who="mia"]').tap();
    await text(page, 'Hi Mia!'); await shot(page, 'tablet-2-ready');
    /* everything fits the screen: no scrolling needed to reach the button */
    const box = await page.getByRole('button', { name: "I'm ready" }).boundingBox();
    assert.ok(box.y + box.height <= 800 && box.width > 200 && box.height >= 56, JSON.stringify(box));
  } finally { await ctx.close(); await r.down(); }
});
