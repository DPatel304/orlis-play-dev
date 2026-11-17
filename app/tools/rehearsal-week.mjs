// The weekly rehearsal: Play's "Featured this week" (games from Discover,
// with Get) and the family challenges, against a real server.
//
//   NODE_PATH=$(npm root -g) node tools/rehearsal-week.mjs http://localhost:5191/ <out-prefix>
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

const s = await start({ dataDir: mkdtempSync(join(tmpdir(), 'orlis-week-')), port: 0, discoveryPort: false, starters, tailscaleJoin: () => true });
const S = `http://127.0.0.1:${s.port}`;
const api = async (m, p, b, tok, extra = {}) => { const r = await fetch(S + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...extra }, body: b ? JSON.stringify(b) : undefined }); return r.json(); };
const me = await api('POST', '/api/signup', { email: 'deep@example.com', password: 'correct horse', name: 'Deep', adult: true });
/* (three different games already played this week: the round in the test makes the fourth, and finishes a challenge) */
for (const g of ['pop-party', 'sky-painter', 'leaf-pile']) await api('POST', '/api/plays', { gameId: g, value: 10, secs: 60, players: 1 }, me.token);
const state = { server: { url: S, name: 'Orlis' }, token: me.token, account: me.account, household: me.household, profiles: me.profiles, current: me.profiles[0].id };
const TAURI = `window.__TAURI__ = { core: { invoke: async (c) => c === 'find_servers' ? [] : null }, window: { getCurrentWindow: () => ({ close(){}, minimize(){}, toggleMaximize(){} }) } };`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
await ctx.route(/\.ts\.net\//, r => r.abort());
await ctx.addInitScript(TAURI + `try { if (!localStorage.getItem('orlis.account')) localStorage.setItem('orlis.account', ${JSON.stringify(JSON.stringify(state))}); } catch {}`);
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => { if (!/sandboxed/.test(e.message)) errs.push(e.message); });
const shot = (n) => pg.screenshot({ path: `${out}-${n}.png` });
const titles = () => pg.$$eval('.shelf h3', e => e.map(x => x.firstChild.textContent));
try {
  console.log('\n1. Play: this week\'s featured from Discover, and the challenges');
  await pg.goto(appUrl + '?debug');
  /* the challenges come up first, as three big cards */
  await pg.waitForSelector('.chsplash .chbig', { timeout: 20000 });
  const big = await pg.$$eval('.chbig', e => e.map(x => x.querySelector('.chtt').textContent + ' ' + x.querySelector('.chft span').textContent));
  check(big.length === 3, 'three big challenge cards on arriving: ' + big.join(' / '));
  await wait(900); await shot('1a-cards');
  await pg.keyboard.press('Space'); await wait(1500);
  check(!(await pg.$('.chsplash')), 'any key skips them: they fly away');
  const pill = (await pg.$eval('.chpill', e => e.textContent).catch(() => '')).replace(/\s+/g, ' ').trim();
  check(/0 of 3/.test(pill), 'and settle into a pill by the name: ' + pill);
  check(await pg.$('.shelf.challenges') === null, 'the challenges row is gone from the page');
  await pg.click('.chpill'); await pg.waitForSelector('.chsplash .chbig', { timeout: 5000 });
  check(true, 'the pill shows them again');
  await pg.keyboard.press('Escape'); await wait(1500);
  check(!(await pg.$('.chsplash')), 'Escape closes them');
  await pg.waitForSelector('.screen.tvhome .slock', { timeout: 15000 });
  await pg.waitForFunction(() => [...document.querySelectorAll('.shelf h3')].some(h => /Featured this week/.test(h.textContent)), null, { timeout: 15000 });
  await wait(800);
  const t1 = await titles();
  check(t1.includes('Featured this week') && t1.includes('My games') && !t1.some(t => /challenges/.test(t)), 'the page: ' + t1.join(' | '));
  const feat = await pg.$$eval('.shelf', secs => { const s = secs.find(x => /Featured this week/.test(x.querySelector('h3').textContent)); return [...s.querySelectorAll('.slock:not(.pictile)')].map(c => ({ name: c.querySelector('.nm').textContent, get: !!c.querySelector('.getpill') })); });
  check(feat.length === 3 && feat.every(f => f.get), 'the three Discover games, each with Get: ' + feat.map(f => f.name).join(', '));
  check(await pg.$('.shelf h3 .rowlink') === null, 'no Discover link in the Featured heading');
  check(await pg.$('.shelf.fr .slock.discovertile') !== null, 'the Discover tile ends the Featured row');
  const chip = await pg.$eval('.discovertile .newchip', e => e.textContent).catch(() => '');
  check(/^\d+ (new this week|to get)$/.test(chip), 'with its count: ' + chip);
  check(await pg.$('.shelf.fr .btn.slock >> nth=0') !== null && (await pg.$eval('.shelf.fr .btn.slock', e => e.getBoundingClientRect().width)) > 300, 'and the Featured tiles are big');
  await shot('1-play');
  await pg.click('.discovertile'); await wait(1500);
  check(await pg.$('.tvtab.on >> text=Discover') !== null, 'the tile goes to Discover');
  await pg.click('.tvtab >> text=Play'); await pg.waitForSelector('.screen.tvhome .slock', { timeout: 15000 }); await wait(1500);

  console.log('\n2. Get one from Featured: it downloads and starts');
  await pg.click('.slock:has(.getpill) >> nth=0');
  await pg.waitForFunction(() => window.__round && window.__round(), null, { timeout: 30000 });
  check(true, 'it started');
  await wait(2500); await shot('2-playing');

  console.log('\n3. The round ends: told to the server; the challenge moves on');
  await pg.evaluate(() => window.__finish());
  /* (its ending plays, then the scores) */
  await pg.waitForFunction(() => [...document.querySelectorAll('.btn')].some(x => /All games/.test(x.textContent)), null, { timeout: 30000 });
  await shot('3-results');
  await pg.waitForFunction(() => /Challenge done: Play 4 different games/.test((document.querySelector('.toast') || {}).textContent || ''), null, { timeout: 12000 });
  check(true, 'a toast says so: ' + (await pg.textContent('.toast')).trim());
  await wait(1000);
  const plays = await api('GET', '/api/challenges', null, me.token);
  check(plays.challenges.find(c => c.kind === 'different').have >= 1, 'the round counted (Play 4 different games: ' + plays.challenges.find(c => c.kind === 'different').have + ')');
  await pg.evaluate(() => { const b = [...document.querySelectorAll('.btn')].find(x => /All games/.test(x.textContent)); b && b.click(); });
  await pg.waitForSelector('.screen.tvhome .slock', { timeout: 15000 }); await wait(2500);
  const feat2 = await pg.$$eval('.shelf', secs => { const s = secs.find(x => /Featured this week/.test(x.querySelector('h3').textContent)); return s ? [...s.querySelectorAll('.slock')].filter(c => c.querySelector('.getpill')).length : -1; });
  check(feat2 === 2, 'back on Play: that one\'s here now (no Get), two still to get');
  const t3 = await titles();
  check(t3[0] === 'Jump back in', 'and Jump back in has it');
  check((await pg.$eval('.shelf .slock .nm', e => e.textContent)) === 'Bubble Dash', 'by its own name');
  await shot('3-after');
} catch (e){ check(false, e.message.split('\n')[0]); await shot('x-failed').catch(() => {}); }
check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close(); await s.close();
console.log(fail.length ? `\n${fail.length} PROBLEM(S)` : '\nALL GOOD');
process.exit(fail.length ? 1 : 0);
