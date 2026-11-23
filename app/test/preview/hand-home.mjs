/* Hand mode on Home, end to end in a real Chromium (U7). Not part of `npm test` (it needs the dev server, Chrome and the pose model);
   run it by hand:

     cd app && npx vite --port 5191 --strictPort &
     node test/preview/hand-home.mjs [--clip path/to/clip.y4m] [--shots dir]

   1. Cost: Home with the real tracker on a synthetic camera clip (python3 test/mkclip.py clip.y4m 8): looks a second, the tracker's
      time per look, the per-frame cost of pose.update, and the same with the light mode off, side by side.
   2. Picking: a scripted pose (a body and a hand put through pose._assign, ten looks a second) points at Pop Party on Home, waves, and
      the game starts - three times out of three. Also: holding still never starts it.
   Frame rates in headless Chromium mean little; the ratios and the pass/fail are what to read.                                    */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
const BASE = opt('url', 'http://127.0.0.1:5191'), CLIP = opt('clip', ''), SHOTS = opt('shots', '');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const flags = ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
if (CLIP) flags.push(`--use-file-for-fake-video-capture=${CLIP}`);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: flags });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, permissions: ['camera'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
const sleep = (ms) => page.waitForTimeout(ms);
const ok = [];
const check = (name, pass, more = '') => { ok.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${more ? '  ' + more : ''}`); };

/* ---------- 1. cost ---------- */
/* Main-thread time over eight seconds at Home, from the browser's own counters (CDP Performance.getMetrics): how much of the time the page
   was busy (tasks), in script, in layout and style, plus the tracker's own numbers. `mode`: 'off' Home as it was (no camera), 'light' hand
   mode as built (ten looks a second), 'full' the camera looked at on every picture (what a game does, for comparison). */
async function cost(mode){
  await page.goto(`${BASE}/${mode === 'off' ? '?fx=0&splash=0' : '?hand=1&fx=0&splash=0'}`);
  if (mode !== 'off') await page.waitForFunction(() => window.__scene && window.__scene().hand === true, null, { timeout: 60000 }).catch(() => {});
  else await page.waitForFunction(() => window.__scene && window.__scene().focus !== undefined, null, { timeout: 60000 });
  const handOn = await page.evaluate(() => !!(window.__scene && window.__scene().hand));
  if (mode === 'full') await page.evaluate(() => { window.__pose.lite = { hz: 1000, idleHz: 1000 }; });
  await sleep(4000);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  await page.evaluate(() => { const pose = window.__pose; window.__looks = 0; const took = pose._took; pose._took = function(...x){ window.__looks++; return took.apply(this, x); }; });
  const m0 = await metrics(), t0 = Date.now();
  await sleep(8000);
  const m1 = await metrics(), secs = (Date.now() - t0) / 1000;
  const pct = (k) => +(100 * (m1[k] - m0[k]) / secs).toFixed(1);
  const t = await page.evaluate(() => ({ looks: window.__looks, people: window.__pose.personCount, inferMs: window.__pose.inferMs, on: window.__pose.on, wanted: window.__pose.wanted }));
  await cdp.detach();
  return { mode, handOn, secs: +secs.toFixed(1), busyPct: pct('TaskDuration'), scriptPct: pct('ScriptDuration'), layoutPct: pct('LayoutDuration'), stylePct: pct('RecalcStyleDuration'), looksPerSec: +(t.looks / secs).toFixed(1), people: t.people, inferMs: +t.inferMs.toFixed(0), cameraOn: t.on, posesWanted: t.wanted };
}
console.log('--- cost (Home, eight seconds each) ---');
const rows = [];
for (const mode of ['off', 'light', 'full']){ const r = await cost(mode); rows.push(r); console.log(JSON.stringify(r)); if (SHOTS && mode === 'light') await page.screenshot({ path: join(SHOTS, 'cost-light.png') }); }
const [off, light, full] = rows;
check('hand mode starts at Home (camera on, light looks)', light.handOn && light.cameraOn);
check('Home without hand mode keeps the camera off', !off.handOn && !off.cameraOn);
check('light mode looks no more often than ten a second', light.looksPerSec <= 11, `${light.looksPerSec} looks/s (the tracker took ${light.inferMs} ms a look here, so it cannot reach ten on this machine)`);

/* ---------- 2. picking with a scripted pose ---------- */
/* a standing body in the camera's mirrored coordinates, and a script that puts it through pose._assign ten times a second */
await page.goto(`${BASE}/?hand=1&fx=0&splash=0`);
await page.waitForFunction(() => window.__scene && window.__scene().hand === true, null, { timeout: 60000 });
await page.evaluate(() => {
  const pose = window.__pose;
  pose.update = () => {};                                  /* (the scripted pose is the only camera: the real tracker would see an empty room) */
  const S = { hand: { x: 0.5, y: 0.35 }, on: false, gone: false };
  window.__S = S;
  const body = () => {
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, v: 0.95 }));
    const set = (i, x, y) => { lm[i] = { x, y, z: 0, v: 0.95 }; };
    set(0, 0.5, 0.2); set(2, 0.48, 0.18); set(5, 0.52, 0.18); set(11, 0.44, 0.32); set(12, 0.56, 0.32);
    set(13, 0.4, 0.42); set(14, 0.6, 0.42); set(15, 0.4, 0.55); set(23, 0.46, 0.62); set(24, 0.54, 0.62);
    set(25, 0.46, 0.8); set(26, 0.54, 0.8); set(27, 0.46, 0.95); set(28, 0.54, 0.95);
    set(16, S.hand.x, S.hand.y);                           /* the right wrist is the pointing hand */
    return lm;
  };
  setInterval(() => { if (S.gone) { pose._assign([], 0.1); return; } pose.on = true; pose.ready = true; pose._assign([body()], 0.1); }, 100);
});
/* the box in front of this body (hand.js REACH): where the hand must be, in the camera, to point at a screen place */
const handFor = (nx, ny) => ({ x: 0.5 - 0.18 + nx * 0.36, y: 0.32 - 0.6 * 0.12 * 16 / 9 + ny * (0.12 * 16 / 9 * 1.55) });
const point = async (nx, ny) => page.evaluate(([x, y]) => { window.__S.hand.x = x; window.__S.hand.y = y; }, Object.values(handFor(nx, ny)));
const wave = async (nx, ny, n = 6) => { const h = handFor(nx, ny); for (let i = 0; i < n; i++){ await page.evaluate(([x, y]) => { window.__S.hand.x = x; window.__S.hand.y = y; }, [h.x + (i % 2 ? 0.04 : -0.04), h.y]); await sleep(100); } await page.evaluate(([x, y]) => { window.__S.hand.x = x; window.__S.hand.y = y; }, [h.x, h.y]); };
const popTile = () => page.evaluate(() => { const t = [...document.querySelectorAll('.htile.game')].find(e => /pop party/i.test(e.textContent) || e.querySelector('.hname')?.textContent === 'Pop Party'); const r = t.getBoundingClientRect(); return { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight }; });

console.log('--- picking ---');
let picked = 0;
for (let round = 1; round <= 3; round++){
  if (round > 1){ await page.evaluate(() => window.__home()); await sleep(1200); }
  await page.waitForFunction(() => window.__scene && window.__scene().hand === true && document.querySelectorAll('.htile').length > 0, null, { timeout: 20000 });
  await sleep(800);
  await point(0.8, 0.2); await sleep(800);                   /* (somewhere harmless first: the hero) */
  const t = await popTile();
  await point(t.x, t.y); await sleep(1500);
  const lit = await page.evaluate(() => ({ hot: !!document.querySelector('.htile.hot'), say: document.querySelector('.hsay.show')?.textContent || '', driver: window.__scene().hand }));
  if (SHOTS && round === 1) await page.screenshot({ path: join(SHOTS, 'hand-pointing.png') });
  /* holding still never starts anything */
  await sleep(2500);
  const stillGame = await page.evaluate(() => window.__game() && window.__game().id);
  await wave(t.x, t.y);
  await page.waitForFunction(() => window.__game() && window.__game().id === 'pop-party', null, { timeout: 8000 }).catch(() => {});
  const g = await page.evaluate(() => window.__game() && window.__game().id);
  const pass = lit.hot && !stillGame && g === 'pop-party';
  if (pass) picked++;
  console.log(`round ${round}: lit=${lit.hot} said="${lit.say}" after 4 s still: ${stillGame || 'nothing started'}; after the wave: ${g || 'nothing'}  ${pass ? 'ok' : 'FAILED'}`);
}
check('a scripted pose picks and starts Pop Party from Home three times out of three', picked === 3, `${picked} of 3`);
await browser.close();
process.exit(ok.every(Boolean) ? 0 : 1);
