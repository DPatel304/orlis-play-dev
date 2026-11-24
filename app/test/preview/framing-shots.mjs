/* The camera check in "get ready" (ui/framing-check.js), in pictures: too close, off to the side, feet cut, and the first-time "Great" moment,
   at 1920x1080 and 1280x720. Not part of `npm test`; run by hand with the dev server up:

     cd app && npx vite --port 5191 --strictPort &
     node test/preview/framing-shots.mjs ../docs/calm            (ONLY=too-close,feet-cut for some of the cases; BASE=... for another port)

   The player is a body put through pose._assign ten times a second (the camera is not used), the way hands-shots.mjs does it. */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
const OUT = process.argv[2] || '../docs/calm', BASE = process.env.BASE || 'http://127.0.0.1:5191';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

/* a standing body (mirrored screen coordinates): where across, the nose's y, and nose-to-ankle span */
const CASES = {
  'too-close': { cx: 0.5, top: 0.05, span: 1.25 },
  'off-to-the-side': { cx: 0.97, top: 0.15, span: 0.72 },
  'feet-cut': { cx: 0.5, top: 0.4, span: 0.62 },
  'first-time-great': { cx: 0.5, top: 0.15, span: 0.72 }
};

const script = ({ cx, top, span }) => {
  const poll = setInterval(() => {
    const pose = window.__pose;
    if (!pose) return;
    clearInterval(poll);
    pose.update = () => {};
    /* (with no camera or model to load, the tracker falls back to the mouse and the check is skipped: hold that off, for good) */
    Object.defineProperty(pose.mouse, 'active', { get: () => false, set: () => {}, configurable: true });
    const body = () => {
      const lm = Array.from({ length: 33 }, () => ({ x: cx, y: 0.5, z: 0, v: 0.95, visibility: 0.95 }));
      const at = (i, dx, f) => { lm[i] = { x: cx + dx, y: top + span * f, z: 0, v: 0.95, visibility: 0.95 }; };
      at(0, 0, 0); at(2, -0.01, -0.02); at(5, 0.01, -0.02);
      at(11, -0.05, 0.22); at(12, 0.05, 0.22); at(13, -0.075, 0.38); at(14, 0.075, 0.38); at(15, -0.08, 0.52); at(16, 0.08, 0.52);
      at(23, -0.03, 0.55); at(24, 0.03, 0.55); at(25, -0.032, 0.78); at(26, 0.032, 0.78); at(27, -0.034, 1); at(28, 0.034, 1);
      for (const i of [29, 30, 31, 32]) at(i, i % 2 ? 0.034 : -0.034, 1.03);
      return lm;
    };
    setInterval(() => { pose.mouse.active = false; pose.on = true; pose.ready = true; pose._assign([body()], 0.1); pose.at(); }, 100);
  }, 5);
};

for (const [size, W, H] of [['1920', 1920, 1080], ['1280', 1280, 720]]){
  for (const [name, spec] of Object.entries(CASES)){
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) continue;
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
    if (process.env.LOUD) page.on('console', (m) => console.log('console:', m.text().slice(0, 200)));
    /* (everything but the first-time shot has already seen the reassurance on this PC) */
    await page.addInitScript((seen) => { try { if (seen) localStorage.setItem('orlis_framing_shown', '1'); else localStorage.removeItem('orlis_framing_shown'); } catch (e){} }, name !== 'first-time-great');
    await page.addInitScript(script, spec);
    await page.goto(`${BASE}/?game=pop-party&splash=0`);
    const hit = await page.waitForFunction(() => window.__mode && window.__mode() === 'framing' && document.querySelector('.frmsay') && document.querySelector('.frmsay').textContent, null, { timeout: 60000 }).then(() => true, () => false);
    if (!hit) console.log('(never reached the framing check: ' + name + ' ' + size + ')');
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(OUT, `framing-${name}-${size}.png`) });
    console.log(name, size, await page.evaluate(() => window.__mode() + ' | ' + ((document.querySelector('.frmsay') || {}).textContent || '(no words)')));
    await ctx.close();
  }
}
await browser.close();
