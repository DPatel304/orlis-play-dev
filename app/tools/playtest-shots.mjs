/* Pictures of the real games being played by the scripted bodies (tools/playtest/rig.mjs), 1920 x 1080, in headless Chrome.

     cd app && npx vite --port 5191 --strictPort &          (another port if 5191 is taken; then BASE=http://127.0.0.1:<port>)
     node tools/playtest-shots.mjs [out dir (relative to where you run it; ../docs/playtest)] [games, comma separated] [line-ups, comma separated (1c,4m)]

   For each game and line-up: early (a few seconds in, real time), mid (the game is run forward to a moment worth a picture) and end (the
   results card, with the ending scene behind it). The bodies go through the app's real tracker; the camera is not used.
   Note: "mid" and "end" run the game forward without waiting, so the clock on the shell's HUD is not moved on. Files: <game>-<lineup>-<moment>.png */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const OUT = resolve(process.cwd(), args[0] || '../docs/playtest'), BASE = process.env.BASE || 'http://127.0.0.1:5191';
const GAMES = (args[1] || 'pop-party,sky-painter,sleepy-bear,leaf-pile,stack-it-high,animal-gym,keep-it-up,ptero-flight,save-the-harvest,cubions-long-way-home').split(',');
const LINEUPS = (args[2] || '1c,4m').split(',');
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function shoot(game, lineup){
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', game, lineup, e.message));
  const name = (m) => join(OUT, `${game}-${lineup}-${m}.png`);
  try {
    await page.goto(`${BASE}/?game=${game}&fx=0&splash=0`);
    await page.waitForFunction(() => window.__pose && window.__go, null, { timeout: 60000 });
    await page.waitForFunction(() => window.__mode && ['play', 'starting', 'lineup'].includes(window.__mode()), null, { timeout: 60000 });
    await page.evaluate(async () => { window.__ptm = await import('/tools/playtest/page.mjs'); });
    const s = await page.evaluate(({ lineup, game }) => window.__ptm.start({ lineup, seed: 1, id: game }), { lineup, game });
    console.log(game, lineup, 'started', JSON.stringify(s));
    /* early: a few seconds of the real game, in real time */
    await page.waitForFunction(() => window.__round() && window.__round().t > 3.5, null, { timeout: 60000 }).catch(() => {});
    await page.screenshot({ path: name('early') });
    const mid = await page.evaluate(() => window.__ptm.toMid());
    await page.waitForTimeout(250);
    await page.screenshot({ path: name('mid') });
    const end = await page.evaluate(() => window.__ptm.toEnd());
    await page.evaluate(() => { if (window.__mode() === 'play') window.__finish(); });
    await page.waitForFunction(() => window.__mode() === 'results', null, { timeout: 60000 }).catch(() => console.log('(no results screen:', game, lineup, ')'));
    await page.waitForTimeout(1800);
    await page.screenshot({ path: name('end') });
    console.log(game, lineup, 'mid', JSON.stringify(mid), 'end', JSON.stringify(end));
  } catch (e){ console.log('FAILED', game, lineup, e.message); }
  await ctx.close();
}
/* a story has no bodies (nobody has to do anything), so one set of pictures does for every line-up: its first page, a page with a move card
   (beat 7: "Reach up high!"), and the end (the last beat). The ?beat=N address starts the story at beat N. */
async function shootStory(game){
  const BEATS = { early: 0, mid: 7, end: 29 };
  for (const [moment, beat] of Object.entries(BEATS)){
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGE ERROR', game, e.message));
    try {
      await page.goto(`${BASE}/?game=${game}&fx=0&splash=0&beat=${beat}`);
      await page.waitForFunction(() => window.__pose && window.__go && window.__mode && window.__round && window.__round(), null, { timeout: 60000 });
      await page.waitForFunction(() => window.__mode() === 'play', null, { timeout: 60000 });
      if (moment === 'early') await page.waitForFunction(() => window.__round().t > 3.5, null, { timeout: 60000 }).catch(() => {});
      if (moment === 'mid') await page.waitForFunction(() => window.__round().card && window.__round().card(), null, { timeout: 60000 }).catch(() => console.log('(no card yet)'));
      if (moment === 'end') await page.waitForFunction(() => window.__mode() === 'results', null, { timeout: 120000 }).then(() => page.waitForTimeout(1800)).catch(() => console.log('(story end never came)'));
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(OUT, `${game}-all-${moment}.png`) });
      console.log(game, moment, 'beat', await page.evaluate(() => window.__round() && window.__round().i));
    } catch (e){ console.log('FAILED', game, moment, e.message); }
    await ctx.close();
  }
}
/* Sky Painter's five covers (and a finished picture): each cover from its start (the top layer), part-way through (two layers showing and a bit of
   the picture), and the picture uncovered. Files: sky-<cover>-fresh.png, sky-<cover>-mid.png, sky-finished.png. Asked for as the game name "sky-covers". */
async function shootSky(lineup){
  const COVERS = ['clouds', 'frost', 'snow', 'foam', 'sand'];
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR sky', e.message));
  try {
    await page.goto(`${BASE}/?game=sky-painter&fx=0&splash=0`);
    await page.waitForFunction(() => window.__pose && window.__go, null, { timeout: 60000 });
    await page.waitForFunction(() => window.__mode && ['play', 'starting', 'lineup'].includes(window.__mode()), null, { timeout: 60000 });
    await page.evaluate(async () => { window.__ptm = await import('/tools/playtest/page.mjs'); });
    console.log('sky started', JSON.stringify(await page.evaluate((lineup) => window.__ptm.start({ lineup, seed: 1, id: 'sky-painter' }), lineup)));
    await page.waitForFunction(() => window.__round() && window.__round().t > 2, null, { timeout: 60000 }).catch(() => {});
    for (let i = 0; i < COVERS.length; i++){
      const id = COVERS[i];
      await page.evaluate(({ id, i }) => window.__ptm.skyFresh(id, i % 3), { id, i });
      await page.waitForTimeout(900);
      await page.screenshot({ path: join(OUT, `sky-${id}-fresh.png`) });
      const mid = await page.evaluate(() => window.__ptm.skyMid());
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(OUT, `sky-${id}-mid.png`) });
      console.log('sky', id, 'mid', JSON.stringify(mid));
    }
    await page.evaluate(() => window.__ptm.skyFresh('clouds', 0));
    const done = await page.evaluate(() => window.__ptm.skyDone());
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT, 'sky-finished.png') });
    console.log('sky finished', JSON.stringify(done));
  } catch (e){ console.log('FAILED sky', e.message); }
  await ctx.close();
}
for (const g of GAMES){
  if (g === 'sky-covers') for (const l of LINEUPS) await shootSky(l);
  else if (g === 'cubions-long-way-home') await shootStory(g);
  else for (const l of LINEUPS) await shoot(g, l);
}
await browser.close();
