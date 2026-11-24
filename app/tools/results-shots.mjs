/* Pop Party's results screen with 1, 2, 3 and 4 players, at 1920 x 1080 and 1280 x 720 (the scripted bodies of tools/playtest/rig.mjs play the
   round through the real tracker, then the round is finished).

     cd app && npx vite --port 5191 --strictPort &          (another port if taken; then BASE=http://127.0.0.1:<port>)
     node tools/results-shots.mjs [out dir (../docs/calm)] [game (pop-party)]

   Files: <out>/results-<n>p.png (1920 x 1080) and results-<n>p-720.png (1280 x 720). */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
const args = process.argv.slice(2);
const OUT = resolve(process.cwd(), args[0] || '../docs/calm'), BASE = process.env.BASE || 'http://127.0.0.1:5191', GAME = args[1] || 'pop-party';
const LINEUP = { 1: '1c', 2: '2m', 3: '3m', 4: '4m' };
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;      /* e.g. ONLY=3p,1p-720 to redo some */
for (const [w, h, suffix] of [[1920, 1080, ''], [1280, 720, '-720']]) for (const n of [1, 2, 3, 4]) for (let attempt = 1; attempt <= 3; attempt++){
  if (ONLY && !ONLY.includes(n + 'p' + suffix)) break;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', n, e.message));
  try {
    await page.goto(`${BASE}/?game=${GAME}&fx=0&splash=0`);
    await page.waitForFunction(() => window.__pose && window.__go, null, { timeout: 60000 });
    await page.waitForFunction(() => window.__mode && ['play', 'starting', 'lineup'].includes(window.__mode()), null, { timeout: 60000 });
    await page.evaluate(async () => { window.__ptm = await import('/tools/playtest/page.mjs'); });
    await page.evaluate(({ lineup, game }) => window.__ptm.start({ lineup, seed: 1, id: game }), { lineup: LINEUP[n], game: GAME });
    await page.waitForFunction(() => window.__round() && window.__round().t > 2, null, { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => window.__ptm.toEnd());
    await page.evaluate(() => { if (window.__mode() === 'play') window.__finish(); });
    await page.waitForFunction(() => window.__mode() === 'results', null, { timeout: 60000 }).catch(() => console.log('(no results screen:', n, ')'));
    await page.waitForTimeout(1800);
    await page.screenshot({ path: join(OUT, `results-${n}p${suffix}.png`) });
    console.log('results-' + n + 'p' + suffix, 'done');
    attempt = 9;
  } catch (e){ console.log('FAILED', n, w, 'attempt', attempt, e.message); }
  await ctx.close();
}
await browser.close();
