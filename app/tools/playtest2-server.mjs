/* Playtest 2, the Orlis Server's management page: starts the real server (server/src/app.js) on a temp data folder with seeded families, plays, games and a
   queue, and walks every admin page at 1920x1080 and 1280x720 (mouse, and the keyboard: Tab, Enter), looking for clipping, overlap, console errors,
   slow screens and words that confuse. Pictures: server-<page>[-720].png; numbers: server.json.

     cd app && node tools/playtest2-server.mjs [out dir (../docs/playtest2)]        (no Vite needed: the page is served by the server itself) */
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
const here = fileURLToPath(new URL('.', import.meta.url));
const OUT = resolve(process.cwd(), process.argv[2] || '../docs/playtest2');
mkdirSync(OUT, { recursive: true });
const { start } = await import(join(here, '../../server/src/app.js'));
const { readOrlis, writeOrlis } = await import(join(here, '../../server/src/orlis-file.js'));
const { buildOrlis } = await import(join(here, '../kit/build-orlis.mjs'));
await buildOrlis('pop-party');
const base = readOrlis(readFileSync(join(here, '../dist-games/pop-party.orlis')));
const variant = (id, name, version = '1.0', by = 'Mia') => {
  const m = JSON.parse(base['manifest.json']); Object.assign(m, { id, name, version, by, blurb: 'A game called ' + name });
  const code = String(base['game.js']).split('"pop-party"').join(JSON.stringify(id)).split("'pop-party'").join(JSON.stringify(id));
  return { name: `${id}.orlis`, data: writeOrlis({ ...base, 'manifest.json': JSON.stringify(m), 'game.js': code }) };
};
const starters = [variant('bubble-dash', 'Bubble Dash'), variant('comet-catch', 'Comet Catch'), variant('puddle-jump', 'Puddle Jump', '1.2', 'The Lees'), variant('a-very-long-game-name-that-keeps-going-and-going', 'A very long game name that keeps going and going on and on')];
const s = await start({ dataDir: mkdtempSync(join(tmpdir(), 'orlis-pt2srv-')), port: 0, discoveryPort: false, internetPort: 0, starters, tailscaleJoin: () => false, approveJoins: true,
  mail: { ready: true, settings: () => ({ user: 'owner@example.com', host: 'smtp.example.com' }), send: async () => {} }, notify: () => {} });
const S = `http://127.0.0.1:${s.port}`;
const call = async (m, p, b, tok) => { const r = await fetch(S + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-Orlis-Manage': s.manageKey, ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: b ? JSON.stringify(b) : undefined }); return r.json().catch(() => ({})); };
const owner = await call('POST', '/api/signup', { email: 'owner@example.com', password: 'correct horse', name: 'Owner', adult: true, family: 'The Patels', device: 'Laptop' });
const DAY = 864e5, ago = (d) => new Date(Date.now() - d * DAY).toISOString();
let n = 0;
const addFamily = ({ name, kids = ['Sam'], joined = ago(100), pending = 0, plays = [], role = 'creator', game = 'pop-party', email = null }) => {
  n++; const hid = `h-pt${n}`, aid = `a-pt${n}`, db = s.db;
  db.prepare('INSERT INTO households (id, name, created_at) VALUES (?, ?, ?)').run(hid, name, joined);
  db.prepare('INSERT INTO accounts (id, email, password_hash, role, created_at, household_id, pending, slots) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(aid, email || `fam${n}@example.com`, 'x', role, joined, hid, pending, 3);
  kids.forEach((k, i) => db.prepare('INSERT INTO profiles (id, account_id, name, avatar, look, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(`p-pt${n}-${i}`, aid, k, 'cube', null, joined));
  for (const at of plays) db.prepare('INSERT INTO plays (household_id, account_id, game_id, value, secs, players, at) VALUES (?, ?, ?, 10, 60, 1, ?)').run(hid, aid, game, at);
  return { hid, aid };
};
const NAMES = ['The Smiths', 'The Lees', 'The Okafors', 'The Nguyens', 'The Garcias', 'A family with a very long name indeed, the Wolfeschlegelsteinhausenbergerdorffs', 'The Patels', 'The Kims', 'The Rossis', 'The Silvas'];
for (let i = 0; i < 48; i++) addFamily({ name: NAMES[i % NAMES.length] + (i >= 10 ? ' ' + (i + 1) : ''), kids: ['Sam', 'Ada', 'Bo', 'Cy'].slice(0, 1 + (i % 4)), joined: ago(5 + i * 3), plays: Array.from({ length: i % 9 }, (_, k) => ago(k * 2 + (i % 5))), game: ['pop-party', 'leaf-pile', 'bubble-dash', 'comet-catch'][i % 4], role: i % 7 === 0 ? 'player' : 'creator' });
const waiting = [addFamily({ name: 'The Newcomers', pending: 1, joined: ago(1), email: 'newcomer@example.com' }), addFamily({ name: 'The Hopefuls', pending: 1, joined: ago(2), email: 'hopeful@example.com' })];
s.db.prepare("INSERT INTO submissions (id, game_id, name, version, account_id, bytes, sha256, status, created_at) VALUES ('s1', 'new-game', 'New Game', '1.0', ?, 100, 'ab', 'waiting', ?)").run(waiting[0].aid, ago(1));
s.db.prepare("INSERT INTO submissions (id, game_id, name, version, account_id, bytes, sha256, status, created_at, decided_at) VALUES ('s2', 'old-game', 'Old Game', '1.0', ?, 100, 'cd', 'declined', ?, ?)").run(waiting[1].aid, ago(5), ago(4));
await call('POST', '/api/store/comet-catch/feature', { on: true }).catch(() => {});

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const results = { made: new Date().toISOString().slice(0, 10), pages: [], issues: [], errors: [], timings: [] };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const AUDIT = () => {
  const vw = innerWidth, vh = innerHeight, out = { offscreen: [], clipped: [], overlaps: [], tiny: [], hScroll: document.documentElement.scrollWidth > vw + 2 };
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const name = (e) => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ':' + (e.getAttribute('aria-label') || e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 28);
  const inter = [...document.querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(vis);
  for (const e of inter){
    const r = e.getBoundingClientRect();
    if (r.right > vw + 2 || r.left < -2 || r.bottom > vh + 2 && !e.closest('.scroll, .panel, main, .main, .body')) out.offscreen.push(name(e) + ` [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
    if (Math.min(r.width, r.height) < 24) out.tiny.push(name(e) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  for (const e of document.querySelectorAll('body *')){
    if (!vis(e)) continue;
    if (![...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())) continue;
    const cs = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 2 && /(hidden|clip)/.test(cs.overflowX) && cs.textOverflow !== 'ellipsis') out.clipped.push('clipped: ' + name(e));
    if (cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 2) out.clipped.push('ellipsis (cut with ...): ' + name(e));
  }
  for (let i = 0; i < inter.length; i++) for (let j = i + 1; j < inter.length; j++){
    const a = inter[i], b = inter[j]; if (a.contains(b) || b.contains(a)) continue;
    const A = a.getBoundingClientRect(), B = b.getBoundingClientRect(), w = Math.min(A.right, B.right) - Math.max(A.left, B.left), h = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
    if (w > 6 && h > 6) out.overlaps.push(`${name(a)} x ${name(b)} ${Math.round(w)}x${Math.round(h)}`);
  }
  out.text = document.body.innerText.replace(/\s+/g, ' ').slice(0, 1200);
  out.active = document.activeElement ? name(document.activeElement) : null;
  return out;
};

for (const [w, h] of [[1920, 1080], [1280, 720]]){
  const suffix = w === 1920 ? '' : '-720';
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const pg = await ctx.newPage(), errs = [];
  pg.on('pageerror', (e) => errs.push('pageerror: ' + e.message.split('\n')[0]));
  pg.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  pg.on('response', (r) => { if (r.status() >= 400) errs.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
  const t0 = Date.now();
  await pg.goto(s.manageUrl); await pg.waitForSelector('nav a[data-t], a[data-t]', { timeout: 30000 });
  results.timings.push({ page: 'first load', w, ms: Date.now() - t0 });
  await wait(1200);
  const visit = async (label, tab, extra = null) => {
    const t1 = Date.now();
    if (tab) await pg.click(`a[data-t="${tab}"]`);
    await wait(250);
    await pg.waitForLoadState('networkidle').catch(() => {});
    if (extra) await extra();
    const ms = Date.now() - t1 - 250; results.timings.push({ page: label, w, ms });
    await wait(500);
    await pg.screenshot({ path: join(OUT, `server-${label}${suffix}.png`) });
    const a = await pg.evaluate(AUDIT); results.pages.push({ page: label, w, ms, ...a });
    console.log(w, label, ms + ' ms', 'clipped', a.clipped.length, 'overlap', a.overlaps.length, 'off', a.offscreen.length, 'hscroll', a.hScroll);
  };
  await visit('overview', null);
  await visit('queue', 'queue');
  await visit('families', 'fams');
  /* a family's detail panel, search, a filter chip, sort, a page further */
  await visit('families-detail', null, async () => { await pg.locator('#fbody tr').first().click(); await wait(900); });
  await pg.keyboard.press('Escape'); await wait(400);
  await visit('families-search', null, async () => { const q = pg.locator('input[type=search], input[placeholder*="earch"]').first(); if (await q.count()) { await q.fill('Wolfe'); await wait(900); } });
  await visit('games', 'games');
  await visit('games-detail', null, async () => { await pg.locator('#gbody tr').first().click(); await wait(900); });
  await pg.keyboard.press('Escape'); await wait(400);
  await visit('activity', 'log');
  await visit('settings', 'sets');
  await pg.evaluate(() => { const sc = document.querySelector('#setsbody') || document.scrollingElement; sc.scrollTop = 99999; window.scrollTo(0, 99999); }); await wait(400);
  await pg.screenshot({ path: join(OUT, `server-settings-bottom${suffix}.png`) });
  /* the keyboard: Tab through the sidebar and the first page; does anything lose its focus ring? */
  await pg.goto(s.manageUrl); await pg.waitForSelector('a[data-t]'); await wait(800);
  const tabs = [];
  for (let i = 0; i < 14; i++){ await pg.keyboard.press('Tab'); await wait(120); tabs.push(await pg.evaluate(() => { const e = document.activeElement, cs = e && getComputedStyle(e); return e ? { el: e.tagName.toLowerCase() + ':' + (e.textContent || e.value || '').trim().slice(0, 18), ring: /rgb/.test(cs.boxShadow) || (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) } : null; })); }
  results.pages.push({ page: 'keyboard tab order', w, tabs });
  await pg.keyboard.press('Enter'); await wait(500);
  await pg.screenshot({ path: join(OUT, `server-keyboard${suffix}.png`) });
  results.errors.push(...errs.map(e => `${w}: ${e}`));
  await ctx.close();
}
writeFileSync(join(OUT, 'server.json'), JSON.stringify(results, null, 1));
console.log('errors', results.errors.length, [...new Set(results.errors)].slice(0, 8));
await browser.close(); await s.close();
