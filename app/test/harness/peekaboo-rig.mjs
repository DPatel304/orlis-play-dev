/* The rig for the Peekaboo tablet view (plan package K5): the Node pad hub, the built pad page, the real tablet program (app/pads/peekaboo/pad.js)
   in headless Chromium, and a minimal stand-in for the game host that runs the REAL rules (createRound) and speaks the protocol of
   docs/specs/peekaboo-views.md: `state` (the rules snapshot + lanterns + rustles, about 18 a second) and `ev` (rustle, enter, leave, found, hidden, phase).
   Opus connects the real host (K4, app/src/games/peekaboo.js) later; this is only so the tablet can be tested alone.
   Used by app/test/peekaboo-pad.node.mjs and app/test/preview/k5-shots.mjs. Plain Node, no test-runner code here. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { startHub } from '../../../tools/pad-hub.mjs';
import { FakeHost } from '../../../tools/pad-fake-host.mjs';
import { createWorld } from '../../src/games/peekaboo/world.js';
import { createRound } from '../../src/games/peekaboo/rules.js';

const { chromium } = createRequire(import.meta.url)('playwright');
export const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const KEY = 'test-secret';
export const TABLET = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' };
export const MIA = { colour: 'orange', face: { eyes: 'dot', mouth: 'smile' }, top: 'cap', outfit: 'stripes', outfitColour: 'shade.card', extra: 'none' };
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export async function until(fn, ms = 8000, label = '') {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timed out waiting for ' + (label || fn)); await sleep(40); }
}

/* the game host, as little as it can be: one hider, the real rules, the latest stick, lanterns the test sets */
export class StandInHost extends FakeHost {
  constructor(o = {}) {
    super({ ...o, game: 'peekaboo', padUrl: '/pads/peekaboo/', need: 'view3d', seats: 1, people: [{ id: 'mia', name: 'Mia', avatar: MIA }] });
    this.world = createWorld(); this.round = null; this.stick = { x: 0, y: 0 }; this.act = null; this.lanterns = []; this.rustles = new Map();
    this.inputs = []; this.sent = { state: 0, ev: [] }; this.tick = 0; this.to = null; this.paused = false;
    this.onReady = (rec, from) => this.begin(from);
  }
  onMessage(msg) {
    if (msg.t === 'msg' && msg.m && msg.m.t === 'in') {
      const m = msg.m; this.inputs.push(m);
      if (m.stick) this.stick = { x: Number(m.stick.x) || 0, y: Number(m.stick.y) || 0 };
      if (m.act) this.act = m.act;
    }
    return super.onMessage(msg);
  }
  begin(to) {
    this.to = to; this.round = createRound(this.world, { hider: 0, seekers: [1] });
    clearInterval(this.timer); let n = 0, last = Date.now();
    this.timer = setInterval(() => {
      const t = Date.now(), dt = Math.min(0.1, (t - last) / 1000); last = t; n++;
      if (this.paused) return;
      const ev = this.round.step(dt, { stick: this.stick, act: this.act, lanterns: this.lanterns }); this.act = null;
      for (const e of ev) {
        const { type, ...rest } = e; if (type === 'rustle') this.rustles.set(rest.placeId, t);
        this.sent.ev.push(type); this.send(this.to, { ...rest, t: 'ev', e: type });
      }
      if (n % 2 === 0) this.sendState();
    }, 1000 / 30);
    this.sendState();
  }
  sendState() {
    const t = Date.now(); for (const [id, at] of this.rustles) if (t - at > 1000) this.rustles.delete(id);
    this.sent.state++;
    this.send(this.to, { ...this.round.snapshot(), lanterns: this.lanterns.map(l => ({ x: l.x, z: l.z, seat: l.seat })), rustles: [...this.rustles.keys()], t: 'state', tick: ++this.tick });
  }
  stop() { clearInterval(this.timer); super.stop(); }
}

export async function startPeekabooRig() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'orlis-k5-'));
  await build({ configFile: path.join(APP, 'vite.pad.config.js'), logLevel: 'silent', build: { outDir: path.join(tmp, 'dist-pad'), emptyOutDir: true } });
  const hub = await startHub({ port: 0, host: '127.0.0.1', key: KEY, padDir: path.join(tmp, 'dist-pad'), gamesDir: path.join(APP, 'pads') });
  const host = await new StandInHost({ url: hub.wsUrl, key: KEY }).start();
  const browser = await chromium.launch();
  const rig = { tmp, hub, host, browser, contexts: [] };
  /* the tablet: open the page, tap the pictures, pick Mia, "I'm ready", and wait for the 3D view */
  rig.tablet = async (opts = TABLET) => {
    const ctx = await browser.newContext(opts); rig.contexts.push(ctx);
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push(e)); page.on('console', (m) => { if (m.type() === 'error') errors.push(new Error(m.text())); });
    await page.goto(hub.url + '/');
    await page.getByText('Tap the three', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });
    for (const id of host.join) await page.locator(`.cell[data-id="${id}"]`).tap();
    await page.locator('.person[data-who="mia"]').tap();
    await page.getByRole('button', { name: "I'm ready" }).tap();
    await page.waitForFunction(() => document.body.dataset.program === 'on' && window.__pk && window.__pk.net.seen, null, { timeout: 20000 });
    return { ctx, page, errors };
  };
  rig.close = async () => {
    host.stop();
    for (const c of rig.contexts.splice(0)) await c.close().catch(() => {});
    await browser.close().catch(() => {});
    await hub.close().catch(() => {});
    fs.rmSync(tmp, { recursive: true, force: true });
  };
  return rig;
}
