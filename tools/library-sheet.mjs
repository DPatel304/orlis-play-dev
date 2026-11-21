// Contact sheet of the shared asset library (U11): every code-drawn piece, Cubo and the scenes, each on paper with its id.
//   node tools/library-sheet.mjs <out.png>        (run it before and after a change, from the repo root)
// Bundles app/src/games/assets with esbuild, draws into one canvas in headless Chromium, writes PNGs at deviceScaleFactor 2.
// A tall sheet is split into numbered files (out-1.png, out-2.png ...). The system-emoji pieces are not drawn (they never change).
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
const here = dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
const { chromium } = req('playwright');
const { build } = createRequire(join(here, '..', 'server', 'package.json'))('esbuild');
const out = resolve(process.argv[2] || 'library.png');
const dir = mkdtempSync(join(tmpdir(), 'sheet-'));
const entry = join(dir, 'entry.js');
const a = join(here, '..', 'app', 'src', 'games', 'assets');
writeFileSync(entry, `
import { assets } from '${a}/index.js';
import { PROPS } from '${a}/props.js';
import { SCENES } from '${a}/scenes.js';
window.__lib = { assets, PROPS, SCENES };`);
await build({ entryPoints: [entry], bundle: true, format: 'iife', outfile: join(dir, 'b.js'), logLevel: 'error' });
const code = readFileSync(join(dir, 'b.js'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
await page.setContent('<body style="margin:0;background:#faf6ec"></body>');
await page.addScriptTag({ content: code });
const info = await page.evaluate(() => {
  const { assets, PROPS, SCENES } = window.__lib;
  const CW = 240, CH = 230, COLS = 5, PAD = 10;
  const items = [];
  items.push(['cubo freeze', (c) => assets.draw(c, 'cubo', 0, 0, 150, { pose: 'freeze', t: 0.1 })]);
  items.push(['cubo jump', (c) => assets.draw(c, 'cubo', 0, 0, 150, { pose: 'jump', t: 0.4 })]);
  items.push(['cubo dance', (c) => assets.draw(c, 'cubo', 0, 0, 150, { pose: 'dance', t: 0.7 })]);
  items.push(['cubo wave (marks)', (c) => assets.draw(c, 'cubo', 0, 0, 150, { pose: 'wave', t: 0.3, marks: true })]);
  items.push(['cubo freeze (marks)', (c) => assets.draw(c, 'cubo', 0, 0, 150, { pose: 'freeze', t: 0.1, marks: true })]);
  for (const id of Object.keys(PROPS)){
    const sz = Math.min(130, 190 / PROPS[id][2]);
    items.push([id, (c) => assets.draw(c, id, 0, 0, sz, { t: 0.4 }), ['cloud', 'popring', 'ring', 'dot', 'sparkle'].includes(id) ? '#8fa6c6' : null]);
  }
  /* the colour-taking pieces, in colours chosen by palette name, as games ask for them */
  for (const id of ['balloon', 'block', 'star', 'heart', 'hand'])
    for (const nm of ['touch.cherry', 'touch.mint', 'touch.skyBlue'])
      items.push([id + ' ' + nm.split('.')[1], (c) => assets.draw(c, id, 0, 0, 120, { color: assets.color(nm) })]);
  const rowsProps = Math.ceil(items.length / COLS);
  const SW = 320, SH = 180, SCOLS = 3;
  const scenes = Object.keys(SCENES);
  const W = COLS * CW, H1 = rowsProps * CH + 30, H2 = Math.ceil(scenes.length / SCOLS) * (SH + 40) + 30;
  const cv = document.createElement('canvas'); document.body.appendChild(cv);
  cv.width = W * 2; cv.height = (H1 + H2) * 2; cv.style.width = W + 'px'; cv.style.height = (H1 + H2) + 'px'; cv.style.display = 'block';
  const c = cv.getContext('2d'); c.scale(2, 2);
  c.fillStyle = '#faf6ec'; c.fillRect(0, 0, W, H1 + H2);
  c.font = '600 13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  items.forEach(([label, fn, bg], k) => {
    const x = (k % COLS) * CW, y = 15 + Math.floor(k / COLS) * CH;
    c.save(); c.beginPath(); c.roundRect(x + PAD / 2, y + PAD / 2, CW - PAD, CH - PAD, 14); c.fillStyle = bg || '#fffdf8'; c.fill(); c.strokeStyle = '#e6dcc7'; c.lineWidth = 1.5; c.stroke(); c.clip();
    c.save(); c.translate(x + CW / 2, y + CH / 2 - 10); fn(c); c.restore();
    c.fillStyle = bg ? '#fff' : '#6b6680'; c.fillText(label, x + CW / 2, y + CH - 22); c.restore();
  });
  scenes.forEach((id, k) => {
    const x = (k % SCOLS) * (W / SCOLS) + (W / SCOLS - SW) / 2, y = H1 + 15 + Math.floor(k / SCOLS) * (SH + 40);
    c.save(); c.beginPath(); c.rect(x, y, SW, SH); c.clip(); c.translate(x, y); assets.scene(c, SW, SH, id, { t: 1 }); c.restore();
    c.fillStyle = '#6b6680'; c.fillText('scene ' + id, x + SW / 2, y + SH + 16);
  });
  return { W, H: H1 + H2 };
});
const per = 1400, parts = Math.ceil(info.H / per);
for (let i = 0; i < parts; i++){
  const f = parts === 1 ? out : out.replace(/\.png$/, `-${i + 1}.png`);
  await page.screenshot({ path: f, fullPage: true, clip: { x: 0, y: i * per, width: info.W, height: Math.min(per, info.H - i * per) } });
  console.log('wrote', f);
}
await browser.close();
