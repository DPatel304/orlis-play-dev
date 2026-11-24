/* Pictures of the new Create (decision 0057) for the tidy-up pass: the Create home, a builder step, and the results card of a made game, into
   docs/calm/create-tidy-*.png (or CREATE_OUT). A signed-in account and creations are stubbed in localStorage; the server is not needed.
   Run (dev server up):  cd app && npx vite --port 5207 --strictPort   then   node test/preview/create-tidy-shots.mjs
   (Headless Chromium draws in software: the pictures are about the look.) */
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const OUT = process.env.CREATE_OUT || path.resolve(import.meta.dirname, '..', '..', '..', 'docs', 'calm');
const URL = process.env.URL || 'http://localhost:5207/?splash=0';
const ONLY = process.env.ONLY || '';
fs.mkdirSync(OUT, { recursive: true });
const SIZES = [[1920, 1080, ''], [1280, 720, '-720']];
const account = {
  server: { url: 'http://127.0.0.1:1', id: 's1', name: 'Home' }, token: 't', account: { id: 'a1', email: 'mum@example.com', role: 'owner' },
  household: { id: 'here', name: 'Home' },
  profiles: [{ id: 'p1', accountId: 'a1', name: 'Mum', look: { skin: 0 } }, { id: 'p2', accountId: 'a1', name: 'Ada', look: { skin: 1 } }], current: 'p1'
};
const picks = (o) => ({ how: 'catch', what: 'apple', where: 'meadow', move: 'reach', speed: 2, many: 2, size: 2, minutes: 1, mode: 'together', golden: true, bomb: false, ...o });
const mk = (id, name, p) => ({ id, name, makerId: 'p2', picks: picks(p), createdAt: '2026-11-24T10:00:00Z', updatedAt: '2026-11-24T10:00:00Z' });
const made = [mk('c1', 'Apple Catch', {}), mk('c2', 'Bee Dash', { how: 'dodge', what: 'bee', where: 'sunset' }), mk('c3', 'Star Bounce', { how: 'keepup', what: 'star', where: 'night' })];

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const open = async (w, h, list) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(([a, l]) => { try { localStorage.setItem('orlis.account', JSON.stringify(a)); localStorage.setItem('orlis.creations:here', JSON.stringify(l)); } catch {} }, [account, list]);
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', e => page.errors.push(String(e)));
  await page.goto(URL); await page.waitForTimeout(2500);
  return { ctx, page };
};
const toCreate = async (page) => { await page.evaluate(() => window.__go.toCreate()); await page.waitForTimeout(1800); };

for (const [w, h, sfx] of SIZES) {
  if (!ONLY || ONLY === 'home') {
    const { ctx, page } = await open(w, h, made);
    await toCreate(page);
    await page.screenshot({ path: path.join(OUT, `create-tidy-home${sfx}.png`) }); console.log('saved home', w, page.errors);
    await ctx.close();
  }
  if (!ONLY || ONLY === 'step') {
    const { ctx, page } = await open(w, h, made.slice(0, 1));
    await toCreate(page);
    await page.getByText('Make a game').first().click(); await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, `create-tidy-step1${sfx}.png`) }); console.log('saved step1', w, page.errors);
    await page.getByText('Pop', { exact: true }).first().click().catch(() => {}); await page.waitForTimeout(600);
    await page.getByText('Next', { exact: false }).first().click().catch(() => {}); await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `create-tidy-step2${sfx}.png`) }); console.log('saved step2', w);
    for (let k = 0; k < 3; k++) { await page.getByText('Next', { exact: false }).first().click().catch(() => {}); await page.waitForTimeout(900); }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, `create-tidy-step5${sfx}.png`) }); console.log('saved step5', w);
    await page.getByText('Next', { exact: false }).first().click().catch(() => {}); await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(OUT, `create-tidy-step6${sfx}.png`) }); console.log('saved step6', w);
    await ctx.close();
  }
  if (!ONLY || ONLY === 'results') {
    for (const [i, name] of [[0, 'results'], [1, 'results-dodge'], [2, 'results-keepup']]) {
      const { ctx, page } = await open(w, h, made);
      await toCreate(page);
      await page.getByText(made[i].name, { exact: true }).first().click(); await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT, `create-tidy-slot${sfx}.png`) });
      await page.getByRole('button', { name: /Play/ }).first().click().catch(async () => { await page.getByText('Play', { exact: true }).last().click(); });
      await page.waitForTimeout(2500);
      await page.getByText('Let\u2019s play').first().click().catch(() => {}); await page.waitForTimeout(5000);
      console.log('mode', await page.evaluate(() => window.__mode()));
      await page.evaluate(() => { const r = window.__round && window.__round(); if (r && r.score) r.score[0] = 12; window.__finish(); });
      await page.waitForTimeout(4000);
      console.log('mode after', await page.evaluate(() => window.__mode()));
      await page.screenshot({ path: path.join(OUT, `create-tidy-${name}${sfx}.png`) }); console.log('saved', name, w, page.errors);
      await ctx.close();
    }
  }
}
await browser.close();
