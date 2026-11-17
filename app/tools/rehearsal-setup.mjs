// The setup rehearsal: someone at their own home opens Orlis Play for the
// first time. It finds the family's server on the internet by itself (its
// address is built in - home-server.js), they make an account (no code),
// wait for the owner's OK, and go straight on to making their first game.
// No Tailscale anywhere.
//
//   NODE_PATH=$(npm root -g) node tools/rehearsal-setup.mjs http://localhost:5191/ <out-prefix>
//
// The server is a real one, on this machine; requests to the built-in
// internet address are handed to it. The PC is pretend Windows, and starts
// offline, to see the app keep trying by itself.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.NODE_PATH ? process.env.NODE_PATH + '/' : import.meta.url);
const { chromium } = require('playwright');
const here = fileURLToPath(new URL('.', import.meta.url));
const { start } = await import(join(here, '../../server/src/app.js'));
const { HOME_SERVER } = await import(join(here, '../src/ui/home-server.js'));
const [appUrl, out] = process.argv.slice(2);

const fail = [];
const check = (ok, what) => { console.log((ok ? '  ✓ ' : '  ✗ ') + what); if (!ok) fail.push(what); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

/* (one page: Play, Discover and Create are reached from the corner menu) */
const goTo = async (pg, t) => { await pg.keyboard.press('Escape').catch(() => {}); const it = await pg.$(`.tvtab:not(.on) >> text="${t}"`); if (it) await it.click(); };
const menuItems = async (pg) => pg.$$eval('.tvtab', e => e.map(x => x.textContent));
const s = await start({ dataDir: mkdtempSync(join(tmpdir(), 'orlis-setup-')), port: 47871, discoveryPort: 0, name: "The family's Orlis", approveJoins: true, tailscaleJoin: () => false, internetPort: 0 });
const S = 'http://127.0.0.1:47871', DOOR = `http://127.0.0.1:${s.internetPort}`;
const api = async (m, p, b, extra = {}) => { const r = await fetch(S + p, { method: m, headers: { 'Content-Type': 'application/json', ...extra }, body: b ? JSON.stringify(b) : undefined }); return r.json(); };
await api('POST', '/api/signup', { email: 'owner@example.com', password: 'correct horse', name: 'Owner', adult: true });
const M = { 'X-Orlis-Manage': s.manageKey };

/* the PC: nothing on its Wi-Fi; online or not */
const net = { online: false };
const TAURI = `window.__TAURI__ = { core: { invoke: async (c) => {
  if (c === 'find_servers') return [];
  if (c === 'setup_status') return { tailscale: { installed: false, state: 'missing' }, claude: { installed: false, signedIn: false } };
  if (c === 'games_list') return [];
  return null; } }, window: { getCurrentWindow: () => ({ close(){}, minimize(){}, toggleMaximize(){} }) } };`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
/* the family's address on the internet: handed to the server's internet door (as Funnel does) */
await ctx.route(HOME_SERVER + '/**', async (route) => {
  if (!net.online) return route.abort('internetdisconnected');
  const req = route.request(), u = new URL(req.url());
  try {
    const r = await fetch(DOOR + u.pathname + u.search, { method: req.method(), headers: req.headers(), body: req.postDataBuffer() || undefined });
    await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) });
  } catch { route.abort(); }
});
await ctx.addInitScript(TAURI);
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => { if (!/sandboxed/.test(e.message)) errs.push(e.message); });
const shot = (n) => pg.screenshot({ path: `${out}-${n}.png` });
const body = async () => ((await pg.textContent('body').catch(() => '')) || '').replace(/\s+/g, ' ');
const seenText = [];
try {
  console.log('\n1. First time opening Orlis Play, at home - offline just now');
  await pg.goto(appUrl + '?debug&splash=0&fx=0');
  await pg.waitForSelector('text=Can’t reach your Orlis server', { timeout: 30000 });
  check(true, 'it says it can’t reach the server, plainly');
  seenText.push(await body());
  await shot('1-offline');

  console.log('\n2. Back online: it finds the server by itself - nothing to type');
  net.online = true;
  await pg.waitForSelector('.getin', { timeout: 20000 });
  check(true, 'found it on its own');
  check((await pg.$$('form input:not([type=hidden])')).length === 1, 'just one box: their email');
  await shot('2-email');
  await pg.fill('form input[type=email]', 'sam@example.com');
  await pg.click('form .go');
  await pg.waitForSelector('text=Make an account', { timeout: 10000 });
  check((await body()).includes('sam@example.com'), 'a new email: Make an account, for sam@example.com');
  check(!(await pg.$('label >> text=Invite code')), 'no invite code');
  const labels = (await pg.$$eval('form label', ls => ls.map(l => l.textContent.trim()))).join(' | ');
  check(/Username/.test(labels) && !(await pg.$('form input[type=checkbox]')), 'Username, and no tick box: ' + labels);
  check(/For grown-ups \(18\+\)/.test(await pg.textContent('.acctcard')), 'For grown-ups (18+).');
  seenText.push(await body());
  await shot('2-account');
  const boxes = await pg.$$('form input:not([type=hidden])'); const vals = ['correct horse', 'Sam']; let k = 0;
  for (const i of boxes){ if ((await i.getAttribute('type')) === 'checkbox') await i.check(); else await i.fill(vals[k++]); }
  await pg.click('form .go');

  console.log('\n3. Straight in to play, while the owner hasn\u2019t said yes yet');
  await pg.waitForSelector('.tvtop', { timeout: 20000 }); await wait(1500);
  seenText.push(await body());
  const joins = (await api('GET', '/api/joins', null, M)).joins;
  check(joins.length === 1 && joins[0].email === 'sam@example.com' && joins[0].name === 'Sam', 'the owner sees them waiting (username Sam)');

  console.log('\n4. Two starter games, nothing else');
  const home = await body();
  check(['Pop Party', 'Sky Painter'].every(n => home.includes(n)), 'Home has Pop Party and Sky Painter');
  check(!['Sleepy Bear', 'Leaf Pile', 'Stack It High', 'Last Known Position'].some(n => home.includes(n)), 'and only those, for now');
  await shot('4-starters');
  await goTo(pg, 'Discover'); await wait(1200);
  check((await body()).includes('Pending account approval'), 'the Store: Pending account approval');
  await goTo(pg, 'Create'); await wait(1200);
  check((await body()).includes('Pending account approval'), 'Create: the same');
  await shot('4-create-pending');
  await goTo(pg, 'Play'); await wait(1200);

  console.log('\n5. The owner lets them in: it says so, and everything opens');
  await api('POST', `/api/joins/${joins[0].id}/approve`, null, M);
  await pg.waitForSelector('.toast', { timeout: 25000 });
  check((await pg.textContent('.toast')).includes('You\u2019re in!'), 'You\u2019re in! Discover and Create are open.');
  await wait(1500);
  const after = await body();
  check(after.includes('Leaf Pile'), 'Home has all the games now');
  await shot('5-in');
  await goTo(pg, 'Create'); await wait(1500);

  console.log('\n6. Their first game');
  await pg.click('.sbtn >> text=Make a game');
  await pg.waitForSelector('.builder', { timeout: 20000 }); await wait(600);
  check((await pg.textContent('.builder .bwhere')).trim() === 'Make a game', 'Create opens on Make a game');
  await pg.click('.reqtile >> text=Surprise me'); await wait(500);
  await pg.click('.reqfoot .btn.go >> text=Send request');
  await pg.waitForSelector('.builder >> text=Sent!', { timeout: 8000 });
  await pg.click('.reqfoot .btn.go >> text=OK'); await wait(1200);
  const page = await body();
  check(/Your games/.test(page) && /Asked/.test(page), 'it’s in Your games: Asked');
  await shot('5-asked');

  console.log('\n7. Signed out, and back: an email with an account asks for its password');
  await pg.keyboard.press('Escape').catch(() => {});
  await pg.click('.burger'); await wait(500);
  await pg.click('.popitem >> text=Sign out');
  await pg.waitForSelector('.getin', { timeout: 20000 });
  await pg.fill('form input[type=email]', 'Sam@Example.com');
  await pg.click('form .go');
  await pg.waitForSelector('text=Welcome back', { timeout: 10000 });
  check((await pg.$$('form input:not([type=hidden])')).length === 1, 'Welcome back - just the password');
  await shot('7-welcome-back');
  await pg.fill('form input[type=password]', 'correct horse');
  await pg.click('form .go');
  await pg.waitForSelector('.tvtop', { timeout: 20000 });
  check(true, 'signed in, back to Home');

  check(!seenText.some(t => /Tailscale/i.test(t)), 'no mention of Tailscale anywhere in setup');
  check(!errs.length, 'no errors: ' + JSON.stringify(errs));
} catch (e){ fail.push(e.message); console.log('  ✗ ' + e.message); await shot('x-failed').catch(() => {}); }
await b.close(); await s.close();
console.log(fail.length ? `\n${fail.length} PROBLEM(S)` : '\nALL GOOD');
process.exit(fail.length ? 1 : 0);
