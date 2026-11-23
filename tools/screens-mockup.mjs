/* Builds docs/screens-mockup.html (the U5 and U7 mockups): renders the real Orlis art in headless Chromium, embeds it as data URIs,
   inlines Fredoka from the UI kit, and fills tools/screens-mockup.src.html.

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

const font = /@font-face\{[^}]*Fredoka[^}]*\}/.exec(readFileSync(join(root, 'docs/ui-kit.html'), 'utf8'));
if (!font) throw new Error('Fredoka @font-face not found in docs/ui-kit.html');
/* the row of game tiles, in one place: {{tiles:plain:0}} (a mouse or remote hovers tile 0), {{tiles:hand:2:p1:mia}} (a child in colour p1 points at
   tile 2), {{tiles:hand:-1}} (nobody points) */
const GAMES = [
  ['pop-party', 'POP PARTY', 'Reach up and pop the balloons', '30%'], ['sky-painter', 'SKY PAINTER', 'Paint the sky with your arms', '58%'],
  ['leaf-pile', 'LEAF PILE', 'Sweep the leaves into a big pile', '50%'], ['sleepy-bear', 'SLEEPY BEAR', 'Dance, then freeze before the bear wakes', '58%'],
  ['stack-it-high', 'STACK IT HIGH', 'Build the tallest tower you can', '80%']
];
const tiles = (mode, lit, who, face) => {
  const l = +lit;
  const inner = GAMES.map(([id, name, , pos], i) => {
    const on = i === l, cls = 'tile' + (on ? (mode === 'plain' ? ' on' : ' lit') : '');
    const extra = on && mode === 'hand' && who
      ? `<div class="hud piece say"><img src="{{art:face-${face}}}" alt=""><span>Wave to play</span></div><div class="cur"><i class="rg"></i><i class="dot"></i></div>` : '';
    return `<div class="${cls}"${on && who ? ` style="--c:var(--${who})"` : ''}><div class="art"><img src="{{art:cover-${id}}}" alt="" style="object-position:${pos} 50%"><b>${name}</b></div>${extra}</div>`;
  }).join('');
  return `<div class="row ${mode}">${inner}</div>`;
};
/* the home options: tiles by game order. {{otiles:A:3}} = the one-row version with focus on game 3; {{otiles:B1:0}}, {{otiles:B2:-1}}, {{otiles:B3:-1}} = rows */
const OG = ['pop-party', 'sky-painter', 'leaf-pile', 'sleepy-bear', 'stack-it-high', 'animal-gym', 'keep-it-up', 'ptero-flight'];
const ON = { 'pop-party': 'POP PARTY', 'sky-painter': 'SKY PAINTER', 'leaf-pile': 'LEAF PILE', 'sleepy-bear': 'SLEEPY BEAR', 'stack-it-high': 'STACK IT HIGH', 'animal-gym': 'ANIMAL GYM', 'keep-it-up': 'KEEP IT UP!', 'ptero-flight': 'PTERRY FLIGHT' };
const ORDER = { A: [0, 1, 2, 3, 4, 5, 6], B1: [0, 1, 2, 3, 4, 5, 6, 7], B2: [5, 6, 7, 2, 0, 1, 3, 4], B3: [4, 3, 1, 0, 7, 5, 2, 6] };
const otiles = (v, f) => `<div class="o-row ${v[0] === 'A' ? 'ra' : 'rb'}">` + ORDER[v].map((g, i) => `<div class="o-t${i === +f ? ' on' : ''}"><div class="o-art g-${OG[g]}"></div><b>${ON[OG[g]]}</b></div>`).join('') + '</div>';
const bgcss = OG.map((id) => `.g-${id}{background-image:url({{art:bg-${id}}})}`).join('\n');
let html = readFileSync(join(root, 'tools/screens-mockup.src.html'), 'utf8').replace('/*FONT*/', () => font[0]);
html = html.replace('/*BGCSS*/', () => bgcss);
html = html.replace(/\{\{otiles:([AB]\d?):(-?\d)\}\}/g, (_, v, f) => otiles(v, f));
html = html.replace(/\{\{tiles:(plain|hand):(-?\d)(?::(p\d):([a-z]+))?\}\}/g, (_, m, l, who, face) => tiles(m, l, who, face));
html = html.replace(/\{\{file:([a-z]+\.jpg)\}\}/g, (_, f) => 'data:image/jpeg;base64,' + readFileSync(join(root, 'tools/screens-mockup-today', f)).toString('base64'));
html = html.replace(/\{\{art:([a-z0-9-]+)\}\}/g, (_, k) => { if (!art[k]) throw new Error('missing art: ' + k); return art[k]; });
writeFileSync(join(root, 'docs/screens-mockup.html'), html);
console.log('docs/screens-mockup.html', (html.length / 1024).toFixed(0) + ' KB,', Object.keys(art).length, 'pieces');
