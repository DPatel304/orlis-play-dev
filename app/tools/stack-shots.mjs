/* Pictures of Stack It High being built by the scripted bodies (tools/playtest/rig.mjs), at 1920x1080 and 1280x720, in headless Chrome.

     cd app && npx vite --port 5191 --strictPort &
     node tools/stack-shots.mjs [out dir (../docs/playtest)] [line-ups (1c,4m)]

   Per line-up and size: mid-build, a block carried with both hands (the glow), the end (the camera panning across what was built) and the
   results card. Files: stack-<lineup>-<width>-<moment>.png */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
const args = process.argv.slice(2);
const OUT = resolve(process.cwd(), args[0] || '../docs/playtest'), BASE = process.env.BASE || 'http://127.0.0.1:5191';
const LINEUPS = (args[1] || '1c,4m').split(',');
const SIZES = [[1920, 1080], [1280, 720]];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function shoot(lineup, [w, h]){
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', lineup, w, e.message));
  const name = (m) => join(OUT, `stack-${lineup}-${w}-${m}.png`);
  try {
    await page.goto(`${BASE}/?game=stack-it-high&fx=0&splash=0`);
    await page.waitForFunction(() => window.__pose && window.__go, null, { timeout: 60000 });
    await page.waitForFunction(() => window.__mode && ['play', 'starting', 'lineup'].includes(window.__mode()), null, { timeout: 60000 });
    await page.evaluate(async () => { window.__ptm = await import('/tools/playtest/page.mjs'); });
    await page.evaluate(({ lineup }) => window.__ptm.start({ lineup, seed: 2, id: 'stack-it-high' }), { lineup });
    await page.waitForFunction(() => window.__round() && window.__round().t > 2, null, { timeout: 60000 }).catch(() => {});
    /* mid-build */
    await page.evaluate(() => window.__ptm.ff(75));
    await page.waitForTimeout(250);
    await page.screenshot({ path: name('mid') });
    /* a block carried with both hands: run forward until one has been held a moment */
    const got = await page.evaluate(() => { const g = window.__round(); let held = 0; for (let i = 0; i < 1500; i++){ window.__ptm.ff(0.1); held = g.blocks.some(b => b.held != null && g.hold[b.held] && b.age > 0 && Math.hypot(g.hold[b.held].vx, g.hold[b.held].vy) < 0.4 && b.Y < 0.75) ? held + 1 : 0; if (held >= 8) return true; } return false; });
    console.log(lineup, w, 'carry found', got);
    await page.waitForTimeout(250);
    await page.screenshot({ path: name('carry') });
    /* the end: the camera pans across what was built, then the results */
    await page.evaluate(() => { window.__ptm.toEnd(); window.__ptm.ff(3); window.__round().over = true; });
    await page.waitForFunction(() => window.__mode() === 'outro', null, { timeout: 30000 }).catch(() => console.log('(no outro)'));
    await page.waitForTimeout(2600);
    await page.screenshot({ path: name('pan') });
    await page.waitForFunction(() => window.__mode() === 'results', null, { timeout: 60000 }).catch(() => console.log('(no results screen)'));
    await page.waitForTimeout(1800);
    await page.screenshot({ path: name('results') });
  } catch (e){ console.log('FAILED', lineup, w, e.message); }
  await ctx.close();
}
for (const l of LINEUPS) for (const s of SIZES) await shoot(l, s);
await browser.close();
