/* The three ways to show hands (handshow.js), in pictures: Pop Party with two scripted players in each way, and Home with a tile lit by pointing.
   Not part of `npm test`; run by hand with the dev server up:

     cd app && npx vite --port 5191 --strictPort &
     node test/preview/hands-shots.mjs ../docs/hands

   1920 x 1080. The players are bodies put through pose._assign ten times a second (the camera is not used). */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
const args = process.argv.slice(2);
const OUT = args[0] || '../docs/hands', BASE = process.env.BASE || 'http://127.0.0.1:5191';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const sleep = (page, ms) => page.waitForTimeout(ms);

/* two standing bodies (camera coordinates, before mirroring: the app mirrors them), each with the arms up and a hand moving */
const script = () => {
  const pose = window.__pose;
  pose.update = () => {};
  const S = window.__S = { t: 0 };
  const body = (cx, hand) => {
    const lm = Array.from({ length: 33 }, () => ({ x: cx, y: 0.5, z: 0, v: 0.95, visibility: 0.95 }));
    const set = (i, x, y) => { lm[i] = { x, y, z: 0, v: 0.95, visibility: 0.95 }; };
    set(0, cx, 0.2); set(2, cx - 0.02, 0.18); set(5, cx + 0.02, 0.18); set(7, cx - 0.04, 0.2); set(8, cx + 0.04, 0.2);
    set(11, cx - 0.06, 0.32); set(12, cx + 0.06, 0.32);
    set(13, cx - 0.1, 0.24); set(14, cx + 0.1, 0.22); set(15, hand.lx, hand.ly); set(16, hand.rx, hand.ry);
    set(23, cx - 0.04, 0.62); set(24, cx + 0.04, 0.62); set(25, cx - 0.04, 0.8); set(26, cx + 0.04, 0.8); set(27, cx - 0.04, 0.95); set(28, cx + 0.04, 0.95);
    return lm;
  };
  setInterval(() => {
    S.t += 0.1;
    const a = body(0.3, { lx: 0.2 + Math.sin(S.t * 3) * 0.02, ly: 0.12, rx: 0.4, ry: 0.15 + Math.sin(S.t * 2) * 0.03 });
    const b = body(0.7, { lx: 0.6, ly: 0.14, rx: 0.8 + Math.sin(S.t * 4) * 0.03, ry: 0.1 });
    pose.on = true; pose.ready = true; pose._assign([a, b], 0.1); pose.at();
  }, 100);
};

for (const way of ['rings', 'body', 'glow']){
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.addInitScript((w) => { try { localStorage.setItem('orlis_handsmode', w); } catch (e){} }, way);
  await page.goto(`${BASE}/?game=pop-party&fx=0&splash=0`);
  await page.waitForFunction(() => window.__pose, null, { timeout: 60000 });
  await page.evaluate(script);
  await page.waitForFunction(() => window.__mode && window.__mode() === 'play', null, { timeout: 60000 }).catch(() => console.log('(never reached play: ' + way + ')'));
  await sleep(page, 6000);
  /* a fast wipe of one hand so the sparkles show */
  await page.screenshot({ path: join(OUT, `pop-party-${way}.png`) });
  console.log('pop-party', way, await page.evaluate(() => window.__mode() + ' players=' + window.__pose.personCount));
  await ctx.close();
}

/* Home, a tile lit by pointing (the scripted body points at Pop Party's tile) */
{
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, permissions: ['camera'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.goto(`${BASE}/?hand=1&fx=0&splash=0`);
  await page.waitForFunction(() => window.__scene && window.__scene().focus !== undefined && window.__pose, null, { timeout: 60000 });
  await sleep(page, 3000);
  await page.evaluate(() => {
    const pose = window.__pose; pose.update = () => {};
    pose.mouse.active = false; pose.reason = ''; pose.on = true; pose.ready = true; pose.lite = { hz: 10, idleHz: 2 };   /* (no tracker to load here: the scripted body stands in for the camera) */
    const S = window.__S = { hand: { x: 0.5, y: 0.35 } };
    const body = () => {
      const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, v: 0.95 }));
      const set = (i, x, y) => { lm[i] = { x, y, z: 0, v: 0.95 }; };
      set(0, 0.5, 0.2); set(2, 0.48, 0.18); set(5, 0.52, 0.18); set(11, 0.44, 0.32); set(12, 0.56, 0.32);
      set(13, 0.4, 0.42); set(14, 0.6, 0.42); set(15, 0.4, 0.55); set(23, 0.46, 0.62); set(24, 0.54, 0.62);
      set(25, 0.46, 0.8); set(26, 0.54, 0.8); set(27, 0.46, 0.95); set(28, 0.54, 0.95); set(16, S.hand.x, S.hand.y);
      return lm;
    };
    setInterval(() => { pose.on = true; pose.ready = true; pose._assign([body()], 0.1); pose.at(); }, 100);
  });
  await page.waitForFunction(() => window.__scene().hand === true && document.querySelectorAll('.htile').length > 0, null, { timeout: 20000 });
  await sleep(page, 1000);
  const t = await page.evaluate(() => { const e = [...document.querySelectorAll('.htile.game')][1] || document.querySelector('.htile'); const r = e.getBoundingClientRect(); return { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight }; });
  const h = { x: 0.5 - 0.18 + t.x * 0.36, y: 0.32 - 0.6 * 0.12 * 16 / 9 + t.y * (0.12 * 16 / 9 * 1.55) };
  await page.evaluate(([x, y]) => { window.__S.hand.x = x; window.__S.hand.y = y; }, [h.x, h.y]);
  await sleep(page, 2500);
  /* a little wave, part way, so the ring along the edge shows */
  for (let i = 0; i < 3; i++){ await page.evaluate(([x, y]) => { window.__S.hand.x = x; window.__S.hand.y = y; }, [h.x + (i % 2 ? 0.04 : -0.04), h.y]); await sleep(page, 100); }
  await page.screenshot({ path: join(OUT, 'home-pointing.png') });
  console.log('home lit:', await page.evaluate(() => !!document.querySelector('.htile.hot')));
  await ctx.close();
}
await browser.close();
