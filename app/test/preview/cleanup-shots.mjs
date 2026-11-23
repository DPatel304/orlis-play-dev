/* Home (Play), Discover and the profile sheet at 1920x1080, for before/after comparisons (cleanup).
   cd app && npx vite --port 5203 --strictPort &   node test/preview/cleanup-shots.mjs before|after ../docs/calm */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
const tag = process.argv[2] || 'after', OUT = process.argv[3] || '../docs/calm', BASE = process.env.BASE || 'http://127.0.0.1:5203';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
page.on('pageerror', e => console.log('pageerror', e.message));
await page.goto(BASE + '/?splash=0'); await page.waitForTimeout(12000);
await page.screenshot({ path: `${OUT}/cleanup-home-${tag}.png` });
await page.locator('.hme').first().click(); await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/cleanup-profile-${tag}.png` });
await page.keyboard.press('Escape'); await page.waitForTimeout(1000);
await page.evaluate(() => window.__go.toStore()); await page.waitForTimeout(8000);
await page.screenshot({ path: `${OUT}/cleanup-discover-${tag}.png` });
await browser.close();
