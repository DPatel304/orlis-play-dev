// The setup rehearsal: someone at their own home, with nothing installed,
// from opening Orlis Play for the first time to playing their first game -
// the checklist doing each step with them.
//
//   NODE_PATH=$(npm root -g) node tools/rehearsal-setup.mjs http://localhost:5191/ <out-prefix>
//
// The server is a real one, seeing everyone as coming over Tailscale. The
// PC is pretend Windows: Tailscale and Claude Code start missing, and each
// install or sign-in "happens" a moment after its button's pressed; the
// share's accepted a few seconds after Tailscale's signed in.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.NODE_PATH ? process.env.NODE_PATH + '/' : import.meta.url);
const { chromium } = require('playwright');
const here = fileURLToPath(new URL('.', import.meta.url));
const { start } = await import(join(here, '../../server/src/app.js'));
const [appUrl, out] = process.argv.slice(2);

const fail = [];
const check = (ok, what) => { console.log((ok ? '  ✓ ' : '  ✗ ') + what); if (!ok) fail.push(what); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const s = await start({ dataDir: mkdtempSync(join(tmpdir(), 'orlis-setup-')), port: 47871, discoveryPort: 0, name: "The family's Orlis", tailscaleJoin: () => true });
const S = 'http://127.0.0.1:47871';
await fetch(S + '/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.com', password: 'correct horse', name: 'Owner', adult: true }) });

/* the PC: what's installed, signed in, accepted - and the game folders */
const pcState = { ts: 'missing', claude: false, accepted: false, asked: [] };
const TAURI = `window.__fs = {};
window.__TAURI__ = { core: { invoke: async (c, a) => {
  const pc = await window.__pc(c);
  if (c === 'setup_status') return { tailscale: { installed: pc.ts !== 'missing', state: pc.ts }, claude: { installed: pc.claude } };
  if (c === 'install_tailscale') return { how: 'winget' };
  if (c === 'tailscale_login') return { opened: true };
  if (c === 'install_claude') return null;
  if (c === 'find_servers') return pc.ts === 'on' && pc.accepted ? [{ url: '${S}', name: "The family's Orlis", via: 'tailscale' }] : [];
  if (c === 'games_list') return Object.entries(__fs).map(([folder, f]) => ({ folder, manifest: f['orlis.json'], changed: f.at }));
  if (c === 'game_make'){ let n = a.name, k = 2; while (__fs[n]) n = a.name + ' ' + k++; __fs[n] = { ...a.files, at: Date.now() }; return n; }
  if (c === 'game_write'){ Object.assign(__fs[a.folder], a.files); return null; }
  if (c === 'game_read') return { game: __fs[a.folder]['game.js'], manifest: __fs[a.folder]['orlis.json'] };
  if (c === 'claude_open') return pc.claude ? { opened: true } : { opened: false, missing: true };
  return null; } }, window: { getCurrentWindow: () => ({ close(){}, minimize(){}, toggleMaximize(){} }) } };`;
const FAKE = `window.__fakeOn = () => {
  const P = window.__pose; P.update = () => {}; P.mouse.active = false; let t = 0;
  setInterval(() => { t += 1 / 30;
    const p = P.players[0]; p.present = true; const cx = 0.5;
    const x = cx + Math.sin(t * 0.9) * 0.25, y = 0.4 + Math.sin(t * 0.63) * 0.3;
    const lm = Array.from({ length: 33 }, () => ({ x: cx, y: 0.6, v: 0.9 }));
    lm[15] = { x: x - 0.04, y: y + 0.03, v: 0.9 }; lm[16] = { x, y, v: 0.9 }; lm[11] = { x: cx + 0.06, y: 0.45, v: 0.9 }; lm[12] = { x: cx - 0.06, y: 0.45, v: 0.9 }; lm[0] = { x: cx, y: 0.35, v: 0.9 };
    p.lm = lm; p.centre = { x: cx, y: 0.6 }; p.scale = 0.3;
    p.hands.left = { x: x - 0.04, y: y + 0.03, vx: 0.4, vy: 0, speed: 0.4 }; p.hands.right = { x, y, vx: 0.4, vy: 0, speed: 0.4 };
    P.personCount = 1;
  }, 33);
};`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.exposeFunction('__pc', (cmd) => {
  pcState.asked.push(cmd);
  /* each button "works" a moment later */
  if (cmd === 'install_tailscale') setTimeout(() => { pcState.ts = 'signin'; }, 1500);
  if (cmd === 'tailscale_login') setTimeout(() => { pcState.ts = 'on'; setTimeout(() => { pcState.accepted = true; }, 6000); }, 1500);
  if (cmd === 'install_claude') setTimeout(() => { pcState.claude = true; }, 1500);
  return { ...pcState };
});
await ctx.addInitScript(TAURI + FAKE);
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => { if (!/sandboxed/.test(e.message)) errs.push(e.message); });
const shot = (n) => pg.screenshot({ path: `${out}-${n}.png` });
const steps = () => pg.$$eval('.setupstep', xs => xs.map(x => x.className.replace('setupstep ', '') + ':' + x.querySelector('b').textContent));
try {
  console.log('\n1. First time opening Orlis Play, at home, nothing installed');
  await pg.goto(appUrl + '?debug');
  await pg.waitForSelector('.setupstep', { timeout: 30000 }); await wait(1500);
  check((await steps()).join(' | ') === 'now:Install Tailscale | later:Sign in to Tailscale | later:Accept the share link you were sent', 'the checklist: ' + (await steps()).join(' | '));
  check(/same home Wi-Fi/.test(await pg.textContent('body')), 'it says none of it is needed on the same Wi-Fi');
  await shot('1-checklist');

  console.log('\n2. Install Tailscale');
  await pg.click('.setupstep .btn >> text=Install Tailscale');
  check(pcState.asked.includes('install_tailscale'), 'the installer was started');
  await wait(6500);
  check((await steps())[0] === 'done:Install Tailscale' && (await steps())[1] === 'now:Sign in to Tailscale', 'it ticks itself off, and sign in is next: ' + (await steps()).join(' | '));
  await shot('2-installed');

  console.log('\n3. Sign in to Tailscale');
  await pg.click('.setupstep .btn >> text=Sign in to Tailscale');
  await wait(6000);
  check((await steps())[2] === 'now:Accept the share link you were sent', 'waiting for the share: ' + (await steps()).join(' | '));
  await shot('3-share');

  console.log('\n4. They accept the share: it connects by itself');
  await pg.waitForSelector('text=Make an account', { timeout: 20000 });
  check(true, 'straight to making an account, no code');
  check(!(await pg.$('input[name=invite], label.field >> text=Invite code')), 'no invite box');
  await shot('4-account');
  const boxes = await pg.$$('form input'); const vals = ['raj@example.com', 'correct horse', 'Raj']; let k = 0;
  for (const i of boxes){ if ((await i.getAttribute('type')) === 'checkbox') await i.check(); else await i.fill(vals[k++]); }
  await pg.click('form .go');

  console.log('\n5. You\u2019re in - and straight on to making a game');
  await pg.waitForSelector('text=You\u2019re in!', { timeout: 15000 }); await wait(800);
  check(!(await pg.$('.setupstep')), 'no Claude Code setup (that\u2019s the Dev Kit)');
  await shot('5-in');
  await pg.click('.btn >> text=Make a game');
  await pg.waitForSelector('.reqpop', { timeout: 20000 }); await wait(600);
  check((await pg.textContent('.reqpop h2')).trim() === 'Make a game', 'Create opens on Make a game');
  await shot('6-make');

  console.log('\n6. Their first game, described and sent');
  await pg.click('.reqtile >> text=Surprise me'); await wait(500);
  check((await pg.textContent('.reqpop h2')).trim() === 'Ready?', 'everything picked for them');
  await shot('7-ready');
  await pg.click('.reqfoot .btn.go >> text=Send request');
  await pg.waitForSelector('.reqpop >> text=Sent!', { timeout: 8000 });
  await pg.click('.reqfoot .btn.go >> text=OK'); await wait(1200);
  const page = ((await pg.textContent('.createpage').catch(() => '')) || '').replace(/\s+/g, ' ');
  check(/Your games/.test(page) && /Asked/.test(page), 'it\u2019s in Your games: Asked');
  check(!/Dev Kit/.test(page), 'no Dev Kit for a new grown-up');
  await shot('8-asked');
  check(!errs.length, 'no errors: ' + JSON.stringify(errs));
} catch (e){ fail.push(e.message); console.log('  ✗ ' + e.message); await shot('x-failed').catch(() => {}); }
await b.close(); await s.close();
console.log(fail.length ? `\n${fail.length} PROBLEM(S)` : '\nALL GOOD');
process.exit(fail.length ? 1 : 0);
