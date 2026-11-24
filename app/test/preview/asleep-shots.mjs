/* The "Orlis is asleep" screens, in pictures: asleep (online, server not answering), not online, and the red in-app
   message when a call can't connect. Not part of `npm test`; run by hand with the dev server up:

     cd app && npx vite --port 5191 --strictPort &
     node test/preview/asleep-shots.mjs ../docs/calm

   Stubs: window.__TAURI__ (so the account step shows; find_servers finds none) and the network (page.route): the owner's
   server never answers, and the Microsoft connection check answers or fails. */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
const OUT = process.argv[2] || '../docs/calm', BASE = process.env.BASE || 'http://127.0.0.1:5191';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

const open = async (size, { online, serverUp }) => {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.addInitScript(() => { window.__TAURI__ = { core: { invoke: async () => [] } }; try { localStorage.clear(); } catch (e){} });
  await page.route('https://www.msftconnecttest.com/**', (r) => online ? r.fulfill({ status: 200, body: 'Microsoft Connect Test' }) : r.abort());
  await page.route('https://orlis.tailb28684.ts.net/**', (r) => {
    if (!serverUp) return r.abort();
    const u = r.request().url();
    if (u.endsWith('/api/hello')) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ app: 'orlis', id: 'x', name: 'Orlis' }) });
    return r.abort();                         /* (then it falls asleep: the next call can't connect) */
  });
  await page.goto(`${BASE}/?splash=0`);
  return { page, ctx };
};

for (const [w, h] of [[1920, 1080], [1280, 720]]){
  const size = { width: w, height: h };
  let { page, ctx } = await open(size, { online: true, serverUp: false });
  await page.waitForSelector('text=Orlis is asleep right now', { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, `asleep-asleep-${w}.png`) }); await ctx.close();

  ({ page, ctx } = await open(size, { online: false, serverUp: false }));
  await page.waitForSelector('text=This laptop isn’t online', { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, `asleep-offline-${w}.png`) }); await ctx.close();

  /* the server answers hello, then goes quiet: the email step's red message */
  ({ page, ctx } = await open(size, { online: true, serverUp: true }));
  await page.waitForSelector('input[type=email]', { timeout: 60000 });
  await page.fill('input[type=email]', 'mum@example.com');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.formmsg.bad', { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, `asleep-popup-${w}.png`) }); await ctx.close();
}
await browser.close();
