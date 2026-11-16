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
  await pg.goto(appUrl + '?debug');
  await pg.waitForSelector('text=Can’t reach your Orlis server', { timeout: 30000 });
  check(true, 'it says it can’t reach the server, plainly');
  seenText.push(await body());
  await shot('1-offline');

  console.log('\n2. Back online: it finds the server by itself - nothing to type');
  net.online = true;
  await pg.waitForSelector('text=Make an account', { timeout: 20000 });
  check(true, 'found it on its own, straight to Make an account');
  check(!(await pg.$('label >> text=Invite code')), 'no invite code');
  seenText.push(await body());
  await shot('2-account');
  const boxes = await pg.$$('form input'); const vals = ['sam@example.com', 'correct horse', 'Sam']; let k = 0;
  for (const i of boxes){ if ((await i.getAttribute('type')) === 'checkbox') await i.check(); else await i.fill(vals[k++]); }
  await pg.click('form .go');

  console.log('\n3. Waiting for the owner');
  await pg.waitForSelector('text=Almost there!', { timeout: 15000 });
  check(true, 'Almost there! - waiting for the owner');
  seenText.push(await body());
  await shot('3-waiting');
  const joins = (await api('GET', '/api/joins', null, M)).joins;
  check(joins.length === 1 && joins[0].email === 'sam@example.com', 'the owner sees them waiting');

  console.log('\n4. The owner lets them in: the app moves on by itself');
  await api('POST', `/api/joins/${joins[0].id}/approve`, null, M);
  await pg.waitForSelector('text=You’re in!', { timeout: 15000 });
  check(true, 'You’re in!');
  await shot('4-in');

  console.log('\n5. Their first game');
  await pg.click('.btn >> text=Make a game');
  await pg.waitForSelector('.reqpop', { timeout: 20000 }); await wait(600);
  check((await pg.textContent('.reqpop h2')).trim() === 'Make a game', 'Create opens on Make a game');
  await pg.click('.reqtile >> text=Surprise me'); await wait(500);
  await pg.click('.reqfoot .btn.go >> text=Send request');
  await pg.waitForSelector('.reqpop >> text=Sent!', { timeout: 8000 });
  await pg.click('.reqfoot .btn.go >> text=OK'); await wait(1200);
  const page = await body();
  check(/Your games/.test(page) && /Asked/.test(page), 'it’s in Your games: Asked');
  await shot('5-asked');

  check(!seenText.some(t => /Tailscale/i.test(t)), 'no mention of Tailscale anywhere in setup');
  check(!errs.length, 'no errors: ' + JSON.stringify(errs));
} catch (e){ fail.push(e.message); console.log('  ✗ ' + e.message); await shot('x-failed').catch(() => {}); }
await b.close(); await s.close();
console.log(fail.length ? `\n${fail.length} PROBLEM(S)` : '\nALL GOOD');
process.exit(fail.length ? 1 : 0);
