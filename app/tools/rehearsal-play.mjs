// The Play page's ways in and out, against a real server: the Featured row
// (three games) selected on a fresh start; the profile screen with the family's
// name, Back and Escape, and its way to the family page; no Family in the
// corner menu; Exit exits at once.
//
//   NODE_PATH=$(npm root -g) node tools/rehearsal-play.mjs http://localhost:5191/ <out-prefix>
//
// Discover's games are Pop Party's package under other names. The PC is
// pretend Windows, signed in already.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.NODE_PATH ? process.env.NODE_PATH + '/' : import.meta.url);
const { chromium } = require('playwright');
const here = fileURLToPath(new URL('.', import.meta.url));
const { start } = await import(join(here, '../../server/src/app.js'));
const { readOrlis, writeOrlis } = await import(join(here, '../../server/src/orlis-file.js'));
const { buildOrlis } = await import(join(here, '../kit/build-orlis.mjs'));
const [appUrl, out] = process.argv.slice(2);

const fail = [];
const check = (ok, what) => { console.log((ok ? '  ✓ ' : '  ✗ ') + what); if (!ok) fail.push(what); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

/* three Discover games: Pop Party's code, other names and colours */
await buildOrlis('pop-party');
const base = readOrlis(readFileSync(join(here, '../dist-games/pop-party.orlis')));
const variant = (id, name, cols, blurb) => {
  const m = JSON.parse(base['manifest.json']);
  Object.assign(m, { id, name, version: '1.0', by: 'Mia', blurb, icon: { ...m.icon, cols } });
  /* (the code says which game it is too) */
  const code = String(base['game.js']).split('"pop-party"').join(JSON.stringify(id)).split("'pop-party'").join(JSON.stringify(id));
  const named = code.split('"Pop Party"').join(JSON.stringify(name)).split("'Pop Party'").join(JSON.stringify(name));
  return { name: `${id}.orlis`, data: writeOrlis({ ...base, 'manifest.json': JSON.stringify(m), 'game.js': named }) };
};
const starters = [variant('bubble-dash', 'Bubble Dash', ['#38bdf8', '#818cf8'], 'Pop the bubbles before they float off'),
  variant('comet-catch', 'Comet Catch', ['#f59e0b', '#ef4444'], 'Catch the falling comets'),
  variant('puddle-jump', 'Puddle Jump', ['#34d399', '#0ea5e9'], 'Jump over the puddles')];

const s = await start({ dataDir: mkdtempSync(join(tmpdir(), 'orlis-play-')), port: 0, discoveryPort: false, starters, tailscaleJoin: () => true });
const S = `http://127.0.0.1:${s.port}`;
const api = async (m, p, b, tok) => { const r = await fetch(S + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: b ? JSON.stringify(b) : undefined }); return r.json(); };
const me = await api('POST', '/api/signup', { email: 'deep@example.com', password: 'correct horse', name: 'Deep', adult: true, family: 'The Patels' });
const kid = await api('POST', '/api/profiles', { name: 'Mia', avatar: 'rocket' }, me.token);
const state = { server: { url: S, name: 'Orlis' }, token: me.token, account: me.account, household: me.household, profiles: [...me.profiles, kid], current: me.profiles[0].id };
const TAURI = `window.__closed = 0; window.__TAURI__ = { core: { invoke: async (c) => c === 'find_servers' ? [] : null }, window: { getCurrentWindow: () => ({ close(){ window.__closed++; }, minimize(){}, toggleMaximize(){} }) } };`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
await ctx.route(/\.ts\.net\//, r => r.abort());
await ctx.addInitScript(TAURI + `try { if (!localStorage.getItem('orlis.account')) localStorage.setItem('orlis.account', ${JSON.stringify(JSON.stringify(state))}); } catch {}`);
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => { if (!/sandboxed/.test(e.message)) errs.push(e.message); });
const shot = (n) => pg.screenshot({ path: `${out}-${n}.png` });
const onPlay = () => pg.waitForSelector('.screen.tvhome .slock', { timeout: 15000 });
const title = () => pg.$eval('.acctcard h2', e => e.textContent).catch(() => '');
try {
  console.log('\n1. A fresh start: the Featured row is the one selected, with three games');
  await pg.goto(appUrl + '?debug');
  /* (two profiles: it opens on who's playing - the family's name, and nothing to go back to) */
  await pg.waitForSelector('.acctcard .who', { timeout: 15000 });
  check((await title()) === 'The Patels', 'on a fresh start it opens on the family\'s name: ' + (await title()));
  check(!(await pg.$('.acctcard .cardicon.back')), 'with no back arrow (nothing to go back to)');
  await shot('0-launch');
  await pg.click('.acctcard .who >> text=Deep');
  await onPlay();
  await pg.waitForFunction(() => [...document.querySelectorAll('.shelf h3')].some(h => /Featured this week/.test(h.textContent)), null, { timeout: 15000 });
  await wait(1500);
  const sel = await pg.$eval('.slock.focus', e => e.closest('.shelf').querySelector('h3').firstChild.textContent).catch(() => '(none)');
  check(sel === 'Featured this week', 'the selected tile is in: ' + sel);
  const n = await pg.$$eval('.shelf', secs => { const f = secs.find(x => /Featured this week/.test(x.querySelector('h3').textContent)); return f ? f.querySelectorAll('.slock:not(.addtile)').length : -1; });
  check(n === 3, 'three featured games: ' + n);
  await shot('1-play');

  console.log('\n2. Your picture: the family\'s name, and a way back');
  await pg.click('.whochip'); await wait(800);
  check((await title()) === 'The Patels', 'the title is the family\'s name: ' + (await title()));
  check(!!(await pg.$('.acctcard .famlink')), 'Manage family is there');
  check(!!(await pg.$('.acctcard .cardicon.back')), 'and a back arrow');
  await shot('2-who');
  await pg.keyboard.press('Escape'); await wait(800);
  check(!!(await pg.$('.screen.tvhome .shelf')), 'Escape goes back to Play');
  await pg.click('.whochip'); await wait(800);
  await pg.click('.acctcard .cardicon.back'); await wait(800);
  check(!!(await pg.$('.screen.tvhome .shelf')), 'the arrow goes back to Play');
  await pg.click('.tvtab >> text=Discover'); await wait(1200);
  await pg.click('.whochip'); await wait(800);
  await pg.keyboard.press('Escape'); await wait(1000);
  check(!!(await pg.$('.tvtab.on >> text=Discover')), 'from Discover, back goes to Discover');
  await pg.click('.tvtab >> text=Play'); await onPlay(); await wait(600);
  await pg.click('.whochip'); await wait(800);
  await pg.click('.famlink'); await wait(1500);
  check(!!(await pg.$('.familypage')), 'Manage family opens the family page');
  await shot('2b-family');
  await pg.click('.tvtab >> text=Play'); await onPlay(); await wait(600);

  console.log('\n2c. The end of My games: reachable with the keys, and the row slides to show it');
  await pg.keyboard.press('ArrowDown'); await wait(400);
  for (let i = 0; i < 14; i++){ await pg.keyboard.press('ArrowRight'); await wait(100); }
  await wait(800);
  const last = await pg.$eval('.pictile.kfocus .nm', e => e.textContent).catch(() => '(none)');
  check(last === 'Make a game', 'the keys reach the last tile: ' + last);
  const inView = await pg.$eval('.pictile.kfocus', e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; }).catch(() => false);
  check(inView, 'and it has slid into view');
  await shot('2c-end');
  await pg.keyboard.press('ArrowUp'); await wait(300);

  console.log('\n3. The corner menu: no Family; Exit exits at once');
  await pg.click('.burger'); await wait(500);
  const items = await pg.$$eval('.popitem .pn', e => e.map(x => x.textContent));
  check(!items.includes('Family') && items.includes('Settings') && items.includes('Exit'), 'the menu: ' + items.join(', '));
  await shot('3-menu');
  await pg.click('.popitem.exit'); await wait(500);
  check((await pg.evaluate(() => window.__closed)) === 1, 'one pick closes the app');
} catch (e){ check(false, e.message.split('\n')[0]); await shot('x-failed').catch(() => {}); }
check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close(); await s.close();
console.log(fail.length ? `\n${fail.length} PROBLEM(S)` : '\nALL GOOD');
process.exit(fail.length ? 1 : 0);
