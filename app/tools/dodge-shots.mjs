/* Pictures of a made Dodge game (decision 0064: an empty bar puts a player out), played by the scripted bodies of tools/playtest/rig.mjs through the
   real tracker, at 1920 x 1080: a single player mid-round, four players mid-round with one out, and the results with some out and some not.

     cd app && npx vite --port 5191 --strictPort &          (another port if taken; then BASE=http://127.0.0.1:<port>)
     node tools/dodge-shots.mjs [out dir (../docs/calm)] [seed (3)]

   Files: <out>/dodge2-1.png, dodge2-4.png, dodge2-results.png */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
const args = process.argv.slice(2);
const OUT = resolve(process.cwd(), args[0] || '../docs/calm'), BASE = process.env.BASE || 'http://127.0.0.1:5191', SEED = +(args[1] || 3);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function open(lineup){
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.goto(`${BASE}/?game=pop-party&fx=0&splash=0`);
  await page.waitForFunction(() => window.__pose && window.__go, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__mode && ['play', 'starting', 'lineup'].includes(window.__mode()), null, { timeout: 60000 });
  await page.evaluate(async () => {
    const made = await import('/tools/playtest/made.mjs');
    window.__ptm = await import('/tools/playtest/page.mjs');
    window.__go.toGame(made.makeMade('made-dodge'));
  });
  await page.evaluate(({ lineup, seed }) => window.__ptm.start({ lineup, seed, id: 'made-dodge' }), { lineup, seed: SEED });
  await page.waitForFunction(() => window.__round() && window.__round().t > 1, null, { timeout: 60000 }).catch(() => {});
  return { ctx, page };
}

/* one player, mid-round */
{
  const { ctx, page } = await open('1c');
  await page.evaluate(() => window.__ptm.ff(22));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, 'dodge2-1.png') });
  console.log('dodge2-1', await page.evaluate(() => { const g = window.__round(); return { t: g.t, hp: g.hp.slice(0, 1), out: g.out.slice(0, 1) }; }));
  await ctx.close();
}
/* four players, exactly one is out (tried again if the round did not go that way: the timing in the page is not exactly the same each run) */
for (let attempt = 1; attempt <= 8; attempt++){
  const { ctx, page } = await open('4m');
  const st = await page.evaluate(() => { window.__ptm.ff(200, (g) => g.out.slice(0, 4).some(Boolean)); window.__ptm.ff(0.5); const g = window.__round(); return { t: g.t, hp: g.hp.slice(0, 4), out: g.out.slice(0, 4), outAt: g.outAt.slice(0, 4) }; });
  const ok = st.out.filter(Boolean).length === 1 && st.hp.filter((h, i) => !st.out[i]).every(h => h >= 0.3);
  if (ok || attempt === 8){ await page.waitForTimeout(300); await page.screenshot({ path: join(OUT, 'dodge2-4.png') }); console.log('dodge2-4', ok, JSON.stringify(st)); await ctx.close(); break; }
  await ctx.close();
}
/* results: the round to its end, some out and some not */
for (let attempt = 1; attempt <= 8; attempt++){
  const { ctx, page } = await open('4m');
  const st = await page.evaluate(() => { window.__ptm.ff(130, (g) => g.over); const g = window.__round(); const r = { t: g.t, hp: g.hp.slice(0, 4), out: g.out.slice(0, 4), outAt: g.outAt.slice(0, 4) }; window.__finish(); return r; });
  const k = st.out.filter(Boolean).length, ok = k >= 1 && k <= 3;
  if (!ok && attempt < 8){ await ctx.close(); continue; }
  await page.waitForFunction(() => window.__mode() === 'results', null, { timeout: 60000 }).catch(() => console.log('(no results screen)'));
  await page.waitForTimeout(1800);
  await page.screenshot({ path: join(OUT, 'dodge2-results.png') });
  console.log('dodge2-results', ok, JSON.stringify(st));
  await ctx.close(); break;
}
await browser.close();
