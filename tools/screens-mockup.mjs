/* Builds docs/screens-mockup.html (the U5 and U7 mockups, in the clean look of decision 0045): renders the real Orlis art in headless
   Chromium, embeds it as data URIs, inlines Outfit (tools/fonts), and fills tools/screens-mockup.src.html.

     node tools/screens-mockup.mjs

   Needs: esbuild (app/node_modules), Playwright and Chrome (PLAYWRIGHT_PATH, CHROME_PATH override the defaults). */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { build } = createRequire(join(root, 'app/package.json'))('esbuild');
const pw = await import(pathToFileURL(join(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright', 'index.mjs')).href);
const chromium = pw.chromium || pw.default.chromium;

const bundle = await build({ entryPoints: [join(root, 'tools/screens-mockup-art.entry.js')], bundle: true, write: false, format: 'iife', target: 'es2022', logLevel: 'error' });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.setContent('<!doctype html><meta charset=utf-8><body>');
await page.addScriptTag({ content: bundle.outputFiles[0].text });
const art = await page.evaluate(() => window.renderAll());
await browser.close();

const face = (w, file) => `@font-face{font-family:"Outfit";font-weight:${w};font-style:normal;src:url(data:font/woff2;base64,${readFileSync(join(root, 'tools/fonts', file)).toString('base64')}) format("woff2")}`;
const font = face(400, 'outfit-Regular.woff2') + '\n' + face(700, 'outfit-Bold.woff2');
const GAMES = ['pop-party', 'sky-painter', 'leaf-pile', 'sleepy-bear', 'stack-it-high', 'animal-gym', 'keep-it-up', 'ptero-flight'];
/* .g-<id> is the wide painted world; .c-<id> is the cover with the game's own painted title */
const css = GAMES.map((id) => `.g-${id}{background-image:url({{art:bg-${id}}})}\n.c-${id}{background-image:url({{art:cover-${id}}})}`).join('\n');
let html = readFileSync(join(root, 'tools/screens-mockup.src.html'), 'utf8').replace('/*FONT*/', () => font).replace('/*GAMECSS*/', () => css);
html = html.replace(/\{\{art:([a-z0-9-]+)\}\}/g, (_, k) => { if (!art[k]) throw new Error('missing art: ' + k); return art[k]; });
writeFileSync(join(root, 'docs/screens-mockup.html'), html);
console.log('docs/screens-mockup.html', (html.length / 1024).toFixed(0) + ' KB,', Object.keys(art).length, 'pieces');
