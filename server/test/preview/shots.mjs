/* Screenshots of the management page against a running preview server (serve.mjs), for docs/calm/admin-*.png:

     node server/test/preview/shots.mjs <folder> <out-folder> [port=47990]

   Needs Playwright (NODE_PATH, or /opt/node-tools): it's not a dependency of the server. */
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const [dir, out, port = '47990'] = process.argv.slice(2);
if (!dir || !out){ console.error('usage: node shots.mjs <data folder> <out folder> [port]'); process.exit(1); }
const require = createRequire(process.env.PLAYWRIGHT_FROM || '/opt/node-tools/');
const { chromium } = require('playwright');
const key = readFileSync(join(dir, 'manage.key'), 'utf8').trim();
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('request', (r) => { if (!r.url().startsWith(`http://127.0.0.1:${port}`) && !r.url().startsWith('data:')) errors.push(`outside request: ${r.url()}`); });
await page.goto(`http://127.0.0.1:${port}/manage?k=${key}`);
await page.waitForSelector('#stats .stat');
/* tall pages (fit): the window is made as tall as the page, so the side bar (as tall as the window) reaches the bottom */
const shot = async (name, { fit = false } = {}) => {
  await page.waitForTimeout(450);
  const size = page.viewportSize();
  if (fit){ const h = await page.evaluate(() => document.documentElement.scrollHeight); await page.setViewportSize({ width: size.width, height: Math.max(size.height, h) }); await page.waitForTimeout(200); }
  await page.screenshot({ path: join(out, `admin-${name}.png`) });
  if (fit) await page.setViewportSize(size);
  console.log(`admin-${name}.png`);
};
const nav = async (t) => { await page.click(`aside a[data-t="${t}"]`); await page.waitForTimeout(300); };

await shot('overview', { fit: true });
await nav('queue'); await page.waitForSelector('#qfull .q'); await shot('queue', { fit: true });
await nav('fams'); await page.waitForSelector('#fbody tr[data-id]');
await page.fill('#fq', 'patel'); await page.waitForTimeout(600); await shot('families-search');
await page.fill('#fq', ''); await page.waitForTimeout(600);
await page.click('#fbody tr[data-id] td:nth-child(2)'); await page.waitForSelector('#panel.open .acct'); await shot('families-panel');
await page.keyboard.press('Escape');
await nav('games'); await page.waitForSelector('#gbody tr[data-id]'); await shot('games');
await page.click('#gbody tr[data-id]'); await page.waitForSelector('#panel.open .acts'); await page.waitForTimeout(300); await shot('games-panel');
await page.keyboard.press('Escape');
await nav('log'); await page.waitForSelector('#logfull li'); await shot('activity');
await nav('sets'); await page.waitForSelector('#setsbody .card'); await shot('settings', { fit: true });
await nav('fams'); await page.setViewportSize({ width: 820, height: 1000 }); await page.waitForTimeout(300); await shot('families-820');
await browser.close();
console.log(errors.length ? `PROBLEMS:\n${errors.join('\n')}` : 'no console errors, nothing loaded from outside');
