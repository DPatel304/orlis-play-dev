/* The five picture-built recipes in pictures (decision 0056, package C1): one shot each, 5 s into the game, from test/preview/recipe.html.
   Not part of `npm test`; run by hand with the dev server up:

     cd app && npx vite --port 5204 --strictPort &
     node test/preview/recipe-shots.mjs ../docs/calm

   Saves recipe-catch.png, recipe-pop.png, recipe-dodge.png, recipe-collect.png and recipe-keepup.png (1920 x 1080). */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
const OUT = process.argv[2] || '../docs/calm', BASE = process.env.BASE || 'http://127.0.0.1:5204';
mkdirSync(OUT, { recursive: true });
const SHOTS = [
  ['catch', 'how=catch&what=apple&where=meadow&move=reach&golden=1&bomb=1'],
  ['pop', 'how=pop&what=balloon&where=sunset&move=reach&golden=1&many=3'],
  ['dodge', 'how=dodge&what=bee&where=night&move=jump&bomb=1&many=3'],
  ['collect', 'how=collect&what=star&where=beach&move=wave&golden=1&many=3'],
  ['keepup', 'how=keepup&what=beachball&where=snow&move=reach&many=3']
];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', e => console.log('page error:', e.message));
for (const [name, query] of SHOTS){
  await page.goto(`${BASE}/test/preview/recipe.html?${query}`);
  await page.waitForFunction(() => window.__done === true, null, { timeout: 60000 });
  await page.screenshot({ path: join(OUT, `recipe-${name}.png`) });
  console.log('saved', join(OUT, `recipe-${name}.png`));
}
await browser.close();
