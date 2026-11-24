/* The rig for the real game shell with phones (plan packages S1 and P5): the Node pad hub, the built pad page, the shell on the Vite dev server,
   headless Chromium for the TV and for phones. Used by app/test/pads-shell.node.mjs (the end-to-end test) and app/test/preview/pads-shots.mjs
   (the owner's pictures in docs/p5/). Plain Node, no test-runner code here. */
import { T } from './slowness.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build, createServer } from 'vite';
import { startHub } from '../../../tools/pad-hub.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
export const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const KEY = 'test-secret';
export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
export const ANDROID = { ...PHONE, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36' };

/* the household the TV knows (the account the shell reads from localStorage; no server is needed) */
export const PROFILES = [
  { id: 'mia', name: 'Mia', accountId: 'a1', look: { colour: 'pink', face: { eyes: 'happy', mouth: 'grin' }, top: 'bob', outfit: 'stripes', outfitColour: 'ui.gold', extra: 'none' } },
  { id: 'sam', name: 'Sam', accountId: 'a1', look: { colour: 'orange', face: { eyes: 'dot', mouth: 'smile' }, top: 'cap', outfit: 'plain', outfitColour: 'shade.card', extra: 'glasses' } },
  { id: 'ola', name: 'Ola', accountId: 'a1', look: { colour: 'green', face: { eyes: 'wink', mouth: 'o' }, top: 'tuft', outfit: 'dots', outfitColour: 'touch.skyBlue', extra: 'none' } }
];
export const ACCOUNT = { token: 't', account: { id: 'a1', role: 'owner' }, household: { id: 'h1', name: 'Test' }, profiles: PROFILES, current: 'mia' };

export async function until(fn, ms = 6000, label = '') {
  /* the deadline scales with how busy the machine is (harness/slowness.mjs); it is only measured once the plain one has passed */
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms && Date.now() - t0 > T(ms)) throw new Error('timed out waiting for ' + (label || fn)); await new Promise(r => setTimeout(r, 40)); }
}

export async function startRig({ tvSize = { width: 1280, height: 720 } } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'orlis-pads-'));
  await build({ configFile: path.join(APP, 'vite.pad.config.js'), logLevel: 'silent', build: { outDir: path.join(tmp, 'dist-pad'), emptyOutDir: true } });
  const hub = await startHub({ port: 0, host: '127.0.0.1', key: KEY, padDir: path.join(tmp, 'dist-pad'), gamesDir: path.join(APP, 'pads') });
  const dev = await createServer({ root: APP, configFile: path.join(APP, 'vite.config.js'), logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: false }, clearScreen: false });
  await dev.listen();
  const base = `http://127.0.0.1:${dev.httpServer.address().port}`;
  const browser = await chromium.launch();
  const rig = { tmp, hub, dev, base, browser, contexts: [] };

  /* the TV: the real shell, straight into a game, pointed at the Node hub */
  rig.tv = async (game = 'pad-lab', { account = ACCOUNT, extra = '', scale = 1, seed = {} } = {}) => {
    const ctx = await browser.newContext({ viewport: tvSize, deviceScaleFactor: scale, });
    rig.contexts.push(ctx);
    await ctx.addInitScript(({ acc, seed }) => { try { localStorage.setItem('orlis.account', JSON.stringify(acc)); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } catch { /* no storage */ } }, { acc: account, seed });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e)); page.on('console', (m) => { if (m.type() === 'error') errors.push(new Error(m.text())); });
    await page.goto(`${base}/?${game ? `game=${game}&` : ''}debug&fx=0&padhub=${hub.port}:${KEY}&padhost=127.0.0.1${extra}`);
    return { ctx, page, errors };
  };
  /* a phone on the pad page */
  rig.phone = async (opts = PHONE, ctxOpts = {}) => {
    const ctx = await browser.newContext({ ...opts, ...ctxOpts });
    rig.contexts.push(ctx);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { throw e; });
    return { ctx, page };
  };
  /* between tests: close every page (a TV left open would take the host seat back from the next one) */
  rig.reset = async () => { for (const c of rig.contexts.splice(0)) await c.close().catch(() => {}); };
  rig.close = async () => {
    await rig.reset();
    await browser.close().catch(() => {});
    await dev.close().catch(() => {});
    await hub.close().catch(() => {});
    fs.rmSync(tmp, { recursive: true, force: true });
  };
  return rig;
}

/* the shell with more than one profile asks "Who's who?" first (the line-up): carry on to the join card */
export async function toJoinCard(tv, ms = 20000) {
  const t0 = Date.now();
  for (;;) {
    if (await tv.page.locator('.joincard').count()) return;
    const go = tv.page.locator('.screen.lineup .btn.go');
    if (await go.count()) await go.click().catch(() => {});
    if (Date.now() - t0 > ms) throw new Error('no join card; errors: ' + tv.errors.map(String).join(' | '));
    await new Promise(r => setTimeout(r, 100));
  }
}

/* the join: open the pad page, tap the three pictures the TV shows, pick who, say ready */
export async function joinPhone(rig, tv, phone, who, { ready = true } = {}) {
  const ids = await tv.page.locator('.jpics canvas').evaluateAll(els => els.map(e => e.dataset.id));
  await phone.page.goto(rig.hub.url + '/');
  await phone.page.getByText('Tap the three', { exact: false }).first().waitFor({ state: 'visible', timeout: T(8000) });
  for (const id of ids) await phone.page.locator(`.cell[data-id="${id}"]`).tap();
  await phone.page.locator(`.person[data-who="${who}"]`).tap();
  await phone.page.getByRole('button', { name: "I'm ready" }).waitFor({ timeout: T(8000) });
  if (ready) await phone.page.getByRole('button', { name: "I'm ready" }).tap();
  return ids;
}
