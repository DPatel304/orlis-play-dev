/* Animal Gym coach pictures: each coach at two moments of its move (the low and high points), a counted try and the "Great job!"
   flourish, 1920x1080; and a four-player 1280x720 (and a reduced-motion one).
     cd app && npx vite --port 5191 --strictPort &   then   BASE=http://127.0.0.1:<port> node tools/gym-shots.mjs [out dir]   (files: gym-<name>.png)
   The round is frozen at an exact moment (step is stopped, the time set), so the pictures show the poses, not the timing. */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
const OUT = resolve(process.cwd(), process.argv[2] || '../docs/playtest'), BASE = process.env.BASE || 'http://127.0.0.1:5191';
mkdirSync(OUT, { recursive: true });
const BEAT = 60 / 140, MOVES = ['reach', 'jump', 'flap', 'squat', 'march', 'lean'];
const BEATS = { reach: 6, jump: 2, flap: 2, squat: 4, march: 4, lean: 4 };
/* [file name, move, phase of the loop, seconds since "Great job!" (-1 none), try (1 -> 0)] */
const FULL = [
  ['giraffe-a', 'reach', 0.0], ['giraffe-b', 'reach', 0.5], ['bunny-a', 'jump', 0.0], ['bunny-b', 'jump', 0.5], ['bird-a', 'flap', 0.0], ['bird-b', 'flap', 0.5],
  ['frog-a', 'squat', 0.5], ['frog-b', 'squat', 0.8], ['elephant-a', 'march', 0.25], ['elephant-b', 'march', 0.75], ['penguin-a', 'lean', 0.25], ['penguin-b', 'lean', 0.75],
  ['giraffe-cheer', 'reach', 0.5, 0.6], ['bunny-try', 'jump', 0.5, -1, 0.9]
];
const SMALL = [['4p-bird', 'flap', 0.5], ['4p-giraffe', 'reach', 0.5], ['4p-elephant', 'march', 0.25]];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
async function run(w, h, players, list, reduced){
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.goto(`${BASE}/?game=animal-gym&fx=0&splash=0`);
  await page.waitForFunction(() => window.__pose && window.__go && window.__mode && ['play', 'starting', 'lineup'].includes(window.__mode()), null, { timeout: 60000 });
  await page.evaluate(async () => { window.__ptm = await import('/tools/playtest/page.mjs'); });
  await page.evaluate(({ players }) => window.__ptm.start({ lineup: players === 4 ? '4m' : '1c', seed: 1, id: 'animal-gym' }), { players });
  for (const [name, move, ph, joy = -1, tryK = 0] of list){
    await page.evaluate(({ move, t, joy, tryK, MOVES }) => {
      const g = window.__round(); g.step = () => {};
      const i = MOVES.indexOf(move);
      g.seg = i; g.cool = false; g.t = t; g.cheered = joy >= 0; g.cheerT = joy; g.pulse = tryK; g.fill = joy >= 0 ? 1 : 0.4;
      g.say = { icon: 'giraffe', text: joy >= 0 ? 'Great job!' : 'Go!', t: 5 };
    }, { move, t: (Math.ceil(30 / (BEATS[move] * BEAT)) + ph) * BEATS[move] * BEAT, joy, tryK, MOVES: ['reach', 'jump', 'flap', 'squat', 'march', 'lean'] });
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT, `gym-${name}${reduced ? '-reduced' : ''}.png`) });
  }
  await ctx.close();
}
await run(1920, 1080, 1, FULL);
await run(1280, 720, 4, SMALL);
await run(1920, 1080, 1, [['giraffe-a', 'reach', 0.5], ['frog-a', 'squat', 0.5]], true);
await browser.close();
