/* Tidy pass 2 in pictures: Keep It Up's move card (settled, on screen), and the Cubion story's end card, at 1920x1080 and 1280x720.
   Not part of `npm test`; run by hand with the dev server up:

     cd app && npx vite --port 5193 --strictPort &
     BASE=http://127.0.0.1:5193 node test/preview/tidy2-shots.mjs ../docs/calm [card|story]

   Files: tidy2-<name>-<size>.png */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
const OUT = process.argv[2] || '../docs/calm', WHAT = process.argv[3] || 'all', BASE = process.env.BASE || 'http://127.0.0.1:5193', TAG = process.env.TAG || '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const SIZES = [['1920', 1920, 1080], ['1280', 1280, 720]];

/* a body or two standing in view, through pose._assign (the camera is not used) */
const bodies = () => {
  const pose = window.__pose; pose.update = () => {};
  const body = (cx) => {
    const lm = Array.from({ length: 33 }, () => ({ x: cx, y: 0.5, z: 0, v: 0.95, visibility: 0.95 }));
    const set = (i, x, y) => { lm[i] = { x, y, z: 0, v: 0.95, visibility: 0.95 }; };
    set(0, cx, 0.2); set(11, cx - 0.06, 0.32); set(12, cx + 0.06, 0.32); set(13, cx - 0.1, 0.24); set(14, cx + 0.1, 0.22); set(15, cx - 0.1, 0.12); set(16, cx + 0.1, 0.15);
    set(23, cx - 0.04, 0.62); set(24, cx + 0.04, 0.62); set(25, cx - 0.04, 0.8); set(26, cx + 0.04, 0.8); set(27, cx - 0.04, 0.95); set(28, cx + 0.04, 0.95);
    return lm;
  };
  setInterval(() => { pose.on = true; pose.ready = true; pose._assign([body(0.3), body(0.7)], 0.1); pose.at(); }, 100);
};

for (const [size, W, H] of SIZES){
  if (WHAT === 'all' || WHAT === 'card'){
    for (const game of (process.env.GAMES || 'keep-it-up').split(',')){
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
      await page.goto(`${BASE}/?game=${game}&fx=0&splash=0`);
      await page.waitForFunction(() => window.__pose, null, { timeout: 60000 });
      await page.evaluate(bodies);
      await page.waitForFunction(() => window.__mode && window.__mode() === 'play', null, { timeout: 60000 }).catch(() => console.log('(never reached play: ' + game + ')'));
      await page.waitForTimeout(2500);                  /* the card has slid in and is settled */
      await page.screenshot({ path: join(OUT, `tidy2-${TAG}${game}-card-${size}.png`) });
      console.log(game, size, 'card');
      await ctx.close();
    }
  }
  if (WHAT === 'all' || WHAT === 'story'){
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
    await page.goto(`${BASE}/?game=cubions-long-way-home&fx=0&splash=0&beat=29`);
    await page.waitForFunction(() => window.__pose && window.__go && window.__mode && window.__round && window.__round(), null, { timeout: 60000 });
    await page.waitForFunction(() => window.__mode() === 'results', null, { timeout: 120000 }).then(() => page.waitForTimeout(1800)).catch(() => console.log('(story end never came)'));
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, `tidy2-${TAG}story-end-${size}.png`) });
    console.log('story end', size);
    await ctx.close();
  }
}
await browser.close();
