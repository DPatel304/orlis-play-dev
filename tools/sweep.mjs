// A screenshot sweep (decision 0040, item 5): after a palette change, look at everything at once.
// Screenshots every built-in game (a moment in: 3 s and 15 s by default) and every kit backdrop (assets.scene) into a folder,
// with an index.html contact sheet.
//
//   node tools/sweep.mjs [folder] [--times 3,15] [--only games|scenes] [--scene night] [--game pop-party] [--url http://127.0.0.1:5191]
//
// folder: default docs/sweep (it is gitignored). The app's dev server is started for the sweep if nothing answers on --url
// (default port 5191), and stopped again afterwards. Games are run headless the way the home banner does it (trailer.js still()):
// pretend players reaching about, no sound, 30 steps a second. Frame rates in headless Chromium mean nothing; the pictures do.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf('--' + name); if (i < 0) return dflt; const v = args[i + 1]; args.splice(i, 2); return v; };
const times = opt('times', '3,15').split(',').map(Number).filter(n => n > 0);
const only = opt('only', ''), oneScene = opt('scene', ''), oneGame = opt('game', '');
const base = opt('url', 'http://127.0.0.1:5191');
const out = resolve(args[0] || join(here, '..', 'docs', 'sweep'));
const W = 1280, H = 720;

async function up(){ try { return (await fetch(base + '/')).ok; } catch { return false; } }
let dev = null;
if (!(await up())){
  const port = new URL(base).port || '5191';
  dev = spawn('npx', ['vite', '--port', port, '--strictPort'], { cwd: join(here, '..', 'app'), stdio: 'ignore', detached: true });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise(r => setTimeout(r, 500));
  if (!(await up())){ console.error('The app dev server did not start (cd app && npx vite --port 5191 --strictPort).'); process.exit(1); }
}
const stopDev = () => { if (dev) try { process.kill(-dev.pid); } catch {} };

rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', e => console.log('page error:', e.message));
await page.goto(base + '/', { waitUntil: 'domcontentloaded' });

const shots = [];     /* { group, name, label, file } */
const save = (group, name, label, dataUrl) => {
  const file = `${group}-${name}.png`;
  writeFileSync(join(out, file), Buffer.from(dataUrl.split(',')[1], 'base64'));
  shots.push({ group, name, label, file });
};

/* ---- every kit backdrop ---- */
if (only !== 'games'){
  const scenes = await page.evaluate(async ({ W, H, one }) => {
    const { assets } = await import('/src/games/assets/index.js');
    const res = [];
    for (const row of assets.list('scene')){
      if (one && row.id !== one) continue;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      assets.scene(cv.getContext('2d'), W, H, row.id, { t: 4, p: 0 });
      res.push({ id: row.id, name: row.name, url: cv.toDataURL('image/png') });
    }
    return res;
  }, { W, H, one: oneScene });
  for (const s of scenes) save('scene', s.id, `${s.name} (${s.id})`, s.url);
}

/* ---- every built-in game, a moment in ---- */
if (only !== 'scenes' && !oneScene){
  const ids = await page.evaluate(async () => (await import('/src/games/index.js')).GAMES.map(g => ({ id: g.id, name: g.name })));
  for (const g of ids){
    if (oneGame && g.id !== oneGame) continue;
    try {
      const frames = await page.evaluate(async ({ id, times, W, H }) => {
        const { GAMES } = await import('/src/games/index.js');
        const { pose, MAX_PLAYERS, PLAYER_COLORS } = await import('/src/tracking/pose.js');
        const { quietly } = await import('/src/audio/sound.js');
        const game = GAMES.find(x => x.id === id);
        const fake = { mouse: { active: true, x: 0.5, y: 0.5 }, players: Array.from({ length: MAX_PLAYERS }, (_, i) => ({
          id: i, color: PLAYER_COLORS[i], present: i < 2, lostFor: 99, watching: 0, at: null, lm: null, raw: null,
          hands: { left: { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 }, right: { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 } },
          centre: { x: 0.5, y: 0.6 }, scale: 0.3 })) };
        const sandbox = (fn) => { const p = pose.players, m = pose.mouse; pose.players = fake.players; pose.mouse = fake.mouse; try { return quietly(fn); } finally { pose.players = p; pose.mouse = m; } };
        const cv = document.createElement('canvas'); cv.width = 1440; cv.height = 810;
        const c = cv.getContext('2d');
        const inst = sandbox(() => game.create(2));
        inst.stillMode = true;
        const res = [], last = Math.max(...times);
        for (let k = 1; k <= last * 30; k++){
          const t = k / 30;
          fake.players.slice(0, 2).forEach((p, i) => {
            const x = 0.3 + i * 0.4 + Math.sin(t * 1.1 + i) * 0.22, y = 0.42 + Math.sin(t * 1.7 + i * 2) * 0.28;
            p.hands.right = { x: x + 0.05, y, vx: 0, vy: 0, speed: 0.5 }; p.hands.left = { x: x - 0.05, y: y + 0.05, vx: 0, vy: 0, speed: 0.4 };
            p.centre = { x, y: 0.6 };
          });
          sandbox(() => inst.step(1 / 30, 1440, 810));
          if (times.some(s => Math.round(s * 30) === k)){
            sandbox(() => inst.draw(c, 1440, 810));
            const o = document.createElement('canvas'); o.width = W; o.height = H; o.getContext('2d').drawImage(cv, 0, 0, W, H);
            res.push({ t: times.find(s => Math.round(s * 30) === k), url: o.toDataURL('image/png') });
          }
        }
        return res;
      }, { id: g.id, times, W, H });
      for (const f of frames) save('game', `${g.id}-${f.t}s`, `${g.name} at ${f.t} s`, f.url);
      console.log('ok  ', g.id);
    } catch (e){ console.log('FAIL', g.id, String(e.message).split('\n')[0]); shots.push({ group: 'game', name: g.id, label: `${g.name}: could not run (${String(e.message).split('\n')[0]})`, file: null }); }
  }
}
await browser.close(); stopDev();

/* ---- the contact sheet ---- */
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const section = (title, group) => {
  const rows = shots.filter(s => s.group === group); if (!rows.length) return '';
  return `<h2>${title}</h2><div class="grid">${rows.map(s => `<figure>${s.file ? `<a href="${esc(s.file)}"><img loading="lazy" src="${esc(s.file)}" alt=""></a>` : '<div class="miss">no picture</div>'}<figcaption>${esc(s.label)}</figcaption></figure>`).join('')}</div>`;
};
writeFileSync(join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Orlis sweep</title><style>body{font:15px system-ui,sans-serif;margin:16px;background:#faf6ec;color:#2f2b45}h1{font-size:20px}h2{font-size:17px;margin-top:28px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}figure{margin:0}img{width:100%;border-radius:8px;display:block;border:1px solid #e6dcc7}
figcaption{font-size:13px;color:#6b6680;padding:4px 2px}.miss{aspect-ratio:16/9;display:grid;place-items:center;background:#e6dcc7;border-radius:8px}</style>
<h1>Orlis sweep</h1><p>${new Date().toISOString().slice(0, 16).replace('T', ' ')} - games at ${times.join(' s, ')} s, and every kit backdrop.</p>
${section('Kit backdrops', 'scene')}${section('Built-in games', 'game')}`);
console.log(`\n${shots.filter(s => s.file).length} pictures -> ${join(out, 'index.html')}`);
