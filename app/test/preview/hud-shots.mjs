/* The HUD in pictures (decision 0046): Pop Party, Keep It Up and Save the Harvest, one shot 1 s into the round (words up) and one 8 s in.
   Not part of `npm test`; run by hand with the dev server up:

     cd app && npx vite --port 5193 --strictPort &
     node test/preview/hud-shots.mjs ../docs/calm before|after

   1920 x 1080. Two scripted bodies through pose._assign (the camera is not used). */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
const args = process.argv.slice(2);
const OUT = args[0] || '../docs/hands', BASE = process.env.BASE || 'http://127.0.0.1:5193';
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


const SUFFIX = args[1] || 'after';
for (const game of ['pop-party', 'keep-it-up', 'save-the-harvest']){
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.goto(`${BASE}/?game=${game}&fx=0&splash=0`);
  await page.waitForFunction(() => window.__pose, null, { timeout: 60000 });
  await page.evaluate(script);
  await page.waitForFunction(() => window.__mode && window.__mode() === 'play', null, { timeout: 60000 }).catch(() => console.log('(never reached play: ' + game + ')'));
  await sleep(page, 1000);
  await page.screenshot({ path: join(OUT, `hud-${game}-${SUFFIX}-1s.png`) });
  await sleep(page, 7000);
  await page.screenshot({ path: join(OUT, `hud-${game}-${SUFFIX}-8s.png`) });
  console.log(game, await page.evaluate(() => window.__mode()));
  await ctx.close();
}
await browser.close();
