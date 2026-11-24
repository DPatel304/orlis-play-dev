/* Pictures of a made game with a mix of all four jobs (decision 0059): mid-play, and its results card, into docs/calm/create2-*.png.
   Run (dev server up):  cd app && npx vite --port 5207 --strictPort   then   node test/preview/create2-shots.mjs */
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const OUT = process.env.CREATE_OUT || path.resolve(import.meta.dirname, '..', '..', '..', 'docs', 'calm');
const URL = process.env.URL || 'http://localhost:5207/?splash=0';
fs.mkdirSync(OUT, { recursive: true });
const account = {
  server: { url: 'http://127.0.0.1:1', id: 's1', name: 'Home' }, token: 't', account: { id: 'a1', email: 'mum@example.com', role: 'owner' },
  household: { id: 'here', name: 'Home' },
  profiles: [{ id: 'p1', accountId: 'a1', name: 'Mum', look: { skin: 0 } }, { id: 'p2', accountId: 'a1', name: 'Ada', look: { skin: 1 } }], current: 'p1'
};
const things = [{ id: 'apple', job: 'collect' }, { id: 'bee', job: 'dodge' }, { id: 'beachball', job: 'keepup' }, { id: 'banana', job: 'stack' }];
const picks = { things, where: 'meadow', speed: 3, many: 3, size: 2, minutes: 1, mode: 'together', golden: true, bomb: false, name: 'Super Sneaky Bee Dodge' };
const made = [{ id: 'c1', name: 'Super Sneaky Bee Dodge', makerId: 'p2', picks, createdAt: '2026-11-24T10:00:00Z', updatedAt: '2026-11-24T10:00:00Z' }];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [w, h, sfx] of [[1920, 1080, ''], [1280, 720, '-720']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(([a, l]) => { try { localStorage.setItem('orlis.account', JSON.stringify(a)); localStorage.setItem('orlis.creations:here', JSON.stringify(l)); } catch {} }, [account, made]);
  const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(String(e)));
  await page.goto(URL); await page.waitForTimeout(2500);
  await page.evaluate(() => window.__go.toCreate()); await page.waitForTimeout(1800);
  if (!sfx) await page.screenshot({ path: path.join(OUT, 'create2-home.png') });
  await page.getByText(made[0].name, { exact: true }).first().click(); await page.waitForTimeout(1000);
  await page.getByText('Play', { exact: true }).last().click(); await page.waitForTimeout(2500);
  await page.getByText('Let’s play').first().click().catch(() => {}); await page.waitForTimeout(9000);
  /* a tower part built, a ball in the air, a few scores */
  await page.evaluate(() => { const r = window.__round(); if (r && r.score) { r.tower = Array.from({ length: 4 }, () => ({ piece: 'banana' })); r.counts = { 'collect-apple': 12, 'dodge-bee': 5, 'stack-banana': 3 }; r.score[0] = 21; r.total = 21; } });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, `create2-mix-play${sfx}.png`) });
  await page.evaluate(() => { window.__finish(); }); await page.waitForTimeout(4000);
  console.log('mode', await page.evaluate(() => window.__mode()), page.errors);
  await page.screenshot({ path: path.join(OUT, `create2-mix-results${sfx}.png`) });
  await ctx.close();
}
await browser.close();
